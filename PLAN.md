
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
