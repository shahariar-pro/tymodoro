/**
 * ui/mixer-view.js - UI Controller for the Ambient Sound Mixer
 */

import {
  NATURE_SOUNDS,
  BINAURAL_SOUNDS,
  SOUND_METADATA,
  DEFAULT_PRESETS,
  toggleSound,
  setSoundVolume,
  setMasterVolume,
  getMasterVolume,
  isSoundActive,
  getActiveSounds,
  stopAllSounds,
  isNoisePlaying,
  applyPreset,
} from "../audio.js";
import { loadMixerState, saveMixerState, saveSettings } from "../storage.js";
import { showToast } from "./toasts.js";

let currentStorage = null;
let currentSettings = null;
let onSettingsUpdate = null;
let activeTab = "nature"; // "nature" | "binaural"
let preMuteVolume = 70;

export function initMixerView({ storage, settings, onSettingsChange }) {
  currentStorage = storage;
  currentSettings = settings;
  onSettingsUpdate = onSettingsChange;

  renderMixerStructure();
  loadSavedMixerState();
  bindMixerEvents();
  updateMixerUI();
}

function renderMixerStructure() {
  const natureGrid = document.getElementById("natureTilesGrid");
  const binauralGrid = document.getElementById("binauralTilesGrid");

  if (natureGrid) {
    natureGrid.innerHTML = NATURE_SOUNDS.map((type) => renderTileHTML(type)).join("");
  }

  if (binauralGrid) {
    binauralGrid.innerHTML = BINAURAL_SOUNDS.map((type) => renderTileHTML(type)).join("");
  }

  renderPresetsList();

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function renderTileHTML(type) {
  const meta = SOUND_METADATA[type] || { label: type, icon: "volume-2", desc: "" };
  return `
    <div class="mixer-tile" data-sound="${type}">
      <div class="tile-header">
        <button class="tile-toggle-btn" data-sound="${type}" aria-pressed="false" title="${meta.desc || meta.label}">
          <i data-lucide="${meta.icon}" class="tile-icon" aria-hidden="true"></i>
          <span class="tile-title">${meta.label}</span>
        </button>
        <span class="tile-vol-badge" id="volBadge-${type}">50%</span>
      </div>
      <div class="tile-slider-row">
        <input 
          type="range" 
          class="tile-vol-slider" 
          data-sound="${type}" 
          min="0" 
          max="100" 
          value="50" 
          aria-label="${meta.label} volume"
        >
      </div>
    </div>
  `;
}

function renderPresetsList() {
  const container = document.getElementById("presetsChips");
  if (!container) return;

  const mixerState = loadMixerState(currentStorage);
  const userPresets = Array.isArray(mixerState.presets) ? mixerState.presets : [];

  let html = "";

  // Built-in presets
  DEFAULT_PRESETS.forEach((preset) => {
    html += `
      <button class="preset-chip default-preset" data-preset-id="${preset.id}" title="Built-in preset">
        <i data-lucide="sparkles"></i>
        <span>${preset.name}</span>
      </button>
    `;
  });

  // User custom presets
  userPresets.forEach((preset, idx) => {
    html += `
      <div class="preset-chip-wrapper">
        <button class="preset-chip custom-preset" data-preset-idx="${idx}" title="Custom preset">
          <i data-lucide="music"></i>
          <span>${preset.name}</span>
        </button>
        <button class="delete-preset-btn" data-delete-idx="${idx}" title="Delete preset" aria-label="Delete ${preset.name}">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;
  });

  container.innerHTML = html;
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function loadSavedMixerState() {
  const mixerState = loadMixerState(currentStorage);
  if (mixerState.masterVolume != null) {
    setMasterVolume(mixerState.masterVolume);
    const masterSlider = document.getElementById("masterNoiseVolume");
    const masterLabel = document.getElementById("masterVolValue");
    if (masterSlider) masterSlider.value = mixerState.masterVolume;
    if (masterLabel) masterLabel.textContent = `${mixerState.masterVolume}%`;
  }

  // Checkbox pause ambient during breaks
  const pauseCb = document.getElementById("pauseAmbientBreaksCheckbox");
  if (pauseCb && currentSettings) {
    pauseCb.checked = Boolean(currentSettings.pauseAmbientDuringBreaks);
  }
}

function bindMixerEvents() {
  // Tabs
  document.getElementById("natureTab")?.addEventListener("click", () => switchTab("nature"));
  document.getElementById("binauralTab")?.addEventListener("click", () => switchTab("binaural"));

  // Close
  document.getElementById("closeNoiseBtn")?.addEventListener("click", closeMixerPanel);

  // Master Volume
  const masterSlider = document.getElementById("masterNoiseVolume");
  const masterValLabel = document.getElementById("masterVolValue");
  if (masterSlider) {
    masterSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      setMasterVolume(val);
      if (masterValLabel) masterValLabel.textContent = `${val}%`;
      persistMixerState();
      updateMuteIcon(val);
    });
  }

  // Master Mute
  document.getElementById("masterMuteBtn")?.addEventListener("click", () => {
    const currentVol = getMasterVolume();
    if (currentVol > 0) {
      preMuteVolume = currentVol;
      setMasterVolume(0);
      if (masterSlider) masterSlider.value = 0;
      if (masterValLabel) masterValLabel.textContent = "0%";
      updateMuteIcon(0);
    } else {
      const restoreVol = preMuteVolume > 0 ? preMuteVolume : 70;
      setMasterVolume(restoreVol);
      if (masterSlider) masterSlider.value = restoreVol;
      if (masterValLabel) masterValLabel.textContent = `${restoreVol}%`;
      updateMuteIcon(restoreVol);
    }
    persistMixerState();
  });

  // Pause during breaks checkbox
  document.getElementById("pauseAmbientBreaksCheckbox")?.addEventListener("change", (e) => {
    if (currentSettings) {
      currentSettings.pauseAmbientDuringBreaks = e.target.checked;
      saveSettings(currentStorage, currentSettings);
      if (typeof onSettingsUpdate === "function") {
        onSettingsUpdate(currentSettings);
      }
    }
  });

  // Tile toggle buttons and sliders delegation
  const whiteNoiseControls = document.getElementById("whiteNoiseControls");
  if (whiteNoiseControls) {
    whiteNoiseControls.addEventListener("click", (e) => {
      // Toggle button
      const toggleBtn = e.target.closest(".tile-toggle-btn");
      if (toggleBtn) {
        const soundType = toggleBtn.dataset.sound;
        handleTileToggle(soundType);
        return;
      }

      // Default preset chip
      const defaultChip = e.target.closest(".default-preset");
      if (defaultChip) {
        const presetId = defaultChip.dataset.presetId;
        const preset = DEFAULT_PRESETS.find((p) => p.id === presetId);
        if (preset) {
          loadPreset(preset);
        }
        return;
      }

      // Custom preset chip
      const customChip = e.target.closest(".custom-preset");
      if (customChip) {
        const idx = parseInt(customChip.dataset.presetIdx, 10);
        const mixerState = loadMixerState(currentStorage);
        const preset = mixerState.presets?.[idx];
        if (preset) {
          loadPreset(preset);
        }
        return;
      }

      // Delete custom preset
      const deleteBtn = e.target.closest(".delete-preset-btn");
      if (deleteBtn) {
        const idx = parseInt(deleteBtn.dataset.deleteIdx, 10);
        deleteCustomPreset(idx);
        return;
      }
    });

    whiteNoiseControls.addEventListener("input", (e) => {
      const slider = e.target.closest(".tile-vol-slider");
      if (slider) {
        const soundType = slider.dataset.sound;
        const vol = parseInt(slider.value, 10);
        const badge = document.getElementById(`volBadge-${soundType}`);
        if (badge) badge.textContent = `${vol}%`;
        setSoundVolume(soundType, vol);
        persistMixerState();
      }
    });
  }

  // Save preset button
  document.getElementById("savePresetBtn")?.addEventListener("click", promptSavePreset);
}

function switchTab(tab) {
  activeTab = tab;
  document.getElementById("natureTab")?.classList.toggle("active", tab === "nature");
  document.getElementById("natureTab")?.setAttribute("aria-selected", tab === "nature");
  document.getElementById("binauralTab")?.classList.toggle("active", tab === "binaural");
  document.getElementById("binauralTab")?.setAttribute("aria-selected", tab === "binaural");

  document.getElementById("natureContent")?.classList.toggle("hidden", tab !== "nature");
  document.getElementById("binauralContent")?.classList.toggle("hidden", tab !== "binaural");
}

function handleTileToggle(soundType) {
  const currentlyActive = isSoundActive(soundType);
  const slider = document.querySelector(`.tile-vol-slider[data-sound="${soundType}"]`);
  const vol = slider ? parseInt(slider.value, 10) : 50;

  toggleSound(soundType, !currentlyActive, vol);
  updateMixerUI();
  persistMixerState();
}

function loadPreset(preset) {
  applyPreset(preset);

  // Update slider positions to match the preset
  if (preset.sounds) {
    for (const [sound, vol] of Object.entries(preset.sounds)) {
      const slider = document.querySelector(`.tile-vol-slider[data-sound="${sound}"]`);
      const badge = document.getElementById(`volBadge-${sound}`);
      if (slider) slider.value = vol;
      if (badge) badge.textContent = `${vol}%`;
    }
  }

  updateMixerUI();
  persistMixerState();
  showToast(`Loaded preset "${preset.name}"`, "info");
}

function promptSavePreset() {
  const active = getActiveSounds();
  if (Object.keys(active).length === 0) {
    showToast("Turn on at least one sound before saving a preset.", "warning");
    return;
  }

  const mixerState = loadMixerState(currentStorage);
  const presets = Array.isArray(mixerState.presets) ? mixerState.presets : [];

  if (presets.length >= 5) {
    showToast("Maximum of 5 custom presets reached. Delete one first.", "warning");
    return;
  }

  const defaultName = `My Mix ${presets.length + 1}`;
  const name = window.prompt("Enter a name for this sound preset:", defaultName);
  if (!name || !name.trim()) return;

  const newPreset = {
    id: `preset_${Date.now()}`,
    name: name.trim().slice(0, 24),
    sounds: { ...active },
  };

  presets.push(newPreset);
  mixerState.presets = presets;
  saveMixerState(currentStorage, mixerState);

  renderPresetsList();
  showToast(`Preset "${newPreset.name}" saved!`, "success");
}

function deleteCustomPreset(idx) {
  const mixerState = loadMixerState(currentStorage);
  const presets = Array.isArray(mixerState.presets) ? mixerState.presets : [];
  if (idx >= 0 && idx < presets.length) {
    const deleted = presets.splice(idx, 1)[0];
    mixerState.presets = presets;
    saveMixerState(currentStorage, mixerState);
    renderPresetsList();
    showToast(`Deleted preset "${deleted.name}"`, "info");
  }
}

export function updateMixerUI() {
  const active = getActiveSounds();

  // Update all tiles
  document.querySelectorAll(".mixer-tile").forEach((tile) => {
    const soundType = tile.dataset.sound;
    const isActive = Boolean(active[soundType]);
    tile.classList.toggle("active", isActive);

    const toggleBtn = tile.querySelector(".tile-toggle-btn");
    if (toggleBtn) {
      toggleBtn.classList.toggle("active", isActive);
      toggleBtn.setAttribute("aria-pressed", isActive.toString());
    }
  });

  // Top nav white noise button indicator
  const navBtn = document.getElementById("whiteNoiseBtn");
  if (navBtn) {
    navBtn.classList.toggle("active", isNoisePlaying());
  }

  updateMuteIcon(getMasterVolume());
}

function updateMuteIcon(vol) {
  const icon = document.getElementById("masterMuteIcon");
  if (!icon) return;

  if (vol === 0) {
    icon.setAttribute("data-lucide", "volume-x");
  } else if (vol < 50) {
    icon.setAttribute("data-lucide", "volume-1");
  } else {
    icon.setAttribute("data-lucide", "volume-2");
  }
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function persistMixerState() {
  const mixerState = loadMixerState(currentStorage);
  mixerState.masterVolume = getMasterVolume();
  mixerState.active = getActiveSounds();
  saveMixerState(currentStorage, mixerState);
}

export function toggleMixerPanel() {
  const panel = document.getElementById("whiteNoiseControls");
  if (!panel) return;
  const isVisible = panel.style.display === "block";
  if (isVisible) {
    closeMixerPanel();
  } else {
    panel.style.display = "block";
    updateMixerUI();
  }
}

export function closeMixerPanel() {
  const panel = document.getElementById("whiteNoiseControls");
  if (panel) panel.style.display = "none";
}
