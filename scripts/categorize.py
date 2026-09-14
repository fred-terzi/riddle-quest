#!/usr/bin/env python3
"""
Categorize riddles into under10 / over10, and remove inappropriate ones.

Rules (applied in order):
  1. REMOVE  — crude / inappropriate (by answer)
  2. OVER10  — complex wordplay, violence, death, alcohol, abstract
  3. UNDER10 — everything else (concrete, fun, gentle → default)

Usage:  python3 scripts/categorize.py
Output: data/riddles-categorized.json  →  { "under10": [{q,a}...], "over10": [{q,a}...] }
"""
import csv, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC  = os.path.join(ROOT, "data", "riddles.csv")
OUT  = os.path.join(ROOT, "data", "riddles-categorized.json")

with open(SRC, encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
print(f"Loaded {len(rows)} riddles\n")

# ── 1. REMOVE: not appropriate for any child ─────────────────────────────────
REMOVE = {
    "fart",
    "gun",
    "noose",
    "photo",
    "stable",
    "teabag",
    "train",
    "iron",      # "blood thirsty killer"
    "moon",      # "glorious behind"
}
# "moon" and "iron" have multiple riddles — only remove the specific one.
# Use (answer, unique_phrase) for those:
REMOVE_SPECIFIC = [
    ("moon", "glorious behind"),
    ("iron", "blood thirsty killer"),
]

# ── 2. OVER-10: by ANSWER ─────────────────────────────────────────────────────
# If the answer is in this set → over-10.
OVER10_ANSWERS = {
    # alcohol
    "alcohol", "wine",

    # violence / weapons
    "arrow", "bee", "justice", "sword", "weapon",
    "stapler", "spider", "scissors", "whip", "thorn", "dagger",

    # death / grave / dark
    "coffin", "death", "grave", "skeleton",
    "ring", "fish", "tree", "wood", "wave",
    "sister", "thimble", "time", "war", "prince",
    "flag", "chess",

    # complex word / letter puzzles
    "barrel", "dove", "fruit", "fur", "pig", "silk",
    "david", "dozens", "few", "envelope", "eye",
    "inkstand", "noon", "short", "teapot", "six",
    "syllable", "thursday", "half", "pea", "ton",
    "vowels", "puns", "numbers", "counterfeit",

    # abstract / philosophical
    "soul", "pride", "choice", "fate", "nothing",
    "dream", "grudge", "mind", "memory", "love",
    "thief", "gravity", "oil", "mercury", "piano",
    "riddle", "sand", "salt", "sleep", "gold",
    "tie", "temper", "past", "pawns", "rainbow",
    "suits", "skin", "water", "yeast", "well",
    "work", "word", "ice",

    # specific over-10
    "moon", "mountain", "mushroom", "silence", "stage",
    "stairs", "sieve", "space", "steps", "shadow",
    "sharing", "ship", "smile", "smoke", "snake",
    "snow", "snowman", "spurs", "splinter", "sponge",
    "squirrel", "stamp", "stars", "sun", "sunlight",
    "sunrise", "thistle", "thunder", "tides", "tomorrow",
    "tongue", "toothpaste", "towel", "turtle", "umbrella",
    "violin", "voice", "volcano", "wall", "walnut",
    "wind", "windmill", "window", "wheel",
    "wolf", "fox", "bear", "lizard", "frog",
    "cricket",
}

# ── 3. Classify ───────────────────────────────────────────────────────────────
def is_removed(q, a):
    a_lower = a.lower()
    if a_lower in REMOVE:
        # Special cases: only remove specific moon/iron riddles
        if a_lower == "moon":
            return "glorious behind" in q.lower()
        if a_lower == "iron":
            return "blood thirsty killer" in q.lower()
        return True
    return False

def is_over10(a):
    return a.lower() in OVER10_ANSWERS

under10, over10, removed = [], [], []
for row in rows:
    q = (row["QUESTIONS"] or "").strip()
    a = (row["ANSWERS"]   or "").strip()
    entry = {"q": q, "a": a}

    if is_removed(q, a):
        removed.append(entry)
    elif is_over10(a):
        over10.append(entry)
    else:
        under10.append(entry)

# ── 4. Report ─────────────────────────────────────────────────────────────────
total = len(under10) + len(over10) + len(removed)
print(f"  under10 : {len(under10):>3}")
print(f"  over10  : {len(over10):>3}")
print(f"  removed : {len(removed):>3}")
print(f"  total   : {total:>3}")

def show(label, lst, n=None):
    items = lst if n is None else lst[:n]
    print(f"\n{'═'*70}\n{label}  ({len(lst)} riddles)" + (f"  [showing {len(items)}]" if n else "") + f"\n{'═'*70}")
    for r in items:
        print(f"  {r['a']:<12}  {r['q'][:68]}")
    if n and len(lst) > n:
        print(f"  … and {len(lst)-n} more")

show("✗ REMOVED (not for kids)", removed)
show("○ OVER-10", over10, n=30)
show("● UNDER-10", under10, n=30)

# ── 5. Write JSON ─────────────────────────────────────────────────────────────
data = {"under10": under10, "over10": over10}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(f"\n✅ Written → data/riddles-categorized.json  ({os.path.getsize(OUT):,} bytes)")
