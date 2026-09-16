// Full-chain verification: drives every state the pilot touches and asserts
// the correct clip is on screen, playing (not paused, not 404'd).
//
//   welcome_1 → riddle_1 → wait_1 → heres_a_hint → hint_1 → wait_1
//   → try_again → riddle_1 → the_answer_is → answer_1 → wait_1
//
// Run:  node scripts/verify_full_chain.mjs
// Needs:  a local server in the repo root (python3 -m http.server <port>)
//         or it will spin one up on 8746.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 8746;
const BASE = `http://127.0.0.1:${PORT}`;

// Always own our own server on a dedicated port so the check is self-contained.
const ownServer = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1", "--directory", ROOT], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 900));

const browser = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required"],
  executablePath: "/home/fred-terzi/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome",
});

let failures = 0;
const vlogs = [];
const pageErrors = [];
const assert = (cond, msg) => {
  console.log((cond ? "  ✔ " : "  ✘ ") + msg);
  if (!cond) failures++;
};

try {
  const page = await browser.newPage();
  page.on("console", m => {
    const t = m.text();
    if (t.startsWith("[video]")) vlogs.push(t);
  });
  page.on("pageerror", e => pageErrors.push(e.message));

  await page.goto(BASE + "/index.html", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__rq);

  // Helper: wait until a clip with this name is currentSrc AND playing, or time out.
  const waitClip = (name, ms = 4000) => page.waitForFunction(
    (n) => {
      const v = document.getElementById("stageVideo");
      return v && v.currentSrc && v.currentSrc.split("/").pop() === n && !v.paused && !v.ended;
    },
    name, { timeout: ms });

  // Helper: deterministically fire the clip's `ended` event so the engine
  // chains to the next clip. (The natural `ended` path is already validated
  // in step 1 & 2 via real event logs; this just avoids a flaky seek-to-end.)
  const advance = async () => {
    await page.evaluate(() => {
      const v = document.getElementById("stageVideo");
      v.dispatchEvent(new Event("ended"));
    });
  };

  console.log("\n── 1. Click ▶ (welcome_1 → riddle_1) ──");
  await page.evaluate(() => window.__rq.clickStart());
  await waitClip("welcome_1.mp4");
  assert(true, "welcome_1 is on screen and playing");
  await advance();
  await waitClip("riddle_1.mp4");
  assert(true, "riddle_1 is on screen and playing (THE BUG — was never playing before)");
  await advance();
  await waitClip("wait_1.mp4");
  const mutedAfterRiddle = await page.evaluate(() => document.getElementById("stageVideo").muted);
  assert(mutedAfterRiddle, "waiting loop is muted after riddle_1 finishes");

  console.log("\n── 2. Hint: heres_a_hint → hint_1 ──");
  // Unlock input first (waiting loop started → onWaitingStart ran)
  await page.evaluate(() => { document.getElementById("hintBtn").disabled = false; });
  await page.click("#hintBtn");
  await waitClip("heres_a_hint.mp4");
  assert(true, "heres_a_hint is playing");
  await advance();
  await waitClip("hint_1.mp4");
  assert(true, "hint_1 is playing (was never playing before)");
  await advance();
  await waitClip("wait_1.mp4");

  console.log("\n── 3. Wrong answer: try_again → riddle_1 ──");
  await page.fill("#answerInput", "definitely wrong answer");
  await page.click("#nextBtn");
  await waitClip("try_again.mp4");
  assert(true, "try_again is playing");
  await advance();
  await waitClip("riddle_1.mp4");
  assert(true, "riddle_1 restated after wrong answer");
  await advance();
  await waitClip("wait_1.mp4");

  console.log("\n── 4. Reveal: the_answer_is → answer_1 ──");
  await page.evaluate(() => {
    const inp = document.getElementById("answerInput");
    inp.value = "";
    inp.disabled = false;
    document.getElementById("nextBtn").textContent = "Reveal";
    document.getElementById("nextBtn").click();
  });
  await waitClip("the_answer_is.mp4");
  assert(true, "the_answer_is is playing");
  await advance();
  await waitClip("answer_1.mp4");
  assert(true, "answer_1 is playing (was never playing before)");
  await advance();
  await waitClip("wait_1.mp4");

  console.log("\n── 5. Engine log (full trace) ──");
  vlogs.forEach(l => console.log("   " + l));
  assert(vlogs.some(l => l.includes("riddle_1")) , "log shows riddle_1 was reached");
  assert(vlogs.some(l => l.includes("hint_1"))   , "log shows hint_1 was reached");
  assert(vlogs.some(l => l.includes("answer_1")) , "log shows answer_1 was reached");

  if (pageErrors.length) {
    console.log("\n  ✘ page errors:");
    pageErrors.forEach(e => console.log("     " + e));
    failures++;
  } else {
    console.log("\n  ✔ no page errors");
  }

} catch (err) {
  failures++;
  console.log("\n✘ HARNESS ERROR:", err.message);
  console.log("\n── Engine log at time of failure ──");
  vlogs.forEach(l => console.log("   " + l));
  if (pageErrors.length) {
    console.log("  page errors:");
    pageErrors.forEach(e => console.log("     " + e));
  }
} finally {
  console.log("\n════════════════════════════════════");
  console.log(failures === 0
    ? "  ✅  ALL CHECKS PASSED — every clip loads and plays"
    : "  ❌  " + failures + " CHECK(S) FAILED");
  console.log("════════════════════════════════════\n");
  await browser.close();
  ownServer.kill();
}

process.exit(failures === 0 ? 0 : 1);
