"""
PUTKI HQ - `routes/admin/_payloads.py`

Note: this lives at `routes/_payloads.py` (not under a sub-package) so
the existing flat router layout under `/app/backend/routes/*.py` keeps
working. The leading underscore signals "internal to the admin router"
and discourages other modules from importing these payloads directly
(they're shaped to the admin router's contracts, not a general API).

iter75 extraction: moved here from `routes/admin.py` to keep that
file focused on endpoint logic. No schema changes; only relocation.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel


# ─── Streamer-meta payloads ─────────────────────────────────────────
class _StreamerMetaPayload(BaseModel):
    """Manual streamer-meta upsert payload."""
    platform: str
    user_login: str
    meta_fi: Optional[str] = ""
    meta_en: Optional[str] = ""
    suppressed: Optional[bool] = False


class _DraftGeneratePayload(BaseModel):
    """Trigger an AI draft for a single streamer."""
    platform: str
    user_login: str
    force: Optional[bool] = False


class _PublishMetaPayload(BaseModel):
    """Promote a draft to live + record publish history."""
    platform: str
    user_login: str
    meta_line_fi: str
    meta_line_en: str


class _SuppressMetaPayload(BaseModel):
    """Toggle suppressed flag for a streamer."""
    platform: str
    user_login: str
    suppressed: bool


# ─── Slot registry + Voyager rotation ───────────────────────────────
class _SlotEntryAdd(BaseModel):
    """Add a new slot/live-table entry to the editorial registry."""
    name: str
    category: str  # slot | live_table
    provider: Optional[str] = ""
    enabled: Optional[bool] = True


class _SlotEntryUpdate(BaseModel):
    """Partial-update an existing slot registry entry."""
    enabled: Optional[bool] = None
    category: Optional[str] = None
    provider: Optional[str] = None


class _VoyagerWeekPayload(BaseModel):
    """Single rotation-calendar week. iso_week format: 'YYYY-Www'."""
    iso_week: str
    market_id: str = "FI"
    partner_operator_slug: Optional[str] = None
    theme: Optional[str] = ""
    prize_summary: Optional[str] = ""
    smartico_template_id: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = "planned"


# ─── Scheduler + dispatch ───────────────────────────────────────────
class _CadencesPayload(BaseModel):
    """Editor-driven cadence list. Each entry is a per-content-type
    cadence row (content_type, weekdays, frequency, min_gap_hours, etc.).
    iter75d fix: model was wrongly typed as Dict[str, Any] which 422'd
    the PUT roundtrip - the GET / DB representation has always been a
    list of cadence dicts, and `set_cadences()` consumes a list."""
    cadences: list


class _DispatchRunPayload(BaseModel):
    """Manual dispatch trigger. dry_run defaults to True so the audit
    trail stays honest until provider keys land."""
    dry_run: Optional[bool] = True


class _DispatchTestSendPayload(BaseModel):
    """Targeted dispatch to a tiny recipient list - go-live smoke test."""
    recipients: list
    channels: Optional[list] = None


class _DispatchFlagPayload(BaseModel):
    """Review-flag a single dispatch send."""
    reason: str
    note: Optional[str] = None
    flagged_by: Optional[str] = None


class _DispatchSegmentOverridePayload(BaseModel):
    """Per-channel/segment override (dry_run | live_segment_only | live_global)."""
    channel: str
    consent_tag: str
    mode: str


# ─── iter76 (Slice 1) · Bot config + partners ──────────────────────
class _BotConfigPayload(BaseModel):
    """Editable subset of `bot_config` singleton.

    Every field is Optional - the back-office surfaces individual
    toggles and updates them one at a time; we PATCH-merge whatever
    arrives onto the existing doc. Strict typing on each field so a
    misclicked checkbox can't silently land as a string."""
    signal_unlock_mode: Optional[str] = None    # "informative" | "routed"
    require_verified_signup: Optional[bool] = None
    daily_signal_count: Optional[int] = None
    daily_dm_enabled: Optional[bool] = None
    sharpness_min: Optional[int] = None          # iter76: replaces deploy-only env var
    sport_whitelist: Optional[list] = None       # iter76: ditto
    stars_premium_enabled: Optional[bool] = None # K5: stub - UI shows but no flow


class _PartnerPayload(BaseModel):
    """Affiliate-routing partner row. iter76 (Slice 1) - CRUD schema
    only; the router that consumes these rows is built in Slice 5.
    Empty table at launch; routing turns on by adding rows + flipping
    `bot_config.signal_unlock_mode` to 'routed'."""
    partner_key: str                             # short stable slug, e.g. "veikkaus"
    display_name: str
    affiliate_base_url: str                      # e.g. https://x.com/aff?cid={code}&sub={subid}
    subid_param_format: Optional[str] = "{code}"
    target_geos: Optional[list] = None           # ISO-3166-1 alpha-2 codes
    status: Optional[str] = "paused"             # "live" | "paused"
    priority_weight: Optional[int] = 0
    postback_secret: Optional[str] = None
    # Carry the existing Smartico embedding fields too so a single row
    # represents the whole partner relationship.
    smartico_template_id: Optional[str] = None
    smartico_loader_url: Optional[str] = None
    smartico_brand_key: Optional[str] = None


__all__ = [
    "_StreamerMetaPayload",
    "_DraftGeneratePayload",
    "_PublishMetaPayload",
    "_SuppressMetaPayload",
    "_SlotEntryAdd",
    "_SlotEntryUpdate",
    "_VoyagerWeekPayload",
    "_CadencesPayload",
    "_DispatchRunPayload",
    "_DispatchTestSendPayload",
    "_DispatchFlagPayload",
    "_DispatchSegmentOverridePayload",
    "_BotConfigPayload",
    "_PartnerPayload",
]
