import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const server = spawn("python3", ["-m", "http.server", "8745", "--bind", "127.0.0.1", "--directory", ROOT], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 700));
const browser = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required"],
  executablePath: "/home/fred-terzi/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome"
});
try {
  const page = await browser.newPage();
  page.on("console", m => console.log("CONSOLE[" + m.type() + "]", m.text()));
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await page.goto("http://127.0.0.1:8745/index.html", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__rq);
  const out = await page.evaluate(async () => {
    const v = document.getElementById("stageVideo");
    const log = [];
    const t0 = performance.now();
    const ts = () => (performance.now() - t0).toFixed(0).padStart(5);
    ["loadedmetadata","loadeddata","canplay","playing","pause","seeked","waiting","error","ended","emptied","stalled"].forEach(t =>
      v.addEventListener(t, () => log.push(
        "[" + ts() + "ms] " + t + " clip=" + (v.dataset.clip||"-") +
        " t=" + (isFinite(v.currentTime) ? v.currentTime.toFixed(2) : "NaN") + " d=" + (isFinite(v.duration) ? v.duration.toFixed(2) : "NaN")
      )));
    log.push("parked: " + (v.dataset.clip || "-"));
    window.__rq.clickStart();
    await new Promise(r => setTimeout(r, 2500));
    log.push(">> 2.5s later: clip=" + (v.dataset.clip||"-") + " paused=" + v.paused + " playing=" + !v.paused);
    return log;
  });
  out.forEach(l => console.log(l));
} finally {
  await browser.close();
  server.kill();
}
