/* Riddle Quest — video stream engine
 *
 * Streams the character clips back-to-back on a single <video> element.
 * Two modes:
 *   - sequence: a list of clips with SOUND (e.g. welcome → riddle, or
 *     try_again, or the_answer_is → answer), then automatically hands over
 *     to the muted waiting loop.
 *   - waiting loop: wait_1 → wait_2 → wait_3 → wait_4 → …, MUTED, forever
 *     until the next sequence cuts in.
 *
 * Public API (window.VideoEngine):
 *   init({ stageEl })
 *   playSequence(urls, { onFirstPlaying }) — unmuted; cuts in over waiting loop
 *   startWaitingLoop()                      — muted
 *   stop()                                  — pause (host page hides the stage)
 *   isWaiting()
 */
(function () {
  "use strict";

  const V = (p) => "assets/videos/" + p;
  const CLIPS = {
    welcome: V("game_play/welcome_1.mp4"),
    riddle: (n) => V("riddles/riddle_" + n + ".mp4"),
    answer: (n) => V("answers/answer_" + n + ".mp4"),
    hint: (n) => V("hints/hint_" + n + ".mp4"),
    theAnswerIs: V("game_play/the_answer_is.mp4"),
    tryAgain: V("game_play/try_again.mp4"),
    heresAHint: V("game_play/heres_a_hint.mp4"),
    wait: (n) => V("waiting_videos/wait_" + n + ".mp4"),
  };
  const WAIT_COUNT = 4;

  let stage = null;               // the <video> element
  const preloadEl = document.createElement("video"); // hidden, just for buffering
  preloadEl.preload = "auto";
  preloadEl.muted = true;

  let queue = [];
  let mode = "idle";              // "sequence" | "waiting" | "idle"
  let waitIdx = 0;
  let onWaitingStartCb = null;

  // ── Structured log: every clip transition is visible in the console ──
  let _clipSeq = 0;              // monotonically increasing, for ordering
  function vlog(label, url) {
    _clipSeq++;
    const short = url ? url.split("/").slice(-2).join("/") : "(none)";
    // eslint-disable-next-line no-console
    console.log(
      "[video] #" + _clipSeq + " " + label,
      "→ " + short,
      "| mode=" + mode +
      " queue=[" + queue.map(u => u.split("/").pop()).join(", ") + "]" +
      " muted=" + (stage ? stage.muted : "?")
    );
  }

  function nextClip() {
    if (mode === "waiting") {
      waitIdx = (waitIdx + 1) % WAIT_COUNT;
      return CLIPS.wait(waitIdx + 1);
    }
    return queue.length ? queue.shift() : null;
  }

  // Pure peek: return the next clip's URL WITHOUT consuming it.
  // Used by preload() so that setClip's buffering call can't eat
  // the queue (was the root cause of riddle/hint/answer clips never playing).
  function peekNext() {
    if (mode === "waiting") {
      return CLIPS.wait(((waitIdx + 1) % WAIT_COUNT) + 1);
    }
    return queue.length ? queue[0] : null;
  }

  // Buffer the next clip while the current one plays, so the hand-off is gap-free.
  function preload(src) {
    if (!src) return;
    if (src === stage.src) return; // nothing new to buffer
    preloadEl.src = src;
  }

  function setClip(url) {
    stage.src = url;
    preload(peekNext());   // peek, not consume
  }

  // Single, well-logged play() call per state transition.
  // The host page hides its own overlay in the click handler, not on the
  // play() promise — that way an autoplay-policy rejection can't leave the
  // overlay frozen forever.
  function safePlay() {
    stage.play().catch(err => {
      // eslint-disable-next-line no-console
      console.warn("[video] play() rejected:", err);
    });
  }

  // Log a clip actually starting playback (fired once per clip).
  function onPlaying() {
    if (!stage) return;
    const short = (stage.currentSrc || "").split("/").pop() || "?";
    vlog("PLAYING", stage.currentSrc);
  }

  // Handle the end of a clip (or a failed load) by chaining the next one.
  // Only acts when the engine owns the stream (mode !== "idle"), so the
  // parked still-frame behind the start overlay never triggers a chain.
  function onEnded() {
    if (mode === "idle") return;
    vlog("ended", stage.currentSrc);

    const url = nextClip();
    if (url === null) {
      // Sequence finished → hand over to the muted waiting loop.
      vlog("sequence complete → waiting loop");
      mode = "waiting";
      waitIdx = 0;
      if (onWaitingStartCb) onWaitingStartCb();
      stage.muted = true; // waiting clips are muted, per the pilot rules
      setClip(CLIPS.wait(1));
      safePlay();
      return;
    }
    vlog("advance →", url);
    setClip(url);
    safePlay();
  }

  // A clip that fails to load never fires "ended" — don't let the stream stall.
  function onMediaError() {
    if (!stage || !stage.currentSrc || mode === "idle") return;
    // eslint-disable-next-line no-console
    console.error("[video] clip failed to load:", stage.src, stage.error);
    onEnded();
  }

  const api = {
    init(opts) {
      stage = opts.stageEl;
      stage.addEventListener("ended", onEnded);
      stage.addEventListener("error", onMediaError);
      stage.addEventListener("playing", onPlaying);  // fires once per actual play
      return api;
    },

    /** Unmuted clip sequence; takes over from the waiting loop instantly. */
    playSequence(urls) {
      if (!stage || !urls || !urls.length) return;
      queue = urls.slice();
      mode = "sequence";
      const first = queue.shift();
      stage.removeAttribute("muted");
      stage.muted = false;
      vlog("sequence start [" + urls.length + " clips]", first);
      setClip(first);
      safePlay();
    },

    /** Start the muted waiting loop (wait_1 → wait_2 → …). */
    startWaitingLoop() {
      if (!stage) return;
      vlog("waiting loop start");
      mode = "waiting";
      waitIdx = 0;
      if (onWaitingStartCb) onWaitingStartCb();
      stage.muted = true;
      setClip(CLIPS.wait(1));
      safePlay();
    },

    /** Pause playback (host page hides the stage; last frame stays put). */
    stop() {
      if (!stage) return;
      vlog("stop");
      mode = "idle";
      queue = [];
      stage.pause();
    },

    setOnWaitingStart(cb) { onWaitingStartCb = cb; return api; },

    isWaiting() { return mode === "waiting"; },

    clips: CLIPS,
  };

  window.VideoEngine = api;
})();
