"""
Iteration 23 — Phase 1 brief Section 6 Sharpness sanity tests.

Pure unit tests over the deterministic Sharpness scoring engine. No
network, no DB. Just verifies the formula behaves as published on
/menetelma so editorial can trust the score.
"""
import os
import sys

# Allow tests/ siblings to be imported.
BACKEND = os.path.join(os.path.dirname(__file__), os.pardir)
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

import pytest

from sharpness import (
    BAND_TIGHT_MIN, BAND_CLEAR_MIN, BAND_MIXED_MIN, BAND_LOOSE_MIN,
    avg_implied_for_fav, compute_sharpness, consensus_tightness_score,
    extract_book_implied_probs, implied_prob_score, recency_momentum_score,
)


class TestImpliedProbScore:
    def test_strong_favourite_maps_high(self):
        # 1.10 odds → 90.9% implied → score ~91
        assert 89.9 <= implied_prob_score(1.10) <= 91.5

    def test_coin_flip_maps_mid(self):
        # 2.00 odds → 50%
        assert 49.5 <= implied_prob_score(2.00) <= 50.5

    def test_long_shot_maps_low(self):
        # 5.00 odds → 20%
        assert 19.5 <= implied_prob_score(5.00) <= 20.5

    def test_invalid_odds_returns_zero(self):
        assert implied_prob_score(0) == 0.0
        assert implied_prob_score(1.0) == 0.0


class TestConsensusTightness:
    def test_perfectly_aligned_books(self):
        # All 5 books at same implied → tightness ≈ 100
        assert consensus_tightness_score([90.9, 90.9, 90.9, 90.9, 90.9]) >= 99.5

    def test_typical_tight_market(self):
        # Books within ~0.5pp stdev → tightness ~96+
        score = consensus_tightness_score([90.0, 90.5, 90.5, 91.0, 91.0])
        assert score >= 95.0

    def test_spread_market(self):
        # 4pp stdev → tightness ~72
        score = consensus_tightness_score([85.0, 88.0, 92.0, 95.0, 95.0])
        assert 60.0 <= score <= 80.0

    def test_single_book_returns_conservative_mid(self):
        # Fallback when we only see one book.
        assert consensus_tightness_score([90.0]) == 60.0

    def test_no_books_returns_conservative_mid(self):
        assert consensus_tightness_score([]) == 60.0


class TestRecencyMomentum:
    def test_no_history_defaults_to_fifty(self):
        assert recency_momentum_score(85.0, None) == 50.0

    def test_consensus_tightened(self):
        # +2pp tightening → score > 50.
        s = recency_momentum_score(avg_implied_now=87.0, avg_implied_24h_ago=85.0)
        assert s > 55.0

    def test_consensus_softened(self):
        # -2pp softening → score < 50.
        s = recency_momentum_score(avg_implied_now=83.0, avg_implied_24h_ago=85.0)
        assert s < 45.0


class TestComputeSharpness:
    def test_strong_favourite_clear_band(self):
        """Arsenal-style 1.10 favourite across 13 tight books → ~80+, clear band."""
        result = compute_sharpness(
            best_decimal_odds=1.10,
            book_implied_probs=[90.0, 90.5, 90.5, 90.9, 91.0, 91.0, 91.5, 91.5, 91.5, 91.5, 92.0, 92.0, 92.0],
            avg_implied_now=91.0,
            avg_implied_24h_ago=None,  # default 50 for momentum
        )
        assert result["sharpness"] >= BAND_CLEAR_MIN
        assert result["band"] in ("clear", "tight")
        assert result["modifier"] is None
        assert result["book_count"] == 13
        assert result["has_momentum_history"] is False

    def test_mid_favourite_mixed_band(self):
        """1.50 favourite (66.7% implied) with spread books → mixed band."""
        result = compute_sharpness(
            best_decimal_odds=1.50,
            book_implied_probs=[60.0, 62.0, 65.0, 67.0, 68.0, 70.0, 72.0],
            avg_implied_now=66.3,
            avg_implied_24h_ago=None,
        )
        assert BAND_LOOSE_MIN <= result["sharpness"] < BAND_TIGHT_MIN

    def test_tightened_momentum_attaches_modifier(self):
        result = compute_sharpness(
            best_decimal_odds=1.10,
            book_implied_probs=[90.5, 91.0, 91.5],
            avg_implied_now=91.0,
            avg_implied_24h_ago=88.0,  # +3pp tighten
        )
        assert result["modifier"] == "tightened"
        assert result["has_momentum_history"] is True

    def test_softened_momentum_attaches_modifier(self):
        result = compute_sharpness(
            best_decimal_odds=1.10,
            book_implied_probs=[90.5, 91.0, 91.5],
            avg_implied_now=88.0,
            avg_implied_24h_ago=91.0,  # -3pp soften
        )
        assert result["modifier"] == "softened"

    def test_components_published_for_transparency(self):
        """All 3 components + weights present so /menetelma can show them."""
        r = compute_sharpness(1.10, [90.5, 91.0], 90.75, None)
        assert "implied_prob_score" in r["components"]
        assert "consensus_tightness" in r["components"]
        assert "recency_momentum" in r["components"]
        assert r["weights"] == {"implied_prob": 0.5, "tightness": 0.3, "momentum": 0.2}


class TestBookExtraction:
    def test_extract_book_implied_probs(self):
        event = {
            "bookmakers": [
                {"markets": [{"key": "h2h", "outcomes": [
                    {"name": "Arsenal", "price": 1.10},
                    {"name": "Burnley", "price": 12.0},
                ]}]},
                {"markets": [{"key": "h2h", "outcomes": [
                    {"name": "Arsenal", "price": 1.12},
                    {"name": "Burnley", "price": 11.0},
                ]}]},
                # Wrong market key — skipped.
                {"markets": [{"key": "totals", "outcomes": [
                    {"name": "Over 2.5", "price": 1.85},
                ]}]},
                # Invalid price — skipped.
                {"markets": [{"key": "h2h", "outcomes": [
                    {"name": "Arsenal", "price": 1.0},
                ]}]},
            ]
        }
        probs = extract_book_implied_probs(event, "Arsenal")
        assert len(probs) == 2
        # 1/1.10 * 100 = 90.909...
        assert 90.0 <= probs[0] <= 91.0
        assert 89.0 <= probs[1] <= 89.5

    def test_avg_implied_for_fav(self):
        event = {
            "bookmakers": [
                {"markets": [{"key": "h2h", "outcomes": [{"name": "X", "price": 1.10}]}]},
                {"markets": [{"key": "h2h", "outcomes": [{"name": "X", "price": 1.20}]}]},
            ]
        }
        avg = avg_implied_for_fav(event, "X")
        # avg of (90.91, 83.33) ≈ 87.12
        assert 86.5 <= avg <= 87.5

    def test_avg_implied_no_books_returns_zero(self):
        event = {"bookmakers": []}
        assert avg_implied_for_fav(event, "X") == 0.0
