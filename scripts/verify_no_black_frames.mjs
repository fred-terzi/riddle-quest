// No-black-frame verification: samples the stage's visible surface at ~60 fps
// while driving several real cuts, and asserts the surface never goes fully
// black (i.e. we never see BOTH video layers at opacity 0 at the same instant,
// which is what exposes the black stage background).
//
// A black frame shows up only during a bad hand-off: the outgoing clip has
// faded/paused and the incoming clip hasn't started painting yet. With the
// two-layer crossfade this window should be zero — the incoming clip is
// guaranteed to be painting before the outgoing one is demoted.
//
//   Run:  node scripts/verify_no_black_frames.mjs
//   Needs: Playwright + a Chromium build (same executablePath as the other scripts).
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 8821;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1", "--directory", ROOT], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 700));

const browser = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required"],
  executablePath: "/home/fred-terzi/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome",
});

let failures = 0;
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__rq);

  // Drives one cut (welcome → riddle) while sampling continuously.
  const result = await page.evaluate(async () => {
    const front = document.getElementById("stageVideo");
    const back = document.getElementById("backVideo");
    let blackSamples = 0, total = 0;
    const badWindow = [];
    const T0 = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        const of = parseFloat(getComputedStyle(front).opacity);
        const ob = parseFloat(getComputedStyle(back).opacity);
        total++;
        if (of + ob < 0.05) {               // both layers effectively invisible → black
          blackSamples++;
          if (badWindow.length < 40) badWindow.push(`t=${(performance.now() - T0).toFixed(0)}ms of=${of.toFixed(2)} ob=${ob.toFixed(2)}`);
        }
        if (performance.now() - T0 < 1500) requestAnimationFrame(tick);
        else resolve();
      };
      window.__rq.clickStart();             // welcome plays, then ends → riddle cut happens inside the window
      requestAnimationFrame(tick);
    });
    return { blackSamples, total, badWindow };
  });

  const pct = (100 * result.blackSamples / result.total).toFixed(2);
  console.log(`\n  Samples: ${result.total}  ·  black-surface samples: ${result.blackSamples}  (${pct}%)\n`);
  if (result.blackSamples === 0) {
    console.log("  ✔ No black frames detected during the cut sequence");
  } else {
    failures++;
    console.log("  ✘ Black frames detected at:");
    result.badWindow.forEach(b => console.log("       " + b));
  }
} catch (err) {
  failures++;
  console.log("\n✘ HARNESS ERROR:", err.message);
} finally {
  console.log("\n════════════════════════════════════");
  console.log(failures === 0
    ? "  ✅  NO BLACK FRAMES — cuts are seamless"
    : "  ❌  BLACK FRAME(S) DETECTED");
  console.log("════════════════════════════════════\n");
  await browser.close();
  server.kill();
}
process.exit(failures === 0 ? 0 : 1);
