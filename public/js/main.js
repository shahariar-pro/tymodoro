/**
 * main.js - Application entry point
 * Wires timer engine, background Web Worker, storage migration, UI, audio alarms,
 * PWA Service Worker, Screen Wake Lock, Document Picture-in-Picture, and Focus Mode.
 */

import * as timer from "./timer.js";
import * as storage from "./storage.js";
import { getStatsSummary, getDailyGoalProgress } from "./stats.js";
import * as tasks from "./tasks.js";
import * as audio from "./audio.js";
import { showToast } from "./ui/toasts.js";
import { initModals, openModal, closeModal, openSkipModal, closeSkipModal } from "./ui/modals.js";
import { showSettingsModal } from "./ui/settings.js";
import { showStatsModal, renderCalendar } from "./ui/stats-view.js";

// Dev-only speed scaling from URL param (?speed=N)
const urlParams = new URLSearchParams(window.location.search);
const parsedSpeed = parseFloat(urlParams.get("speed"));
const speed = !isNaN(parsedSpeed) && parsedSpeed > 0 ? parsedSpeed : 1;
if (speed !== 1) {
  console.info(`[Tymodoro] Running in fast-forward dev mode: speed = ${speed}x`);
}

// App State
let settings = null;
let timerState = null;
let sessions = [];
let currentTheme = "dark";
let themePreviewActive = null;
let currentMonthDate = new Date();
let tickWorker = null;
let fallbackInterval = null;
let floatingWindow = null;
let pipWindow = null;
let isDraggingWidget = false;
let lastPersistTime = 0;
let titleFlashInterval = null;
let wakeLock = null;
let isFocusModeActive = false;

// Notification permission state
let notificationPermission =
  typeof window !== "undefined" && "Notification" in window
    ? Notification.permission === "granted"
    : false;

function onQuotaError(err, key) {
  showToast("Storage quota exceeded. Some changes could not be saved.", 5000, "error");
}

/**
 * Initialize application
 */
document.addEventListener("DOMContentLoaded", () => {
  // 1. Run idempotent schema migration (v1 -> v2)
  storage.migrateToV2(window.localStorage, onQuotaError);

  // 2. Load stored data
  settings = storage.loadSettings(window.localStorage);
  sessions = storage.loadSessions(window.localStorage);
  currentTheme = storage.loadTheme(window.localStorage);
  document.body.setAttribute("data-theme", currentTheme);
  updateMetaThemeColor(currentTheme);

  // 3. Initialize modals & tasks
  initModals();
  tasks.initTasks(window.localStorage, (taskText, taskId) => {
    if (timerState) {
      timerState.taskId = taskId;
      storage.saveTimerState(window.localStorage, timerState, onQuotaError);
    }
    updateSessionLabel();
    updateFloatingWindow();
    updatePipWindow();
    updateFocusModeDisplay();
  });

  // 4. Restore or initialize timer state
  const savedTimer = storage.loadTimerState(window.localStorage);
  const now = Date.now();
  const restoration = timer.restore(savedTimer, now, settings, speed);
  timerState = restoration.state;

  if (restoration.awayCompleted && restoration.completedSession) {
    handleSessionCompleted(restoration.completedSession);
    showToast("Your session finished while you were away", 5000);
  }

  // 5. Setup tick source (Web Worker with fallback interval)
  initTickSource();

  // 6. Audio context unlock on first user gesture
  const unlockAudio = () => {
    audio.initAudioContext();
    document.removeEventListener("click", unlockAudio);
    document.removeEventListener("touchstart", unlockAudio);
  };
  document.addEventListener("click", unlockAudio, { once: true });
  document.addEventListener("touchstart", unlockAudio, { once: true });

  // 7. Wire UI controls & keyboard shortcuts
  setupUIEventListeners();
  setupKeyboardShortcuts();
  setupFloatingWidgetDrag();

  // 8. Register Service Worker for PWA
  registerServiceWorker();

  // 9. Initial render
  updateSoundIndicator();
  updateDisplay();
  updateSessionLabel();
  renderCalendar(
    currentMonthDate,
    tasks.getCurrentCalendarDate(),
    sessions,
    settings,
    handleSelectCalendarDate,
  );
  updateThemeSelector();

  // 10. Handle PWA shortcut action (?action=focus)
  if (urlParams.get("action") === "focus" && timerState.status === timer.STATUS.IDLE) {
    toggleTimer();
  }

  // 11. Document visibility change
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // 12. Message listener for floating popup window
  window.addEventListener("message", handleWindowMessage);

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
});

/**
 * PWA Service Worker Registration
 */
function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const isLocalhost = Boolean(
    window.location.hostname === "localhost" ||
      window.location.hostname === "[::1]" ||
      window.location.hostname.match(
        /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/,
      ),
  );

  if (window.location.protocol === "https:" || isLocalhost) {
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (
              installingWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              showToast("Update available! Click to reload.", 0, "info");
              const container = document.getElementById("toastContainer");
              const latest = container?.lastElementChild;
              if (latest) {
                latest.style.cursor = "pointer";
                latest.addEventListener("click", () => {
                  installingWorker.postMessage({ type: "SKIP_WAITING" });
                  window.location.reload();
                });
              }
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[Tymodoro] Service Worker registration failed:", err);
      });
  }
}

/**
 * Dynamic meta theme-color update
 */
function updateMetaThemeColor(theme) {
  const themeColors = {
    dark: "#000000",
    light: "#ffffff",
    ocean: "#0f172a",
    forest: "#0f1419",
    sunset: "#1a1625",
    purple: "#1e1b4b",
    rose: "#1f0f1a",
    blush: "#faf8f7",
  };
  const color = themeColors[theme] || "#000000";
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
}

/**
 * Tick Source: Web Worker with setInterval fallback
 */
function initTickSource() {
  try {
    tickWorker = new Worker("js/tick-worker.js");
    tickWorker.addEventListener("message", () => {
      onTick();
    });
    if (timerState.status === timer.STATUS.RUNNING) {
      tickWorker.postMessage("start");
    }
  } catch (err) {
    console.warn("[Tymodoro] Web Worker creation failed, using setInterval fallback:", err);
    tickWorker = null;
    if (timerState.status === timer.STATUS.RUNNING) {
      startFallbackInterval();
    }
  }
}

function startFallbackInterval() {
  if (!fallbackInterval) {
    fallbackInterval = setInterval(() => {
      onTick();
    }, 250);
  }
}

function stopFallbackInterval() {
  if (fallbackInterval) {
    clearInterval(fallbackInterval);
    fallbackInterval = null;
  }
}

function onTick() {
  if (!timerState || timerState.status !== timer.STATUS.RUNNING) return;

  const now = Date.now();
  const tickResult = timer.tick(timerState, now, settings, speed);
  timerState = tickResult.state;

  if (tickResult.event === "completed") {
    if (tickWorker) tickWorker.postMessage("stop");
    stopFallbackInterval();

    handleSessionCompleted(tickResult.completedSession);

    if (tickResult.autoStarted) {
      const isBreak =
        timerState.phase === timer.PHASES.SHORT_BREAK ||
        timerState.phase === timer.PHASES.LONG_BREAK;
      const autoStartTitle = isBreak ? "Break started" : "Focus started";

      if (
        settings.notificationsOn &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(autoStartTitle, {
            body: isBreak ? "Enjoy your well-deserved break!" : "Time to dive back into deep focus!",
            icon: "icons/icon-192.png",
            badge: "icons/icon-192.png",
            tag: "tymodoro-session",
          });
        } catch (e) {}
      }

      announceToScreenReader(autoStartTitle);

      if (tickWorker) tickWorker.postMessage("start");
      else startFallbackInterval();

      if (timerState.phase === timer.PHASES.WORK) {
        acquireWakeLock();
      }
    }
  }

  updateDisplay();

  // Persist timer state every ~5s while running
  if (now - lastPersistTime >= 5000 || tickResult.event === "completed") {
    lastPersistTime = now;
    storage.saveTimerState(window.localStorage, timerState, onQuotaError);
  }
}

function handleSessionCompleted(completedSession) {
  releaseWakeLock();

  if (completedSession) {
    if (timerState?.taskId) {
      const incrementResult = tasks.incrementTaskPomodoro(timerState.taskId, window.localStorage);
      if (incrementResult) {
        completedSession.taskId = incrementResult.taskId;
        completedSession.tag = incrementResult.tag;
        completedSession.taskName = incrementResult.taskName;
      }
    }

    sessions.push(completedSession);
    storage.appendSession(window.localStorage, completedSession, onQuotaError);
    renderCalendar(
      currentMonthDate,
      tasks.getCurrentCalendarDate(),
      sessions,
      settings,
      handleSelectCalendarDate,
    );

    // Celebrate Daily Goal completion once
    const goalProgress = getDailyGoalProgress(sessions, settings.dailyGoal);
    if (goalProgress.todayCount === goalProgress.goal) {
      showToast("🎉 Daily Goal achieved! Great work!", 5000);
    }
  }

  // 1. Play Synthesized Alarm
  audio.playAlarm(
    settings.alarmSound || "chime",
    settings.alarmVolume ?? 0.6,
    settings.alarmRepeat ?? 1,
    settings.soundOn,
  );

  // 2. Vibration feedback on mobile devices
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch (e) {}
  }

  // 3. Tab Title Flash
  startTitleFlash("🔔 Time's Up!");

  // 4. Screen Reader Announcement
  announceToScreenReader(
    timerState.phase === timer.PHASES.WORK
      ? "Break completed. Ready to focus."
      : "Focus session completed. Time for a break.",
  );

  // 5. Desktop Notifications
  if (
    settings.notificationsOn &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    const isWorkCompleted =
      timerState.phase === timer.PHASES.SHORT_BREAK ||
      timerState.phase === timer.PHASES.LONG_BREAK;
    const title = "TYMODORO";
    const body = isWorkCompleted
      ? `Amazing! You completed a ${settings.focusTime}-minute deep focus session!`
      : `Break completed! Ready to focus again?`;

    try {
      new Notification(title, {
        body,
        icon: "icons/icon-192.png",
        badge: "icons/icon-192.png",
        tag: "tymodoro-session",
      });
    } catch (e) {}
  }

  storage.saveTimerState(window.localStorage, timerState, onQuotaError);
  updateSessionLabel();
  updateDisplay();
}

/**
 * Tab Title Flash on Completion
 */
function startTitleFlash(flashText) {
  stopTitleFlash();
  let toggle = false;
  titleFlashInterval = setInterval(() => {
    document.title = toggle ? flashText : "TYMODORO - Focus Timer";
    toggle = !toggle;
  }, 1000);

  const clearFlash = () => {
    stopTitleFlash();
    updateDisplay();
    window.removeEventListener("focus", clearFlash);
    window.removeEventListener("click", clearFlash);
  };
  window.addEventListener("focus", clearFlash);
  window.addEventListener("click", clearFlash);
}

function stopTitleFlash() {
  if (titleFlashInterval) {
    clearInterval(titleFlashInterval);
    titleFlashInterval = null;
  }
}

/**
 * Screen Wake Lock API
 */
async function acquireWakeLock() {
  if (
    settings?.keepAwake &&
    timerState?.status === timer.STATUS.RUNNING &&
    timerState?.phase === timer.PHASES.WORK &&
    typeof navigator !== "undefined" &&
    "wakeLock" in navigator &&
    !wakeLock
  ) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    } catch (err) {
      console.warn("[Tymodoro] Screen Wake Lock request failed:", err);
    }
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

/**
 * Screen Reader Announcement
 */
function announceToScreenReader(message) {
  const el = document.getElementById("timerAnnouncement");
  if (el) {
    el.textContent = "";
    setTimeout(() => {
      el.textContent = message;
    }, 50);
  }
}

/**
 * Handle tab visibility change
 */
function handleVisibilityChange() {
  if (!document.hidden && timerState && timerState.status === timer.STATUS.RUNNING) {
    onTick();
    acquireWakeLock();
  }
}

/**
 * Timer action handlers
 */
async function toggleTimer() {
  const now = Date.now();
  stopTitleFlash();

  // Unlock audio context on user action for iOS/Safari
  audio.initAudioContext();

  if (timerState.status === timer.STATUS.RUNNING) {
    releaseWakeLock();
    timerState = timer.pause(timerState, now, speed);
    if (tickWorker) tickWorker.postMessage("stop");
    stopFallbackInterval();
    announceToScreenReader("Timer paused");
  } else {
    // Request notification permission if enabled and default
    if (
      settings.notificationsOn &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      try {
        const perm = await Notification.requestPermission();
        notificationPermission = perm === "granted";
      } catch (e) {}
    }

    timerState = timer.start(timerState, now, speed);
    if (tickWorker) tickWorker.postMessage("start");
    else startFallbackInterval();

    if (timerState.phase === timer.PHASES.WORK) {
      acquireWakeLock();
    }
    announceToScreenReader("Timer started");
  }

  storage.saveTimerState(window.localStorage, timerState, onQuotaError);
  updateDisplay();
  updateFloatingWindow();
  updatePipWindow();
  updateFocusModeDisplay();
}

function resetTimer() {
  stopTitleFlash();
  releaseWakeLock();

  if (tickWorker) tickWorker.postMessage("stop");
  stopFallbackInterval();

  timerState = timer.reset(timerState, settings);
  storage.saveTimerState(window.localStorage, timerState, onQuotaError);
  announceToScreenReader("Timer reset");

  updateDisplay();
  updateFloatingWindow();
  updatePipWindow();
  updateFocusModeDisplay();
}

function skipSession() {
  stopTitleFlash();
  releaseWakeLock();

  const now = Date.now();
  const skipResult = timer.skip(timerState, now, settings, speed, false);

  if (skipResult.event === "confirm_skip") {
    openSkipModal(
      skipResult.percentComplete,
      () => {
        // Confirm skip anyway (abandon without logging)
        if (tickWorker) tickWorker.postMessage("stop");
        stopFallbackInterval();

        const forced = timer.skip(timerState, Date.now(), settings, speed, true);
        timerState = forced.state;
        storage.saveTimerState(window.localStorage, timerState, onQuotaError);
        announceToScreenReader("Session skipped");

        updateDisplay();
        updateSessionLabel();
        updateFloatingWindow();
        updatePipWindow();
        updateFocusModeDisplay();
      },
      () => {
        // Cancel skip
      },
    );
    return;
  }

  if (tickWorker) tickWorker.postMessage("stop");
  stopFallbackInterval();

  timerState = skipResult.state;
  if (skipResult.completedSession) {
    handleSessionCompleted(skipResult.completedSession);
  } else {
    storage.saveTimerState(window.localStorage, timerState, onQuotaError);
  }

  announceToScreenReader("Session skipped");
  updateDisplay();
  updateSessionLabel();
  updateFloatingWindow();
  updatePipWindow();
  updateFocusModeDisplay();
}

/**
 * Display and UI rendering
 */
function updateDisplay() {
  if (!timerState) return;

  const minutes = Math.max(0, Math.floor(timerState.remainingSec / 60));
  const seconds = Math.max(0, timerState.remainingSec % 60);
  const displayText = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const timerDisplayEl = document.getElementById("timerDisplay");
  if (timerDisplayEl) timerDisplayEl.textContent = displayText;

  const floatingTimerTime = document.getElementById("floatingTimerTime");
  if (floatingTimerTime) floatingTimerTime.textContent = displayText;

  // Progress ring
  const progressCircle = document.getElementById("progressCircle");
  if (progressCircle) {
    const progress =
      ((timerState.plannedSec - timerState.remainingSec) / timerState.plannedSec) * 100;
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (progress / 100) * circumference;
    progressCircle.style.strokeDashoffset = offset;
  }

  // Play/Pause icon
  const playIcon = document.getElementById("playIcon");
  const floatingPlayIcon = document.getElementById("floatingPlayIcon");
  const isRunning = timerState.status === timer.STATUS.RUNNING;

  if (playIcon) playIcon.setAttribute("data-lucide", isRunning ? "pause" : "play");
  if (floatingPlayIcon) floatingPlayIcon.setAttribute("data-lucide", isRunning ? "pause" : "play");

  // Timer Status
  const timerStatusEl = document.getElementById("timerStatus");
  if (timerStatusEl) {
    if (isRunning) {
      timerStatusEl.textContent = "In Progress";
    } else if (timerState.remainingSec < timerState.plannedSec) {
      timerStatusEl.textContent = "Paused";
    } else {
      timerStatusEl.textContent = "Ready to Start";
    }
  }

  // Live document title countdown (if title flash is not active)
  if (!titleFlashInterval) {
    if (isRunning) {
      const phaseName =
        timerState.phase === timer.PHASES.WORK
          ? "Focus"
          : timerState.phase === timer.PHASES.SHORT_BREAK
            ? "Short Break"
            : "Long Break";
      document.title = `${displayText} · ${phaseName}`;
    } else if (timerState.remainingSec < timerState.plannedSec) {
      document.title = `${displayText} · Paused`;
    } else {
      document.title = "TYMODORO - Focus Timer";
    }
  }

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }

  updateFloatingWindow();
  updatePipWindow();
  updateFocusModeDisplay();
}

function updateSessionLabel() {
  const sessionLabel = document.getElementById("sessionLabel");
  const floatingSessionLabel = document.getElementById("floatingSessionLabel");
  if (!sessionLabel) return;

  let labelText = "Deep Focus Session";
  if (timerState.phase === timer.PHASES.SHORT_BREAK) {
    labelText = "Quick Recharge";
  } else if (timerState.phase === timer.PHASES.LONG_BREAK) {
    labelText = "Extended Break";
  } else if (timerState.taskId) {
    const taskText = tasks.getSelectedTaskText();
    if (taskText) labelText = taskText;
  }

  sessionLabel.textContent = labelText;
  if (floatingSessionLabel) floatingSessionLabel.textContent = labelText;
}

function updateSoundIndicator() {
  const indicator = document.getElementById("soundIndicator");
  if (!indicator) return;
  const icon = indicator.querySelector("i");
  if (!icon) return;

  if (settings.soundOn) {
    indicator.classList.remove("muted");
    icon.setAttribute("data-lucide", "bell");
  } else {
    indicator.classList.add("muted");
    icon.setAttribute("data-lucide", "bell-off");
  }
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function toggleSound() {
  settings.soundOn = !settings.soundOn;
  storage.saveSettings(window.localStorage, settings, onQuotaError);
  updateSoundIndicator();
  announceToScreenReader(settings.soundOn ? "Sound unmuted" : "Sound muted");
}

/**
 * Themes
 */
function setTheme(theme) {
  currentTheme = theme;
  document.body.setAttribute("data-theme", theme);
  updateMetaThemeColor(theme);
  storage.saveTheme(window.localStorage, theme, onQuotaError);
  updateThemeSelector();
  hideThemeSelector();
  themePreviewActive = null;
  updateFloatingWindow();
  updatePipWindow();
}

function previewTheme(theme) {
  themePreviewActive = currentTheme;
  document.body.setAttribute("data-theme", theme);
  updateMetaThemeColor(theme);
}

function revertTheme() {
  if (themePreviewActive) {
    document.body.setAttribute("data-theme", themePreviewActive);
    updateMetaThemeColor(themePreviewActive);
    themePreviewActive = null;
  }
}

function updateThemeSelector() {
  document.querySelectorAll(".theme-option").forEach((opt) => {
    if (opt.dataset.theme === currentTheme) {
      opt.classList.add("active");
    } else {
      opt.classList.remove("active");
    }
  });
}

function showThemeSelector() {
  closeAllPanels();
  const sel = document.getElementById("themeSelector");
  if (sel) sel.style.display = "block";
}

function hideThemeSelector() {
  const sel = document.getElementById("themeSelector");
  if (sel) sel.style.display = "none";
}

/**
 * Calendar handlers
 */
function handleSelectCalendarDate(date) {
  tasks.setCalendarDate(date, window.localStorage);
  renderCalendar(
    currentMonthDate,
    tasks.getCurrentCalendarDate(),
    sessions,
    settings,
    handleSelectCalendarDate,
  );
}

function prevMonth() {
  currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
  renderCalendar(
    currentMonthDate,
    tasks.getCurrentCalendarDate(),
    sessions,
    settings,
    handleSelectCalendarDate,
  );
}

function nextMonth() {
  currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
  renderCalendar(
    currentMonthDate,
    tasks.getCurrentCalendarDate(),
    sessions,
    settings,
    handleSelectCalendarDate,
  );
}

function toggleCalendar() {
  const calendarSection = document.getElementById("calendarSection");
  const mainContent = document.getElementById("mainContent");
  if (!calendarSection || !mainContent) return;

  const isHidden = calendarSection.classList.contains("hidden");
  if (isHidden) {
    calendarSection.classList.remove("hidden");
    mainContent.classList.add("with-calendar");
    mainContent.classList.remove("timer-only");
  } else {
    calendarSection.classList.add("hidden");
    mainContent.classList.remove("with-calendar");
    mainContent.classList.add("timer-only");
  }
}

function toggleTodoList() {
  const todoSection = document.getElementById("todoSection");
  const mainContent = document.getElementById("mainContent");
  const toggleBtn = document.getElementById("todoToggleBtn");
  if (!todoSection || !mainContent) return;

  const isHidden = todoSection.classList.contains("hidden");
  if (isHidden) {
    todoSection.classList.remove("hidden");
    mainContent.classList.remove("timer-only");
    if (toggleBtn) {
      toggleBtn.classList.add("active");
      const icon = toggleBtn.querySelector("i");
      if (icon) icon.setAttribute("data-lucide", "list-x");
    }
  } else {
    todoSection.classList.add("hidden");
    if (document.getElementById("calendarSection")?.classList.contains("hidden")) {
      mainContent.classList.add("timer-only");
    }
    if (toggleBtn) {
      toggleBtn.classList.remove("active");
      const icon = toggleBtn.querySelector("i");
      if (icon) icon.setAttribute("data-lucide", "list-todo");
    }
  }
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

/**
 * White noise controls
 */
function toggleWhiteNoisePanel() {
  const panel = document.getElementById("whiteNoiseControls");
  if (!panel) return;
  const isVisible = panel.style.display === "block";
  if (isVisible) {
    panel.style.display = "none";
  } else {
    closeAllPanels();
    panel.style.display = "block";
  }
}

function switchNoiseTab(tabName) {
  document.querySelectorAll(".noise-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.id === `${tabName}Tab`);
  });
  document.querySelectorAll(".noise-content").forEach((content) => {
    content.classList.toggle("hidden", content.id !== `${tabName}Content`);
  });

  audio.stopNoise();
  updateNoiseUI();
}

function selectNoise(type) {
  const currentPlaying = audio.getCurrentNoiseType();
  if (currentPlaying === type) {
    audio.stopNoise();
  } else {
    audio.startNoise(type);
  }
  updateNoiseUI();
}

function updateNoiseUI() {
  const current = audio.getCurrentNoiseType();
  const whiteNoiseBtn = document.getElementById("whiteNoiseBtn");

  document.querySelectorAll(".noise-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.sound === current);
  });

  if (whiteNoiseBtn) {
    whiteNoiseBtn.classList.toggle("active", Boolean(current));
  }
}

function closeAllPanels() {
  hideThemeSelector();
  const noisePanel = document.getElementById("whiteNoiseControls");
  if (noisePanel) noisePanel.style.display = "none";
  closeModal();
  closeSkipModal();
}

/**
 * Fullscreen Focus Mode
 */
function toggleFocusMode(forceState) {
  isFocusModeActive = forceState !== undefined ? forceState : !isFocusModeActive;
  const overlay = document.getElementById("focusModeOverlay");
  if (!overlay) return;

  if (isFocusModeActive) {
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    updateFocusModeDisplay();
    const playBtn = document.getElementById("focusModePlayBtn");
    if (playBtn) playBtn.focus();
  } else {
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }
}

function updateFocusModeDisplay() {
  const overlay = document.getElementById("focusModeOverlay");
  if (!overlay || !isFocusModeActive || !timerState) return;

  const minutes = Math.max(0, Math.floor(timerState.remainingSec / 60));
  const seconds = Math.max(0, timerState.remainingSec % 60);
  const displayText = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const timeEl = document.getElementById("focusModeTime");
  if (timeEl) timeEl.textContent = displayText;

  const phaseEl = document.getElementById("focusModePhase");
  if (phaseEl) {
    phaseEl.textContent =
      timerState.phase === timer.PHASES.WORK
        ? "Focus Session"
        : timerState.phase === timer.PHASES.SHORT_BREAK
          ? "Quick Break"
          : "Extended Break";
  }

  const taskEl = document.getElementById("focusModeTask");
  if (taskEl) {
    const taskText = tasks.getSelectedTaskText();
    taskEl.textContent = taskText ? `Focus: ${taskText}` : "";
  }

  const playIcon = document.getElementById("focusModePlayIcon");
  if (playIcon) {
    playIcon.setAttribute(
      "data-lucide",
      timerState.status === timer.STATUS.RUNNING ? "pause" : "play",
    );
  }

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

/**
 * Shortcuts Modal
 */
function showShortcutsModal() {
  closeAllPanels();
  const content = `
    <table class="shortcuts-table" aria-label="Keyboard shortcuts reference">
      <tbody>
        <tr><td>Start / Pause</td><td><span class="kbd">Space</span></td></tr>
        <tr><td>Reset Timer</td><td><span class="kbd">R</span></td></tr>
        <tr><td>Skip Session</td><td><span class="kbd">S</span></td></tr>
        <tr><td>Focus Mode</td><td><span class="kbd">F</span></td></tr>
        <tr><td>Toggle Tasks</td><td><span class="kbd">T</span></td></tr>
        <tr><td>Toggle Mute</td><td><span class="kbd">M</span></td></tr>
        <tr><td>Shortcuts Guide</td><td><span class="kbd">?</span></td></tr>
        <tr><td>Close Dialog / Exit Focus</td><td><span class="kbd">Esc</span></td></tr>
      </tbody>
    </table>
  `;
  openModal("Keyboard Shortcuts", content);
}

/**
 * About Modal
 */
function showAboutModal() {
  closeAllPanels();
  const content = `
    <div class="about-content">
      <h3>Created by Dewan Shahariar Hossen</h3>
      <p>A passionate developer who believes in the power of focused work and mindful breaks. This Pomodoro timer is designed to help you achieve your goals with style and efficiency!</p>
      
      <div class="contact-links">
        <a href="https://www.linkedin.com/in/dewan-shahariar" target="_blank" rel="noopener noreferrer" class="contact-link">
          <i data-lucide="linkedin"></i>
          LinkedIn Profile
        </a>
        <a href="mailto:shahariar.professional@gmail.com" class="contact-link">
          <i data-lucide="mail"></i>
          Email Me
        </a>
      </div>
      
      <div class="motivational-message">
        <p>"Every great achievement starts with a single focused session. You've got this! Keep pushing forward, one Pomodoro at a time!"</p>
      </div>
    </div>
  `;
  openModal("About", content);
}

/**
 * Mini Timer: Document Picture-in-Picture with fallback to popup window
 */
async function openMiniTimer() {
  // If browser supports Document Picture-in-Picture (user-gesture required)
  if (
    typeof window !== "undefined" &&
    "documentPictureInPicture" in window &&
    typeof window.documentPictureInPicture.requestWindow === "function"
  ) {
    try {
      if (pipWindow) {
        pipWindow.close();
        pipWindow = null;
      }

      pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 340,
        height: 220,
      });

      const computedTheme = getComputedStyle(document.body);
      const pipDoc = pipWindow.document;

      const style = pipDoc.createElement("style");
      style.textContent = `
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: "Inter", -apple-system, sans-serif; }
        body {
          background: ${computedTheme.getPropertyValue("--bg-primary") || "#000000"};
          color: ${computedTheme.getPropertyValue("--text-primary") || "#ffffff"};
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          text-align: center;
          padding: 1rem;
        }
        .pip-time { font-size: 3.2rem; font-weight: 900; letter-spacing: -0.05em; line-height: 1; }
        .pip-label { font-size: 0.875rem; color: ${computedTheme.getPropertyValue("--text-secondary") || "#cccccc"}; margin-top: 0.25rem; }
        .pip-controls { display: flex; gap: 0.75rem; margin-top: 1rem; }
        .pip-btn {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 1px solid ${computedTheme.getPropertyValue("--border") || "#333333"};
          background: ${computedTheme.getPropertyValue("--bg-secondary") || "#111111"};
          color: ${computedTheme.getPropertyValue("--text-primary") || "#ffffff"};
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 1.2rem;
          transition: all 0.2s ease;
        }
        .pip-btn:hover { transform: scale(1.08); }
        .pip-btn.play {
          background: ${computedTheme.getPropertyValue("--accent") || "#ffffff"};
          color: ${computedTheme.getPropertyValue("--bg-primary") || "#000000"};
        }
      `;
      pipDoc.head.appendChild(style);

      pipDoc.body.innerHTML = `
        <div class="pip-time" id="pipTime">25:00</div>
        <div class="pip-label" id="pipLabel">Focus</div>
        <div class="pip-controls">
          <button class="pip-btn play" id="pipPlayBtn" title="Start/Pause">▶</button>
          <button class="pip-btn" id="pipSkipBtn" title="Skip">⏭</button>
        </div>
      `;

      pipDoc.getElementById("pipPlayBtn")?.addEventListener("click", () => {
        toggleTimer();
      });
      pipDoc.getElementById("pipSkipBtn")?.addEventListener("click", () => {
        skipSession();
      });

      pipWindow.addEventListener("pagehide", () => {
        pipWindow = null;
      });

      updatePipWindow();
      return;
    } catch (err) {
      console.warn("[Tymodoro] Document PiP failed, falling back to popup window:", err);
    }
  }

  // Fallback to popup window
  openFloatingWindow();
}

function updatePipWindow() {
  if (!pipWindow || pipWindow.closed || !timerState) return;

  const minutes = Math.max(0, Math.floor(timerState.remainingSec / 60));
  const seconds = Math.max(0, timerState.remainingSec % 60);
  const displayText = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const timeEl = pipWindow.document.getElementById("pipTime");
  if (timeEl) timeEl.textContent = displayText;

  const labelEl = pipWindow.document.getElementById("pipLabel");
  if (labelEl) {
    const taskText = tasks.getSelectedTaskText();
    const phaseName =
      timerState.phase === timer.PHASES.WORK
        ? "Deep Focus"
        : timerState.phase === timer.PHASES.SHORT_BREAK
          ? "Quick Break"
          : "Extended Break";
    labelEl.textContent = taskText || phaseName;
  }

  const playBtn = pipWindow.document.getElementById("pipPlayBtn");
  if (playBtn) {
    playBtn.textContent = timerState.status === timer.STATUS.RUNNING ? "⏸" : "▶";
  }
}

function openFloatingWindow() {
  const width = 380;
  const height = 480;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  if (floatingWindow && !floatingWindow.closed) {
    floatingWindow.focus();
    return;
  }

  floatingWindow = window.open(
    "float-timer.html",
    "TYMODOROTimer",
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,menubar=no,toolbar=no,location=no,status=no`,
  );

  if (!floatingWindow) {
    showToast("Could not open floating timer. Make sure pop-ups are allowed.", 4000);
  }
}

function updateFloatingWindow() {
  if (floatingWindow && !floatingWindow.closed && timerState) {
    floatingWindow.postMessage(
      {
        type: "updateTimer",
        timeLeft: timerState.remainingSec,
        totalTime: timerState.plannedSec,
        currentSession: timerState.phase,
        isRunning: timerState.status === timer.STATUS.RUNNING,
        currentTaskText: tasks.getSelectedTaskText(),
        currentTheme,
      },
      window.location.origin,
    );
  }
}

function handleWindowMessage(event) {
  if (event.origin !== window.location.origin) return;
  if (event.source !== floatingWindow) return;

  const data = event.data;
  if (!data) return;

  if (data.type === "toggleTimer") {
    toggleTimer();
  } else if (data.type === "skipSession") {
    skipSession();
  } else if (data.type === "requestSync") {
    updateFloatingWindow();
  } else if (data.type === "floatWindowClosed") {
    floatingWindow = null;
  }
}

function setupFloatingWidgetDrag() {
  const widget = document.getElementById("floatingWidget");
  if (!widget) return;
  const handle = widget.querySelector(".floating-widget-header");
  if (!handle) return;

  let startX = 0;
  let startY = 0;

  handle.addEventListener("mousedown", (e) => {
    isDraggingWidget = true;
    startX = e.clientX - widget.getBoundingClientRect().left;
    startY = e.clientY - widget.getBoundingClientRect().top;
    handle.style.cursor = "grabbing";
    widget.style.transition = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (isDraggingWidget) {
      const newX = e.clientX - startX;
      const newY = e.clientY - startY;
      const maxX = window.innerWidth - widget.offsetWidth;
      const maxY = window.innerHeight - widget.offsetHeight;

      widget.style.right = "auto";
      widget.style.bottom = "auto";
      widget.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
      widget.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
    }
  });

  document.addEventListener("mouseup", () => {
    if (isDraggingWidget) {
      isDraggingWidget = false;
      handle.style.cursor = "grab";
      widget.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
    }
  });
}

/**
 * UI Event Listeners (all wired via addEventListener)
 */
function setupUIEventListeners() {
  // Header controls
  document.getElementById("todoToggleBtn")?.addEventListener("click", toggleTodoList);
  document.getElementById("calendarBtn")?.addEventListener("click", toggleCalendar);
  document.getElementById("whiteNoiseBtn")?.addEventListener("click", toggleWhiteNoisePanel);
  document.getElementById("themeBtn")?.addEventListener("click", showThemeSelector);
  document.getElementById("statsBtn")?.addEventListener("click", () => {
    closeAllPanels();
    showStatsModal(
      sessions,
      settings,
      tasks.getCompletedTodosCount(),
      tasks.getTotalTodosCount(),
      tasks.getCurrentCalendarDate(),
    );
  });
  document.getElementById("settingsBtn")?.addEventListener("click", () => {
    closeAllPanels();
    showSettingsModal(settings, window.localStorage, (updatedSettings) => {
      settings = updatedSettings;
      timerState = timer.applySettings(timerState, settings);
      storage.saveTimerState(window.localStorage, timerState, onQuotaError);
      updateDisplay();
      updateSoundIndicator();
    });
  });
  document.getElementById("focusModeBtn")?.addEventListener("click", () => toggleFocusMode(true));
  document.getElementById("shortcutsBtn")?.addEventListener("click", showShortcutsModal);
  document.getElementById("aboutBtn")?.addEventListener("click", showAboutModal);
  document.getElementById("floatingWindowBtn")?.addEventListener("click", openMiniTimer);

  // Focus mode overlay buttons
  document.getElementById("focusModePlayBtn")?.addEventListener("click", toggleTimer);
  document.getElementById("focusModeSkipBtn")?.addEventListener("click", skipSession);
  document.getElementById("focusModeExitBtn")?.addEventListener("click", () => toggleFocusMode(false));
  document.getElementById("focusModeFsBtn")?.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  });

  // Calendar navigation
  document.getElementById("prevMonthBtn")?.addEventListener("click", prevMonth);
  document.getElementById("nextMonthBtn")?.addEventListener("click", nextMonth);

  // Todo add button & Enter key
  document.getElementById("addTodoBtn")?.addEventListener("click", () => {
    tasks.addTodo(window.localStorage);
  });
  document.getElementById("todoInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      tasks.addTodo(window.localStorage);
    }
  });
  document.getElementById("clearCompletedBtn")?.addEventListener("click", () => {
    tasks.clearCompleted(window.localStorage);
  });
  document.getElementById("carryOverBtn")?.addEventListener("click", () => {
    const res = tasks.bringOverUnfinishedTasks(window.localStorage);
    showToast(res.message, 4000);
  });

  // Timer controls
  document.getElementById("playBtn")?.addEventListener("click", toggleTimer);
  document.getElementById("resetBtn")?.addEventListener("click", resetTimer);
  document.getElementById("skipBtn")?.addEventListener("click", skipSession);

  // Sound indicator
  const soundIndicator = document.getElementById("soundIndicator");
  if (soundIndicator) {
    soundIndicator.addEventListener("click", toggleSound);
    soundIndicator.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleSound();
      }
    });
  }

  // White noise controls
  document.getElementById("regularTab")?.addEventListener("click", () => switchNoiseTab("regular"));
  document.getElementById("binauralTab")?.addEventListener("click", () => switchNoiseTab("binaural"));
  document.getElementById("closeNoiseBtn")?.addEventListener("click", toggleWhiteNoisePanel);

  document.querySelectorAll(".noise-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectNoise(btn.dataset.sound);
    });
  });

  const noiseVolume = document.getElementById("noiseVolume");
  if (noiseVolume) {
    noiseVolume.addEventListener("input", (e) => {
      audio.setNoiseVolume(Number(e.target.value));
      updateNoiseUI();
    });
  }

  // Theme selector
  document.getElementById("closeThemeBtn")?.addEventListener("click", hideThemeSelector);
  document.querySelectorAll(".theme-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      setTheme(opt.dataset.theme);
    });
    opt.addEventListener("mouseenter", () => {
      previewTheme(opt.dataset.theme);
    });
    opt.addEventListener("mouseleave", () => {
      revertTheme();
    });
  });

  // Modal close buttons
  document.getElementById("closeModalBtn")?.addEventListener("click", closeModal);

  // Floating widget controls
  document.getElementById("floatingPlayBtn")?.addEventListener("click", toggleTimer);
  document.getElementById("floatingSkipBtn")?.addEventListener("click", skipSession);
  document.getElementById("closeFloatingWidgetBtn")?.addEventListener("click", () => {
    const widget = document.getElementById("floatingWidget");
    if (widget) widget.classList.remove("active");
  });
}

/**
 * Keyboard shortcuts: Space (start/pause), R (reset), S (skip), F (focus), T (tasks), M (mute), ? (shortcuts), Esc (exit)
 */
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select, .subtask-input, .todo-edit-input")) {
      return;
    }

    if (e.code === "Space") {
      e.preventDefault();
      toggleTimer();
    } else if (e.code === "KeyR") {
      e.preventDefault();
      resetTimer();
    } else if (e.code === "KeyS") {
      e.preventDefault();
      skipSession();
    } else if (e.code === "KeyF") {
      e.preventDefault();
      toggleFocusMode();
    } else if (e.code === "KeyT") {
      e.preventDefault();
      toggleTodoList();
    } else if (e.code === "KeyM") {
      e.preventDefault();
      toggleSound();
    } else if (e.key === "?" || (e.shiftKey && e.key === "/")) {
      e.preventDefault();
      showShortcutsModal();
    } else if (e.key === "Escape") {
      if (isFocusModeActive) {
        toggleFocusMode(false);
      }
    }
  });
}
