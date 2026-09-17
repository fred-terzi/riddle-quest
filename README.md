# Riddle Quest

A single-page riddle game for kids. Pick an age group, solve riddles, ask for hints, and watch a character talk you through the first three rounds via short video clips.

**Live:** https://fred-terzi.github.io/riddle-quest/

## How to run locally

The game is fully static — no build step.

```bash
# Option 1: just open the file
open index.html

# Option 2: local server (required for the blob-pool video engine)
python3 -m http.server 8751
# → http://localhost:8751
```

## What's in the box

| Path | What it is |
|---|---|
| `index.html` | The entire game — HTML, CSS, JS in one file |
| `assets/videos/engine.js` | Video engine (blob pool + two-layer crossfade) + clip name→path table |
| `assets/videos/` | 17 short MP4 clips (~10 MB total) in 5 folders, one per game role |
| `data/riddles-categorized.json` | 377 riddles with answers + hints, split by age |
| `scripts/` | Playwright test harness (dev-only, not served to players) |

## Making your own clips

Every clip is a short single-character talking video. To add or replace one:

**1. Match the specs.** All clips are **1024×768 (4:3), H.264, 24 fps, ~3–4 s**, with an audio track. Keep new clips in the same format so the crossfade stays seamless and sizes stay small (~0.4–0.6 MB each).

**2. Use the right name and folder.** The engine looks clips up by exact name (see the `CLIPS` table at the top of `assets/videos/engine.js`). Each game role maps to a folder:

| Role | Folder | Files |
|---|---|---|
| Intro / lead-ins | `assets/videos/game_play/` | `welcome_1`, `the_answer_is`, `try_again`, `heres_a_hint` |
| Riddle | `assets/videos/riddles/` | `riddle_1`, `riddle_2`, `riddle_3` |
| Hint | `assets/videos/hints/` | `hint_1`, `hint_2`, `hint_3` |
| Answer | `assets/videos/answers/` | `answer_1`, `answer_2`, `answer_3` |
| "Thinking" loop (muted) | `assets/videos/waiting_videos/` | `wait_1` … `wait_4` |

**3. Match-cut the ends.** The most important rule: **the last frame of a clip should be the same as the first frame of the clip that follows it** (e.g. last frame of `welcome_1` ≈ first frame of `riddle_1`). The engine crossfades between consecutive clips, so matching end→start frames reads as a smooth scene change instead of a visible dissolve. The muted `wait_*` clips loop — make them seamless (first and last frame identical).

**4. Drop it in and reload.** Any editor or video generator that exports H.264 MP4 works. If a clip is close but not exact, normalize it:

```bash
ffmpeg -i input.mp4 -vf "scale=1024:768,fps=24" -c:v libx264 -crf 26 -preset medium \
       -c:a aac -b:a 96k assets/videos/riddles/riddle_1.mp4
```

The blob pool re-fetches on page load, so a hard refresh is all that's needed.

## Tech stack

- **Frontend:** plain HTML/CSS/JS — no framework, no build tools
- **Video:** 17 pre-generated H.264 MP4s, loaded into a blob pool at page load, crossfaded between two stacked `<video>` elements
- **Hosting:** GitHub Pages (static)
- **Testing:** Playwright (Chromium) state-machine walkthrough

## Verification scripts

```bash
npm install          # installs Playwright (dev-only)
npm run verify:full  # full state-machine walkthrough (17/17 clips)
npm run verify:black # asserts zero black frames across every cut
```

## License

MIT — see [`LICENSE`](LICENSE).
