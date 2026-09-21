/**
 * settings.js - Settings modal UI with auto-start, duration sliders, sound, and notification toggles
 */
import { openModal, closeModal } from "./modals.js";
import { saveSettings } from "../storage.js";

export function showSettingsModal(settings, storage, onApplyCallback) {
  const currentSettings = { ...settings };
  const isNotificationDenied =
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "denied";

  const contentHtml = `
    <div class="setting-group">
      <label class="setting-label" id="focusLabel">Focus Session: ${currentSettings.focusTime} minutes</label>
      <input type="range" class="slider" min="1" max="60" value="${currentSettings.focusTime}" id="focusSlider">
    </div>
    <div class="setting-group">
      <label class="setting-label" id="shortBreakLabel">Quick Break: ${currentSettings.shortBreakTime} minutes</label>
      <input type="range" class="slider" min="1" max="30" value="${currentSettings.shortBreakTime}" id="shortBreakSlider">
    </div>
    <div class="setting-group">
      <label class="setting-label" id="longBreakLabel">Extended Break: ${currentSettings.longBreakTime} minutes</label>
      <input type="range" class="slider" min="1" max="60" value="${currentSettings.longBreakTime}" id="longBreakSlider">
    </div>
    <div class="setting-group">
      <label class="setting-label" id="longBreakAfterLabel">Sessions until Extended Break: ${currentSettings.longBreakAfter}</label>
      <input type="range" class="slider" min="1" max="10" value="${currentSettings.longBreakAfter}" id="longBreakAfterSlider">
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

    <div class="setting-toggle-row" style="margin-bottom: ${isNotificationDenied ? "0.5rem" : "1.5rem"};">
      <label class="setting-toggle-label" for="notificationsOnToggle">Desktop Notifications</label>
      <label class="toggle-switch">
        <input type="checkbox" id="notificationsOnToggle" ${currentSettings.notificationsOn ? "checked" : ""}>
        <span class="toggle-slider"></span>
      </label>
    </div>
    ${
      isNotificationDenied
        ? '<div class="setting-hint">Notifications are blocked by your browser settings. Enable them to receive session alerts.</div>'
        : ""
    }

    <button class="apply-btn" id="applySettingsBtn">Apply Settings</button>
  `;

  openModal("Settings", contentHtml);

  // Wire event listeners on rendered elements
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
  if (soundOnToggle) {
    soundOnToggle.addEventListener("change", (e) => {
      currentSettings.soundOn = e.target.checked;
    });
  }

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
