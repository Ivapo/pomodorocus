(() => {
  "use strict";

  // --- Constants ---
  const CIRCUMFERENCE = 2 * Math.PI * 90; // r=90 in SVG
  const MODES = { WORK: "Work", SHORT: "Short Break", LONG: "Long Break" };
  const MODE_VARS = { [MODES.WORK]: "--clr-work", [MODES.SHORT]: "--clr-short", [MODES.LONG]: "--clr-long" };
  const MODE_LABELS = { [MODES.WORK]: "Focus", [MODES.SHORT]: "Short Pause", [MODES.LONG]: "Long Pause" };
  const STORAGE_KEY = "pomodorocus_settings";
  const THEME_KEY = "pomodorocus_theme";
  const THEMES = ["ocus", "dark", "light", "3.1", "tui"];

  // --- DOM refs ---
  const $ = (id) => document.getElementById(id);
  const timerDisplay = $("timerDisplay");
  const progressRing = $("progressRing");
  const startPauseBtn = $("startPauseBtn");
  const timerBtn = $("timerBtn");
  const indicatorIcon = $("timerIndicator").querySelector(".timer-indicator__icon");
  const indicatorLabel = $("timerIndicator").querySelector(".timer-indicator__label");
  const resetBtn = $("resetBtn");
  const refreshBtn = $("refreshBtn");
  const themeToggle = $("themeToggle");
  const sessionDots = $("sessionDots");
  const settingsToggle = $("settingsToggle");
  const settingsPanel = $("settingsPanel");
  const settingsBackdrop = $("settingsBackdrop");
  const settingsSave = $("settingsSave");
  const workInput = $("workDuration");
  const shortInput = $("shortBreakDuration");
  const longInput = $("longBreakDuration");
  const sessionsInput = $("sessionsBeforeLong");

  // --- State ---
  let settings = loadSettings();
  let mode = MODES.WORK;
  let totalSeconds = settings.work * 60;
  let remaining = totalSeconds;
  let running = false;
  let intervalId = null;
  let completedWork = 0; // work sessions completed in current cycle

  // --- Settings persistence ---
  function defaultSettings() {
    return { work: 25, short: 5, long: 15, sessions: 4 };
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        return {
          work: clamp(s.work, 1, 120),
          short: clamp(s.short, 1, 30),
          long: clamp(s.long, 1, 60),
          sessions: clamp(s.sessions, 2, 10),
        };
      }
    } catch { /* ignore */ }
    return defaultSettings();
  }

  function saveSettings(s) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }

  function clamp(val, min, max) {
    const n = parseInt(val, 10);
    if (isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  // --- Indicator ---
  function updateIndicator() {
    if (running) {
      indicatorIcon.style.display = "none";
      indicatorLabel.style.display = "";
      indicatorLabel.textContent = MODE_LABELS[mode];
    } else {
      indicatorIcon.style.display = "";
      indicatorLabel.style.display = "none";
    }
  }

  // --- Timer logic ---
  function start() {
    if (running) return;
    running = true;
    startPauseBtn.textContent = "Pause";
    updateIndicator();
    playStart();
    intervalId = setInterval(tick, 1000);
  }

  function pause() {
    running = false;
    startPauseBtn.textContent = "Start";
    updateIndicator();
    playPause();
    clearInterval(intervalId);
    intervalId = null;
  }

  function reset() {
    pause();
    remaining = totalSeconds;
    updateDisplay();
  }

  function tick() {
    remaining--;
    if (remaining <= 0) {
      remaining = 0;
      updateDisplay();
      clearInterval(intervalId);
      intervalId = null;
      running = false;
      playBeep();
      advanceMode();
      setTimeout(() => start(), 0);
      return;
    }
    updateDisplay();
  }

  function setMode(newMode) {
    mode = newMode;
    switch (mode) {
      case MODES.WORK:
        totalSeconds = settings.work * 60;
        break;
      case MODES.SHORT:
        totalSeconds = settings.short * 60;
        break;
      case MODES.LONG:
        totalSeconds = settings.long * 60;
        break;
    }
    remaining = totalSeconds;
    const cssVar = MODE_VARS[mode];
    const color = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
    document.documentElement.style.setProperty("--clr-active", color);
    updateIndicator();
    updateDisplay();
    renderDots();
  }

  function advanceMode() {
    if (mode === MODES.WORK) {
      completedWork++;
      if (completedWork >= settings.sessions) {
        completedWork = 0;
        setMode(MODES.LONG);
      } else {
        setMode(MODES.SHORT);
      }
    } else {
      setMode(MODES.WORK);
    }
  }

  // --- Display ---
  function updateDisplay() {
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    timerDisplay.textContent =
      String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");

    const progress = totalSeconds > 0 ? remaining / totalSeconds : 1;
    const offset = CIRCUMFERENCE * (1 - progress);
    progressRing.style.strokeDasharray = CIRCUMFERENCE;
    progressRing.style.strokeDashoffset = offset;

    document.title = `${timerDisplay.textContent} — ${mode} | Pomodorocus`;
  }

  function renderDots() {
    sessionDots.innerHTML = "";
    for (let i = 0; i < settings.sessions; i++) {
      const dot = document.createElement("span");
      dot.className = "session-dot" + (i < completedWork ? " session-dot--done" : "");
      sessionDots.appendChild(dot);
    }
  }

  // --- Sound ---
  function playClick(freq, duration) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
      setTimeout(() => ctx.close(), 500);
    } catch { /* Web Audio not available */ }
  }

  function playStart() { playClick(600, 0.08); }
  function playPause() { playClick(400, 0.08); }

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);

      // Second beep
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.3);
      gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.3);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.1);
      osc2.start(ctx.currentTime + 0.3);
      osc2.stop(ctx.currentTime + 1.1);

      setTimeout(() => ctx.close(), 2000);
    } catch { /* Web Audio not available */ }
  }

  // --- Settings UI ---
  function openSettings() {
    workInput.value = settings.work;
    shortInput.value = settings.short;
    longInput.value = settings.long;
    sessionsInput.value = settings.sessions;
    settingsPanel.hidden = false;
  }

  function closeSettings() {
    settingsPanel.hidden = true;
  }

  function applySettings() {
    settings = {
      work: clamp(workInput.value, 1, 120),
      short: clamp(shortInput.value, 1, 30),
      long: clamp(longInput.value, 1, 60),
      sessions: clamp(sessionsInput.value, 2, 10),
    };
    saveSettings(settings);
    pause();
    completedWork = 0;
    setMode(MODES.WORK);
    closeSettings();
  }

  // --- Themes ---
  function applyTheme(name) {
    if (name === "ocus") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", name);
    }
    themeToggle.textContent = name;
    localStorage.setItem(THEME_KEY, name);
    // Refresh active color from new theme
    const cssVar = MODE_VARS[mode];
    const color = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
    document.documentElement.style.setProperty("--clr-active", color);
  }

  function cycleTheme() {
    const current = localStorage.getItem(THEME_KEY) || "ocus";
    const idx = THEMES.indexOf(current);
    const next = THEMES[(idx + 1) % THEMES.length];
    applyTheme(next);
  }

  // --- Event listeners ---
  function toggleStartPause() {
    running ? pause() : start();
  }

  startPauseBtn.addEventListener("click", toggleStartPause);
  timerBtn.addEventListener("click", toggleStartPause);
  resetBtn.addEventListener("click", reset);
  refreshBtn.addEventListener("click", () => location.reload());
  themeToggle.addEventListener("click", cycleTheme);
  settingsToggle.addEventListener("click", openSettings);
  settingsBackdrop.addEventListener("click", closeSettings);
  settingsSave.addEventListener("click", applySettings);

  // Close settings on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !settingsPanel.hidden) {
      closeSettings();
    }
  });

  // --- Init ---
  applyTheme(localStorage.getItem(THEME_KEY) || "ocus");
  setMode(MODES.WORK);

  // --- Service Worker Registration ---
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
