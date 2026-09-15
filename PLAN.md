
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

---

## Phase 7 — Video stream pilot for riddles 1–3 (M2)

Goal: the character talks the kid through the game via back-to-back video clips.
Riddles 1–3 (the first three under-10 entries, tagged `videoSet: 1|2|3`) play a
full video flow; every other riddle is text-only (no video — clips don't match).

**Assets** (local, untracked, 1024×768 h264+aac, 3–18 s, <2 MB):
`assets/videos/{riddles/riddle_{1,2,3},answers/answer_{1,2,3},hints/hint_{1,2,3}}.mp4` +
`assets/videos/game_play/{welcome_1,heres_a_hint,the_answer_is,try_again}.mp4` +
`assets/videos/waiting_videos/wait_{1..4}.mp4`

**Streaming rules** (one `<video>` element, clips chain back-to-back on `ended`):
| Game state | Stream (all with sound) |
|---|---|
| New video riddle | `welcome_1` → `riddle_{set}` → waiting loop |
| Waiting loop | `wait_1 → wait_2 → wait_3 → wait_4` … (**muted**) |
| Correct / Reveal | `the_answer_is` → `answer_{set}` → waiting loop |
| Wrong guess | `try_again` → waiting loop |
| Hint | `heres_a_hint` → `hint_{set}` → waiting loop |

| # | Step | Detail | Verify |
|---|------|--------|--------|
| 7.1 | Update this PLAN + commit | this block | commit exists |
| 7.2 | Video engine + stage | `assets/videos/engine.js`: playlist queue, seamless `ended` chaining, preload of next clip, `playSequence()` (unmuted) / `playWaitingLoop()` (muted) / `stop()` / `onWaitingStart` hook; `<video>` stage in card (16:9, letterboxed, hidden for non-video riddles) | engine loads, stage visible for riddles 1–3 only |
| 7.3 | Wire game states | hook `selectAge`/`render`/`checkAnswer`/`revealAnswer`/`showHint`/level-complete into the engine per the table; video riddles are always the first three (no shuffle among them); buttons stay active so the player can type while the character talks; a new clip instantly cuts off a wrong/late clip | each state transition streams the right clip in the right order |
| 7.4 | Headless browser verification | Playwright (chromium) script: load page over `python3 -m http.server`, assert stage visibility per riddle, click through new-riddle → wrong → hint → reveal → next, capture `src` sequence + mute states, log any `error`/`stalled` events, screenshot the stage | sequence matches the table; no load errors; screenshots look right |
| 7.5 | Tag `v0.3.0-m2` | after 7.4 passes | tag exists |
