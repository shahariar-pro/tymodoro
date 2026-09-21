/**
 * settings.js - Settings modal UI with auto-start, duration sliders, alarm sound picker, volume, repeat, and wake lock toggles
 */
import { openModal, closeModal } from "./modals.js";
import { saveSettings } from "../storage.js";
import { previewAlarm } from "../audio.js";

export function showSettingsModal(settings, storage, onApplyCallback) {
  const currentSettings = { ...settings };
  const isNotificationDenied =
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "denied";

  const contentHtml = `
    <div class="settings-container">
      <div class="setting-group">
        <label class="setting-label" id="focusLabel">Focus Session: ${currentSettings.focusTime} minutes</label>
        <input type="range" class="slider" min="1" max="60" value="${currentSettings.focusTime}" id="focusSlider" aria-label="Focus session duration">
      </div>
      <div class="setting-group">
        <label class="setting-label" id="shortBreakLabel">Quick Break: ${currentSettings.shortBreakTime} minutes</label>
        <input type="range" class="slider" min="1" max="30" value="${currentSettings.shortBreakTime}" id="shortBreakSlider" aria-label="Quick break duration">
      </div>
      <div class="setting-group">
        <label class="setting-label" id="longBreakLabel">Extended Break: ${currentSettings.longBreakTime} minutes</label>
        <input type="range" class="slider" min="1" max="60" value="${currentSettings.longBreakTime}" id="longBreakSlider" aria-label="Extended break duration">
      </div>
      <div class="setting-group">
        <label class="setting-label" id="longBreakAfterLabel">Sessions until Extended Break: ${currentSettings.longBreakAfter}</label>
        <input type="range" class="slider" min="1" max="10" value="${currentSettings.longBreakAfter}" id="longBreakAfterSlider" aria-label="Sessions until extended break">
      </div>

      <div class="setting-toggle-row">
        <label class="setting-toggle-label" for="autoStartBreaksToggle">Auto-start Breaks</label>
        <label class="toggle-switch">
          <input type="checkbox" id="autoStartBreaksToggle" ${currentSettings.autoStartBreaks ? "checked" : ""}>
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-toggle-row">
        <label class="setting-toggle-label" for="autoStartFocusToggle">Auto-start Focus</label>
        <label class="toggle-switch">
          <input type="checkbox" id="autoStartFocusToggle" ${currentSettings.autoStartFocus ? "checked" : ""}>
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-toggle-row">
        <label class="setting-toggle-label" for="soundOnToggle">Sound Effects (Beep & Alarm)</label>
        <label class="toggle-switch">
          <input type="checkbox" id="soundOnToggle" ${currentSettings.soundOn ? "checked" : ""}>
          <span class="toggle-slider"></span>
        </label>
      </div>

      <!-- Alarm Sound Picker -->
      <div class="setting-group" id="alarmSoundGroup" style="${currentSettings.soundOn ? "" : "opacity: 0.5;"}">
        <label class="setting-label" for="alarmSoundSelect">Alarm Sound</label>
        <div class="setting-input-row">
          <select id="alarmSoundSelect" class="setting-select" aria-label="Alarm sound">
            <option value="chime" ${currentSettings.alarmSound === "chime" ? "selected" : ""}>Chime (Harmonic)</option>
            <option value="bell" ${currentSettings.alarmSound === "bell" ? "selected" : ""}>Temple Bell (Resonant)</option>
            <option value="digital" ${currentSettings.alarmSound === "digital" ? "selected" : ""}>Digital (Electronic)</option>
            <option value="soft" ${currentSettings.alarmSound === "soft" ? "selected" : ""}>Soft (Warm Marimba)</option>
          </select>
          <button type="button" class="setting-preview-btn" id="previewAlarmBtn" title="Preview alarm sound" aria-label="Preview alarm sound">
            <i data-lucide="play"></i>
            <span>Preview</span>
          </button>
        </div>
      </div>

      <!-- Alarm Volume & Repeat -->
      <div class="setting-group" id="alarmVolumeGroup" style="${currentSettings.soundOn ? "" : "opacity: 0.5;"}">
        <label class="setting-label" id="alarmVolumeLabel">Alarm Volume: ${Math.round((currentSettings.alarmVolume ?? 0.6) * 100)}%</label>
        <input type="range" class="slider" min="0" max="100" value="${Math.round((currentSettings.alarmVolume ?? 0.6) * 100)}" id="alarmVolumeSlider" aria-label="Alarm volume">
      </div>

      <div class="setting-group" id="alarmRepeatGroup" style="${currentSettings.soundOn ? "" : "opacity: 0.5;"}">
        <label class="setting-label" for="alarmRepeatSelect">Alarm Repeat</label>
        <select id="alarmRepeatSelect" class="setting-select" aria-label="Alarm repeat count">
          <option value="1" ${Number(currentSettings.alarmRepeat) === 1 ? "selected" : ""}>Play 1 time</option>
          <option value="2" ${Number(currentSettings.alarmRepeat) === 2 ? "selected" : ""}>Play 2 times</option>
          <option value="3" ${Number(currentSettings.alarmRepeat) === 3 ? "selected" : ""}>Play 3 times</option>
        </select>
      </div>

      <div class="setting-toggle-row">
        <label class="setting-toggle-label" for="keepAwakeToggle">Keep Screen Awake (Wake Lock)</label>
        <label class="toggle-switch">
          <input type="checkbox" id="keepAwakeToggle" ${currentSettings.keepAwake ? "checked" : ""}>
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-group">
        <label class="setting-label" for="weekStartSelect">First Day of Week</label>
        <select id="weekStartSelect" class="setting-select" aria-label="First day of week">
          <option value="mon" ${currentSettings.weekStart === "mon" ? "selected" : ""}>Monday</option>
          <option value="sat" ${currentSettings.weekStart === "sat" ? "selected" : ""}>Saturday</option>
          <option value="sun" ${currentSettings.weekStart === "sun" ? "selected" : ""}>Sunday</option>
        </select>
      </div>

      <div class="setting-toggle-row" style="margin-bottom: ${isNotificationDenied ? "0.5rem" : "1.5rem"};">
        <label class="setting-toggle-label" for="notificationsOnToggle">Desktop Notifications</label>
        <label class="toggle-switch">
          <input type="checkbox" id="notificationsOnToggle" ${currentSettings.notificationsOn ? "checked" : ""}>
          <span class="toggle-slider"></span>
        </label>
      </div>
      ${
        isNotificationDenied
          ? '<div class="setting-hint">Notifications are blocked by your browser settings. Enable them in site permissions to receive session alerts.</div>'
          : ""
      }

      <button class="apply-btn" id="applySettingsBtn">Apply Settings</button>
    </div>
  `;

  openModal("Settings", contentHtml);

  // Wire duration sliders
  const focusSlider = document.getElementById("focusSlider");
  const shortBreakSlider = document.getElementById("shortBreakSlider");
  const longBreakSlider = document.getElementById("longBreakSlider");
  const longBreakAfterSlider = document.getElementById("longBreakAfterSlider");

  if (focusSlider) {
    focusSlider.addEventListener("input", (e) => {
      currentSettings.focusTime = parseInt(e.target.value, 10);
      document.getElementById("focusLabel").textContent = `Focus Session: ${currentSettings.focusTime} minutes`;
    });
  }

  if (shortBreakSlider) {
    shortBreakSlider.addEventListener("input", (e) => {
      currentSettings.shortBreakTime = parseInt(e.target.value, 10);
      document.getElementById("shortBreakLabel").textContent = `Quick Break: ${currentSettings.shortBreakTime} minutes`;
    });
  }

  if (longBreakSlider) {
    longBreakSlider.addEventListener("input", (e) => {
      currentSettings.longBreakTime = parseInt(e.target.value, 10);
      document.getElementById("longBreakLabel").textContent = `Extended Break: ${currentSettings.longBreakTime} minutes`;
    });
  }

  if (longBreakAfterSlider) {
    longBreakAfterSlider.addEventListener("input", (e) => {
      currentSettings.longBreakAfter = parseInt(e.target.value, 10);
      document.getElementById("longBreakAfterLabel").textContent = `Sessions until Extended Break: ${currentSettings.longBreakAfter}`;
    });
  }

  // Toggles
  const autoStartBreaksToggle = document.getElementById("autoStartBreaksToggle");
  if (autoStartBreaksToggle) {
    autoStartBreaksToggle.addEventListener("change", (e) => {
      currentSettings.autoStartBreaks = e.target.checked;
    });
  }

  const autoStartFocusToggle = document.getElementById("autoStartFocusToggle");
  if (autoStartFocusToggle) {
    autoStartFocusToggle.addEventListener("change", (e) => {
      currentSettings.autoStartFocus = e.target.checked;
    });
  }

  const soundOnToggle = document.getElementById("soundOnToggle");
  const alarmSoundGroup = document.getElementById("alarmSoundGroup");
  const alarmVolumeGroup = document.getElementById("alarmVolumeGroup");
  const alarmRepeatGroup = document.getElementById("alarmRepeatGroup");

  if (soundOnToggle) {
    soundOnToggle.addEventListener("change", (e) => {
      currentSettings.soundOn = e.target.checked;
      const opacity = e.target.checked ? "1" : "0.5";
      if (alarmSoundGroup) alarmSoundGroup.style.opacity = opacity;
      if (alarmVolumeGroup) alarmVolumeGroup.style.opacity = opacity;
      if (alarmRepeatGroup) alarmRepeatGroup.style.opacity = opacity;
    });
  }

  // Alarm sound picker & preview
  const alarmSoundSelect = document.getElementById("alarmSoundSelect");
  if (alarmSoundSelect) {
    alarmSoundSelect.addEventListener("change", (e) => {
      currentSettings.alarmSound = e.target.value;
    });
  }

  const previewAlarmBtn = document.getElementById("previewAlarmBtn");
  if (previewAlarmBtn) {
    previewAlarmBtn.addEventListener("click", () => {
      const vol = currentSettings.alarmVolume ?? 0.6;
      previewAlarm(currentSettings.alarmSound || "chime", vol);
    });
  }

  // Alarm volume slider
  const alarmVolumeSlider = document.getElementById("alarmVolumeSlider");
  if (alarmVolumeSlider) {
    alarmVolumeSlider.addEventListener("input", (e) => {
      const pct = parseInt(e.target.value, 10);
      currentSettings.alarmVolume = pct / 100;
      document.getElementById("alarmVolumeLabel").textContent = `Alarm Volume: ${pct}%`;
    });
  }

  // Alarm repeat select
  const alarmRepeatSelect = document.getElementById("alarmRepeatSelect");
  if (alarmRepeatSelect) {
    alarmRepeatSelect.addEventListener("change", (e) => {
      currentSettings.alarmRepeat = parseInt(e.target.value, 10);
    });
  }

  // Keep awake toggle
  const keepAwakeToggle = document.getElementById("keepAwakeToggle");
  if (keepAwakeToggle) {
    keepAwakeToggle.addEventListener("change", (e) => {
      currentSettings.keepAwake = e.target.checked;
    });
  }

  // Week start select
  const weekStartSelect = document.getElementById("weekStartSelect");
  if (weekStartSelect) {
    weekStartSelect.addEventListener("change", (e) => {
      currentSettings.weekStart = e.target.value;
    });
  }

  // Notifications toggle
  const notificationsOnToggle = document.getElementById("notificationsOnToggle");
  if (notificationsOnToggle) {
    notificationsOnToggle.addEventListener("change", (e) => {
      currentSettings.notificationsOn = e.target.checked;
      if (
        e.target.checked &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "default"
      ) {
        Notification.requestPermission();
      }
    });
  }

  // Apply button
  const applyBtn = document.getElementById("applySettingsBtn");
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      saveSettings(storage, currentSettings);
      closeModal();
      if (typeof onApplyCallback === "function") {
        onApplyCallback(currentSettings);
      }
    });
  }
}
