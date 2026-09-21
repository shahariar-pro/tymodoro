import test from "node:test";
import assert from "node:assert";
import {
  createSound,
  NATURE_SOUNDS,
  BINAURAL_SOUNDS,
  DEFAULT_PRESETS,
} from "../public/js/audio.js";
import {
  loadMixerState,
  saveMixerState,
  STORAGE_KEYS,
} from "../public/js/storage.js";

/**
 * Creates a mock Web Audio API AudioContext for headless testing
 */
function createMockAudioContext() {
  return {
    currentTime: 0,
    sampleRate: 44100,
    destination: { name: "destination" },
    createGain() {
      return {
        gain: {
          value: 1,
          setValueAtTime(v) {
            this.value = v;
          },
          setTargetAtTime(v) {
            this.value = v;
          },
          linearRampToValueAtTime(v) {
            this.value = v;
          },
          exponentialRampToValueAtTime(v) {
            this.value = v;
          },
        },
        connect(target) {
          this.target = target;
        },
        disconnect() {
          this.target = null;
        },
      };
    },
    createBuffer(channels, size, rate) {
      return {
        numberOfChannels: channels,
        length: size,
        sampleRate: rate,
        getChannelData() {
          return new Float32Array(size);
        },
      };
    },
    createBufferSource() {
      return {
        buffer: null,
        loop: false,
        playing: false,
        connect(target) {
          this.target = target;
        },
        disconnect() {
          this.target = null;
        },
        start() {
          this.playing = true;
        },
        stop() {
          this.playing = false;
        },
      };
    },
    createBiquadFilter() {
      return {
        type: "lowpass",
        frequency: { setValueAtTime() {} },
        Q: { setValueAtTime() {} },
        connect(target) {
          this.target = target;
        },
        disconnect() {
          this.target = null;
        },
      };
    },
    createOscillator() {
      return {
        type: "sine",
        frequency: { setValueAtTime() {} },
        playing: false,
        connect(target) {
          this.target = target;
        },
        disconnect() {
          this.target = null;
        },
        start() {
          this.playing = true;
        },
        stop() {
          this.playing = false;
        },
      };
    },
    createChannelMerger(count) {
      return {
        count,
        connect(target) {
          this.target = target;
        },
        disconnect() {
          this.target = null;
        },
      };
    },
  };
}

/**
 * Creates a mock storage Map
 */
function createMockStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

test("audio: createSound initializes independent sound instances with valid contracts", () => {
  const ctx = createMockAudioContext();

  for (const type of NATURE_SOUNDS) {
    const sound = createSound(ctx, type);
    assert.ok(sound.output, `Sound ${type} should have an output gain node`);
    assert.strictEqual(typeof sound.start, "function");
    assert.strictEqual(typeof sound.stop, "function");
    assert.strictEqual(typeof sound.setVolume, "function");
    assert.strictEqual(sound.isBinaural, false);
    assert.strictEqual(sound.type, type);

    // Test volume adjustment
    sound.setVolume(0.75);
    assert.strictEqual(sound.output.gain.value, 0.75);

    // Test start and stop
    sound.start();
    sound.stop();
  }
});

test("audio: createSound supports binaural beats with stereo channels and single-active flag", () => {
  const ctx = createMockAudioContext();

  for (const type of BINAURAL_SOUNDS) {
    const sound = createSound(ctx, type);
    assert.ok(sound.output);
    assert.strictEqual(sound.isBinaural, true);
    assert.strictEqual(sound.type, type);

    sound.setVolume(0.8);
    // Scaled binaural volume
    assert.ok(sound.output.gain.value > 0);

    sound.start();
    sound.stop();
  }
});

test("audio: multi-sound concurrent mixing (Storm + Café at independent volumes)", () => {
  const ctx = createMockAudioContext();
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.8;

  // Sound 1: Storm at 60%
  const storm = createSound(ctx, "storm");
  storm.setVolume(0.6);
  storm.output.connect(masterGain);
  storm.start();

  // Sound 2: Café at 35%
  const cafe = createSound(ctx, "coffee");
  cafe.setVolume(0.35);
  cafe.output.connect(masterGain);
  cafe.start();

  // Both run simultaneously with their own gain values
  assert.strictEqual(storm.output.gain.value, 0.6);
  assert.strictEqual(cafe.output.gain.value, 0.35);

  // Both are connected to master gain
  assert.strictEqual(storm.output.target, masterGain);
  assert.strictEqual(cafe.output.target, masterGain);

  // Stop one without affecting the other
  storm.stop();
  assert.strictEqual(cafe.output.gain.value, 0.35);

  cafe.stop();
});

test("audio: mixer presets persist and survive storage reload", () => {
  const storage = createMockStorage();

  // Initial load returns defaults
  const initial = loadMixerState(storage);
  assert.strictEqual(initial.masterVolume, 70);
  assert.deepStrictEqual(initial.presets, []);

  // Save custom preset
  const customPresets = [
    {
      id: "preset_1",
      name: "Rainy Study",
      sounds: { storm: 70, coffee: 40 },
    },
    {
      id: "preset_2",
      name: "Midnight Coding",
      sounds: { fire: 50, focus15: 30 },
    },
  ];

  saveMixerState(storage, {
    masterVolume: 85,
    active: { storm: 70, coffee: 40 },
    presets: customPresets,
  });

  // Reload from storage
  const reloaded = loadMixerState(storage);
  assert.strictEqual(reloaded.masterVolume, 85);
  assert.strictEqual(reloaded.presets.length, 2);
  assert.strictEqual(reloaded.presets[0].name, "Rainy Study");
  assert.strictEqual(reloaded.presets[0].sounds.storm, 70);
  assert.strictEqual(reloaded.presets[1].sounds.focus15, 30);
});

test("audio: default presets provide balanced starting soundscapes", () => {
  assert.ok(DEFAULT_PRESETS.length >= 4);
  const rainyCafe = DEFAULT_PRESETS.find((p) => p.id === "rainy-cafe");
  assert.ok(rainyCafe);
  assert.strictEqual(rainyCafe.sounds.storm, 50);
  assert.strictEqual(rainyCafe.sounds.coffee, 40);
});
