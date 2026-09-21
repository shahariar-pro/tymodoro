/**
 * audio.js - Web Audio API synthesizer for timer alarms, ambient sound mixer, and binaural beats
 */

let audioContext = null;
let masterGainNode = null;
let masterVolume = 0.7; // 0.0 to 1.0
let activeSounds = new Map(); // type -> { instance, volume }
let isSuspendedForBreak = false;

export const NATURE_SOUNDS = ["storm", "forest", "ocean", "coffee", "fire", "wind"];
export const BINAURAL_SOUNDS = ["gamma40", "beta20", "alpha10", "theta6", "delta3", "focus15"];

export const BINAURAL_FREQS = {
  gamma40: 40,
  beta20: 20,
  alpha10: 10,
  theta6: 6,
  delta3: 3,
  focus15: 15,
};

export const SOUND_METADATA = {
  storm: { label: "Storm", icon: "cloud-lightning", desc: "Rain, wind & thunder", isBinaural: false },
  forest: { label: "Forest", icon: "trees", desc: "Birds, leaves & water", isBinaural: false },
  ocean: { label: "Ocean", icon: "waves", desc: "Crashing rolling waves", isBinaural: false },
  coffee: { label: "Café", icon: "coffee", desc: "Warm ambient chatter", isBinaural: false },
  fire: { label: "Fireplace", icon: "flame", desc: "Gentle crackling wood", isBinaural: false },
  wind: { label: "Wind", icon: "wind", desc: "Breezy mountain gust", isBinaural: false },
  gamma40: { label: "40Hz Gamma", icon: "zap", desc: "Peak mental processing", isBinaural: true },
  beta20: { label: "20Hz Beta", icon: "brain", desc: "Active problem solving", isBinaural: true },
  alpha10: { label: "10Hz Alpha", icon: "circle-dot", desc: "Relaxed alert focus", isBinaural: true },
  theta6: { label: "6Hz Theta", icon: "moon", desc: "Deep meditation & flow", isBinaural: true },
  delta3: { label: "3Hz Delta", icon: "bed", desc: "Restorative deep rest", isBinaural: true },
  focus15: { label: "15Hz Focus", icon: "target", desc: "Sustained attention", isBinaural: true },
};

export const DEFAULT_PRESETS = [
  { id: "rainy-cafe", name: "Rainy Café", sounds: { storm: 50, coffee: 40 } },
  { id: "cozy-fire", name: "Cozy Fireplace", sounds: { fire: 60, wind: 30 } },
  { id: "forest-stream", name: "Forest Stream", sounds: { forest: 60, ocean: 25 } },
  { id: "deep-focus", name: "Deep Focus", sounds: { storm: 40, focus15: 35 } },
  { id: "calm-theta", name: "Calm Theta", sounds: { ocean: 45, theta6: 30 } },
];

export function initAudioContext() {
  if (!audioContext && typeof window !== "undefined") {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
    }
  }
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  if (audioContext && !masterGainNode) {
    try {
      masterGainNode = audioContext.createGain();
      masterGainNode.gain.setValueAtTime(masterVolume, audioContext.currentTime);
      masterGainNode.connect(audioContext.destination);
    } catch (e) {
      // Mock environment protection
    }
  }
  return audioContext;
}

export function getAudioContext() {
  return audioContext;
}

export function playBeep(soundEnabled = true, frequency = 800, duration = 500) {
  if (!soundEnabled) return;
  const ctx = initAudioContext();
  if (!ctx) return;

  try {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);
  } catch (error) {
    console.error("Error playing beep:", error);
  }
}

/**
 * Synthesized Alarm Sounds (chime, bell, digital, soft)
 */
export function playAlarm(type = "chime", volume = 0.6, repeat = 1, soundEnabled = true) {
  if (!soundEnabled) return;
  const ctx = initAudioContext();
  if (!ctx) return;

  const count = Math.max(1, Math.min(3, repeat || 1));
  const normalizedVol = Math.max(0, Math.min(1, volume != null ? volume : 0.6));

  for (let i = 0; i < count; i++) {
    const cycleTime = ctx.currentTime + i * 1.5;
    renderAlarmCycle(ctx, type, normalizedVol, cycleTime);
  }
}

export function previewAlarm(type = "chime", volume = 0.6) {
  const ctx = initAudioContext();
  if (!ctx) return;
  const normalizedVol = Math.max(0, Math.min(1, volume != null ? volume : 0.6));
  renderAlarmCycle(ctx, type, normalizedVol, ctx.currentTime);
}

function renderAlarmCycle(ctx, type, volume, start) {
  switch (type) {
    case "bell":
      renderBellAlarm(ctx, volume, start);
      break;
    case "digital":
      renderDigitalAlarm(ctx, volume, start);
      break;
    case "soft":
      renderSoftAlarm(ctx, volume, start);
      break;
    case "chime":
    default:
      renderChimeAlarm(ctx, volume, start);
      break;
  }
}

function renderChimeAlarm(ctx, volume, start) {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    const noteTime = start + idx * 0.15;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, noteTime);

    gain.gain.setValueAtTime(0.001, noteTime);
    gain.gain.linearRampToValueAtTime(volume * 0.4, noteTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.9);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteTime);
    osc.stop(noteTime + 0.95);
  });
}

function renderBellAlarm(ctx, volume, start) {
  const partials = [
    { freq: 440, gain: volume * 0.5, decay: 1.8 },
    { freq: 440 * 2.76, gain: volume * 0.25, decay: 1.2 },
    { freq: 440 * 5.4, gain: volume * 0.1, decay: 0.8 },
  ];

  partials.forEach((p) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(p.freq, start);

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(p.gain, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + p.decay);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + p.decay + 0.05);
  });
}

function renderDigitalAlarm(ctx, volume, start) {
  const beeps = [
    { time: start, freq: 880, dur: 0.12 },
    { time: start + 0.16, freq: 1760, dur: 0.16 },
    { time: start + 0.42, freq: 880, dur: 0.12 },
    { time: start + 0.58, freq: 1760, dur: 0.2 },
  ];

  beeps.forEach((b) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(b.freq, b.time);

    gain.gain.setValueAtTime(0.001, b.time);
    gain.gain.linearRampToValueAtTime(volume * 0.35, b.time + 0.01);
    gain.gain.setValueAtTime(volume * 0.35, b.time + b.dur - 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, b.time + b.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(b.time);
    osc.stop(b.time + b.dur + 0.02);
  });
}

function renderSoftAlarm(ctx, volume, start) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900, start);
  filter.connect(ctx.destination);

  const chords = [392.0, 493.88, 587.33];
  chords.forEach((freq, idx) => {
    const noteTime = start + idx * 0.08;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, noteTime);

    gain.gain.setValueAtTime(0.001, noteTime);
    gain.gain.linearRampToValueAtTime(volume * 0.35, noteTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 1.2);

    osc.connect(gain);
    gain.connect(filter);

    osc.start(noteTime);
    osc.stop(noteTime + 1.25);
  });
}

/**
 * Creates an independent sound generator instance with its own pipeline
 * @param {AudioContext} ctx
 * @param {string} type
 * @returns {{ output: GainNode, start: Function, stop: Function, setVolume: Function, type: string, isBinaural: boolean }}
 */
export function createSound(ctx, type) {
  const isBinaural = Boolean(BINAURAL_FREQS[type]);
  const output = ctx.createGain();
  output.gain.setValueAtTime(0.5, ctx.currentTime);

  let cleanup = () => {};

  if (isBinaural) {
    const freq = BINAURAL_FREQS[type] || 10;
    const baseFreq = 200;

    const leftOsc = ctx.createOscillator();
    const rightOsc = ctx.createOscillator();
    const leftGain = ctx.createGain();
    const rightGain = ctx.createGain();
    const merger = ctx.createChannelMerger(2);

    leftOsc.type = "sine";
    rightOsc.type = "sine";
    leftOsc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    rightOsc.frequency.setValueAtTime(baseFreq + freq, ctx.currentTime);

    leftGain.gain.setValueAtTime(1, ctx.currentTime);
    rightGain.gain.setValueAtTime(1, ctx.currentTime);

    leftOsc.connect(leftGain);
    leftGain.connect(merger, 0, 0);

    rightOsc.connect(rightGain);
    rightGain.connect(merger, 0, 1);

    merger.connect(output);

    cleanup = () => {
      try {
        leftOsc.stop();
        rightOsc.stop();
      } catch (e) {}
      try {
        leftOsc.disconnect();
        rightOsc.disconnect();
        leftGain.disconnect();
        rightGain.disconnect();
        merger.disconnect();
      } catch (e) {}
    };

    return {
      output,
      type,
      isBinaural: true,
      start: () => {
        try {
          leftOsc.start();
          rightOsc.start();
        } catch (e) {}
      },
      stop: cleanup,
      setVolume: (v) => {
        const val = Math.max(0, Math.min(1, v));
        // Scale binaural slightly so it balances with ambient
        output.gain.setValueAtTime(val * 0.35, ctx.currentTime);
      },
    };
  }

  // Nature Sounds
  let source = null;
  let filter = null;

  switch (type) {
    case "storm": {
      const bufferSize = ctx.sampleRate * 3;
      const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      for (let i = 0; i < bufferSize; i++) {
        const rain = (Math.random() * 2 - 1) * 0.3;
        const thunder = Math.random() > 0.998 ? (Math.random() * 2 - 1) * 0.8 : 0;
        const wind = Math.sin(i * 0.001) * 0.2;
        left[i] = rain + thunder + wind;
        right[i] = rain + thunder * 0.8 + wind * 0.9;
      }
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(600, ctx.currentTime);

      source.connect(filter);
      filter.connect(output);
      break;
    }

    case "forest": {
      const bufferSize = ctx.sampleRate * 4;
      const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      for (let i = 0; i < bufferSize; i++) {
        const birds = Math.random() > 0.995 ? Math.sin(i * 0.1) * 0.3 : 0;
        const leaves = (Math.random() * 2 - 1) * 0.1 * Math.sin(i * 0.002);
        const water = Math.sin(i * 0.005) * 0.05;
        left[i] = birds + leaves + water;
        right[i] = birds * 0.8 + leaves * 1.1 + water;
      }
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.Q.setValueAtTime(0.5, ctx.currentTime);

      source.connect(filter);
      filter.connect(output);
      break;
    }

    case "ocean": {
      const bufferSize = ctx.sampleRate * 6;
      const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      for (let i = 0; i < bufferSize; i++) {
        const wave1 = Math.sin(i * 0.008) * 0.4;
        const wave2 = Math.sin(i * 0.012) * 0.3;
        const foam = (Math.random() * 2 - 1) * 0.15;
        left[i] = wave1 + wave2 + foam;
        right[i] = wave1 * 0.9 + wave2 * 1.1 + foam * 0.8;
      }
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(400, ctx.currentTime);

      source.connect(filter);
      filter.connect(output);
      break;
    }

    case "coffee": {
      const bufferSize = ctx.sampleRate * 3;
      const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      for (let i = 0; i < bufferSize; i++) {
        const chatter = Math.sin(i * 0.003) * 0.15;
        const machine = Math.random() > 0.997 ? (Math.random() * 2 - 1) * 0.4 : 0;
        const ambience = (Math.random() * 2 - 1) * 0.1;
        left[i] = chatter + machine + ambience;
        right[i] = chatter * 0.9 + machine * 0.7 + ambience * 1.1;
      }
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1200, ctx.currentTime);
      filter.Q.setValueAtTime(1, ctx.currentTime);

      source.connect(filter);
      filter.connect(output);
      break;
    }

    case "fire": {
      const bufferSize = ctx.sampleRate * 3;
      const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      for (let i = 0; i < bufferSize; i++) {
        const crackle = Math.random() > 0.99 ? (Math.random() * 2 - 1) * 0.5 : 0;
        const base = (Math.random() * 2 - 1) * 0.08;
        const pop = Math.random() > 0.999 ? (Math.random() * 2 - 1) * 0.3 : 0;
        left[i] = crackle + base + pop;
        right[i] = crackle * 0.8 + base * 1.1 + pop * 0.9;
      }
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(250, ctx.currentTime);

      source.connect(filter);
      filter.connect(output);
      break;
    }

    case "wind":
    default: {
      const bufferSize = ctx.sampleRate * 4;
      const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      for (let i = 0; i < bufferSize; i++) {
        const wind1 = Math.sin(i * 0.001) * 0.3;
        const wind2 = Math.sin(i * 0.0015) * 0.2;
        const highWind = (Math.random() * 2 - 1) * 0.12;
        left[i] = wind1 + wind2 + highWind;
        right[i] = wind1 * 0.9 + wind2 * 1.1 + highWind * 0.8;
      }
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(150, ctx.currentTime);

      source.connect(filter);
      filter.connect(output);
      break;
    }
  }

  return {
    output,
    type,
    isBinaural: false,
    start: () => {
      try {
        source.start(0);
      } catch (e) {}
    },
    stop: () => {
      try {
        source.stop(0);
      } catch (e) {}
      try {
        source.disconnect();
        if (filter) filter.disconnect();
      } catch (e) {}
    },
    setVolume: (v) => {
      const val = Math.max(0, Math.min(1, v));
      output.gain.setValueAtTime(val, ctx.currentTime);
    },
  };
}

/**
 * Toggles a sound in the ambient mixer
 * @param {string} type
 * @param {boolean} shouldEnable
 * @param {number} [volumePercent=50] 0 to 100
 */
export function toggleSound(type, shouldEnable, volumePercent = 50) {
  const ctx = initAudioContext();
  if (!ctx) return false;

  const isBinaural = Boolean(BINAURAL_FREQS[type]);

  // If disabling
  if (!shouldEnable) {
    const active = activeSounds.get(type);
    if (active) {
      active.instance.stop();
      try {
        active.instance.output.disconnect();
      } catch (e) {}
      activeSounds.delete(type);
    }
    return true;
  }

  // If enabling: enforce only one binaural sound active at any time
  if (isBinaural) {
    for (const [key, sound] of activeSounds.entries()) {
      if (sound.instance.isBinaural) {
        sound.instance.stop();
        try {
          sound.instance.output.disconnect();
        } catch (e) {}
        activeSounds.delete(key);
      }
    }
  }

  // Stop existing instance of this sound if running
  if (activeSounds.has(type)) {
    const existing = activeSounds.get(type);
    existing.instance.stop();
    try {
      existing.instance.output.disconnect();
    } catch (e) {}
    activeSounds.delete(type);
  }

  const normalizedVol = Math.max(0, Math.min(1, (volumePercent || 50) / 100));
  const soundInstance = createSound(ctx, type);
  soundInstance.setVolume(normalizedVol);

  if (masterGainNode) {
    soundInstance.output.connect(masterGainNode);
  } else {
    soundInstance.output.connect(ctx.destination);
  }

  soundInstance.start();
  activeSounds.set(type, { instance: soundInstance, volume: normalizedVol });
  return true;
}

/**
 * Sets volume for a specific active sound
 * @param {string} type
 * @param {number} volumePercent 0 to 100
 */
export function setSoundVolume(type, volumePercent) {
  const active = activeSounds.get(type);
  const normalizedVol = Math.max(0, Math.min(1, volumePercent / 100));
  if (active) {
    active.volume = normalizedVol;
    active.instance.setVolume(normalizedVol);
  }
}

/**
 * Sets mixer master volume
 * @param {number} volumePercent 0 to 100
 */
export function setMasterVolume(volumePercent) {
  masterVolume = Math.max(0, Math.min(1, volumePercent / 100));
  if (masterGainNode && audioContext && !isSuspendedForBreak) {
    masterGainNode.gain.setValueAtTime(masterVolume, audioContext.currentTime);
  }
}

export function getMasterVolume() {
  return Math.round(masterVolume * 100);
}

/**
 * Checks if a specific sound is actively playing
 */
export function isSoundActive(type) {
  return activeSounds.has(type);
}

/**
 * Returns currently active sounds as { [type]: volumePercent }
 */
export function getActiveSounds() {
  const result = {};
  for (const [type, data] of activeSounds.entries()) {
    result[type] = Math.round(data.volume * 100);
  }
  return result;
}

/**
 * Stops all currently active sounds
 */
export function stopAllSounds() {
  for (const [, sound] of activeSounds.entries()) {
    try {
      sound.instance.stop();
      sound.instance.output.disconnect();
    } catch (e) {}
  }
  activeSounds.clear();
}

/**
 * Loads a preset sound configuration
 * @param {{ sounds: Object.<string, number> }} preset
 */
export function applyPreset(preset) {
  if (!preset || !preset.sounds) return;
  stopAllSounds();
  for (const [soundType, vol] of Object.entries(preset.sounds)) {
    if (vol > 0) {
      toggleSound(soundType, true, vol);
    }
  }
}

/**
 * Smoothly pauses ambient sounds during breaks
 */
export function pauseAmbientForBreak() {
  if (activeSounds.size > 0 && !isSuspendedForBreak) {
    isSuspendedForBreak = true;
    if (masterGainNode && audioContext) {
      try {
        masterGainNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.1);
      } catch (e) {
        masterGainNode.gain.setValueAtTime(0, audioContext.currentTime);
      }
    }
  }
}

/**
 * Smoothly resumes ambient sounds after breaks
 */
export function resumeAmbientAfterBreak() {
  if (isSuspendedForBreak) {
    isSuspendedForBreak = false;
    if (masterGainNode && audioContext) {
      try {
        masterGainNode.gain.setTargetAtTime(masterVolume, audioContext.currentTime, 0.15);
      } catch (e) {
        masterGainNode.gain.setValueAtTime(masterVolume, audioContext.currentTime);
      }
    }
  }
}

export function isAmbientSuspendedForBreak() {
  return isSuspendedForBreak;
}

// Backwards-compatibility aliases
export function startNoise(type) {
  const ctx = initAudioContext();
  if (!ctx) return null;
  stopAllSounds();
  toggleSound(type, true, 30);
  return activeSounds.get(type)?.instance;
}

export function stopNoise() {
  stopAllSounds();
}

export function getCurrentNoiseType() {
  if (activeSounds.size === 0) return null;
  return activeSounds.keys().next().value;
}

export function isNoisePlaying() {
  return activeSounds.size > 0;
}

export function setNoiseVolume(volumePercent) {
  setMasterVolume(volumePercent);
}
