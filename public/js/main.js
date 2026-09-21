/**
 * main.js - Application entry point
 * Wires timer engine, background Web Worker, storage migration, UI, audio, and tasks.
 */

import * as timer from "./timer.js";
import * as storage from "./storage.js";
import { getStatsSummary } from "./stats.js";
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
let floatingWidgetVisible = false;
let isDraggingWidget = false;
let lastPersistTime = 0;

// Notification permission state
let notificationPermission = typeof window !== "undefined" && "Notification" in window ? Notification.permission === "granted" : false;

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

  // 3. Initialize modals & tasks
  initModals();
  tasks.initTasks(window.localStorage, (taskText, taskId) => {
    if (timerState) {
      timerState.taskId = taskId;
      storage.saveTimerState(window.localStorage, timerState, onQuotaError);
    }
    updateSessionLabel();
    updateFloatingWindow();
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

  // 8. Initial render
  updateSoundIndicator();
  updateDisplay();
  updateSessionLabel();
  renderCalendar(currentMonthDate, tasks.getCurrentCalendarDate(), sessions, settings, handleSelectCalendarDate);
  updateThemeSelector();

  // 9. Document visibility change
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // 10. Message listener for floating popup window
  window.addEventListener("message", handleWindowMessage);

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
});

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

    audio.playBeep(settings.soundOn, 1000, 800);
    handleSessionCompleted(tickResult.completedSession);

    if (tickResult.autoStarted) {
      if (tickWorker) tickWorker.postMessage("start");
      else startFallbackInterval();
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
  if (completedSession) {
    sessions.push(completedSession);
    storage.appendSession(window.localStorage, completedSession, onQuotaError);
    renderCalendar(currentMonthDate, tasks.getCurrentCalendarDate(), sessions, settings, handleSelectCalendarDate);
  }

  // Notifications
  if (settings.notificationsOn && "Notification" in window && Notification.permission === "granted") {
    const isWork = timerState.phase === timer.PHASES.SHORT_BREAK || timerState.phase === timer.PHASES.LONG_BREAK;
    const title = "TYMODORO";
    const body = isWork
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
 * Handle tab visibility change
 */
function handleVisibilityChange() {
  if (!document.hidden && timerState && timerState.status === timer.STATUS.RUNNING) {
    onTick();
  }
}

/**
 * Timer action handlers
 */
async function toggleTimer() {
  const now = Date.now();

  if (timerState.status === timer.STATUS.RUNNING) {
    timerState = timer.pause(timerState, now, speed);
    if (tickWorker) tickWorker.postMessage("stop");
    stopFallbackInterval();
  } else {
    // Request notification permission if enabled and default
    if (settings.notificationsOn && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      try {
        const perm = await Notification.requestPermission();
        notificationPermission = perm === "granted";
      } catch (e) {}
    }

    timerState = timer.start(timerState, now, speed);
    if (tickWorker) tickWorker.postMessage("start");
    else startFallbackInterval();
  }

  storage.saveTimerState(window.localStorage, timerState, onQuotaError);
  updateDisplay();
  updateFloatingWindow();
}

function resetTimer() {
  if (tickWorker) tickWorker.postMessage("stop");
  stopFallbackInterval();

  timerState = timer.reset(timerState, settings);
  storage.saveTimerState(window.localStorage, timerState, onQuotaError);
  updateDisplay();
  updateFloatingWindow();
}

function skipSession() {
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
        updateDisplay();
        updateSessionLabel();
        updateFloatingWindow();
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

  updateDisplay();
  updateSessionLabel();
  updateFloatingWindow();
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
    const progress = ((timerState.plannedSec - timerState.remainingSec) / timerState.plannedSec) * 100;
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

  // Live document title countdown
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

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }

  updateFloatingWindow();
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
}

/**
 * Themes
 */
function setTheme(theme) {
  currentTheme = theme;
  document.body.setAttribute("data-theme", theme);
  storage.saveTheme(window.localStorage, theme, onQuotaError);
  updateThemeSelector();
  hideThemeSelector();
  themePreviewActive = null;
  updateFloatingWindow();
}

function previewTheme(theme) {
  themePreviewActive = currentTheme;
  document.body.setAttribute("data-theme", theme);
}

function revertTheme() {
  if (themePreviewActive) {
    document.body.setAttribute("data-theme", themePreviewActive);
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
  renderCalendar(currentMonthDate, tasks.getCurrentCalendarDate(), sessions, settings, handleSelectCalendarDate);
}

function prevMonth() {
  currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
  renderCalendar(currentMonthDate, tasks.getCurrentCalendarDate(), sessions, settings, handleSelectCalendarDate);
}

function nextMonth() {
  currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
  renderCalendar(currentMonthDate, tasks.getCurrentCalendarDate(), sessions, settings, handleSelectCalendarDate);
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
 * Floating popup window & widget
 */
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
  document.getElementById("aboutBtn")?.addEventListener("click", showAboutModal);
  document.getElementById("floatingWindowBtn")?.addEventListener("click", openFloatingWindow);

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

  // Timer controls
  document.getElementById("playBtn")?.addEventListener("click", toggleTimer);
  document.getElementById("resetBtn")?.addEventListener("click", resetTimer);
  document.getElementById("skipBtn")?.addEventListener("click", skipSession);

  // Sound indicator
  document.getElementById("soundIndicator")?.addEventListener("click", toggleSound);

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
 * Keyboard shortcuts: Space (start/pause), R (reset), Esc (modals)
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
    }
  });
}
