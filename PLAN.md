
## Phase 5 — Categorize riddles by age group

| # | Step | Detail |
|---|------|--------|
| 5.1 | Define exclusions | Crude, sexual, or too-dark riddles removed |
| 5.2 | Classify remainder | `under10` vs `over10` (darkness/violence/wordplay → over10) |
| 5.3 | Emit `data/riddles-categorized.json` | `{ under10: [...], over10: [...] }` |
| 5.4 | Update UI with a level selector | 3 options: All / Kids <10 / Kids 10+ |

### Exclusion rules (applied first, case-insensitive)
Crude / sexual: `fart`, `drunk`, `drink`, `woman shoots her husband`,
`long, hard, and straight`, `discharge`, `thrusting`, `blood thirsty`, `blood thirsty killer`,
`behead me`

### Over-10 triggers (kept, but bumped out of under-10)
`blood`, `die/died/dies/dying`, `death`, `dead`, `kill/killed/killing`,
`drunk`, `grave`, `coffin`, `noose`, `gun`, `skeleton`, `corpse`

---

## Phase 6 — Add a hint to each riddle (next milestone, M1)

Goal: every riddle ships with a hand-authored hint. Player can request the hint
while a riddle is active. Hints are authored by us (not scraped/generated blind) —
we know each riddle and its answer, so each hint points the player toward the
right track without giving away the answer.

| # | Step | Detail |
|---|------|--------|
| 6.1 | Scaffold | `data/hints.json` skeleton (`{ "exact question text": "hint" }`) + `scripts/merge_hints.py` that reports coverage, merges hints into `data/riddles-categorized.json` (adds `hint` per entry), fails loudly on missing/orphan hints |
| 6.2 | Author under-10 hints (205) | Hand-written, age-appropriate, ≤ ~12 words, never contains the answer word |
| 6.3 | Author over-10 hints (172) | Same bar, may lean slightly deeper |
| 6.4 | Merge + verify | 377/377 coverage, valid JSON, every entry has non-empty `hint` |
| 6.5 | Wire UI | "💡 Hint" button reveals hint for the current riddle; resets on Next Riddle; `normalize()` must carry `hint` through |
| 6.6 | Tag `v0.2.0-m1` | After 6.5 is verified and committed |

### Hint quality bar
- One line, ≤ ~12 words.
- Names the category, a key property, or a close cousin of the answer — never the answer word itself.
- Age-appropriate to its group (under-10 hints stay kid-friendly).
- Works for the exact question text only (questions are 100% unique, so keying is safe).

### Open questions
- Does requesting a hint cost anything (e.g., riddle doesn't count toward the 10)? — *default: free, no penalty.*
- Hint available anytime while the riddle is active, or only after a wrong guess? — *default: anytime.*
