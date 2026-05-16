"""Phase 3 Batch 3D — Smartico Voyager loader fields in /api/admin/settings + public exposure."""
import os
import requests
from pathlib import Path

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    env_file = Path("/app/frontend/.env")
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_TOKEN = "mittari-admin"
H = {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}


class TestSmarticoVoyagerSettings:
    def test_put_round_trip_all_four_fields(self):
        payload = {
            "telegram_channel": "https://t.me/mittarifi",
            "smartico_template_id": "tpl-voyager-test",
            "smartico_loader_url": "https://cdn.smartico.ai/loader/TEST_brand.js",
            "smartico_brand_key": "TEST_weezybet-fi",
        }
        r = requests.put(f"{API}/admin/settings", headers=H, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["telegram_channel"] == payload["telegram_channel"]
        assert d["smartico_template_id"] == payload["smartico_template_id"]
        assert d["smartico_loader_url"] == payload["smartico_loader_url"]
        assert d["smartico_brand_key"] == payload["smartico_brand_key"]
        assert d.get("updated_at")

    def test_public_settings_exposes_all_four(self):
        r = requests.get(f"{API}/settings/public")
        assert r.status_code == 200
        d = r.json()
        for key in ("telegram_channel", "smartico_template_id", "smartico_loader_url", "smartico_brand_key"):
            assert key in d, f"missing key {key} in public settings"
        # no leaks
        assert "updated_at" not in d
        assert "_id" not in d

    def test_admin_get_settings_exposes_all_four_plus_updated_at(self):
        r = requests.get(f"{API}/admin/settings", headers={"X-Admin-Token": ADMIN_TOKEN})
        assert r.status_code == 200
        d = r.json()
        for key in ("telegram_channel", "smartico_template_id", "smartico_loader_url", "smartico_brand_key", "updated_at"):
            assert key in d, f"missing key {key} in admin settings"

    def test_clear_smartico_loader_and_brand_to_null(self):
        # set then clear
        requests.put(f"{API}/admin/settings", headers=H, json={
            "smartico_loader_url": "https://cdn.smartico.ai/loader/TEST_brand.js",
            "smartico_brand_key": "TEST_brand",
        })
        r = requests.put(f"{API}/admin/settings", headers=H, json={
            "telegram_channel": None,
            "smartico_template_id": None,
            "smartico_loader_url": None,
            "smartico_brand_key": None,
        })
        assert r.status_code == 200
        d = r.json()
        assert d["smartico_loader_url"] is None
        assert d["smartico_brand_key"] is None
        assert d["smartico_template_id"] is None
        # public reflects null
        rp = requests.get(f"{API}/settings/public")
        pd = rp.json()
        assert pd["smartico_loader_url"] is None
        assert pd["smartico_brand_key"] is None

    def test_admin_put_requires_token(self):
        r = requests.put(f"{API}/admin/settings", json={"smartico_loader_url": "x"})
        assert r.status_code == 401
