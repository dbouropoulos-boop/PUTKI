"""
PUTKI HQ — Unified lead lifecycle view.

Joins the disparate lead collections into a single timeline so the
back-office can answer "who came in, where from, and what happened
next" without 6 separate queries. Read-only — no mutation.

Source collections joined:
  signups                    — streamer alerts band (homepage)
  optin_consents             — unified consent ledger (220+ rows live)
  voita_entries              — sports raffle entries
  mestari_diagnostic_leads   — poker + blackjack diagnostics
  email_outbox               — emails queued / sent / opened / clicked
  telegram_bindings          — bound Telegram users

Output shape (per identity row):
  identity_key   — email (lowered) or 'tg:<user_id>' for un-emailed TG users
  channels       — set of channels present (email | telegram)
  surfaces       — set of surfaces captured on (voita | mestari_sports |
                   mestari_poker | mestari_blackjack | streamer_alerts |
                   mittari | voyager | ...)
  first_seen / last_seen
  email_metrics  — {queued, sent, opened, clicked, last_sent_at}
  details        — most recent surface payload per channel
"""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Max lookback per collection — defends against unbounded scans on the
# live preview while still surfacing every recent lead. The back-office
# table truncates at 200 rows; this just bounds the join.
MAX_PER_COLLECTION = 600


def _norm_email(e: Any) -> Optional[str]:
    if not e or not isinstance(e, str):
        return None
    s = e.strip().lower()
    return s if "@" in s and len(s) <= 200 else None


async def build_timeline(db, *, limit: int = 200) -> Dict[str, Any]:
    """Single query path used by /api/admin/leads/timeline."""
    by_id: Dict[str, Dict[str, Any]] = {}

    def _get(key: str) -> Dict[str, Any]:
        if key not in by_id:
            by_id[key] = {
                "identity_key": key,
                "email": key if "@" in key else None,
                "telegram_user_id": key[3:] if key.startswith("tg:") else None,
                "name": None,
                "channels": set(),
                "surfaces": set(),
                "first_seen": None,
                "last_seen": None,
                "email_metrics": {"queued": 0, "sent": 0, "failed": 0,
                                  "opened_total": 0, "clicked_total": 0,
                                  "last_sent_at": None},
                "details": {},
            }
        return by_id[key]

    def _bump(row: Dict[str, Any], ts: Optional[str]):
        if not ts:
            return
        if not row["first_seen"] or ts < row["first_seen"]:
            row["first_seen"] = ts
        if not row["last_seen"] or ts > row["last_seen"]:
            row["last_seen"] = ts

    # ── signups (streamer alerts) ───────────────────────────────────
    async for d in db.signups.find(
        {}, {"_id": 0, "email": 1, "streamers": 1, "channels": 1, "created_at": 1},
    ).sort([("created_at", -1)]).limit(MAX_PER_COLLECTION):
        em = _norm_email(d.get("email"))
        if not em:
            continue
        r = _get(em)
        r["channels"].add("email")
        r["surfaces"].add("streamer_alerts")
        _bump(r, d.get("created_at"))
        r["details"]["streamer_alerts"] = {
            "streamers": d.get("streamers") or [],
            "channels": d.get("channels") or [],
            "created_at": d.get("created_at"),
        }

    # ── optin_consents (unified consent ledger) ─────────────────────
    async for d in db.optin_consents.find(
        {}, {"_id": 0, "channel": 1, "identifier": 1, "email": 1,
             "phone": 1, "telegram_username": 1, "surface": 1, "consent_tag": 1,
             "created_at": 1, "last_seen_at": 1, "first_seen_at": 1},
    ).sort([("last_seen_at", -1)]).limit(MAX_PER_COLLECTION):
        em = _norm_email(d.get("email") or d.get("identifier"))
        if em:
            r = _get(em)
            r["channels"].add("email")
        elif d.get("telegram_username"):
            r = _get(f"tg:{d['telegram_username']}")
            r["channels"].add("telegram")
        else:
            continue
        if d.get("surface"):
            r["surfaces"].add(d["surface"])
        _bump(r, d.get("first_seen_at") or d.get("created_at"))
        _bump(r, d.get("last_seen_at") or d.get("created_at"))

    # ── voita_entries (raffle) ──────────────────────────────────────
    async for d in db.voita_entries.find(
        {}, {"_id": 0, "email_lower": 1, "display_name": 1, "raffle_slug": 1,
             "raffle_id": 1, "created_at": 1, "id": 1,
             "prediction_one_x_two": 1},
    ).sort([("created_at", -1)]).limit(MAX_PER_COLLECTION):
        em = _norm_email(d.get("email_lower"))
        if not em:
            continue
        r = _get(em)
        r["channels"].add("email")
        r["surfaces"].add("voita")
        if not r["name"] and d.get("display_name"):
            r["name"] = d["display_name"]
        _bump(r, d.get("created_at"))
        r["details"].setdefault("voita", []).append({
            "raffle_slug": d.get("raffle_slug"),
            "raffle_id": d.get("raffle_id"),
            "entry_id": d.get("id"),
            "prediction": d.get("prediction_one_x_two"),
            "created_at": d.get("created_at"),
        })

    # ── mestari_diagnostic_leads (poker + blackjack) ────────────────
    async for d in db.mestari_diagnostic_leads.find(
        {}, {"_id": 0, "email": 1, "name": 1, "diagnostic": 1,
             "profile_key": 1, "lang": 1, "captured_at": 1,
             "first_seen_at": 1, "playbook_dispatch_ready": 1},
    ).sort([("captured_at", -1)]).limit(MAX_PER_COLLECTION):
        em = _norm_email(d.get("email"))
        if not em:
            continue
        r = _get(em)
        r["channels"].add("email")
        r["surfaces"].add(f"mestari_{d.get('diagnostic', '?')}")
        if not r["name"] and d.get("name"):
            r["name"] = d["name"]
        _bump(r, d.get("first_seen_at"))
        _bump(r, d.get("captured_at"))
        r["details"].setdefault("mestari", []).append({
            "diagnostic": d.get("diagnostic"),
            "profile_key": d.get("profile_key"),
            "playbook_dispatch_ready": d.get("playbook_dispatch_ready"),
            "lang": d.get("lang"),
            "captured_at": d.get("captured_at"),
        })

    # ── email_outbox (everything we tried/will try to send) ─────────
    metrics_pipeline = [
        {"$group": {
            "_id": "$to",
            "queued": {"$sum": {"$cond": [{"$eq": ["$status", "pending"]}, 1, 0]}},
            "sent":   {"$sum": {"$cond": [{"$eq": ["$status", "sent"]}, 1, 0]}},
            "failed": {"$sum": {"$cond": [{"$eq": ["$status", "failed"]}, 1, 0]}},
            "opens":  {"$sum": {"$ifNull": ["$open_count", 0]}},
            "clicks": {"$sum": {"$ifNull": ["$click_count", 0]}},
            "last_sent_at": {"$max": "$sent_at"},
        }},
    ]
    async for d in db.email_outbox.aggregate(metrics_pipeline):
        em = _norm_email(d.get("_id"))
        if not em:
            continue
        if em not in by_id:
            # Email present in outbox but never made it into a lead
            # collection — surface anyway so it doesn't go invisible.
            r = _get(em)
            r["channels"].add("email")
            r["surfaces"].add("outbox_only")
        else:
            r = by_id[em]
        r["email_metrics"] = {
            "queued": int(d.get("queued", 0)),
            "sent": int(d.get("sent", 0)),
            "failed": int(d.get("failed", 0)),
            "opened_total": int(d.get("opens", 0)),
            "clicked_total": int(d.get("clicks", 0)),
            "last_sent_at": d.get("last_sent_at"),
        }

    # ── telegram_bindings ───────────────────────────────────────────
    async for d in db.telegram_bindings.find(
        {}, {"_id": 0, "user_id": 1, "username": 1, "email": 1,
             "bound_at": 1, "last_seen_at": 1},
    ).sort([("bound_at", -1)]).limit(MAX_PER_COLLECTION):
        em = _norm_email(d.get("email"))
        if em:
            r = _get(em)
            r["telegram_user_id"] = d.get("user_id")
            r["channels"].add("telegram")
        else:
            r = _get(f"tg:{d.get('user_id', 'unknown')}")
            r["channels"].add("telegram")
        _bump(r, d.get("bound_at"))
        _bump(r, d.get("last_seen_at"))
        r["details"]["telegram"] = {
            "user_id": d.get("user_id"),
            "username": d.get("username"),
            "bound_at": d.get("bound_at"),
        }

    # Sort by last_seen desc, freeze the sets → lists.
    rows: List[Dict[str, Any]] = list(by_id.values())
    rows.sort(key=lambda r: (r.get("last_seen") or ""), reverse=True)
    for r in rows:
        r["channels"] = sorted(r["channels"])
        r["surfaces"] = sorted(r["surfaces"])

    # Headline counts (table footer)
    surface_counts: Dict[str, int] = defaultdict(int)
    for r in rows:
        for s in r["surfaces"]:
            surface_counts[s] += 1
    summary = {
        "rows_total": len(rows),
        "by_surface": dict(surface_counts),
        "by_channel": {
            "email": sum(1 for r in rows if "email" in r["channels"]),
            "telegram": sum(1 for r in rows if "telegram" in r["channels"]),
            "both": sum(1 for r in rows if "email" in r["channels"]
                        and "telegram" in r["channels"]),
        },
        "email_outbox": {
            "queued": sum(r["email_metrics"]["queued"] for r in rows),
            "sent": sum(r["email_metrics"]["sent"] for r in rows),
            "failed": sum(r["email_metrics"]["failed"] for r in rows),
            "opens_total": sum(r["email_metrics"]["opened_total"] for r in rows),
            "clicks_total": sum(r["email_metrics"]["clicked_total"] for r in rows),
        },
    }

    return {"summary": summary, "rows": rows[:limit]}


# ── 24h engagement funnel ────────────────────────────────────────────

async def build_funnel(db, *, hours: int = 24) -> Dict[str, Any]:
    """6-stage funnel for the last N hours. Each stage emits a `count`
    plus a 24-bucket sparkline (per-hour totals, oldest first) so the
    back-office can render it without a second query.

    Stages:
      signups   — distinct emails added to optin_consents
      queued    — email_outbox rows created
      sent      — email_outbox rows flipped to status=sent
      opened    — outbox rows with first_opened_at in window
      clicked   — outbox rows with first_clicked_at in window
      returned  — distinct emails that received an email AND came back
                  to voita / mestari AFTER receiving it
    """
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours)
    cutoff_iso = cutoff.isoformat()
    n_buckets = min(24, hours)
    bucket_seconds = (hours * 3600) // max(1, n_buckets)

    def _bucket_index(iso: str) -> Optional[int]:
        if not iso:
            return None
        try:
            ts = datetime.fromisoformat(iso.replace("Z", "+00:00"))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
        except Exception:
            return None
        delta = (ts - cutoff).total_seconds()
        if delta < 0 or delta > hours * 3600:
            return None
        idx = int(delta // bucket_seconds)
        return min(max(0, idx), n_buckets - 1)

    stage_def = [
        ("signups", "blue"),
        ("queued", "amber"),
        ("sent", "green"),
        ("opened", "green"),
        ("clicked", "green"),
        ("returned", "violet"),
    ]
    stages: Dict[str, Dict[str, Any]] = {
        s: {"count": 0, "spark": [0] * n_buckets, "color": c}
        for s, c in stage_def
    }

    def _hit(stage: str, iso: str, *, dedupe_key: Optional[str] = None,
             dedupe_set: Optional[set] = None):
        idx = _bucket_index(iso)
        if idx is None:
            return
        if dedupe_set is not None and dedupe_key is not None:
            if dedupe_key in dedupe_set:
                return
            dedupe_set.add(dedupe_key)
        stages[stage]["count"] += 1
        stages[stage]["spark"][idx] += 1

    # ── signups: distinct emails from optin_consents created in window
    signup_seen: set = set()
    async for d in db.optin_consents.find(
        {"$or": [
            {"first_seen_at": {"$gte": cutoff_iso}},
            {"created_at": {"$gte": cutoff_iso}},
        ]},
        {"_id": 0, "email": 1, "identifier": 1, "first_seen_at": 1, "created_at": 1},
    ):
        email = (d.get("email") or d.get("identifier") or "").lower().strip()
        if not email or "@" not in email:
            continue
        ts = d.get("first_seen_at") or d.get("created_at")
        _hit("signups", ts, dedupe_key=email, dedupe_set=signup_seen)

    # ── queued / sent / opened / clicked from email_outbox
    sent_emails_in_window: Dict[str, str] = {}   # email → max sent_at iso
    async for d in db.email_outbox.find(
        {"$or": [
            {"created_at": {"$gte": cutoff_iso}},
            {"sent_at": {"$gte": cutoff_iso}},
            {"first_opened_at": {"$gte": cutoff_iso}},
            {"first_clicked_at": {"$gte": cutoff_iso}},
        ]},
        {"_id": 0, "to": 1, "created_at": 1, "sent_at": 1,
         "first_opened_at": 1, "first_clicked_at": 1, "status": 1},
    ):
        _hit("queued", d.get("created_at"))
        if d.get("status") == "sent" and d.get("sent_at"):
            _hit("sent", d.get("sent_at"))
            em = (d.get("to") or "").lower()
            if em and d["sent_at"] >= sent_emails_in_window.get(em, ""):
                sent_emails_in_window[em] = d["sent_at"]
        if d.get("first_opened_at"):
            _hit("opened", d.get("first_opened_at"))
        if d.get("first_clicked_at"):
            _hit("clicked", d.get("first_clicked_at"))

    # ── returned: a voita_entry or mestari_diagnostic_lead created
    #    AFTER the recipient's most recent sent_at (engagement loop).
    #    No sent_at history in window ⇒ no "returned" measurement.
    returned_seen: set = set()
    if sent_emails_in_window:
        emails = list(sent_emails_in_window.keys())
        async for d in db.voita_entries.find(
            {"email_lower": {"$in": emails},
             "created_at": {"$gte": cutoff_iso}},
            {"_id": 0, "email_lower": 1, "created_at": 1},
        ):
            em = d.get("email_lower", "").lower()
            anchor = sent_emails_in_window.get(em)
            if anchor and d.get("created_at", "") > anchor:
                _hit("returned", d["created_at"], dedupe_key=em, dedupe_set=returned_seen)
        async for d in db.mestari_diagnostic_leads.find(
            {"email": {"$in": emails},
             "captured_at": {"$gte": cutoff_iso}},
            {"_id": 0, "email": 1, "captured_at": 1},
        ):
            em = (d.get("email") or "").lower()
            anchor = sent_emails_in_window.get(em)
            if anchor and d.get("captured_at", "") > anchor:
                _hit("returned", d["captured_at"], dedupe_key=em, dedupe_set=returned_seen)

    return {
        "hours": hours,
        "buckets": n_buckets,
        "bucket_seconds": bucket_seconds,
        "since": cutoff_iso,
        "until": now.isoformat(),
        "stages": stages,
        "order": [s for s, _ in stage_def],
    }
