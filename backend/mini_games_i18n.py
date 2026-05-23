"""
PUTKI HQ — Mini-game suite English translations (iter60).

Parallel EN content for every Finnish seed entry in `mini_games.py` and
`mini_games_phase2.py`. Keyed by `(slug, order)` so the seed functions
can merge `prompt_en`, `label_en`, `explanation_en` into each question
doc without touching the FI definitions.

Personas are keyed by their internal `key` (e.g. `math_strong`).

Whenever you add a new FI question, add the matching EN entry here.
The seed loop is idempotent — `$set` will fill in `_en` fields on the
next boot when rows pre-exist without them.
"""
from __future__ import annotations

from typing import Any, Dict, List


# ─────────────────────── Quiz EN (10 questions) ──────────────────────

QUIZ_EN: List[Dict[str, Any]] = [
    {
        "order": 1,
        "prompt_en": "What does the acronym RTP stand for in slot machines?",
        "options": [
            {"key": "a", "label_en": "Real-Time Profit"},
            {"key": "b", "label_en": "Return to Player"},
            {"key": "c", "label_en": "Random Theoretical Payout"},
            {"key": "d", "label_en": "Reverse Tax Percentage"},
        ],
        "explanation_en": (
            "RTP = Return to Player. It indicates the proportion of stakes a "
            "game theoretically returns to players over the long run. 96% RTP "
            "means that on average €96 of every €100 wagered is returned — "
            "the house keeps 4%."
        ),
    },
    {
        "order": 2,
        "prompt_en": "A slot has HIGH volatility. What does that actually mean?",
        "options": [
            {"key": "a", "label_en": "Wins come often but are small"},
            {"key": "b", "label_en": "Wins are rare but larger"},
            {"key": "c", "label_en": "The game is broken"},
            {"key": "d", "label_en": "RTP is above 98%"},
        ],
        "explanation_en": (
            "High-volatility slots pay out less often but bigger when they do. "
            "Your bankroll takes more punishment — you need a larger buffer "
            "and steadier nerves to ride through the dry runs."
        ),
    },
    {
        "order": 3,
        "prompt_en": "You receive a €100 deposit bonus with a 35x wagering requirement. How much must you wager before withdrawal?",
        "options": [
            {"key": "a", "label_en": "€35"},
            {"key": "b", "label_en": "€350"},
            {"key": "c", "label_en": "€3,500"},
            {"key": "d", "label_en": "Nothing"},
        ],
        "explanation_en": (
            "35x wagering on a €100 bonus = €3,500 of playthrough before "
            "winnings can be withdrawn. Always check whether the requirement "
            "applies to just the bonus or to bonus + deposit."
        ),
    },
    {
        "order": 4,
        "prompt_en": "Which of these is the BEST bankroll strategy for a beginner?",
        "options": [
            {"key": "a", "label_en": "Bet half of your bankroll on one spin"},
            {"key": "b", "label_en": "Use max 1–2% of your bankroll per spin"},
            {"key": "c", "label_en": "Raise stakes when you're losing"},
            {"key": "d", "label_en": "Play until your bankroll is zero"},
        ],
        "explanation_en": (
            "Pros recommend 1–2% stake per spin. This lets variance smooth out "
            "and extends sessions. RAISING bets while losing (chasing) is the "
            "single most common cause of large bankroll wipeouts."
        ),
    },
    {
        "order": 5,
        "prompt_en": "A slot has paid only losses for 50 spins in a row. Is the next spin more likely to win?",
        "options": [
            {"key": "a", "label_en": "Yes — the game is 'due'"},
            {"key": "b", "label_en": "No — every spin is independent"},
            {"key": "c", "label_en": "Depends on the game"},
            {"key": "d", "label_en": "Only if you raise the stake"},
        ],
        "explanation_en": (
            "Classic Gambler's Fallacy. Every spin is statistically INDEPENDENT "
            "of previous ones — the slot has no memory. This is one of the most "
            "common cognitive errors that leads to chasing and addiction."
        ),
    },
    {
        "order": 6,
        "prompt_en": "Which provider can LEGALLY offer betting and casino services in Finland in 2026?",
        "options": [
            {"key": "a", "label_en": "Only Veikkaus"},
            {"key": "b", "label_en": "Veikkaus + 5–8 licensed operators"},
            {"key": "c", "label_en": "All EU-licensed operators"},
            {"key": "d", "label_en": "None"},
        ],
        "explanation_en": (
            "Finland opened the gambling market to competition in 2026. "
            "Veikkaus' monopoly ended — under the new licensing regime several "
            "operators now hold Finnish licences. An EU licence alone is NOT "
            "enough to legally operate in Finland."
        ),
    },
    {
        "order": 7,
        "prompt_en": "Deposit limits are a basic responsible-gambling tool. What's a sensible starting limit per month?",
        "options": [
            {"key": "a", "label_en": "As high as the operator allows"},
            {"key": "b", "label_en": "10% of your salary after tax"},
            {"key": "c", "label_en": "At most an amount you can lose without it affecting your sleep"},
            {"key": "d", "label_en": "Only after you've already lost money"},
        ],
        "explanation_en": (
            "Golden rule: only play with money you can lose without it affecting "
            "your life. Set the limit BEFORE your first deposit, not after "
            "you're already chasing losses."
        ),
    },
    {
        "order": 8,
        "prompt_en": "The house edge is 4%. You play €1,000 worth of slot spins. How much does the house win on average?",
        "options": [
            {"key": "a", "label_en": "€10"},
            {"key": "b", "label_en": "€40"},
            {"key": "c", "label_en": "€100"},
            {"key": "d", "label_en": "€400"},
        ],
        "explanation_en": (
            "House edge × volume = expected house win. 4% × €1,000 = €40. "
            "This is the THEORETICAL average — in any single session you "
            "might win or lose much more."
        ),
    },
    {
        "order": 9,
        "prompt_en": "Which of these is NOT a warning sign of problem gambling?",
        "options": [
            {"key": "a", "label_en": "Playing to win back your losses"},
            {"key": "b", "label_en": "Lying to family about how much you play"},
            {"key": "c", "label_en": "Occasionally depositing €2 on a weekend for fun"},
            {"key": "d", "label_en": "Playing with borrowed money"},
        ],
        "explanation_en": (
            "A small weekend stake as part of an entertainment budget is NOT a "
            "warning sign. Chasing losses, lying about play, and using borrowed "
            "money ARE — these are classic signals that play has slipped "
            "out of control."
        ),
    },
    {
        "order": 10,
        "prompt_en": "What is the SAFEST way to limit your playing time?",
        "options": [
            {"key": "a", "label_en": "Try to limit yourself by remembering to stop"},
            {"key": "b", "label_en": "Set the operator's time-limit tool OR a self-exclusion"},
            {"key": "c", "label_en": "Don't install the app"},
            {"key": "d", "label_en": "Only play while drunk"},
        ],
        "explanation_en": (
            "Mandatory operator tools (time limits, deposit limits, self-exclusion, "
            "peluuri.fi) are far more effective than willpower alone. Set your "
            "limits BEFORE the session — in the heat of play, rational decision-"
            "making is impaired."
        ),
    },
]


# ─────────────────────── Quiz personas EN ────────────────────────────

QUIZ_PERSONAS_EN = {
    "math_strong": {
        "title_en": "The Numbers Reader",
        "tagline_en": "Strong grip on math and probability.",
    },
    "responsibility_strong": {
        "title_en": "The Steady Hand",
        "tagline_en": "You understand responsible-play fundamentals well.",
    },
    "balanced": {
        "title_en": "Balanced Beginner",
        "tagline_en": "Good foundation — both numbers and self-control in shape.",
    },
    "needs_basics": {
        "title_en": "Fresh Learner",
        "tagline_en": "We recommend revisiting the basics before playing for real money.",
    },
}

# Topic-tag labels shown in the strengths / gaps panel after email unlock.
TAG_LABELS_EN = {
    "math": "math & RTP",
    "bankroll": "bankroll management",
    "bonus": "bonus terms",
    "psychology": "play psychology",
    "responsibility": "responsible play",
    "regulation": "Finnish regulation",
}


# ─────────────────────── Scenario EN (5 scenarios) ───────────────────

SCENARIO_EN: List[Dict[str, Any]] = [
    {
        "order": 1,
        "prompt_en": (
            "You've played one evening and made a €120 profit. Friends suggest "
            "you keep going and 'double it'. What do you do?"
        ),
        "options": [
            {"key": "a", "label_en": "Keep playing — the flow is good",
             "explanation_en": "The classic 'hot hand' trap. The win came from variance, not skill. Stopping is statistically the best moment."},
            {"key": "b", "label_en": "Withdraw the profit, keep playing with the original budget",
             "explanation_en": "Good decision. Separating 'your money' from 'the win' protects you from sliding back to break-even or into the red."},
            {"key": "c", "label_en": "Stop completely and close the app",
             "explanation_en": "Excellent. Stopping while ahead is one of the hardest but most important skills."},
        ],
    },
    {
        "order": 2,
        "prompt_en": (
            "You've lost 80% of your monthly budget. A notification appears about "
            "a new 50% deposit bonus. What do you do?"
        ),
        "options": [
            {"key": "a", "label_en": "Deposit and try to win it back",
             "explanation_en": "Chasing losses is the MOST common reason small initial losses snowball into large ones. A bonus makes it more tempting, but the risk is identical."},
            {"key": "b", "label_en": "Take a break — wait until next month",
             "explanation_en": "Strong decision. The bonus will still be there. A break breaks the emotional tie and restores rational perspective."},
            {"key": "c", "label_en": "Deposit just a small amount to test",
             "explanation_en": "Better than (a), but still suspect. When the budget is broken, every deposit deepens the problem."},
        ],
    },
    {
        "order": 3,
        "prompt_en": (
            "A streamer wins €50,000 and encourages viewers to try the same game "
            "via a 'click here' affiliate link. What do you think?"
        ),
        "options": [
            {"key": "a", "label_en": "If they hit it, I can hit it too",
             "explanation_en": "Survivor bias. You only see the winners — not the thousands of similar viewers who lost. A streamer's win tells you nothing about EXPECTED value."},
            {"key": "b", "label_en": "The streamer earns a commission on my losses — the edge is theirs",
             "explanation_en": "Exactly. The affiliate model rewards the streamer for your losses. The edge is theirs — you are the product."},
            {"key": "c", "label_en": "I'll check whether the streamer is responsible / plays with their own money",
             "explanation_en": "Good question, but hard to verify. Even if the streamer is honest, the affiliate system still distorts the message."},
        ],
    },
    {
        "order": 4,
        "prompt_en": (
            "You've played steadily for 6 months. The account shows €500 in profit. "
            "A feeling says: 'One big stake and I lock in a €1,000 win.' What do you do?"
        ),
        "options": [
            {"key": "a", "label_en": "Stake €100 on a high-variance slot",
             "explanation_en": "Risk/reward is off — the expected value of a single spin is negative. Six months of work can disappear in one minute."},
            {"key": "b", "label_en": "Withdraw €250, continue the rest at the usual pace",
             "explanation_en": "Excellent. You realise part of the profit — psychologically this 'locks it in'. The rest can keep working structurally."},
            {"key": "c", "label_en": "Pause — don't do anything within the next hour",
             "explanation_en": "Very sensible. The emotional spike subsides — a rational decision is usually better 30 minutes later."},
        ],
    },
    {
        "order": 5,
        "prompt_en": (
            "A friend says: 'I just play whenever I feel like it — I don't have an "
            "overall budget.' What do you advise?"
        ),
        "options": [
            {"key": "a", "label_en": "Works fine as long as it's fun",
             "explanation_en": "This is a misconception. Without a pre-set budget every decision is made in the heat of the moment — when losing, the limit disappears."},
            {"key": "b", "label_en": "Set a monthly budget IN ADVANCE and a deposit limit with the operator",
             "explanation_en": "Right answer. A pre-set budget + a mandatory operator deposit limit = a practical buffer for when willpower fails."},
            {"key": "c", "label_en": "Use only cash, never a bank card",
             "explanation_en": "Old solid advice for physical casinos, but in online play it doesn't directly help. A deposit limit is more effective."},
        ],
    },
]


# ─────────────────────── Scenario personas EN ────────────────────────

SCENARIO_PERSONAS_EN = {
    "patient_tactician": {
        "title_en": "The Patient Tactician",
        "tagline_en": "You recognise emotional regulation and keep a cool head under pressure.",
    },
    "growing_judge": {
        "title_en": "The Growing Judge",
        "tagline_en": "Solid foundation — reinforce your bankroll thinking.",
    },
    "fresh_player": {
        "title_en": "The Fresh Player",
        "tagline_en": "We recommend reviewing the responsible-play basics before making real-money decisions.",
    },
}


# ─────────────────────── Insight EN (6 tiles) ────────────────────────

INSIGHT_EN: List[Dict[str, Any]] = [
    {
        "order": 1,
        "prompt_en": "RTP ≠ GUARANTEE",
        "explanation_en": (
            "96% RTP doesn't mean you get €96 back from every €100. It's a "
            "STATISTICAL average over MILLIONS of spins. In any single "
            "session the outcome can be anything."
        ),
    },
    {
        "order": 2,
        "prompt_en": "THE COMMISSION TRAP",
        "explanation_en": (
            "Streamers typically earn 25–45% of a viewer's NET losses under the "
            "affiliate model. The more you lose, the more they earn. This is a "
            "structural conflict of interest."
        ),
    },
    {
        "order": 3,
        "prompt_en": "BONUS TERMS",
        "explanation_en": (
            "A typical '100% bonus, €100' + 35x wagering = €7,000 of playthrough "
            "before you can withdraw anything. With high volatility the chance "
            "of being in profit at the end is usually below 30%."
        ),
    },
    {
        "order": 4,
        "prompt_en": "TIME DISTORTION",
        "explanation_en": (
            "Your brain processes 5-minute and 5-hour sessions COMPLETELY "
            "differently. Continuous play over 90 minutes measurably degrades "
            "decision-making — set the operator's time-limit to 60 minutes."
        ),
    },
    {
        "order": 5,
        "prompt_en": "BANKROLL MATH",
        "explanation_en": (
            "The smallest bankroll-friendly stake = 1% of your bankroll per spin. "
            "With a €200 bankroll that's €2/spin. Statistically that gives you "
            "200+ spins before likely depletion — enough for variance to even out."
        ),
    },
    {
        "order": 6,
        "prompt_en": "VEIKKAUS 2026",
        "explanation_en": (
            "Finnish gambling law changed in 2026: Veikkaus' monopoly ended and "
            "multiple operators received licences. ALWAYS verify the operator "
            "holds a Finnish licence (not just an EU one) before depositing."
        ),
    },
]


# ─────────────────────── Lookup helpers ──────────────────────────────

def quiz_en_by_order() -> Dict[int, Dict[str, Any]]:
    return {q["order"]: q for q in QUIZ_EN}


def scenario_en_by_order() -> Dict[int, Dict[str, Any]]:
    return {q["order"]: q for q in SCENARIO_EN}


def insight_en_by_order() -> Dict[int, Dict[str, Any]]:
    return {q["order"]: q for q in INSIGHT_EN}
