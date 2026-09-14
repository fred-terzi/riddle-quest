#!/usr/bin/env python3
"""
Merge hand-authored hints (data/hints.json) into data/riddles-categorized.json.

Each riddle entry gains a "hint" field:
  { "q": "...", "a": "...", "hint": "..." }

Verification (fails the run, exit 1, on any violation):
  * every riddle in the JSON has a non-empty hint   (no missing)
  * every hint in hints.json matches a riddle       (no orphans)
  * hint text does not contain the answer word
  * hint is a single line, <= 13 words

Usage:  python3 scripts/merge_hints.py
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CAT  = os.path.join(ROOT, "data", "riddles-categorized.json")
HINTS= os.path.join(ROOT, "data", "hints.json")

MAX_WORDS = 13

def words(text):
    return re.findall(r"[a-z]+", text.lower())

def fmt(tag, group, idx, detail):
    return tag + " " + group + " (" + str(idx) + "): " + detail

def main():
    with open(CAT, encoding="utf-8") as f:
        data = json.load(f)
    with open(HINTS, encoding="utf-8") as f:
        hints = json.load(f)

    errors = []
    used = set()

    def attach(r, group, idx):
        q = r["q"]
        if q not in hints:
            errors.append(fmt("MISSING", group, idx, "no hint for " + q[:50] + "..."))
            return
        used.add(q)
        h = hints[q]
        if not isinstance(h, str) or not h.strip():
            errors.append(fmt("EMPTY", group, idx, "hint is blank"))
            return
        if "\n" in h:
            errors.append(fmt("MULTILINE", group, idx, "hint has a newline"))
            return
        n_words = len(h.split())
        if n_words > MAX_WORDS:
            errors.append(fmt("TOO LONG", group, idx, str(n_words) + " words: " + repr(h)))
        ans_words = set(words(r["a"]))
        hint_words = set(words(h))
        overlap = ans_words & hint_words
        if overlap:
            errors.append(fmt("LEAK", group, idx, "hint contains answer word " + str(sorted(overlap)) + ": " + repr(h)))
        r["hint"] = h.strip()

    for idx, r in enumerate(data["under10"]):
        attach(r, "under10", idx)
    for idx, r in enumerate(data["over10"]):
        attach(r, "over10", idx)

    orphans = set(hints) - used
    for q in sorted(orphans):
        errors.append("ORPHAN  hint with no matching riddle: " + q[:50] + "...")

    if errors:
        print(str(len(errors)) + " hint problem(s):")
        for e in errors:
            print("   " + e)
        sys.exit(1)

    total = len(data["under10"]) + len(data["over10"])
    with open(CAT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(str(total) + "/" + str(total) + " riddles now carry a hint -> data/riddles-categorized.json")

if __name__ == "__main__":
    main()
