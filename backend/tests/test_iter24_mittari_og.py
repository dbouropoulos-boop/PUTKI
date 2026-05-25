"""
Iteration 24 - Phase 1 Sprint 4 Mittari OG image helpers.

Pure unit tests over the slug + cache logic. We do NOT actually call
Nano Banana here (network + cost). The contract verified:
  • mittari_og_slug returns a stable filename per (state, date).
  • mittari_og_exists is False until a file is written, True after.
  • ensure_mittari_state_og returns None when disabled via env flag.
  • Unknown state → None.
  • Cached file → returns the cached URL without re-generating.
"""
import asyncio
import os
import sys

BACKEND = os.path.join(os.path.dirname(__file__), os.pardir)
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

import og_image_generator as og


def _run(coro):
    """Tiny sync wrapper around asyncio.run - keeps tests synchronous."""
    return asyncio.run(coro)


class TestSlug:
    def test_slug_is_stable(self):
        assert og.mittari_og_slug("KIIRASTULI", "2026-05-18") == "mittari-kiirastuli-2026-05-18"

    def test_url_contains_slug(self):
        url = og.mittari_og_url("MYRSKY", "2026-05-19")
        assert "mittari-myrsky-2026-05-19" in url
        assert url.endswith(".png")


class TestCachePresence:
    def test_exists_false_before_write(self, tmp_path, monkeypatch):
        monkeypatch.setattr(og, "OG_DIR", tmp_path)
        monkeypatch.setattr(og, "_output_path", lambda slug: tmp_path / f"{slug}.png")
        assert og.mittari_og_exists("KIIRASTULI", "2099-01-01") is False

    def test_exists_true_after_write(self, tmp_path, monkeypatch):
        monkeypatch.setattr(og, "OG_DIR", tmp_path)
        monkeypatch.setattr(og, "_output_path", lambda slug: tmp_path / f"{slug}.png")
        (tmp_path / "mittari-kiirastuli-2099-01-02.png").write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 16)
        assert og.mittari_og_exists("KIIRASTULI", "2099-01-02") is True


class TestEnsureMittariStateOg:
    def test_returns_none_when_disabled(self, monkeypatch):
        monkeypatch.setenv("PUTKI_HQ_DISABLE_OG_IMAGES", "1")
        result = _run(og.ensure_mittari_state_og("KIIRASTULI", "2099-01-01", "Test reading."))
        assert result is None

    def test_returns_none_for_unknown_state(self, monkeypatch):
        monkeypatch.delenv("PUTKI_HQ_DISABLE_OG_IMAGES", raising=False)
        result = _run(og.ensure_mittari_state_og("UNKNOWN_KEY", "2099-01-01", "Test."))
        assert result is None

    def test_returns_cached_url_when_file_exists(self, tmp_path, monkeypatch):
        monkeypatch.delenv("PUTKI_HQ_DISABLE_OG_IMAGES", raising=False)
        monkeypatch.setattr(og, "OG_DIR", tmp_path)
        monkeypatch.setattr(og, "_output_path", lambda slug: tmp_path / f"{slug}.png")
        slug = og.mittari_og_slug("MYRSKY", "2099-02-02")
        (tmp_path / f"{slug}.png").write_bytes(b"\x89PNGfake")
        result = _run(og.ensure_mittari_state_og("MYRSKY", "2099-02-02", "Reading."))
        assert result is not None
        assert slug in result

    def test_returns_none_when_emergent_key_unset(self, tmp_path, monkeypatch):
        """When key is missing, _generate_mittari_card returns None - and
        ensure_mittari_state_og bubbles that up without crashing."""
        monkeypatch.delenv("PUTKI_HQ_DISABLE_OG_IMAGES", raising=False)
        monkeypatch.delenv("EMERGENT_LLM_KEY", raising=False)
        monkeypatch.setattr(og, "OG_DIR", tmp_path)
        monkeypatch.setattr(og, "_output_path", lambda slug: tmp_path / f"{slug}.png")
        result = _run(og.ensure_mittari_state_og("KIIRASTULI", "2099-03-03", "Reading."))
        assert result is None


class TestStateDirectives:
    def test_all_five_states_have_directives(self):
        for k in ("KYLMA", "HAALEA", "KUUMA", "MYRSKY", "KIIRASTULI"):
            assert k in og.MITTARI_STATE_DIRECTIVES
            label, mood, hex_color = og.MITTARI_STATE_DIRECTIVES[k]
            assert hex_color.startswith("#") and len(hex_color) == 7
            assert mood and label

    def test_perkele_color_matches_brand(self):
        assert og.MITTARI_STATE_DIRECTIVES["KIIRASTULI"][2] == "#C13B2C"
        assert og.MITTARI_STATE_DIRECTIVES["KIIRASTULI"][0] == "PERKELE"
