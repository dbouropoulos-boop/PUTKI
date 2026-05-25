"""
Iteration 23 - Phase 1 brief Section 2/3 news classifier sanity tests.

Pure unit tests over the deterministic news classifier. No I/O.
"""
import os
import sys

BACKEND = os.path.join(os.path.dirname(__file__), os.pardir)
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from news_classifier import (
    archive_min, classify_item, relevance_threshold,
)


class TestRelevanceThresholds:
    def test_default_threshold_is_45(self):
        # Restored to 45 even if env override was set elsewhere.
        os.environ.pop("NEWS_TICKER_RELEVANCE_THRESHOLD", None)
        assert relevance_threshold() == 45

    def test_default_archive_min_is_20(self):
        os.environ.pop("NEWS_TICKER_ARCHIVE_MIN", None)
        assert archive_min() == 20


class TestClassifier:
    def test_tier1_source_gambling_keyword_high_severity(self):
        """Yle (tier 1) + 'kielto' (high severity) + 'Veikkaus' (gambling)
        → relevance well above threshold."""
        r = classify_item(
            title="Veikkaus saa kiellon EU-tuomioistuimelta",
            source="Yle Uutiset",
            source_tier=1,
            feed_category="news",
        )
        assert r["category"] == "gambling"
        assert r["severity"] == "high"
        assert r["relevance"] >= 75
        assert "veikkaus" in r["entity_tags"]

    def test_tier3_google_news_sports_kw(self):
        """Google News (tier 3) sports query - should still score above threshold."""
        r = classify_item(
            title="Leijonat voitti olympiakultaa",
            source="Google News · Sports",
            source_tier=3,
            feed_category="sports",
        )
        assert r["category"] == "sports"
        assert r["relevance"] >= 45
        assert "leijonat" in r["entity_tags"]

    def test_low_relevance_dropped(self):
        """No keyword matches, tier 3, no entities → below threshold."""
        r = classify_item(
            title="Sää kylmenee viikonloppuna",
            source="Google News · News",
            source_tier=3,
            feed_category="news",
        )
        assert r["relevance"] < relevance_threshold()

    def test_regulation_keyword_routes_correctly(self):
        r = classify_item(
            title="Uusi rahapelilaki hyväksytty eduskunnassa",
            source="Helsingin Sanomat",
            source_tier=1,
            feed_category="news",
        )
        assert r["category"] == "regulation"
        # Tier 1 boost + regulation keyword above threshold
        assert r["relevance"] >= relevance_threshold()

    def test_scene_keyword_routes_correctly(self):
        r = classify_item(
            title="Suomalainen striimaaja siirtyy Twitchistä Kickiin",
            source="Iltalehti",
            source_tier=2,
            feed_category="news",
        )
        assert r["category"] == "scene"

    def test_empty_title_safe(self):
        r = classify_item(title="", source="Yle", source_tier=1)
        assert r["category"] == "news"
        assert r["relevance"] == 0
        assert r["entity_tags"] == []

    def test_feed_category_fallback_when_no_keyword_match(self):
        """Generic title with no category keywords falls back to feed hint."""
        r = classify_item(
            title="Tuulivoima kasvaa tasaisesti",
            source="Kauppalehti",
            source_tier=2,
            feed_category="news",
        )
        assert r["category"] == "news"
