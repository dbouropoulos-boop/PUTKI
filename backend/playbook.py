"""
PUTKI HQ - Playbook upload + send queue.

Single-doc model (admin uploads ONE universal playbook; every Voita lock-in
gets it attached to their welcome email). PDF only, 5 MB cap.

Storage:
  - Binary stored on disk at /app/storage/playbooks/<sha256>.pdf
    (content-addressed so re-uploading the same file is a no-op).
  - Metadata in Mongo (`settings._id='playbook_current'`):
      { filename, sha256, size_bytes, content_type, uploaded_at, uploaded_by }
  - Older sha256-hash files are kept on disk (10 most recent) so admin
    can roll back; older still get garbage-collected at upload time.

Queue:
  - `email_outbox` documents have `{to, subject, body_html, body_text,
    attachments[{filename, sha256, mime}], status, attempts, scheduled_at,
    sent_at, last_error, voita_entry_id?, source}`.
  - This module enqueues - actual SEND happens in workers/send_outbox.py
    once RESEND_API_KEY is configured.

GDPR: we do NOT store the PDF bytes in Mongo (keeps DB small) and we
keep a `voita_entry_id` reference so user-data-deletion requests cascade.
"""
from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from email_tracking import (
    inject_tracking_into_html,
    new_token as new_tracking_token,
    tracking_enabled,
)

logger = logging.getLogger(__name__)

# Storage dir is fixed; deployments mount /app/storage as a persistent
# volume (or fall back to /tmp if missing in CI).
STORAGE_ROOT = Path(os.environ.get("PLAYBOOK_STORAGE_ROOT", "/app/storage/playbooks"))
MAX_BYTES = 5 * 1024 * 1024  # 5 MB hard cap (per product brief)
ALLOWED_MIME = "application/pdf"
KEEP_HISTORY = 10  # older versions kept on disk for rollback


def _ensure_storage() -> Path:
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    return STORAGE_ROOT


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sha256(data: bytes) -> str:
    h = hashlib.sha256()
    h.update(data)
    return h.hexdigest()


def _gc_old_files(current_sha: str) -> None:
    """Keep the KEEP_HISTORY most-recent files on disk; delete the rest."""
    try:
        files = [p for p in STORAGE_ROOT.glob("*.pdf") if p.is_file()]
        files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        for stale in files[KEEP_HISTORY:]:
            if stale.stem != current_sha:
                stale.unlink(missing_ok=True)
    except Exception:
        logger.exception("playbook GC failed (non-fatal)")


# ── Public API ─────────────────────────────────────────────────────────

async def save_playbook(db, *, data: bytes, filename: str, content_type: str,
                         uploaded_by: Optional[str]) -> Dict[str, Any]:
    """Persist an uploaded playbook PDF and mark it as current. Raises
    ValueError on validation failure so the API layer can map to 400."""
    if not data:
        raise ValueError("empty_file")
    if len(data) > MAX_BYTES:
        raise ValueError(f"too_large_{len(data)}_bytes_max_{MAX_BYTES}")
    if (content_type or "").lower() != ALLOWED_MIME:
        raise ValueError(f"unsupported_mime_{content_type}_only_pdf")
    if not data.startswith(b"%PDF"):
        # Belt-and-braces - reject anything that doesn't have the PDF magic.
        raise ValueError("not_a_valid_pdf")

    safe_filename = (filename or "playbook.pdf").strip()[:120]
    if not safe_filename.lower().endswith(".pdf"):
        safe_filename = f"{safe_filename}.pdf"

    _ensure_storage()
    sha = _sha256(data)
    target = STORAGE_ROOT / f"{sha}.pdf"
    if not target.exists():
        target.write_bytes(data)

    meta = {
        "filename": safe_filename,
        "sha256": sha,
        "size_bytes": len(data),
        "content_type": ALLOWED_MIME,
        "uploaded_at": _now_iso(),
        "uploaded_by": (uploaded_by or "admin")[:60],
        "storage_path": str(target),
    }
    await db.settings.update_one(
        {"_id": "playbook_current"},
        {"$set": {"value": meta, "updated_at": meta["uploaded_at"]}},
        upsert=True,
    )
    _gc_old_files(sha)
    return meta


async def get_current_playbook(db) -> Optional[Dict[str, Any]]:
    doc = await db.settings.find_one(
        {"_id": "playbook_current"}, {"_id": 0, "value": 1}
    )
    if not doc:
        return None
    return doc.get("value")


async def load_playbook_bytes(db) -> Optional[Dict[str, Any]]:
    """Returns dict with `data` (bytes) + metadata, or None if missing."""
    meta = await get_current_playbook(db)
    if not meta:
        return None
    path = Path(meta.get("storage_path") or "")
    if not path.exists():
        logger.warning("playbook storage_path missing: %s", path)
        return None
    return {**meta, "data": path.read_bytes()}


# ── Email enqueue ──────────────────────────────────────────────────────

def _derive_display_name(*, display_name: Optional[str], email: str,
                          lang: str = "fi") -> str:
    """display_name (40-char trim) → email local-part capitalised → fallback.
    The fallback is locale-aware so subject lines never read 'Hi Player' in
    a Finnish inbox."""
    if display_name:
        clean = display_name.strip()
        if clean:
            return clean[:40]
    local = (email or "").split("@", 1)[0]
    chunk = local.split(".")[0].split("_")[0].split("+")[0]
    if chunk and chunk.isascii() and chunk.isalpha():
        return chunk.capitalize()[:40]
    return "Pelaaja" if lang == "fi" else "Player"


def _build_playbook_body(*, display_name: str, raffle_title: str,
                          entry_position: Optional[int], lang: str) -> Dict[str, str]:
    """Lightweight inline body. Final templating (HTML brand wrapper) lives
    in workers/send_outbox.py - we keep both `body_html` and `body_text`
    so multipart sends look right."""
    if lang == "en":
        subject = "Your scout playbook + entry locked"
        intro = (
            f"Hey {display_name},\n\n"
            f"Your entry to {raffle_title} is locked in"
            + (f" - you\u2019re entrant #{entry_position}" if entry_position else "")
            + ". The kickoff result lands in your inbox shortly after the match.\n\n"
            "Attached: the PUTKI HQ scout playbook - the same patterns the scout reports "
            "use to surface the daily five.\n\nGood luck.\n- PUTKI HQ"
        )
    else:
        subject = "Scout-pelikirjasi + osallistuminen lukittu"
        intro = (
            f"Hei {display_name},\n\n"
            f"Osallistumisesi {raffle_title} -arvontaan on lukittu"
            + (f" - olet osallistuja #{entry_position}" if entry_position else "")
            + ". Ottelutulos lähtee sähköpostiisi pian kickoffin jälkeen.\n\n"
            "Liitteenä: PUTKI HQ scout-pelikirja - samat kuviot, joita scout-raportit "
            "käyttävät päivän viiden poiminnan nostoon.\n\nOnnea matkaan.\n- PUTKI HQ"
        )
    body_text = intro
    body_html = (
        "<div style=\"font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#111\">"
        f"<p>{intro.replace(chr(10) + chr(10), '</p><p>').replace(chr(10), '<br>')}</p>"
        "</div>"
    )
    return {"subject": subject, "body_text": body_text, "body_html": body_html}


async def enqueue_playbook_email(db, *, email: str, display_name: Optional[str],
                                  raffle_title: str, entry_id: str,
                                  entry_position: Optional[int] = None,
                                  lang: str = "fi") -> Optional[str]:
    """Enqueue ONE playbook email for a fresh Voita entry.

    Idempotent on (entry_id, source=voita_playbook) - re-calling for the
    same entry is a no-op so retry storms don't duplicate.

    Returns the new outbox _id (string) or None if there's no current
    playbook (admin hasn't uploaded yet - message is queued anyway with a
    NULL attachment marker so the send-worker can resolve at send time)."""
    if not email or "@" not in email:
        return None

    existing = await db.email_outbox.find_one(
        {"voita_entry_id": entry_id, "source": "voita_playbook"},
        {"_id": 1},
    )
    if existing:
        return None

    meta = await get_current_playbook(db)
    name = _derive_display_name(display_name=display_name, email=email, lang=lang)
    body = _build_playbook_body(
        display_name=name, raffle_title=raffle_title or "Voita",
        entry_position=entry_position, lang=lang,
    )
    attachment = None
    if meta:
        attachment = {
            "filename": meta.get("filename") or "playbook.pdf",
            "sha256": meta.get("sha256"),
            "mime": meta.get("content_type") or ALLOWED_MIME,
            "size_bytes": meta.get("size_bytes"),
        }

    doc = {
        "to": email.lower().strip(),
        "to_name": name,
        "subject": body["subject"],
        "body_text": body["body_text"],
        "body_html": body["body_html"],
        "attachments": [attachment] if attachment else [],
        "status": "pending",            # pending → sending → sent | failed
        "attempts": 0,
        "scheduled_at": _now_iso(),
        "sent_at": None,
        "last_error": None,
        "voita_entry_id": entry_id,
        "source": "voita_playbook",
        "lang": lang,
        "created_at": _now_iso(),
        "missing_attachment": attachment is None,
    }
    if tracking_enabled():
        token = new_tracking_token()
        doc["track_token"] = token
        doc["open_count"] = 0
        doc["click_count"] = 0
        doc["body_html"] = inject_tracking_into_html(doc["body_html"], token)
    res = await db.email_outbox.insert_one(doc)
    return str(res.inserted_id)


async def outbox_summary(db) -> Dict[str, Any]:
    """Counts + last 20 rows for the back-office queue panel."""
    counts: Dict[str, int] = {}
    pipeline = [{"$group": {"_id": "$status", "n": {"$sum": 1}}}]
    async for row in db.email_outbox.aggregate(pipeline):
        counts[row["_id"] or "unknown"] = row["n"]

    rows: List[Dict[str, Any]] = []
    cursor = db.email_outbox.find(
        {}, {
            "_id": 1, "to": 1, "to_name": 1, "subject": 1, "status": 1,
            "attempts": 1, "scheduled_at": 1, "sent_at": 1,
            "last_error": 1, "source": 1, "missing_attachment": 1,
            "voita_entry_id": 1,
            "open_count": 1, "click_count": 1,
            "first_opened_at": 1, "last_opened_at": 1,
            "first_clicked_at": 1, "last_clicked_at": 1,
        },
    ).sort([("scheduled_at", -1)]).limit(20)
    async for d in cursor:
        d["id"] = str(d.pop("_id"))
        rows.append(d)
    # Aggregate tracking totals (cheap pipeline; one extra round-trip).
    try:
        from email_tracking import tracking_summary as _ts
        n, opens, clicks = await _ts(db)
        totals = {"outbox_total": n, "opens_total": opens, "clicks_total": clicks}
    except Exception:
        totals = {"outbox_total": 0, "opens_total": 0, "clicks_total": 0}
    return {"counts": counts, "rows": rows, "tracking": totals}


async def manual_resend(db, outbox_id: str) -> bool:
    """Reset one row to pending so the worker picks it up again."""
    from bson import ObjectId
    try:
        oid = ObjectId(outbox_id)
    except Exception:
        return False
    res = await db.email_outbox.update_one(
        {"_id": oid},
        {"$set": {
            "status": "pending",
            "scheduled_at": _now_iso(),
            "last_error": None,
        }, "$inc": {"attempts": 0}},
    )
    return res.modified_count > 0
