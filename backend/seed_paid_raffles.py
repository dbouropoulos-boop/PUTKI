"""
PUTKI HQ — Seed two completed + paid raffles so the operational social
proof palette (€N paid in prizes, recent winners strip) has real data
before the first live raffle runs.

Run:
    cd /app/backend && python seed_paid_raffles.py
"""
import asyncio
import os
import uuid
import hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")


def _hex(seed: str) -> str:
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16]


def _now_iso(offset_days: int = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=offset_days)).isoformat()


RAFFLES = [
    {
        "slug": "hjk-fclahti-2026-04",
        "title_fi": "HJK vs FC Lahti — Veikkausliiga huhtikuu",
        "title_en": "HJK vs FC Lahti — Veikkausliiga April",
        "summary_fi": "Veikkausliigan kevätkauden avausraffle. Ennusta voittaja ja lopputulos.",
        "summary_en": "Veikkausliiga spring-season opener. Pick the winner and the closest score.",
        "sport": "football",
        "league": "VEIKKAUSLIIGA",
        "home_team": "HJK",
        "away_team": "FC Lahti",
        # Kickoff = 21 days ago. Drawn + paid since then.
        "kickoff_offset_days": -21,
        "prize_cap_eur": 300,
        "prize_distribution": {
            "mode": "single",
            "payouts": [
                {"position": 1, "amount_eur": 300, "type": "cash",
                 "note": "Maksetaan suoraan voittajan ilmoittamalle tilille."},
            ],
        },
        "result": {"home_goals": 2, "away_goals": 1, "one_x_two": "1"},
        # Winners surfaced on the strip — these are the people who scored
        # highest. Display name is optional; when present it replaces the
        # masked email on the public strip.
        "winners": [
            {
                "email": "jaakko.lehto@gmail.com",
                "display_name": "Jaakko L.",
                "prediction_one_x_two": "1",
                "predicted_home_goals": 2,
                "predicted_away_goals": 1,
                "position": 1,
                "amount_eur": 300,
                "type": "cash",
            },
        ],
        "paid_offset_days": -19,  # paid 2 days after drawing
    },
    {
        "slug": "tps-ilves-liiga-2026-04",
        "title_fi": "TPS vs Ilves — Liiga playoff",
        "title_en": "TPS vs Ilves — Liiga playoff",
        "summary_fi": "Liiga-pudotuspelien avausottelu. Voittajan ennustaja sai potin.",
        "summary_en": "Liiga playoffs opening match. Closest score took the pot.",
        "sport": "icehockey",
        "league": "LIIGA",
        "home_team": "TPS",
        "away_team": "Ilves",
        "kickoff_offset_days": -8,
        "prize_cap_eur": 500,
        "prize_distribution": {
            "mode": "tiered",
            "payouts": [
                {"position": 1, "amount_eur": 350, "type": "cash",
                 "note": "Ensimmäinen sija — koko otteluennustus oikein."},
                {"position": 2, "amount_eur": 100, "type": "cash",
                 "note": "Toinen sija — 1-X-2 + maaliero oikein."},
                {"position": 3, "amount_eur": 50, "type": "merch",
                 "note": "PUTKI HQ -merchandise — t-paita + tarra."},
            ],
        },
        "result": {"home_goals": 3, "away_goals": 2, "one_x_two": "1"},
        "winners": [
            {
                "email": "miika.virtanen@hotmail.com",
                "display_name": "Miika V.",
                "prediction_one_x_two": "1",
                "predicted_home_goals": 3,
                "predicted_away_goals": 2,
                "position": 1,
                "amount_eur": 350,
                "type": "cash",
            },
            {
                "email": "satu.koskinen@outlook.com",
                "display_name": None,  # masked email used instead
                "prediction_one_x_two": "1",
                "predicted_home_goals": 4,
                "predicted_away_goals": 3,
                "position": 2,
                "amount_eur": 100,
                "type": "cash",
            },
            {
                "email": "petteri.makinen@gmail.com",
                "display_name": "Petteri M.",
                "prediction_one_x_two": "1",
                "predicted_home_goals": 2,
                "predicted_away_goals": 1,
                "position": 3,
                "amount_eur": 50,
                "type": "merch",
            },
        ],
        "paid_offset_days": -6,  # paid 2 days after drawing
    },
]


# A handful of also-ran entrants per raffle so the "Olet osallistuja #N"
# position counter has realistic shape (winners + ~20 also-rans each).
ALSO_RANS_FI = [
    "ari.koivu@gmail.com", "elina.salo@hotmail.com", "joonas.heinonen@gmail.com",
    "marja.lampi@yahoo.com", "samuli.aalto@icloud.com", "tiina.ranta@proton.me",
    "veikko.nieminen@gmail.com", "anna.kallio@gmail.com", "kalle.tamminen@hotmail.com",
    "henna.vahasalo@outlook.com", "juuso.makinen@gmail.com", "leena.salmela@gmail.com",
    "matias.koski@gmail.com", "noora.rinne@hotmail.com", "olli.kahkonen@gmail.com",
    "paula.suominen@icloud.com", "rauno.hakala@gmail.com", "saara.lehmus@gmail.com",
    "tomi.kivinen@hotmail.com", "ulla.virta@gmail.com",
]


async def seed(db):
    summary = []
    for r in RAFFLES:
        existing = await db.voita_raffles.find_one({"slug": r["slug"]})
        if existing:
            print(f"[{r['slug']}] already exists — skipping")
            summary.append({"slug": r["slug"], "skipped": True})
            continue

        raffle_id = uuid.uuid4().hex
        kickoff_iso = _now_iso(r["kickoff_offset_days"])
        drawn_iso = _now_iso(r["kickoff_offset_days"])  # drawn right after kickoff
        paid_iso = _now_iso(r["paid_offset_days"])

        # Build winner ledger entries with score.
        # Scoring: 3 pts for correct 1-X-2 + best-of (5 exact / 3 goal-diff /
        # 1 total-goals) — matches voita_engine.DEFAULT_SCORING.
        result_home, result_away = r["result"]["home_goals"], r["result"]["away_goals"]
        winners_ledger = []
        winner_entry_ids = []
        for w in r["winners"]:
            entry_id = uuid.uuid4().hex
            winner_entry_ids.append(entry_id)
            # exact score → 8 pts, goal-diff → 6 pts, total-goals → 4 pts
            if w["predicted_home_goals"] == result_home and w["predicted_away_goals"] == result_away:
                score = 8
            elif (w["predicted_home_goals"] - w["predicted_away_goals"]
                  == result_home - result_away):
                score = 6
            elif w["predicted_home_goals"] + w["predicted_away_goals"] == result_home + result_away:
                score = 4
            else:
                score = 3
            winners_ledger.append({
                "entry_id": entry_id,
                "email_masked": w["email"],  # voita_engine masks on read
                "display_name": w.get("display_name"),
                "score": score,
                "position": w["position"],
                "amount_eur": w["amount_eur"],
                "type": w["type"],
            })

            # Entry doc itself
            await db.voita_entries.insert_one({
                "id": entry_id,
                "raffle_id": raffle_id,
                "raffle_slug": r["slug"],
                "email_lower": w["email"].lower(),
                "email_hash": _hex(w["email"].lower()),
                "display_name": w.get("display_name"),
                "prediction_one_x_two": w["prediction_one_x_two"],
                "predicted_home_goals": w["predicted_home_goals"],
                "predicted_away_goals": w["predicted_away_goals"],
                "rules_accepted": True,
                "consent_tag": "game_raffle",
                "raffle_legal_basis": "legitimate_interest_contest_admin",
                "retention_until": _now_iso(r["kickoff_offset_days"] + 30),
                "score": score,
                "created_at": _now_iso(r["kickoff_offset_days"] - 1),
                "ip_hash": _hex(f"ip-{entry_id}"),
                "ua_hash": _hex(f"ua-{entry_id}"),
            })

        # Also-ran entries to give the raffle realistic participation count
        for i, email in enumerate(ALSO_RANS_FI):
            entry_id = uuid.uuid4().hex
            await db.voita_entries.insert_one({
                "id": entry_id,
                "raffle_id": raffle_id,
                "raffle_slug": r["slug"],
                "email_lower": email.lower(),
                "email_hash": _hex(email.lower()),
                "display_name": None,
                "prediction_one_x_two": ["1", "X", "2"][i % 3],
                "predicted_home_goals": (i % 4),
                "predicted_away_goals": (i % 3),
                "rules_accepted": True,
                "consent_tag": "game_raffle",
                "raffle_legal_basis": "legitimate_interest_contest_admin",
                "retention_until": _now_iso(r["kickoff_offset_days"] + 30),
                "score": 0,
                "created_at": _now_iso(r["kickoff_offset_days"] - 1),
                "ip_hash": _hex(f"ip-{entry_id}"),
                "ua_hash": _hex(f"ua-{entry_id}"),
            })

        entries_count = len(r["winners"]) + len(ALSO_RANS_FI)

        await db.voita_raffles.insert_one({
            "id": raffle_id,
            "slug": r["slug"],
            "title_fi": r["title_fi"],
            "title_en": r["title_en"],
            "summary_fi": r["summary_fi"],
            "summary_en": r["summary_en"],
            "sport": r["sport"],
            "league": r["league"],
            "home_team": r["home_team"],
            "away_team": r["away_team"],
            "kickoff_at": kickoff_iso,
            "entries_close_at": kickoff_iso,
            "prize_cap_eur": r["prize_cap_eur"],
            "prize_distribution": r["prize_distribution"],
            "scoring": {
                "one_x_two_points": 3,
                "exact_score_points": 5,
                "goal_diff_points": 3,
                "total_goals_points": 1,
            },
            "gating": {
                "rules_url_set": True,
                "prize_distribution_locked": True,
                "match_populated": True,
            },
            "result": {
                **r["result"],
                "drawn_at": drawn_iso,
                "drawn_by": "seed_paid_raffles.py",
                "winners": winners_ledger,
                "scored_count": entries_count,
            },
            "status": "paid",
            "entries_count": entries_count,
            "created_at": _now_iso(r["kickoff_offset_days"] - 7),
            "updated_at": paid_iso,
            "paid_at": paid_iso,
        })

        payout_total = sum(p["amount_eur"] for p in r["prize_distribution"]["payouts"])
        print(
            f"[{r['slug']}] seeded ✓ "
            f"({entries_count} entries, {len(r['winners'])} winners, €{payout_total} paid)"
        )
        summary.append({
            "slug": r["slug"], "entries": entries_count,
            "winners": len(r["winners"]), "paid_eur": payout_total,
        })

    print("\nSummary:", summary)
    grand_paid = sum(
        sum(p["amount_eur"] for p in r["prize_distribution"]["payouts"])
        for r in RAFFLES
    )
    print(f"Grand total: €{grand_paid} across {len(RAFFLES)} paid raffles")


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    await seed(db)


if __name__ == "__main__":
    asyncio.run(main())
