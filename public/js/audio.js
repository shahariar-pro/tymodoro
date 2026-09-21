/**
 * audio.js - Web Audio API synthesizer for timer alarms, ambient sounds, and binaural beats
 */

let audioContext = null;
let currentNoise = null;
let currentNoiseType = null;
let noiseGainNode = null;
let noiseVolume = 0.3;

export function initAudioContext() {
  if (!audioContext && typeof window !== "undefined") {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
    }
  }
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume();
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

export function isNoisePlaying() {
  return currentNoise !== null;
}

export function getCurrentNoiseType() {
  return currentNoiseType;
}

export function setNoiseVolume(volumePercent) {
  noiseVolume = Math.max(0, Math.min(1, volumePercent / 100));
  if (noiseGainNode && audioContext) {
    noiseGainNode.gain.setValueAtTime(noiseVolume, audioContext.currentTime);
  }
  if (volumePercent === 0) {
    stopNoise();
  }
}

export function stopNoise() {
  if (currentNoise) {
    try {
      currentNoise.stop();
    } catch (e) {
      // Ignore if already stopped
    }
    currentNoise = null;
    currentNoiseType = null;
  }
}

export function startNoise(type) {
  const ctx = initAudioContext();
  if (!ctx) return null;

  stopNoise();

  const generator = noiseGenerators[type];
  if (generator) {
    currentNoise = generator(ctx);
    currentNoiseType = type;
    return currentNoise;
  }
  return null;
}

// Synthesizers
function generateStormSound(ctx) {
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

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  noiseGainNode = ctx.createGain();
  noiseGainNode.gain.setValueAtTime(noiseVolume, ctx.currentTime);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(600, ctx.currentTime);

  source.connect(filter);
  filter.connect(noiseGainNode);
  noiseGainNode.connect(ctx.destination);

  source.start();
  return source;
}

function generateForestSound(ctx) {
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

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  noiseGainNode = ctx.createGain();
  noiseGainNode.gain.setValueAtTime(noiseVolume, ctx.currentTime);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(800, ctx.currentTime);
  filter.Q.setValueAtTime(0.5, ctx.currentTime);

  source.connect(filter);
  filter.connect(noiseGainNode);
  noiseGainNode.connect(ctx.destination);

  source.start();
  return source;
}

function generateOceanSound(ctx) {
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

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  noiseGainNode = ctx.createGain();
  noiseGainNode.gain.setValueAtTime(noiseVolume, ctx.currentTime);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(400, ctx.currentTime);

  source.connect(filter);
  filter.connect(noiseGainNode);
  noiseGainNode.connect(ctx.destination);

  source.start();
  return source;
}

function generateCoffeeShopSound(ctx) {
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

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  noiseGainNode = ctx.createGain();
  noiseGainNode.gain.setValueAtTime(noiseVolume, ctx.currentTime);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1200, ctx.currentTime);
  filter.Q.setValueAtTime(1, ctx.currentTime);

  source.connect(filter);
  filter.connect(noiseGainNode);
  noiseGainNode.connect(ctx.destination);

  source.start();
  return source;
}

function generateFireSound(ctx) {
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

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  noiseGainNode = ctx.createGain();
  noiseGainNode.gain.setValueAtTime(noiseVolume, ctx.currentTime);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(250, ctx.currentTime);

  source.connect(filter);
  filter.connect(noiseGainNode);
  noiseGainNode.connect(ctx.destination);

  source.start();
  return source;
}

function generateWindSound(ctx) {
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

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  noiseGainNode = ctx.createGain();
  noiseGainNode.gain.setValueAtTime(noiseVolume, ctx.currentTime);

  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(150, ctx.currentTime);

  source.connect(filter);
  filter.connect(noiseGainNode);
  noiseGainNode.connect(ctx.destination);

  source.start();
  return source;
}

function generateBinauralBeat(ctx, frequency) {
  const baseFreq = 200;
  const leftFreq = baseFreq;
  const rightFreq = baseFreq + frequency;

  const leftOsc = ctx.createOscillator();
  const rightOsc = ctx.createOscillator();

  const leftGain = ctx.createGain();
  const rightGain = ctx.createGain();
  const merger = ctx.createChannelMerger(2);

  noiseGainNode = ctx.createGain();
  noiseGainNode.gain.setValueAtTime(noiseVolume * 0.3, ctx.currentTime);

  leftOsc.frequency.setValueAtTime(leftFreq, ctx.currentTime);
  rightOsc.frequency.setValueAtTime(rightFreq, ctx.currentTime);

  leftOsc.type = "sine";
  rightOsc.type = "sine";

  leftGain.gain.setValueAtTime(1, ctx.currentTime);
  rightGain.gain.setValueAtTime(1, ctx.currentTime);

  leftOsc.connect(leftGain);
  leftGain.connect(merger, 0, 0);

  rightOsc.connect(rightGain);
  rightGain.connect(merger, 0, 1);

  merger.connect(noiseGainNode);
  noiseGainNode.connect(ctx.destination);

  leftOsc.start();
  rightOsc.start();

  return {
    stop: () => {
      try {
        leftOsc.stop();
        rightOsc.stop();
      } catch (e) {}
    },
  };
}

const noiseGenerators = {
  storm: (ctx) => generateStormSound(ctx),
  forest: (ctx) => generateForestSound(ctx),
  ocean: (ctx) => generateOceanSound(ctx),
  coffee: (ctx) => generateCoffeeShopSound(ctx),
  fire: (ctx) => generateFireSound(ctx),
  wind: (ctx) => generateWindSound(ctx),
  gamma40: (ctx) => generateBinauralBeat(ctx, 40),
  beta20: (ctx) => generateBinauralBeat(ctx, 20),
  alpha10: (ctx) => generateBinauralBeat(ctx, 10),
  theta6: (ctx) => generateBinauralBeat(ctx, 6),
  delta3: (ctx) => generateBinauralBeat(ctx, 3),
  focus15: (ctx) => generateBinauralBeat(ctx, 15),
};
