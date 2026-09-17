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
| `assets/videos/engine.js` | Video playback engine (blob pool + two-layer crossfade) |
| `assets/videos/manifest.json` | Maps game states → clip file names |
| `assets/videos/` | 17 short MP4 clips (~10 MB total), generated locally |
| `data/riddles-categorized.json` | 377 riddles with answers + hints, split by age |
| `scripts/` | Playwright test harness (dev-only, not served to players) |

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
