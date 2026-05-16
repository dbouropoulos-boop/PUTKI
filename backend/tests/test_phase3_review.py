"""Phase 3 review-request-specific tests hitting the PUBLIC URL.

Covers items from the review_request that aren't in test_phase3_pipeline.py:
- 401 unauthorized when X-Admin-Token missing
- state.value is int on /api/dial
- operator_update content_type fanout includes site/archive/telegram/email
- GET /api/admin/queue/{id} after approve includes distribution_results
"""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pelisignaali-fi.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
TOK = "mittari-admin"
HDR = {"X-Admin-Token": TOK}


class TestUnauthorizedAdmin:
    def test_signals_requires_token(self):
        r = requests.get(f"{API}/admin/signals", timeout=10)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:200]}"

    def test_signals_poll_requires_token(self):
        r = requests.post(f"{API}/admin/signals/poll", timeout=15)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:200]}"

    def test_dial_history_requires_token(self):
        r = requests.get(f"{API}/admin/dial/history", timeout=10)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:200]}"


class TestDialShape:
    def test_dial_state_value_is_int(self):
        requests.post(f"{API}/admin/signals/poll", headers=HDR, timeout=15)
        r = requests.get(f"{API}/dial", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "state" in d
        st = d["state"]
        for k in ("key", "label", "color", "value", "headline"):
            assert k in st, f"state missing {k}"
        assert isinstance(st["value"], int), f"state.value is {type(st['value']).__name__}: {st['value']}"
        assert "any_real" in d
        assert "composite_score" in d

    def test_cockpit_full_shape(self):
        requests.post(f"{API}/admin/signals/poll", headers=HDR, timeout=15)
        r = requests.get(f"{API}/cockpit", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "composite_score" in d
        assert "sub_scores" in d
        assert "primary_driver" in d
        assert "primary_driver_label" in d
        assert "fi" in d["primary_driver_label"]
        assert "en" in d["primary_driver_label"]


class TestOperatorUpdateDistribution:
    def test_operator_update_includes_email_channel(self):
        gen = requests.post(
            f"{API}/admin/queue/generate",
            headers={**HDR, "Content-Type": "application/json"},
            json={
                "content_type": "operator_update",
                "signal_payload": {
                    "operator": "Weezybet",
                    "change_type": "promo_update",
                    "details": "Test promo update for distribution test",
                },
            },
            timeout=45,
        )
        assert gen.status_code == 200, gen.text
        item_id = gen.json()["id"]

        approve = requests.post(
            f"{API}/admin/queue/{item_id}/approve",
            headers={**HDR, "Content-Type": "application/json"},
            json={"selected_variant_index": 0},
            timeout=20,
        )
        assert approve.status_code == 200, approve.text
        published = approve.json()["published"]
        results = published.get("distribution_results", [])
        channels = {r["channel"] for r in results}
        # operator_update should fan out to site, archive, telegram, email
        assert "site" in channels, f"site missing in {channels}"
        assert "telegram" in channels, f"telegram missing in {channels}"
        # email expected per spec (mocked since no RESEND_API_KEY)
        assert "email" in channels, f"email missing in {channels}"

        # GET /api/admin/queue/{id} should reflect distribution_results
        item = requests.get(f"{API}/admin/queue/{item_id}", headers=HDR, timeout=10).json()
        assert "distribution_results" in item
        item_channels = {r["channel"] for r in item["distribution_results"]}
        assert "email" in item_channels
        assert "telegram" in item_channels
