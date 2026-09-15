/* Playwright end-to-end check for the video pilot (M2).
 * Run: node scripts/verify_video.mjs
 * Serves the repo root on 127.0.0.1:8742 and walks the full state machine.
 *
 * Note: headless Chromium won't fire a natural `ended` on its own schedule,
 * so the harness dispatches `ended` itself — exactly the event the engine
 * listens for — and then waits for the next clip's src to appear.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE = "http://127.0.0.1:8742/index.html";
const TIMEOUT = 20000;

const results = [];
const ok = (name, cond, extra = "") => {
  results.push({ name, pass: !!cond, extra });
  console.log((cond ? "  PASS " : "  FAIL ") + name + (extra ? "  [" + extra + "]" : ""));
};

const server = spawn("python3", ["-m", "http.server", "8742", "--bind", "127.0.0.1", "--directory", ROOT], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 700));

// Use a known-good local chromium build if one is cached; fall back to default resolution.
const LOCAL_CHROME = process.env.CHROME_PATH || "/home/fred-terzi/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const launchOpts = { args: ["--autoplay-policy=no-user-gesture-required"] };
if (fs.existsSync(LOCAL_CHROME)) launchOpts.executablePath = LOCAL_CHROME;
let browser;
try {
  browser = await chromium.launch(launchOpts);
} catch (e) {
  launchOpts.executablePath = undefined;
  browser = await chromium.launch(launchOpts);
}

let page = null;
let failed = 0;
try {
  page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  const consoleErrs = [];
  const http404 = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text()); });
  page.on("pageerror", (e) => consoleErrs.push("PAGEERROR: " + e.message));
  page.on("response", (r) => {
    const u = r.url();
    if (r.status() >= 400 && !/favicon/i.test(u)) http404.push(r.status() + " " + u);
  });

  await page.goto(BASE, { waitUntil: "networkidle" });
  const t0 = Date.now();
  await page.waitForFunction(() => window.__rq && document.getElementById("riddle").textContent.indexOf("Loading") < 0, null, { timeout: TIMEOUT });
  console.log("page loaded in " + (Date.now() - t0) + "ms\n");

  // ---- clip-stepping helpers ----
  const fire = () => page.evaluate(() => document.getElementById("stageVideo").dispatchEvent(new Event("ended")));
  const stepTo = (needle, timeoutMs = 20000) =>
    page.waitForFunction((n) => window.__rq.currentSrc().indexOf(n) >= 0, needle, { timeout: timeoutMs });
  const step = async (needle) => {
    const before = await page.evaluate(() => window.__rq.currentSrc());
    await fire();
    await stepTo(needle);
    const now = await page.evaluate(() => window.__rq.currentSrc());
    if (before === now) throw new Error("step(" + needle + ") did not advance: still " + now);
    return now;
  };
  const src = () => page.evaluate(() => window.__rq.currentSrc());
  const muted = () => page.evaluate(() => window.__rq.muted());
  const mode = () => page.evaluate(() => window.__rq.engineMode());
  const stageVisible = () => page.evaluate(() => window.__rq.videoStage());
  const overlayVisible = () => page.evaluate(() => !document.getElementById("startOverlay").classList.contains("hidden"));
  const inputDisabled = () => page.evaluate(() => document.getElementById("answerInput").disabled);
  const overlayWait = () => page.waitForFunction(() => !document.getElementById("startOverlay").classList.contains("hidden"), null, { timeout: 8000 });

  console.log("— initial state (riddle 1, video set 1) —");
  ok("stage visible for video riddle", await stageVisible());
  ok("start overlay visible (press play w/ sound)", await overlayVisible());
  ok("riddle text shown", (await page.locator("#riddle").textContent()).indexOf("goes up") >= 0);
  ok("input parked (disabled)", await inputDisabled());
  ok("video src parked on riddle_1", (await src()).indexOf("riddle_1") >= 0);
  await page.screenshot({ path: path.join(ROOT, "screenshots", "01_parked.png") });

  console.log("\n— press ▶ → welcome → riddle_1 → muted waiting —");
  await page.evaluate(() => window.__rq.clickStart());
  await stepTo("welcome_1");
  ok("welcome_1 playing with sound", (await muted()) === false);
  await page.screenshot({ path: path.join(ROOT, "screenshots", "02_welcome.png") });
  await step("riddle_1");
  ok("chained to riddle_1", (await src()).indexOf("riddle_1") >= 0);
  await page.screenshot({ path: path.join(ROOT, "screenshots", "03_riddle1.png") });
  await step("wait_1");
  ok("waiting loop started, muted", (await mode()) === "waiting" && (await muted()) === true, "src=" + await src());
  ok("input now enabled", (await inputDisabled()) === false);
  await page.screenshot({ path: path.join(ROOT, "screenshots", "04_waiting.png") });
  await step("wait_2");
  ok("waiting loop advances wait_1→wait_2", (await src()).indexOf("wait_2") >= 0);

  console.log("\n— wrong guess → try_again → riddle_1 → waiting —");
  await page.fill("#answerInput", "wrong answer");
  await page.click("#nextBtn");
  await stepTo("try_again");
  ok("try_again playing with sound", (await muted()) === false);
  await page.screenshot({ path: path.join(ROOT, "screenshots", "05_try_again.png") });
  await step("riddle_1");
  ok("riddle_1 restated", (await src()).indexOf("riddle_1") >= 0);
  await step("wait_1");
  ok("back to muted waiting", (await mode()) === "waiting" && (await muted()) === true);
  ok("feedback shows wrong", (await page.locator("#feedback").textContent()).indexOf("Not quite") >= 0);

  console.log("\n— hint → heres_a_hint → hint_1 → waiting (+ text lands) —");
  await page.click("#hintBtn");
  await stepTo("heres_a_hint");
  ok("heres_a_hint playing with sound", (await muted()) === false);
  await step("hint_1");
  ok("hint_1 playing", (await src()).indexOf("hint_1") >= 0);
  await page.screenshot({ path: path.join(ROOT, "screenshots", "06_hint.png") });
  await step("wait_1");
  ok("back to muted waiting", (await mode()) === "waiting" && (await muted()) === true);
  ok("hint text landed on screen", (await page.locator("#hintText").textContent()).length > 3);
  ok("hint button now 'Shown' + disabled", (await page.locator("#hintBtn").textContent()).indexOf("Shown") >= 0 && (await page.locator("#hintBtn").isDisabled()));

  console.log("\n— correct answer → the_answer_is → answer_1 → waiting —");
  await page.fill("#answerInput", "AGE"); // case-insensitive
  await page.click("#nextBtn");
  await stepTo("the_answer_is");
  ok("the_answer_is playing with sound", (await muted()) === false);
  await step("answer_1");
  ok("answer_1 playing", (await src()).indexOf("answer_1") >= 0);
  await page.screenshot({ path: path.join(ROOT, "screenshots", "07_answer.png") });
  await step("wait_1");
  ok("back to muted waiting after answer", (await mode()) === "waiting" && (await muted()) === true);
  ok("button now 'Next Riddle'", (await page.locator("#nextBtn").textContent()).indexOf("Next") >= 0);

  console.log("\n— next → riddle 2 (video set 2), correct one counted —");
  await page.click("#nextBtn");
  ok("progress at 1/10 after correct riddle 1", (await page.locator("#progressLabel").textContent()).indexOf("1 / 10") >= 0);
  await overlayWait();
  ok("riddle 2 shows start overlay", await overlayVisible());
  ok("riddle 2 text (anchor)", (await page.locator("#riddle").textContent()).indexOf("throw out") >= 0);
  await page.evaluate(() => window.__rq.clickStart());
  await stepTo("welcome_1");
  await step("riddle_2");
  ok("riddle_2 streaming", (await src()).indexOf("riddle_2") >= 0);
  await step("wait_1");
  ok("riddle_2 done, muted waiting", (await mode()) === "waiting" && (await muted()) === true);
  await page.screenshot({ path: path.join(ROOT, "screenshots", "08_riddle2.png") });

  console.log("\n— next → riddle 3 (video set 3) —");
  await page.click("#nextBtn");
  await overlayWait();
  await page.evaluate(() => window.__rq.clickStart());
  await stepTo("welcome_1");
  await step("riddle_3");
  ok("riddle_3 streaming", (await src()).indexOf("riddle_3") >= 0);
  await step("wait_1");
  ok("riddle_3 done, muted waiting", (await mode()) === "waiting" && (await muted()) === true);
  // blank answer → reveal path
  await page.click("#nextBtn");
  await stepTo("the_answer_is");
  await step("answer_3");
  ok("reveal path: answer_3 streamed", (await src()).indexOf("answer_3") >= 0);
  await step("wait_1");
  ok("waiting after reveal", (await mode()) === "waiting" && (await muted()) === true);
  await page.screenshot({ path: path.join(ROOT, "screenshots", "09_riddle3_reveal.png") });

  console.log("\n— next → riddle 4 (text-only, no videoSet) —");
  await page.click("#nextBtn");
  await page.waitForTimeout(150);
  ok("stage hidden for text-only riddle", (await stageVisible()) === false);
  ok("input enabled immediately (no video gate)", (await inputDisabled()) === false);
  await page.screenshot({ path: path.join(ROOT, "screenshots", "10_textonly.png") });

  console.log("\n— age switch to Kids 10+ (no video riddles) —");
  await page.click('.age-btn[data-age="over10"]');
  await page.waitForTimeout(150);
  ok("stage hidden for over10 deck", (await stageVisible()) === false);
  ok("deck count for over10", (await page.locator("#count").textContent()).indexOf("172") >= 0);

  console.log("\n— engine error log —");
  // generic "Failed to load resource" console noise is covered by the http404 tracker
  const real = consoleErrs.filter((t) => !t.includes("Failed to load resource"));
  ok("no console/page errors", real.length === 0, real.slice(0, 3).join(" | "));
  ok("no 404s on any asset", http404.length === 0, http404.join(" | ").slice(0, 200));

  failed = results.filter((r) => !r.pass).length;
} catch (e) {
  if (page) {
    try {
      const s = await page.evaluate(() => ({
        src: window.__rq.currentSrc(), muted: window.__rq.muted(), mode: window.__rq.engineMode(),
        btn: document.getElementById("nextBtn").textContent,
        overlay: !document.getElementById("startOverlay").classList.contains("hidden"),
        riddle: document.getElementById("riddle").textContent.slice(0, 40)
      }));
      console.log("\n  [SNAP on-crash] " + JSON.stringify(s));
    } catch (e2) { console.log("\n  [SNAP on-crash] <page gone: " + e2.message + ">"); }
  }
  throw e;
} finally {
  await browser.close();
  server.kill();
}

console.log("\n==== " + (results.length - failed) + "/" + results.length + " checks passed ====");
process.exit(failed ? 1 : 0);
