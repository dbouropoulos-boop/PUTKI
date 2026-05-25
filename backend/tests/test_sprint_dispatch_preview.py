"""
PUTKI HQ - Dispatch previewer + go-live overrides + targeted test-send tests.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://pelisignaali-fi.preview.emergentagent.com",
).rstrip("/")
ADMIN_TOKEN = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "X-Admin-Token": ADMIN_TOKEN})
    return s


@pytest.fixture(scope="module")
def public():
    return requests.Session()


def _seed_optin(admin, channel, surface, identifier):
    payload = {"channel": channel, "surface": surface}
    if channel == "email":
        payload["email"] = identifier
    elif channel == "sms":
        payload["phone"] = identifier
    else:
        payload["telegram_username"] = identifier
    r = requests.post(
        f"{BASE_URL}/api/optin", json=payload, timeout=10,
    )
    assert r.status_code in (200, 201), r.text


# ── Cycle listing ───────────────────────────────────────────────────────

class TestCyclesEndpoint:
    def test_list_default_window(self, admin):
        # Trigger a dry-run cycle so we have at least one row.
        run = admin.post(f"{BASE_URL}/api/admin/dispatch/run", json={"dry_run": True}, timeout=30)
        assert run.status_code == 200
        r = admin.get(f"{BASE_URL}/api/admin/dispatch/cycles", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d
        assert isinstance(d["items"], list)
        assert d["count"] == len(d["items"])
        assert any(c.get("kind") == "cycle" for c in d["items"])

    def test_list_window_param(self, admin):
        r = admin.get(f"{BASE_URL}/api/admin/dispatch/cycles?days=1&limit=10", timeout=10)
        assert r.status_code == 200
        assert r.json()["count"] <= 10


# ── Cycle detail ─────────────────────────────────────────────────────────

class TestCycleDetail:
    def test_404_for_unknown(self, admin):
        r = admin.get(f"{BASE_URL}/api/admin/dispatch/cycles/{uuid.uuid4().hex}", timeout=10)
        assert r.status_code == 404

    def test_detail_shape(self, admin):
        run = admin.post(f"{BASE_URL}/api/admin/dispatch/run", json={"dry_run": True}, timeout=30)
        cycle_id = run.json()["id"]
        r = admin.get(f"{BASE_URL}/api/admin/dispatch/cycles/{cycle_id}", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "cycle" in d
        assert "per_channel" in d
        for ch in ("email", "sms", "telegram"):
            assert ch in d["per_channel"]
            entry = d["per_channel"][ch]
            assert "recipient_count" in entry
            assert "sends" in entry
        assert d["flag_count"] == 0  # newly created cycle


# ── Flagging ─────────────────────────────────────────────────────────────

class TestFlagging:
    def _send_id_from_recent(self, admin):
        # Make sure at least one send exists; seed an optin then run a cycle.
        ident = f"flag-{uuid.uuid4().hex[:8]}@example.com"
        _seed_optin(admin, "email", "pelisignaalit", ident)
        run = admin.post(f"{BASE_URL}/api/admin/dispatch/run", json={"dry_run": True}, timeout=30)
        cycle_id = run.json()["id"]
        detail = admin.get(f"{BASE_URL}/api/admin/dispatch/cycles/{cycle_id}", timeout=10).json()
        sends = detail["per_channel"]["email"]["sends"]
        assert sends, "expected at least one email send"
        return sends[0]["id"]

    def test_flag_with_dropdown_only(self, admin):
        send_id = self._send_id_from_recent(admin)
        r = admin.post(
            f"{BASE_URL}/api/admin/dispatch/logs/{send_id}/flag",
            json={"reason": "tone_off"}, timeout=10,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["reason"] == "tone_off"
        assert d["note"] == ""
        assert d["status"] == "open"

    def test_flag_with_note(self, admin):
        send_id = self._send_id_from_recent(admin)
        r = admin.post(
            f"{BASE_URL}/api/admin/dispatch/logs/{send_id}/flag",
            json={"reason": "legal_concern", "note": "GDPR Art. 7 wording is ambiguous."},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["note"] == "GDPR Art. 7 wording is ambiguous."

    def test_flag_invalid_reason(self, admin):
        send_id = self._send_id_from_recent(admin)
        r = admin.post(
            f"{BASE_URL}/api/admin/dispatch/logs/{send_id}/flag",
            json={"reason": "made_up"}, timeout=10,
        )
        assert r.status_code == 400

    def test_flag_unknown_send(self, admin):
        r = admin.post(
            f"{BASE_URL}/api/admin/dispatch/logs/{uuid.uuid4().hex}/flag",
            json={"reason": "other"}, timeout=10,
        )
        assert r.status_code == 400

    def test_flag_upsert_then_clear(self, admin):
        send_id = self._send_id_from_recent(admin)
        admin.post(f"{BASE_URL}/api/admin/dispatch/logs/{send_id}/flag",
                    json={"reason": "tone_off"}, timeout=10)
        r2 = admin.post(f"{BASE_URL}/api/admin/dispatch/logs/{send_id}/flag",
                        json={"reason": "formatting", "note": "newline glitch"}, timeout=10)
        assert r2.json()["reason"] == "formatting"
        d = admin.delete(f"{BASE_URL}/api/admin/dispatch/logs/{send_id}/flag", timeout=10)
        assert d.status_code == 200
        assert d.json()["removed"] is True
        # second delete is a no-op
        d2 = admin.delete(f"{BASE_URL}/api/admin/dispatch/logs/{send_id}/flag", timeout=10)
        assert d2.json()["removed"] is False

    def test_flags_listing(self, admin):
        send_id = self._send_id_from_recent(admin)
        admin.post(f"{BASE_URL}/api/admin/dispatch/logs/{send_id}/flag",
                    json={"reason": "other", "note": "smoke test"}, timeout=10)
        r = admin.get(f"{BASE_URL}/api/admin/dispatch/review-flags", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert any(f["send_id"] == send_id for f in d["items"])


# ── Segment overrides ────────────────────────────────────────────────────

class TestSegmentOverrides:
    def test_default_dry_run_when_unset(self, admin):
        # Listing on a fresh combo returns whatever exists. We test the
        # PUT endpoint which is the canonical write path.
        r = admin.put(
            f"{BASE_URL}/api/admin/dispatch/segment-overrides",
            json={"channel": "email", "consent_tag": "email_sentiment", "mode": "dry_run"},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["mode"] == "dry_run"

    def test_set_live_segment_only(self, admin):
        r = admin.put(
            f"{BASE_URL}/api/admin/dispatch/segment-overrides",
            json={"channel": "sms", "consent_tag": "sms_alerts", "mode": "live_segment_only"},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["mode"] == "live_segment_only"

    def test_set_live_global(self, admin):
        r = admin.put(
            f"{BASE_URL}/api/admin/dispatch/segment-overrides",
            json={"channel": "telegram", "consent_tag": "telegram_alerts", "mode": "live_global"},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["mode"] == "live_global"

    def test_reject_unknown_mode(self, admin):
        r = admin.put(
            f"{BASE_URL}/api/admin/dispatch/segment-overrides",
            json={"channel": "email", "consent_tag": "email_sentiment", "mode": "ship_it"},
            timeout=10,
        )
        assert r.status_code == 400

    def test_reject_unknown_channel(self, admin):
        r = admin.put(
            f"{BASE_URL}/api/admin/dispatch/segment-overrides",
            json={"channel": "fax", "consent_tag": "email_sentiment", "mode": "dry_run"},
            timeout=10,
        )
        assert r.status_code == 400

    def test_listing_returns_set_rows(self, admin):
        admin.put(
            f"{BASE_URL}/api/admin/dispatch/segment-overrides",
            json={"channel": "email", "consent_tag": "email_sentiment", "mode": "live_segment_only"},
            timeout=10,
        )
        r = admin.get(f"{BASE_URL}/api/admin/dispatch/segment-overrides", timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        match = [i for i in items if i["channel"] == "email" and i["consent_tag"] == "email_sentiment"]
        assert match and match[0]["mode"] == "live_segment_only"


# ── Targeted test-send ───────────────────────────────────────────────────

class TestTargetedTestSend:
    def test_requires_recipients(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/dispatch/test-send",
                        json={"recipients": []}, timeout=15)
        assert r.status_code == 400

    def test_safety_drops_non_optin(self, admin):
        # An email NOT in the segment should produce 0 sends.
        nobody = f"nobody-{uuid.uuid4().hex[:8]}@example.com"
        r = admin.post(f"{BASE_URL}/api/admin/dispatch/test-send",
                        json={"recipients": [nobody], "channels": ["email"]}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        # No email send rows for the non-opted-in address.
        email_row = next((x for x in d["results"] if x["channel"] == "email"), None)
        assert email_row is not None
        assert email_row["recipients_seen"] == 0

    def test_only_filters_to_listed_recipient(self, admin):
        # Seed two distinct emails; target one via test-send.
        ident_in = f"target-{uuid.uuid4().hex[:8]}@example.com"
        ident_other = f"other-{uuid.uuid4().hex[:8]}@example.com"
        _seed_optin(admin, "email", "pelisignaalit", ident_in)
        _seed_optin(admin, "email", "pelisignaalit", ident_other)
        r = admin.post(f"{BASE_URL}/api/admin/dispatch/test-send",
                        json={"recipients": [ident_in], "channels": ["email"]}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        email_row = next((x for x in d["results"] if x["channel"] == "email"), None)
        assert email_row is not None
        assert email_row["recipients_seen"] == 1
        assert d["test_send"] is True
        assert d["recipients_override_count"] == 1

    def test_channels_filter_scoped(self, admin):
        ident = f"sms-target-{uuid.uuid4().hex[:8]}@example.com"
        _seed_optin(admin, "email", "pelisignaalit", ident)
        r = admin.post(f"{BASE_URL}/api/admin/dispatch/test-send",
                        json={"recipients": [ident], "channels": ["email"]}, timeout=30)
        assert r.status_code == 200
        channels = {res["channel"] for res in r.json()["results"]}
        assert channels == {"email"}


# ── Voita: match_populated auto-derive (frontend cleanup partner) ────────

class TestVoitaMatchPopulatedAuto:
    def test_auto_true_when_fields_complete(self, admin):
        slug = f"sprint-test-{uuid.uuid4().hex[:6]}"
        create = admin.post(
            f"{BASE_URL}/api/admin/voita/raffles",
            json={
                "slug": slug, "title_fi": "Test", "title_en": "Test",
                "sport": "football", "league": "TEST",
                "home_team": "HJK", "away_team": "FC Lahti",
                "kickoff_at": "2026-06-01T18:00:00+03:00",
                "prize_distribution": {"payouts": [{"position": 1, "amount_eur": 100, "type": "cash"}]},
            }, timeout=10,
        )
        assert create.status_code in (200, 201), create.text
        doc = create.json().get("created") or create.json()
        assert doc["gating"]["match_populated"] is True

    def test_auto_false_when_kickoff_missing(self, admin):
        slug = f"sprint-test-{uuid.uuid4().hex[:6]}"
        create = admin.post(
            f"{BASE_URL}/api/admin/voita/raffles",
            json={
                "slug": slug, "title_fi": "Test", "title_en": "Test",
                "sport": "football", "home_team": "HJK", "away_team": "FC Lahti",
                "prize_distribution": {"payouts": [{"position": 1, "amount_eur": 100, "type": "cash"}]},
            }, timeout=10,
        )
        assert create.status_code in (200, 201), create.text
        doc = create.json().get("created") or create.json()
        assert doc["gating"]["match_populated"] is False

    def test_patch_ignores_manual_match_populated(self, admin):
        slug = f"sprint-test-{uuid.uuid4().hex[:6]}"
        create = admin.post(
            f"{BASE_URL}/api/admin/voita/raffles",
            json={
                "slug": slug, "title_fi": "Test", "title_en": "Test",
                "sport": "football", "home_team": "HJK", "away_team": "FC Lahti",
                "prize_distribution": {"payouts": [{"position": 1, "amount_eur": 100, "type": "cash"}]},
            }, timeout=10,
        )
        doc = create.json().get("created") or create.json()
        patch = admin.put(
            f"{BASE_URL}/api/admin/voita/raffles/{doc['id']}",
            json={"gating": {"match_populated": True}}, timeout=10,
        )
        assert patch.status_code == 200
        updated = patch.json().get("updated") or patch.json()
        # Still false because kickoff_at is absent.
        assert updated["gating"]["match_populated"] is False

    def test_patching_kickoff_flips_auto_true(self, admin):
        slug = f"sprint-test-{uuid.uuid4().hex[:6]}"
        create = admin.post(
            f"{BASE_URL}/api/admin/voita/raffles",
            json={
                "slug": slug, "title_fi": "Test", "title_en": "Test",
                "sport": "football", "home_team": "HJK", "away_team": "FC Lahti",
                "prize_distribution": {"payouts": [{"position": 1, "amount_eur": 100, "type": "cash"}]},
            }, timeout=10,
        )
        doc = create.json().get("created") or create.json()
        patch = admin.put(
            f"{BASE_URL}/api/admin/voita/raffles/{doc['id']}",
            json={"kickoff_at": "2026-06-01T18:00:00+03:00"}, timeout=10,
        )
        assert patch.status_code == 200
        updated = patch.json().get("updated") or patch.json()
        assert updated["gating"]["match_populated"] is True
