/* Riddle Quest — video stream engine
 *
 * Streams the character clips back-to-back with seamless hand-offs so there is
 * never a black frame between clips.
 *
 * How it works
 * ────────────
 * Two fixed <video> elements are stacked (both absolutely positioned inside the
 * stage). One is always the ACTIVE layer (opacity 1, playing); the other is the
 * STANDBY layer (opacity 0, pre-rolling the next clip).
 *
 * Every cut does the same thing:
 *   1. Load the next clip on the STANDBY layer.
 *   2. Wait until that layer has actually PRESENTED a frame to the screen.
 *      We gate on `requestVideoFrameCallback` (fires after a real frame is
 *      composited) — the `playing` event alone fires a frame or two early and
 *      lets a black frame through. A `requestAnimationFrame` fallback covers
 *      browsers without rVFC (e.g. Safari), and a hard timeout is the last
 *      resort.
 *   3. Crossfade: make the STANDBY layer active, fade the old one out.
 *   4. Swap: the old active layer becomes the new standby for the next cut.
 *
 * The visible surface therefore never clears to black — the outgoing clip stays
 * on screen (fading out) until the incoming clip is guaranteed to be playing.
 *
 * If the standby layer can't autoplay (NotAllowedError, a real error, or a
 * timeout) we fall back to a direct swap on the ACTIVE layer. That is the safe
 * path — playback always continues — and it only shows the brief black frame
 * that a plain single-<video> swap would show.
 *
 * Two modes
 * ─────────
 *   sequence: a list of clips with SOUND (welcome → riddle, try_again,
 *             the_answer_is → answer, etc.), then hands off to the waiting loop.
 *   waiting:  wait_1 → wait_2 → wait_3 → wait_4 → …, MUTED, forever until the
 *             next sequence cuts in.
 *
 * Public API (window.VideoEngine)
 * ───────────────────────────────
 *   init({ stageEl, backEl })
 *   playSequence(urls)           — unmuted; cuts in over the waiting loop
 *   startWaitingLoop()           — muted
 *   park(url)                    — freeze first frame behind the start overlay
 *   stop()                       — pause (host page hides the stage)
 *   isWaiting()                  — true while in the waiting loop
 *   activeClip()                 — raw URL currently on screen
 *   activePlaying()              — true if the active clip is playing
 *   clips                        — the CLIPS name table
 */
(function () {
  "use strict";

  const V = (p) => "assets/videos/" + p;
  const CLIPS = {
    welcome:     V("game_play/welcome_1.mp4"),
    riddle:      (n) => V("riddles/riddle_" + n + ".mp4"),
    answer:      (n) => V("answers/answer_" + n + ".mp4"),
    hint:        (n) => V("hints/hint_" + n + ".mp4"),
    theAnswerIs: V("game_play/the_answer_is.mp4"),
    tryAgain:    V("game_play/try_again.mp4"),
    heresAHint:  V("game_play/heres_a_hint.mp4"),
    wait:        (n) => V("waiting_videos/wait_" + n + ".mp4"),
  };
  const WAIT_COUNT = 4;

  // ── Blob pool ──────────────────────────────────────────────────────────────
  // Fetch every clip once at init and hold object URLs in memory.
  // setClip() uses the object URL — no repeated network GETs.
  const PILOT_RIDDLES = 3;
  const ALL_CLIPS = [
    CLIPS.welcome, CLIPS.theAnswerIs, CLIPS.tryAgain, CLIPS.heresAHint,
    ...Array.from({ length: PILOT_RIDDLES }, (_, i) => CLIPS.riddle(i + 1)),
    ...Array.from({ length: PILOT_RIDDLES }, (_, i) => CLIPS.hint(i + 1)),
    ...Array.from({ length: PILOT_RIDDLES }, (_, i) => CLIPS.answer(i + 1)),
    ...Array.from({ length: WAIT_COUNT },   (_, i) => CLIPS.wait(i + 1)),
  ];
  const pool = new Map();   // rawUrl → objectURL
  const objUrl = (raw) => pool.has(raw) ? pool.get(raw) : raw;

  async function warmPool() {
    try {
      const entries = await Promise.all(ALL_CLIPS.map(async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(url + " → HTTP " + res.status);
        return [url, URL.createObjectURL(await res.blob())];
      }));
      entries.forEach(([raw, bu]) => pool.set(raw, bu));
      console.log("[video] blob pool warmed: " + pool.size + "/" + ALL_CLIPS.length + " clips");
    } catch (e) {
      console.warn("[video] blob pool partial (falling back to raw URLs):", e.message);
    }
  }

  // ── Layer state ────────────────────────────────────────────────────────────
  // `active`  = the <video> element currently on screen (top, opacity 1)
  // `standby` = the <video> element pre-rolling the next clip (bottom, opacity 0)
  // `activeEl` and `standbyEl` are the two fixed elements from init.
  let activeEl  = null;
  let standbyEl = null;
  let queue     = [];
  let mode      = "idle";   // "sequence" | "waiting" | "idle"
  let waitIdx   = 0;
  let onWaitingStartCb = null;

  // ── Structured log ─────────────────────────────────────────────────────────
  let _seq = 0;
  function vlog(label, url) {
    _seq++;
    const short = url ? url.split("/").slice(-2).join("/") : "(none)";
    const activeClipName = activeEl ? (activeEl.dataset.clip || "(none)") : "(none)";
    console.log(
      "[video] #" + _seq + " " + label,
      "→ " + short,
      "| mode=" + mode +
      " queue=[" + queue.map(u => u.split("/").pop()).join(", ") + "]" +
      " active=" + activeClipName +
      " muted=" + (activeEl ? activeEl.muted : "?")
    );
  }

  // ── Element helpers ────────────────────────────────────────────────────────
  function setClipOn(el, rawUrl, muted) {
    el.muted = !!muted;
    el.currentTime = 0;
    el.src = objUrl(rawUrl);
    el.dataset.clip    = rawUrl.split("/").pop();
    el.dataset.clipUrl = rawUrl;
  }

  // Returns a Promise that resolves only once `el` has PRESENTED a real frame
  // to the compositor. We gate on `requestVideoFrameCallback` because the
  // `playing` event fires before the first frame is actually on screen —
  // promoting on `playing` is what leaked the last black frame through.
  //
  // Fallback for browsers without rVFC (e.g. Safari): `playing` + two nested
  // requestAnimationFrame ticks, which lets the compositor actually paint.
  //
  // `AbortError` from play() is normal and NOT a failure — it just means a
  // previous play() was superseded. Only a real `error` event or a hard
  // timeout rejects this promise.
  function showingFrame(el, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn) => { if (!settled) { settled = true; fn(); } };
      const timer = setTimeout(
        () => settle(() => reject(new Error("showingFrame timeout"))),
        timeoutMs
      );
      const onFrame = () => {
        clearTimeout(timer);
        settle(resolve);
      };
      el.addEventListener("error", () => {
        clearTimeout(timer);
        settle(() => reject(new Error("element error")));
      }, { once: true });

      // Register the frame-presented gate BEFORE starting playback so the very
      // first presented frame is not missed.
      if (typeof el.requestVideoFrameCallback === "function") {
        el.requestVideoFrameCallback(onFrame);
      } else {
        el.addEventListener("playing", () => {
          requestAnimationFrame(() => requestAnimationFrame(onFrame));
        }, { once: true });
      }

      const p = el.play();
      if (p && p.catch) p.catch((err) => {
        if (err && err.name === "AbortError") return;   // superseded — not a fault
        clearTimeout(timer);
        settle(() => reject(err));
      });
    });
  }

  // Promote standby over active (crossfade), then demote old active to standby.
  function promote(newActive, oldActive) {
    newActive.classList.add("active");
    oldActive.classList.remove("active");
    activeEl  = newActive;
    standbyEl = oldActive;
    oldActive.pause();
  }

  // Safe, no-black handoff. Loads clip on the standby layer, waits for a real
  // frame, then crossfades. Falls back to directCut if standby can't autoplay.
  async function cutTo(rawUrl, muted) {
    if (!activeEl) { return; }
    if (!standbyEl) { directCut(rawUrl, muted); return; }

    setClipOn(standbyEl, rawUrl, muted);
    try {
      await showingFrame(standbyEl);
    } catch (err) {
      console.warn("[video] crossfade fallback (direct swap):", err && err.name || err);
      directCut(rawUrl, muted);
      return;
    }
    promote(standbyEl, activeEl);
  }

  // Direct swap on the active layer. Safe but can show a brief black frame —
  // used only as the fallback when the crossfade path fails.
  function directCut(rawUrl, muted) {
    if (!activeEl) return;
    setClipOn(activeEl, rawUrl, muted);
    const p = activeEl.play();
    if (p && p.catch) p.catch((err) => {
      if (err && err.name === "AbortError") return;
      console.warn("[video] play() rejected:", err);
    });
  }

  // ── Queue / mode state machine ─────────────────────────────────────────────
  function nextClip() {
    if (mode === "waiting") {
      waitIdx = (waitIdx + 1) % WAIT_COUNT;
      return CLIPS.wait(waitIdx + 1);
    }
    return queue.length ? queue.shift() : null;
  }

  function onEnded() {
    if (mode === "idle") return;
    vlog("ended", activeEl ? activeEl.dataset.clipUrl : null);

    const url = nextClip();
    if (url === null) {
      vlog("sequence complete → waiting loop");
      mode = "waiting";
      waitIdx = 0;
      if (onWaitingStartCb) onWaitingStartCb();
      cutTo(CLIPS.wait(1), true);
      return;
    }
    vlog("advance →", url);
    cutTo(url, false);
  }

  function onPlaying() {
    if (activeEl) vlog("PLAYING", activeEl.dataset.clipUrl);
  }

  function onMediaError() {
    if (!activeEl || mode === "idle") return;
    console.error("[video] clip failed to load:", activeEl.dataset.clipUrl, activeEl.error);
    onEnded();
  }

  // Event wiring — only the active element drives the state machine.
  // We bind to both elements and check the target, so the binding survives
  // the promote/swap without re-wiring.
  const wireHandler = (el) => {
    el.addEventListener("ended",   () => { if (el === activeEl) onEnded(); });
    el.addEventListener("playing", () => { if (el === activeEl) onPlaying(); });
    el.addEventListener("error",   () => { if (el === activeEl) onMediaError(); });
  };

  const api = {
    init(opts) {
      activeEl  = opts.stageEl;
      standbyEl = opts.backEl || null;
      if (activeEl) { activeEl.classList.add("active"); wireHandler(activeEl); }
      if (standbyEl) { wireHandler(standbyEl); }
      warmPool();   // fire-and-forget; pool is best-effort
      return api;
    },

    playSequence(urls) {
      if (!activeEl || !urls || !urls.length) return;
      queue = urls.slice();
      mode = "sequence";
      const first = queue.shift();
      vlog("sequence start [" + urls.length + " clips]", first);
      cutTo(first, false);
    },

    startWaitingLoop() {
      if (!activeEl) return;
      vlog("waiting loop start");
      mode = "waiting";
      waitIdx = 0;
      if (onWaitingStartCb) onWaitingStartCb();
      cutTo(CLIPS.wait(1), true);
    },

    /** Freeze first frame behind the start overlay (muted, paused, no autoplay). */
    park(rawUrl) {
      if (!activeEl) return;
      setClipOn(activeEl, rawUrl, true);
      activeEl.pause();
      const trySeek = () => { try { activeEl.currentTime = 0.05; } catch (e) {} };
      if (activeEl.readyState >= 2) trySeek();
      else activeEl.addEventListener("loadeddata", trySeek, { once: true });
    },

    stop() {
      if (activeEl)  activeEl.pause();
      if (standbyEl) standbyEl.pause();
      vlog("stop");
      mode = "idle";
      queue = [];
    },

    setOnWaitingStart(cb) { onWaitingStartCb = cb; return api; },

    isWaiting()     { return mode === "waiting"; },
    activeClip()    { return activeEl ? (activeEl.dataset.clipUrl || "") : ""; },
    activePlaying() { return !!(activeEl && !activeEl.paused && activeEl.readyState >= 2); },
    activeMuted()   { return !!(activeEl && activeEl.muted); },

    clips: CLIPS,
  };

  window.VideoEngine = api;
})();
