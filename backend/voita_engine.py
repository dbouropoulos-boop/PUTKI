"""
PUTKI HQ — Voita (guess-the-winner raffle) engine.

Sako-approved mechanic, GDPR Article 7(4) compliant entry flow.

Data model (Mongo collections)
------------------------------
`voita_raffles`
    Per-raffle definition.
    {
      id, slug, title_fi, title_en, summary_fi, summary_en,
      sport, league,
      home_team, away_team,
      kickoff_at,                 # ISO. entry_close_at defaults to this.
      entries_close_at,
      prize_cap_eur,              # hard guard, <= 500 enforced server-side
      prize_distribution: {
          mode: "single" | "tiered",
          payouts: [
              {position: 1, amount_eur: 300, type: "cash"|"credit"|"merch",
               note: "..."},
              ...
          ],
      },
      scoring: {
          one_x_two_points: 3,
          exact_score_points: 5,
          goal_diff_points: 3,
          total_goals_points: 1,
          # Score-variant points are best-of, not stackable.
      },
      gating: {
          rules_url_set: bool,
          prize_distribution_locked: bool,
          match_populated: bool,
      },
      result: None | {
          home_goals, away_goals, one_x_two,    # finalized result
          drawn_at, drawn_by, winners: [...],   # populated by draw_raffle()
      },
      status: "draft" | "open" | "closed" | "drawn" | "archived",
      created_at, updated_at,
    }

`voita_entries`
    Per-entrant submission for a single raffle.
    Legal basis: legitimate-interest (contest administration).
    Retained until winner + 30d, auto-deleted unless marketing opt-in.
    {
      id, raffle_id, email_lower, email_hash, prediction_one_x_two,
      predicted_home_goals, predicted_away_goals,
      rules_accepted: True,
      consent_tag: "game_raffle",
      raffle_legal_basis: "legitimate_interest_contest_admin",
      retention_until,           # ISO; computed from raffle kickoff + 30d
      score: None | int,         # populated when raffle is drawn
      created_at, ip_hash, ua_hash,
    }

Audit trail
-----------
- Every entry writes a `raffle_entry` row to `audit_log`.
- Every separately-given marketing consent on the confirmation page
  writes its own `consent_given` row to `audit_log` AND its own row to
  `optin_consents` (existing collection). Different legal basis, separate
  timestamp — survives a DPO inquiry.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

DEFAULT_SCORING = {
    "one_x_two_points": 3,
    "exact_score_points": 5,
    "goal_diff_points": 3,
    "total_goals_points": 1,
}
DEFAULT_PRIZE_CAP_EUR = 500
PAYOUT_TYPES = {"cash", "credit", "merch"}
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
ENTRY_RETENTION_DAYS_AFTER_KICKOFF = 30


# ── Indexes ──────────────────────────────────────────────────────────────

async def ensure_indexes(db) -> None:
    try:
        await db.voita_raffles.create_index("slug", unique=True)
        await db.voita_raffles.create_index([("status", 1), ("entries_close_at", 1)])
        await db.voita_entries.create_index([("raffle_id", 1), ("email_lower", 1)], unique=True)
        await db.voita_entries.create_index("retention_until")
    except Exception:
        logger.exception("voita_engine.ensure_indexes failed")


# ── Helpers ──────────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash(value: str, salt: str = "putki-voita") -> str:
    return hashlib.sha256(f"{salt}:{value}".encode("utf-8")).hexdigest()[:32]


def _coerce_payouts(payouts: List[Dict[str, Any]], prize_cap_eur: int) -> List[Dict[str, Any]]:
    """Validate the prize distribution. Raises ValueError on any issue."""
    if not payouts:
        raise ValueError("prize_distribution.payouts must contain at least one row")
    seen_positions: set = set()
    total = 0
    cleaned: List[Dict[str, Any]] = []
    for row in payouts:
        try:
            pos = int(row.get("position"))
            amount = int(row.get("amount_eur"))
        except (TypeError, ValueError) as exc:
            raise ValueError(f"payout row missing/invalid position or amount_eur: {row}") from exc
        if pos < 1:
            raise ValueError(f"position must be >= 1 (got {pos})")
        if pos in seen_positions:
            raise ValueError(f"duplicate payout position: {pos}")
        seen_positions.add(pos)
        if amount < 0:
            raise ValueError(f"amount_eur must be >= 0 (got {amount})")
        ptype = (row.get("type") or "cash").lower()
        if ptype not in PAYOUT_TYPES:
            raise ValueError(f"payout type must be one of {PAYOUT_TYPES} (got {ptype})")
        total += amount
        cleaned.append({
            "position": pos, "amount_eur": amount, "type": ptype,
            "note": (row.get("note") or "")[:240],
        })
    if total > prize_cap_eur:
        raise ValueError(f"total payouts {total}€ exceed prize cap {prize_cap_eur}€")
    cleaned.sort(key=lambda r: r["position"])
    return cleaned


def _coerce_slug(slug: str) -> str:
    slug = (slug or "").strip().lower()
    if not slug or not SLUG_RE.match(slug):
        raise ValueError("slug must be kebab-case lowercase alphanumeric")
    return slug


def _sanitize_display_name(raw: str) -> str:
    """Optional self-chosen display name shown on the recent-winners
    strip. Aggressively bounded: 40 chars max, strips control chars +
    HTML angle brackets. Empty / missing is fine — strip falls back to
    the masked email."""
    if not raw:
        return ""
    cleaned = "".join(c for c in str(raw) if c.isprintable())
    cleaned = cleaned.replace("<", "").replace(">", "").strip()
    return cleaned[:40]


def _public_raffle_view(d: Dict[str, Any]) -> Dict[str, Any]:
    """Strip ObjectId + redact admin-only fields for public reads."""
    gating = d.get("gating") or {}
    return {
        "id": d.get("id"),
        "slug": d.get("slug"),
        "title_fi": d.get("title_fi"),
        "title_en": d.get("title_en"),
        "summary_fi": d.get("summary_fi"),
        "summary_en": d.get("summary_en"),
        "sport": d.get("sport"),
        "league": d.get("league"),
        "home_team": d.get("home_team"),
        "away_team": d.get("away_team"),
        "kickoff_at": d.get("kickoff_at"),
        "entries_close_at": d.get("entries_close_at"),
        "image_url": d.get("image_url"),
        "prize_cap_eur": d.get("prize_cap_eur") or DEFAULT_PRIZE_CAP_EUR,
        "prize_distribution": d.get("prize_distribution") or {},
        "scoring": d.get("scoring") or DEFAULT_SCORING,
        "gating": {
            "rules_url_set": bool(gating.get("rules_url_set")),
            "prize_distribution_locked": bool(gating.get("prize_distribution_locked")),
            "match_populated": bool(gating.get("match_populated")),
        },
        "status": d.get("status"),
        "result": d.get("result") or None,
        "entries_count": d.get("entries_count") or 0,
        "editorial_pick": d.get("editorial_pick") or None,
        "seeded": bool(d.get("seeded")),
    }


def _is_publicly_visible(d: Dict[str, Any]) -> bool:
    """All three gates plus the global feature flag must be true for a
    raffle to surface on the public listing."""
    gating = d.get("gating") or {}
    return (
        bool(gating.get("rules_url_set"))
        and bool(gating.get("prize_distribution_locked"))
        and bool(gating.get("match_populated"))
        and d.get("status") in ("open", "closed", "drawn", "paid")
    )


# ── Raffle CRUD (admin) ──────────────────────────────────────────────────

async def create_raffle(db, payload: Dict[str, Any]) -> Dict[str, Any]:
    slug = _coerce_slug(payload.get("slug") or "")
    existing = await db.voita_raffles.find_one({"slug": slug}, {"_id": 1})
    if existing:
        raise ValueError(f"raffle with slug '{slug}' already exists")

    prize_cap = int(payload.get("prize_cap_eur") or DEFAULT_PRIZE_CAP_EUR)
    if prize_cap < 0 or prize_cap > DEFAULT_PRIZE_CAP_EUR:
        raise ValueError(f"prize_cap_eur must be 0..{DEFAULT_PRIZE_CAP_EUR}")

    distribution = payload.get("prize_distribution") or {}
    payouts_raw = distribution.get("payouts") or []
    payouts = _coerce_payouts(payouts_raw, prize_cap) if payouts_raw else []
    mode = (distribution.get("mode") or ("single" if len(payouts) <= 1 else "tiered")).lower()
    if mode not in {"single", "tiered"}:
        raise ValueError("prize_distribution.mode must be 'single' or 'tiered'")

    scoring = {**DEFAULT_SCORING, **(payload.get("scoring") or {})}
    for k, v in scoring.items():
        try:
            scoring[k] = int(v)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"scoring.{k} must be int") from exc
        if scoring[k] < 0:
            raise ValueError(f"scoring.{k} must be >= 0")

    doc = {
        "id": uuid.uuid4().hex,
        "slug": slug,
        "title_fi": (payload.get("title_fi") or "").strip()[:240],
        "title_en": (payload.get("title_en") or "").strip()[:240],
        "summary_fi": (payload.get("summary_fi") or "").strip()[:1200],
        "summary_en": (payload.get("summary_en") or "").strip()[:1200],
        "sport": (payload.get("sport") or "").strip()[:48],
        "league": (payload.get("league") or "").strip()[:120],
        "home_team": (payload.get("home_team") or "").strip()[:120],
        "away_team": (payload.get("away_team") or "").strip()[:120],
        "kickoff_at": payload.get("kickoff_at"),
        "entries_close_at": payload.get("entries_close_at") or payload.get("kickoff_at"),
        "image_url": (payload.get("image_url") or "").strip()[:400] or None,
        "prize_cap_eur": prize_cap,
        "prize_distribution": {"mode": mode, "payouts": payouts},
        "scoring": scoring,
        "gating": {
            "rules_url_set": bool(payload.get("rules_url_set")),
            "prize_distribution_locked": False,
            "match_populated": bool(
                payload.get("home_team") and payload.get("away_team")
                and payload.get("kickoff_at")
            ),
        },
        "result": None,
        "status": "draft",
        "entries_count": 0,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.voita_raffles.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_raffle(db, raffle_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
    """Selective patch. Refuses to mutate fields once a raffle reaches
    `drawn` status — the audit trail must be immutable after the draw."""
    existing = await db.voita_raffles.find_one({"id": raffle_id}, {"_id": 0})
    if not existing:
        raise ValueError(f"raffle {raffle_id} not found")
    if existing.get("status") in {"drawn", "paid"}:
        raise ValueError("raffle is drawn/paid — no further edits permitted")

    update: Dict[str, Any] = {"updated_at": _now_iso()}

    for key in ("title_fi", "title_en", "summary_fi", "summary_en",
                 "sport", "league", "home_team", "away_team",
                 "kickoff_at", "entries_close_at", "image_url"):
        if key in patch and patch[key] is not None:
            update[key] = patch[key]

    if "prize_cap_eur" in patch:
        cap = int(patch["prize_cap_eur"])
        if cap < 0 or cap > DEFAULT_PRIZE_CAP_EUR:
            raise ValueError(f"prize_cap_eur must be 0..{DEFAULT_PRIZE_CAP_EUR}")
        update["prize_cap_eur"] = cap

    if "prize_distribution" in patch and patch["prize_distribution"] is not None:
        cap = update.get("prize_cap_eur") or existing.get("prize_cap_eur") or DEFAULT_PRIZE_CAP_EUR
        payouts_raw = (patch["prize_distribution"] or {}).get("payouts") or []
        payouts = _coerce_payouts(payouts_raw, cap)
        mode = ((patch["prize_distribution"] or {}).get("mode")
                or ("single" if len(payouts) <= 1 else "tiered")).lower()
        if mode not in {"single", "tiered"}:
            raise ValueError("prize_distribution.mode must be 'single' or 'tiered'")
        update["prize_distribution"] = {"mode": mode, "payouts": payouts}

    if "scoring" in patch and patch["scoring"] is not None:
        scoring = {**existing.get("scoring", DEFAULT_SCORING), **patch["scoring"]}
        for k in DEFAULT_SCORING:
            scoring[k] = int(scoring.get(k, DEFAULT_SCORING[k]))
            if scoring[k] < 0:
                raise ValueError(f"scoring.{k} must be >= 0")
        update["scoring"] = scoring

    # Editorial pick — admin-only, optional. Surfaced on the public
    # match-context endpoint so the quiz `mode_with_editorial` variant
    # can show the toimitus pick alongside bookmaker consensus.
    if "editorial_pick" in patch and patch["editorial_pick"] is not None:
        ep = patch["editorial_pick"]
        if isinstance(ep, dict):
            cleaned = {
                "one_x_two": str(ep.get("one_x_two") or "").upper()[:1] if ep.get("one_x_two") in ("1", "X", "2") else None,
                "predicted_home_goals": int(ep["predicted_home_goals"]) if ep.get("predicted_home_goals") not in (None, "") else None,
                "predicted_away_goals": int(ep["predicted_away_goals"]) if ep.get("predicted_away_goals") not in (None, "") else None,
                "rationale_fi": (ep.get("rationale_fi") or "").strip()[:400] or None,
                "rationale_en": (ep.get("rationale_en") or "").strip()[:400] or None,
                "author": (ep.get("author") or "").strip()[:80] or None,
                "updated_at": _now_iso(),
            }
            update["editorial_pick"] = cleaned

    gating_patch = patch.get("gating") or {}
    if gating_patch:
        gating = dict(existing.get("gating") or {})
        # match_populated is auto-derived from team + kickoff fields; admins
        # cannot toggle it manually. Only the two human gates are writable.
        for k in ("rules_url_set", "prize_distribution_locked"):
            if k in gating_patch:
                gating[k] = bool(gating_patch[k])
        update["gating"] = gating

    # Always recompute match_populated from the post-patch field values.
    post_home = update.get("home_team", existing.get("home_team"))
    post_away = update.get("away_team", existing.get("away_team"))
    post_kickoff = update.get("kickoff_at", existing.get("kickoff_at"))
    auto_match = bool(post_home and post_away and post_kickoff)
    gating_final = dict(update.get("gating") or existing.get("gating") or {})
    gating_final["match_populated"] = auto_match
    update["gating"] = gating_final

    if "status" in patch:
        new_status = (patch["status"] or "").lower()
        if new_status not in {"draft", "open", "closed", "archived"}:
            raise ValueError("status must be draft|open|closed|archived (drawn set via /draw, paid via /mark-paid)")
        update["status"] = new_status

    await db.voita_raffles.update_one({"id": raffle_id}, {"$set": update})
    doc = await db.voita_raffles.find_one({"id": raffle_id}, {"_id": 0})
    return doc


async def delete_raffle(db, raffle_id: str) -> Dict[str, Any]:
    existing = await db.voita_raffles.find_one({"id": raffle_id}, {"_id": 0})
    if not existing:
        raise ValueError(f"raffle {raffle_id} not found")
    if existing.get("status") in {"drawn", "paid"}:
        raise ValueError("raffle is drawn/paid — cannot delete (use status='archived' instead)")
    await db.voita_raffles.delete_one({"id": raffle_id})
    # Also drop entries that belonged to it.
    await db.voita_entries.delete_many({"raffle_id": raffle_id})
    return {"deleted": True, "id": raffle_id}


async def list_raffles_admin(db) -> List[Dict[str, Any]]:
    cur = db.voita_raffles.find({}, {"_id": 0}).sort([("created_at", -1)])
    return [d async for d in cur]


async def list_raffles_public(db) -> List[Dict[str, Any]]:
    cur = db.voita_raffles.find({}, {"_id": 0})
    out: List[Dict[str, Any]] = []
    async for d in cur:
        if _is_publicly_visible(d):
            out.append(_public_raffle_view(d))
    out.sort(key=lambda r: (r.get("kickoff_at") or ""), reverse=False)
    return out


async def get_raffle_public(db, slug: str) -> Optional[Dict[str, Any]]:
    d = await db.voita_raffles.find_one({"slug": slug}, {"_id": 0})
    if not d:
        return None
    if not _is_publicly_visible(d):
        return None
    return _public_raffle_view(d)


# ── Entry capture ────────────────────────────────────────────────────────

async def submit_entry(
    db, *, slug: str, email: str, prediction_one_x_two: str,
    predicted_home_goals: int, predicted_away_goals: int,
    rules_accepted: bool, display_name: str = "",
    confidence: Optional[int] = None,
    contact_channel: Optional[str] = None,
    pending_id: Optional[str] = None,
    ip: str = "", ua: str = "",
) -> Dict[str, Any]:
    """Step 1 — raffle entry. Captures the minimum required for contest
    administration under legitimate-interest basis. NO marketing consent
    is bundled here — that's Step 2 on the confirmation page."""
    email = (email or "").strip().lower()
    if not EMAIL_RE.match(email):
        raise ValueError("invalid email")
    if not rules_accepted:
        raise ValueError("rules must be accepted to enter")
    if prediction_one_x_two not in {"1", "X", "x", "2"}:
        raise ValueError("prediction must be one of '1' | 'X' | '2'")
    try:
        ph = int(predicted_home_goals)
        pa = int(predicted_away_goals)
    except (TypeError, ValueError) as exc:
        raise ValueError("predicted_home_goals / predicted_away_goals must be integers") from exc
    if ph < 0 or pa < 0 or ph > 50 or pa > 50:
        raise ValueError("predicted goals must be between 0 and 50")

    raffle = await db.voita_raffles.find_one({"slug": slug}, {"_id": 0})
    if not raffle:
        raise ValueError("raffle not found")
    if not _is_publicly_visible(raffle):
        raise ValueError("raffle not currently open")
    if raffle.get("status") not in {"open"}:
        # Only "open" status accepts entries. "closed" / "drawn" reject.
        raise ValueError(f"raffle status is {raffle.get('status')}; not accepting entries")

    close_at = raffle.get("entries_close_at")
    if close_at:
        try:
            close_dt = datetime.fromisoformat(close_at.replace("Z", "+00:00"))
            if close_dt.tzinfo is None:
                close_dt = close_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > close_dt:
                raise ValueError("entries are closed for this raffle")
        except (ValueError, AttributeError) as exc:
            # Bad timestamp in db — surface as 500, not silently accept
            raise ValueError(f"raffle entries_close_at malformed: {exc}") from exc

    # Reject duplicate (raffle_id, email) entries — first submission wins.
    dup = await db.voita_entries.find_one(
        {"raffle_id": raffle["id"], "email_lower": email}, {"_id": 1},
    )
    if dup:
        raise ValueError("this email has already entered this raffle")

    # Compute retention horizon: kickoff + 30d (or close_at + 30d if no kickoff)
    retention_until = None
    horizon_source = raffle.get("kickoff_at") or raffle.get("entries_close_at")
    if horizon_source:
        try:
            dt = datetime.fromisoformat(horizon_source.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            retention_until = (dt + timedelta(days=ENTRY_RETENTION_DAYS_AFTER_KICKOFF)).isoformat()
        except (ValueError, AttributeError):
            retention_until = None

    entry = {
        "id": uuid.uuid4().hex,
        "raffle_id": raffle["id"],
        "raffle_slug": raffle["slug"],
        "email_lower": email,
        "email_hash": _hash(email),
        "display_name": _sanitize_display_name(display_name),
        "prediction_one_x_two": prediction_one_x_two.upper(),
        "predicted_home_goals": ph,
        "predicted_away_goals": pa,
        "rules_accepted": True,
        "consent_tag": "game_raffle",
        "raffle_legal_basis": "legitimate_interest_contest_admin",
        "retention_until": retention_until,
        "score": None,
        "created_at": _now_iso(),
        "ip_hash": _hash(ip) if ip else None,
        "ua_hash": _hash(ua) if ua else None,
        "confidence": int(confidence) if confidence and 1 <= int(confidence) <= 5 else None,
        "contact_channel": contact_channel if contact_channel in {"telegram", "email"} else None,
        "pending_id": (pending_id or "").strip()[:64] or None,
        "telegram_bound_at": None,  # set by Slice 3 bot when /start hits
    }
    await db.voita_entries.insert_one(entry)
    await db.voita_raffles.update_one(
        {"id": raffle["id"]},
        {"$inc": {"entries_count": 1}, "$set": {"updated_at": _now_iso()}},
    )

    # Audit log — separate from marketing consent audit trail.
    try:
        await db.audit_log.insert_one({
            "kind": "raffle_entry",
            "raffle_id": raffle["id"],
            "raffle_slug": raffle["slug"],
            "entry_id": entry["id"],
            "email_hash": entry["email_hash"],
            "legal_basis": entry["raffle_legal_basis"],
            "captured_at": entry["created_at"],
            "ip_hash": entry["ip_hash"],
        })
    except Exception:
        logger.exception("voita audit_log insert failed")

    entry.pop("_id", None)
    # Compute entrant position (1-indexed) — count of entries created
    # at or before this one in the same raffle. Surfaced on the
    # confirmation page so the entrant sees "Olet osallistuja #N".
    try:
        position = await db.voita_entries.count_documents({
            "raffle_id": raffle["id"],
            "created_at": {"$lte": entry["created_at"]},
        })
    except Exception:
        position = None
    return {
        "ok": True,
        "entry_id": entry["id"],
        "raffle_slug": raffle["slug"],
        "raffle_title_fi": raffle.get("title_fi"),
        "raffle_title_en": raffle.get("title_en"),
        "created_at": entry["created_at"],
        "position": position,
    }


# ── Scoring + draw ──────────────────────────────────────────────────────

def score_entry(scoring: Dict[str, int], *,
                 prediction_one_x_two: str, predicted_home_goals: int, predicted_away_goals: int,
                 actual_home_goals: int, actual_away_goals: int,
                 actual_one_x_two: str) -> int:
    """Returns the deterministic point total for a single entry against
    the official result. Score-variant points are best-of, not stackable
    — exact-score awards `exact_score_points`, NOT exact + goal-diff +
    total."""
    pts = 0
    if (prediction_one_x_two or "").upper() == (actual_one_x_two or "").upper():
        pts += int(scoring.get("one_x_two_points", DEFAULT_SCORING["one_x_two_points"]))
    if predicted_home_goals == actual_home_goals and predicted_away_goals == actual_away_goals:
        pts += int(scoring.get("exact_score_points", DEFAULT_SCORING["exact_score_points"]))
    elif (predicted_home_goals - predicted_away_goals) == (actual_home_goals - actual_away_goals):
        pts += int(scoring.get("goal_diff_points", DEFAULT_SCORING["goal_diff_points"]))
    elif (predicted_home_goals + predicted_away_goals) == (actual_home_goals + actual_away_goals):
        pts += int(scoring.get("total_goals_points", DEFAULT_SCORING["total_goals_points"]))
    return pts


def compute_one_x_two(home_goals: int, away_goals: int) -> str:
    if home_goals > away_goals:
        return "1"
    if home_goals < away_goals:
        return "2"
    return "X"


async def draw_raffle(db, raffle_id: str, *, home_goals: int, away_goals: int,
                      drawn_by: str = "admin") -> Dict[str, Any]:
    """Locks the result, scores every entry, deterministically picks the
    top N winners (where N = len(prize_distribution.payouts))."""
    raffle = await db.voita_raffles.find_one({"id": raffle_id}, {"_id": 0})
    if not raffle:
        raise ValueError("raffle not found")
    if raffle.get("status") == "drawn":
        raise ValueError("raffle already drawn — results immutable")

    actual_one_x_two = compute_one_x_two(home_goals, away_goals)
    scoring = {**DEFAULT_SCORING, **(raffle.get("scoring") or {})}

    cur = db.voita_entries.find({"raffle_id": raffle_id}, {"_id": 0})
    scored: List[Tuple[int, str, Dict[str, Any]]] = []
    bulk_updates: List[Tuple[str, int]] = []
    async for e in cur:
        pts = score_entry(
            scoring,
            prediction_one_x_two=e.get("prediction_one_x_two"),
            predicted_home_goals=int(e.get("predicted_home_goals") or 0),
            predicted_away_goals=int(e.get("predicted_away_goals") or 0),
            actual_home_goals=home_goals,
            actual_away_goals=away_goals,
            actual_one_x_two=actual_one_x_two,
        )
        scored.append((pts, e.get("id"), e))
        bulk_updates.append((e.get("id"), pts))

    # Write per-entry scores
    if bulk_updates:
        ops = [
            ({"id": entry_id}, {"$set": {"score": pts}})
            for entry_id, pts in bulk_updates
        ]
        for q, u in ops:
            await db.voita_entries.update_one(q, u)

    # Deterministic tie-break: seed RNG with raffle_id + entry_id hash so
    # the draw is reproducible. Editorial team can re-run with the same
    # result and audit the order.
    import random
    seeded = []
    for pts, entry_id, entry in scored:
        seed = int(_hash(f"{raffle_id}:{entry_id}"), 16) % (2 ** 32)
        seeded.append((pts, seed, entry))
    seeded.sort(key=lambda t: (-t[0], t[1]))

    payouts = (raffle.get("prize_distribution") or {}).get("payouts") or []
    winners: List[Dict[str, Any]] = []
    for i, payout in enumerate(payouts):
        if i >= len(seeded):
            break
        pts, _, entry = seeded[i]
        winners.append({
            "position": payout["position"],
            "entry_id": entry["id"],
            "email_hash": entry.get("email_hash"),
            "score": pts,
            "prize_amount_eur": payout["amount_eur"],
            "prize_type": payout["type"],
            "prize_note": payout.get("note", ""),
        })

    result = {
        "home_goals": home_goals,
        "away_goals": away_goals,
        "one_x_two": actual_one_x_two,
        "drawn_at": _now_iso(),
        "drawn_by": drawn_by,
        "winners": winners,
        "scored_count": len(scored),
    }
    await db.voita_raffles.update_one(
        {"id": raffle_id},
        {"$set": {"status": "drawn", "result": result, "updated_at": _now_iso()}},
    )

    try:
        await db.audit_log.insert_one({
            "kind": "raffle_draw",
            "raffle_id": raffle_id,
            "drawn_by": drawn_by,
            "drawn_at": result["drawn_at"],
            "result_home": home_goals,
            "result_away": away_goals,
            "winners_count": len(winners),
        })
    except Exception:
        logger.exception("voita draw audit_log insert failed")

    return {"ok": True, "result": result}


# ── Admin entries list ───────────────────────────────────────────────────

async def list_entries_admin(db, raffle_id: str) -> List[Dict[str, Any]]:
    cur = db.voita_entries.find({"raffle_id": raffle_id}, {"_id": 0}).sort([("created_at", 1)])
    return [d async for d in cur]


def mask_email(email: str) -> str:
    """First-letter + ***@domain mask, tuned for the Finnish small-market
    identifiability risk.

    Rules:
      • Major providers (gmail, hotmail, outlook, icloud, yahoo, proton,
        live, me) → show domain. Otherwise mask domain to *** + TLD.
        `d***@gmail.com`   vs   `d***@***.fi`
      • When local-part looks like `firstname.lastname` (period-split,
        each part ≥ 2 alphabetic chars) → mask the local-part fully:
        `***@gmail.com`. Stops the d***@gmail.com from being a
        recognisable first name in a small dataset.
      • Empty / no @ → '' (caller hides the row).
    """
    if not email or "@" not in email:
        return ""
    local, _, domain = email.partition("@")
    local = (local or "").strip()
    domain = (domain or "").strip().lower()
    if not local or not domain:
        return ""

    major = {
        "gmail.com", "hotmail.com", "hotmail.fi", "outlook.com",
        "icloud.com", "yahoo.com", "yahoo.fi",
        "proton.me", "protonmail.com",
        "live.com", "me.com",
    }

    # Detect firstname.lastname pattern
    parts = local.lower().split(".")
    is_full_name = (
        len(parts) >= 2
        and all(len(p) >= 2 for p in parts)
        and all(p.replace("-", "").isalpha() for p in parts)
    )
    local_masked = "***" if is_full_name else f"{local[0].lower()}***"

    if domain in major:
        domain_masked = domain
    else:
        tld = domain.rsplit(".", 1)[-1] if "." in domain else domain
        domain_masked = f"***.{tld}"

    return f"{local_masked}@{domain_masked}"


async def mark_paid(db, raffle_id: str, *, paid_by: str = "admin") -> Dict[str, Any]:
    """Flip a drawn raffle to `paid` status. The recent-winners strip
    surfaces only paid raffles — a draw without payment is a weaker
    trust claim than a draw + paid timestamp."""
    existing = await db.voita_raffles.find_one({"id": raffle_id}, {"_id": 0})
    if not existing:
        raise ValueError(f"raffle {raffle_id} not found")
    if existing.get("status") != "drawn":
        raise ValueError("raffle must be in 'drawn' status before it can be marked paid")
    now = _now_iso()
    await db.voita_raffles.update_one(
        {"id": raffle_id},
        {"$set": {"status": "paid", "paid_at": now, "paid_by": paid_by, "updated_at": now}},
    )
    try:
        await db.audit_log.insert_one({
            "kind": "raffle_paid", "raffle_id": raffle_id,
            "paid_by": paid_by, "paid_at": now,
        })
    except Exception:
        logger.exception("voita mark-paid audit_log insert failed")
    return await db.voita_raffles.find_one({"id": raffle_id}, {"_id": 0})


async def recent_winners_public(db, *, limit: int = 3) -> List[Dict[str, Any]]:
    """Returns the last N *paid* raffles with masked winner emails (or
    self-chosen display names, when the entrant supplied one).

    Each item carries `paid_at` so the strip can show "Maksettu {date}",
    which is a stronger trust signal than just "drawn".
    """
    cur = db.voita_raffles.find(
        {"status": "paid"}, {"_id": 0},
    ).sort([("paid_at", -1)]).limit(max(1, int(limit)))
    items: List[Dict[str, Any]] = []
    async for d in cur:
        if not _is_publicly_visible(d):
            continue
        result = d.get("result") or {}
        winners = result.get("winners") or []
        entry_ids = [w.get("entry_id") for w in winners if w.get("entry_id")]
        # Pull display_name AND email so we can prefer the name when given.
        entries_by_id: Dict[str, Dict[str, Any]] = {}
        if entry_ids:
            ecur = db.voita_entries.find(
                {"id": {"$in": entry_ids}},
                {"_id": 0, "id": 1, "email_lower": 1, "display_name": 1},
            )
            async for e in ecur:
                entries_by_id[e["id"]] = e
        winner_views = []
        for w in winners:
            ent = entries_by_id.get(w.get("entry_id")) or {}
            display_name = (ent.get("display_name") or "").strip()
            email_masked = mask_email(ent.get("email_lower") or "")
            winner_views.append({
                "position": w.get("position"),
                "prize_amount_eur": w.get("prize_amount_eur"),
                "prize_type": w.get("prize_type"),
                "score": w.get("score"),
                "display_name": display_name or None,
                "email_masked": email_masked,
                # Frontend reads `display_label` first — falls back to mask.
                "display_label": display_name or email_masked,
            })
        items.append({
            "raffle_slug": d.get("slug"),
            "home_team": d.get("home_team"),
            "away_team": d.get("away_team"),
            "sport": d.get("sport"),
            "league": d.get("league"),
            "drawn_at": result.get("drawn_at"),
            "paid_at": d.get("paid_at"),
            "scored_count": result.get("scored_count"),
            "result_score": f"{result.get('home_goals')}–{result.get('away_goals')}",
            "winners": winner_views,
        })
    return items
