"""
PUTKI HQ - Seed two OPEN (active) raffles so the gamified `/voita` listing
has live cards to demo end-to-end. Both pass the 3 gating flags so they
surface publicly.

Run:
    cd /app/backend && python seed_active_raffles.py
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")


def _iso(offset_hours: int = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=offset_hours)).isoformat()


RAFFLES = [
    {
        "slug": "kups-hjk-veikkausliiga-final-2026",
        "title_fi": "KuPS vs HJK - Veikkausliigan kärkikamppailu",
        "title_en": "KuPS vs HJK - Veikkausliiga title clash",
        "summary_fi": "Kauden ratkaiseva mestaruusottelu. Ennusta voittaja ja lopputulos.",
        "summary_en": "The season's title decider. Predict the winner and the score.",
        "sport": "football",
        "league": "VEIKKAUSLIIGA",
        "home_team": "KuPS",
        "away_team": "HJK",
        "kickoff_hours": 72,         # 3 days from now
        "close_hours": 70,           # entries close 2h before kickoff
        "prize_cap_eur": 400,
        "prize_distribution": {
            "mode": "tiered",
            "payouts": [
                {"position": 1, "amount_eur": 250, "type": "cash",
                 "note": "Tarkka lopputulos + 1-X-2 oikein."},
                {"position": 2, "amount_eur": 100, "type": "cash",
                 "note": "1-X-2 + maaliero oikein."},
                {"position": 3, "amount_eur": 50, "type": "merch",
                 "note": "PUTKI HQ -tuotepaketti."},
            ],
        },
        "editorial_pick": {
            "one_x_two": "1",
            "predicted_home_goals": 2,
            "predicted_away_goals": 1,
            "note_fi": "KuPS kotikenttä, HJK ilman keskuspuolustajaa.",
            "note_en": "KuPS at home, HJK missing first-choice CB.",
            "author": "Toimitus",
        },
    },
    {
        "slug": "tappara-karpat-liiga-final-2026",
        "title_fi": "Tappara vs Kärpät - Liiga-finaalin avausottelu",
        "title_en": "Tappara vs Kärpät - Liiga Final game 1",
        "summary_fi": "Liiga-finaalin avausottelu Nokia-areenalla. Mestaruus alkaa tästä.",
        "summary_en": "Game 1 of the Liiga Final at Nokia Arena. The title starts here.",
        "sport": "icehockey",
        "league": "LIIGA",
        "home_team": "Tappara",
        "away_team": "Kärpät",
        "kickoff_hours": 48,
        "close_hours": 46,
        "prize_cap_eur": 500,
        "prize_distribution": {
            "mode": "tiered",
            "payouts": [
                {"position": 1, "amount_eur": 300, "type": "cash",
                 "note": "Tarkka lopputulos + voittaja oikein."},
                {"position": 2, "amount_eur": 150, "type": "cash",
                 "note": "Voittaja + maaliero oikein."},
                {"position": 3, "amount_eur": 50, "type": "merch",
                 "note": "Liiga-finaali-aiheinen merch-paketti."},
            ],
        },
        "editorial_pick": {
            "one_x_two": "1",
            "predicted_home_goals": 3,
            "predicted_away_goals": 2,
            "note_fi": "Tapparan ylivoima ratkaisee, Kärpiltä puuttuu konkari-puolustaja.",
            "note_en": "Tappara's PP edge decides, Kärpät missing veteran D.",
            "author": "Toimitus",
        },
    },
]


async def seed(db):
    summary = []
    for r in RAFFLES:
        existing = await db.voita_raffles.find_one({"slug": r["slug"]})
        if existing:
            print(f"[{r['slug']}] already exists - skipping")
            summary.append({"slug": r["slug"], "skipped": True})
            continue

        raffle_id = uuid.uuid4().hex
        kickoff_iso = _iso(r["kickoff_hours"])
        close_iso = _iso(r["close_hours"])

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
            "entries_close_at": close_iso,
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
            "editorial_pick": r["editorial_pick"],
            "status": "open",
            "entries_count": 0,
            "result": None,
            "created_at": _iso(-2),
            "updated_at": _iso(0),
            "seeded": True,
        })
        payout_total = sum(p["amount_eur"] for p in r["prize_distribution"]["payouts"])
        print(f"[{r['slug']}] seeded ✓ (status=open, pot=€{payout_total}, kickoff in {r['kickoff_hours']}h)")
        summary.append({
            "slug": r["slug"], "status": "open", "pot_eur": payout_total,
            "kickoff_hours": r["kickoff_hours"],
        })

    print("\nSummary:", summary)


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    await seed(db)


if __name__ == "__main__":
    asyncio.run(main())
