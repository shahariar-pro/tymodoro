/**
 * settings.js - Settings modal UI with preferences and Data Management (Export/Import/Reset)
 */
import { openModal, closeModal } from "./modals.js";
import {
  saveSettings,
  exportDataJSON,
  exportSessionsCSV,
  validateImportData,
  mergeImportData,
  replaceImportData,
  resetAllData,
} from "../storage.js";
import { previewAlarm } from "../audio.js";
import { showToast } from "./toasts.js";

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function showSettingsModal(settings, storage, onApplyCallback) {
  const currentSettings = { ...settings };
  const isNotificationDenied =
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "denied";

  const todayDateStr = new Date().toISOString().slice(0, 10);

  const contentHtml = `
    <div class="settings-modal-wrapper">
      <div class="modal-tabs">
        <button class="modal-tab active" id="tabPrefBtn">Preferences</button>
        <button class="modal-tab" id="tabDataBtn">Data & Backup</button>
      </div>

      <!-- Tab 1: Preferences -->
      <div class="settings-tab-pane" id="panePreferences">
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

        <div class="setting-toggle-row">
          <label class="setting-toggle-label" for="pauseAmbientToggle">Pause Ambient Audio During Breaks</label>
          <label class="toggle-switch">
            <input type="checkbox" id="pauseAmbientToggle" ${currentSettings.pauseAmbientDuringBreaks ? "checked" : ""}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="setting-toggle-row">
          <label class="setting-toggle-label" for="breakSuggestionsToggle">Show Break Suggestions & Tips</label>
          <label class="toggle-switch">
            <input type="checkbox" id="breakSuggestionsToggle" ${currentSettings.breakSuggestions !== false ? "checked" : ""}>
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

      <!-- Tab 2: Data & Backup -->
      <div class="settings-tab-pane hidden" id="paneData">
        <div class="backup-section">
          <h4 class="backup-heading"><i data-lucide="download"></i> Export Data</h4>
          <p class="backup-desc">Export your tasks, settings, streaks, and session history as an open-format file stored safely on your device.</p>
          <div class="backup-buttons-row">
            <button class="backup-btn primary" id="exportJsonBtn">
              <i data-lucide="file-json"></i>
              Export JSON Backup
            </button>
            <button class="backup-btn" id="exportCsvBtn">
              <i data-lucide="file-spreadsheet"></i>
              Export Sessions (CSV)
            </button>
          </div>
        </div>

        <div class="backup-section">
          <h4 class="backup-heading"><i data-lucide="upload"></i> Import Backup</h4>
          <p class="backup-desc">Restore or merge a previously exported JSON backup. The file will be thoroughly validated before applying.</p>
          <input type="file" id="importFileInput" accept=".json" style="display: none;">
          <button class="backup-btn" id="triggerImportBtn">
            <i data-lucide="upload-cloud"></i>
            Select Backup File (JSON)...
          </button>
          
          <div id="importConfirmBox" class="import-confirm-box hidden">
            <div id="importSummaryText" class="import-summary-text"></div>
            <div class="backup-buttons-row" style="margin-top: 0.75rem;">
              <button class="backup-btn primary" id="confirmMergeBtn">Merge (Keep Existing)</button>
              <button class="backup-btn danger" id="confirmReplaceBtn">Replace All</button>
              <button class="backup-btn" id="cancelImportBtn">Cancel</button>
            </div>
          </div>
        </div>

        <div class="backup-section danger-zone">
          <h4 class="backup-heading danger"><i data-lucide="alert-triangle"></i> Reset All Data</h4>
          <p class="backup-desc">Permanently erase all sessions, tasks, streaks, and custom settings. We strongly recommend downloading a backup first.</p>
          <button class="backup-btn danger-outline" id="triggerResetBtn">
            <i data-lucide="trash-2"></i>
            Reset Everything...
          </button>

          <div id="resetConfirmBox" class="reset-confirm-box hidden">
            <p style="font-size: 0.85rem; color: var(--danger); font-weight: 600; margin-bottom: 0.5rem;">
              To confirm, type <code>RESET</code> in the box below:
            </p>
            <input type="text" id="resetInput" class="reset-input" placeholder="Type RESET" autocomplete="off">
            <div class="backup-buttons-row" style="margin-top: 0.75rem;">
              <button class="backup-btn danger" id="executeResetBtn" disabled>Confirm & Erase All Data</button>
              <button class="backup-btn" id="cancelResetBtn">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  openModal("Settings", contentHtml);

  // Tab switching
  const tabPrefBtn = document.getElementById("tabPrefBtn");
  const tabDataBtn = document.getElementById("tabDataBtn");
  const panePreferences = document.getElementById("panePreferences");
  const paneData = document.getElementById("paneData");

  tabPrefBtn?.addEventListener("click", () => {
    tabPrefBtn.classList.add("active");
    tabDataBtn?.classList.remove("active");
    panePreferences?.classList.remove("hidden");
    paneData?.classList.add("hidden");
  });

  tabDataBtn?.addEventListener("click", () => {
    tabDataBtn.classList.add("active");
    tabPrefBtn?.classList.remove("active");
    paneData?.classList.remove("hidden");
    panePreferences?.classList.add("hidden");
  });

  // Duration sliders
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
  document.getElementById("autoStartBreaksToggle")?.addEventListener("change", (e) => {
    currentSettings.autoStartBreaks = e.target.checked;
  });

  document.getElementById("autoStartFocusToggle")?.addEventListener("change", (e) => {
    currentSettings.autoStartFocus = e.target.checked;
  });

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
  document.getElementById("alarmSoundSelect")?.addEventListener("change", (e) => {
    currentSettings.alarmSound = e.target.value;
  });

  document.getElementById("previewAlarmBtn")?.addEventListener("click", () => {
    const vol = currentSettings.alarmVolume ?? 0.6;
    previewAlarm(currentSettings.alarmSound || "chime", vol);
  });

  // Alarm volume slider
  document.getElementById("alarmVolumeSlider")?.addEventListener("input", (e) => {
    const pct = parseInt(e.target.value, 10);
    currentSettings.alarmVolume = pct / 100;
    document.getElementById("alarmVolumeLabel").textContent = `Alarm Volume: ${pct}%`;
  });

  // Alarm repeat
  document.getElementById("alarmRepeatSelect")?.addEventListener("change", (e) => {
    currentSettings.alarmRepeat = parseInt(e.target.value, 10);
  });

  // Keep awake
  document.getElementById("keepAwakeToggle")?.addEventListener("change", (e) => {
    currentSettings.keepAwake = e.target.checked;
  });

  // Pause ambient during breaks
  document.getElementById("pauseAmbientToggle")?.addEventListener("change", (e) => {
    currentSettings.pauseAmbientDuringBreaks = e.target.checked;
  });

  // Break suggestions
  document.getElementById("breakSuggestionsToggle")?.addEventListener("change", (e) => {
    currentSettings.breakSuggestions = e.target.checked;
  });

  // Week start
  document.getElementById("weekStartSelect")?.addEventListener("change", (e) => {
    currentSettings.weekStart = e.target.value;
  });

  // Notifications
  document.getElementById("notificationsOnToggle")?.addEventListener("change", (e) => {
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

  // Apply button
  document.getElementById("applySettingsBtn")?.addEventListener("click", () => {
    saveSettings(storage, currentSettings);
    closeModal();
    if (typeof onApplyCallback === "function") {
      onApplyCallback(currentSettings);
    }
  });

  // --- DATA & BACKUP ACTIONS ---
  // Export JSON
  document.getElementById("exportJsonBtn")?.addEventListener("click", () => {
    const jsonStr = exportDataJSON(storage);
    downloadBlob(jsonStr, `tymodoro-backup-${todayDateStr}.json`, "application/json");
    showToast("Backup exported successfully!");
  });

  // Export CSV
  document.getElementById("exportCsvBtn")?.addEventListener("click", () => {
    const csvStr = exportSessionsCSV(storage);
    downloadBlob(csvStr, `tymodoro-sessions-${todayDateStr}.csv`, "text/csv");
    showToast("Sessions CSV exported successfully!");
  });

  // Import JSON trigger
  const fileInput = document.getElementById("importFileInput");
  const triggerImportBtn = document.getElementById("triggerImportBtn");
  const importConfirmBox = document.getElementById("importConfirmBox");
  const importSummaryText = document.getElementById("importSummaryText");
  let validatedImportPayload = null;

  triggerImportBtn?.addEventListener("click", () => {
    fileInput?.click();
  });

  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      const validation = validateImportData(text);

      if (!validation.valid) {
        showToast(validation.error || "Invalid backup file", 5000, "error");
        fileInput.value = "";
        return;
      }

      validatedImportPayload = validation.data;
      if (importSummaryText && importConfirmBox) {
        importSummaryText.innerHTML = `
          <strong>Backup file verified!</strong><br>
          Found: <strong>${validation.summary.sessionCount} sessions</strong>, 
          <strong>${validation.summary.todoCount} tasks</strong> across 
          <strong>${validation.summary.dateCount} dates</strong>.<br>
          Choose how to import:
        `;
        importConfirmBox.classList.remove("hidden");
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("confirmMergeBtn")?.addEventListener("click", () => {
    if (validatedImportPayload) {
      mergeImportData(storage, validatedImportPayload);
      showToast("Data merged successfully!");
      closeModal();
      window.location.reload();
    }
  });

  document.getElementById("confirmReplaceBtn")?.addEventListener("click", () => {
    if (validatedImportPayload) {
      replaceImportData(storage, validatedImportPayload);
      showToast("Data replaced successfully!");
      closeModal();
      window.location.reload();
    }
  });

  document.getElementById("cancelImportBtn")?.addEventListener("click", () => {
    validatedImportPayload = null;
    if (fileInput) fileInput.value = "";
    if (importConfirmBox) importConfirmBox.classList.add("hidden");
  });

  // Danger Zone: Reset
  const triggerResetBtn = document.getElementById("triggerResetBtn");
  const resetConfirmBox = document.getElementById("resetConfirmBox");
  const resetInput = document.getElementById("resetInput");
  const executeResetBtn = document.getElementById("executeResetBtn");
  const cancelResetBtn = document.getElementById("cancelResetBtn");

  triggerResetBtn?.addEventListener("click", () => {
    resetConfirmBox?.classList.remove("hidden");
    resetInput?.focus();
  });

  resetInput?.addEventListener("input", (e) => {
    const isReset = e.target.value.trim() === "RESET";
    if (executeResetBtn) executeResetBtn.disabled = !isReset;
  });

  cancelResetBtn?.addEventListener("click", () => {
    if (resetConfirmBox) resetConfirmBox.classList.add("hidden");
    if (resetInput) resetInput.value = "";
    if (executeResetBtn) executeResetBtn.disabled = true;
  });

  executeResetBtn?.addEventListener("click", () => {
    if (resetInput?.value.trim() === "RESET") {
      resetAllData(storage);
      closeModal();
      showToast("All data has been reset to defaults.", 4000);
      window.location.reload();
    }
  });

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}
