import test from "node:test";
import assert from "node:assert";
import {
  migrateToV2,
  loadSettings,
  saveSettings,
  loadSessions,
  safeSet,
  safeGet,
  STORAGE_KEYS,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
} from "../public/js/storage.js";

/**
 * Creates a simple mock storage object
 */
function createMockStorage(initialData = {}) {
  const map = new Map(Object.entries(initialData));
  return {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(k, String(v));
    },
    removeItem(k) {
      map.delete(k);
    },
    clear() {
      map.clear();
    },
    _map: map,
  };
}

test("storage: migration from realistic v1 fixture", () => {
  const v1Fixture = {
    // Legacy settings (schema v1 had no notificationsOn, alarmSound, etc.)
    [STORAGE_KEYS.SETTINGS]: JSON.stringify({
      focusTime: 25,
      shortBreakTime: 5,
      longBreakTime: 15,
      longBreakAfter: 4,
    }),
    // Legacy stats with daily counts
    [STORAGE_KEYS.STATS_LEGACY]: JSON.stringify({
      totalSessions: 5,
      weekSessions: 5,
      monthSessions: 5,
      totalMinutes: 125,
      todaySessions: 2,
      dailyData: {
        "Mon Sep 21 2026": 3,
        "Tue Sep 22 2026": 2,
      },
    }),
    // Existing theme and todos
    [STORAGE_KEYS.THEME]: "ocean",
    [STORAGE_KEYS.TODOS]: JSON.stringify({
      "Mon Sep 21 2026": [{ id: "t1", text: "Task 1", completed: true }],
    }),
  };

  const storage = createMockStorage(v1Fixture);

  // Run migration
  const migrated = migrateToV2(storage);
  assert.strictEqual(migrated, true, "First migration should return true");

  // Verify schema version
  assert.strictEqual(
    storage.getItem(STORAGE_KEYS.SCHEMA),
    CURRENT_SCHEMA_VERSION.toString(),
  );

  // Verify settings merged over defaults
  const settings = loadSettings(storage);
  assert.strictEqual(settings.focusTime, 25);
  assert.strictEqual(settings.soundOn, true);
  assert.strictEqual(settings.notificationsOn, false);
  assert.strictEqual(settings.weekStart, "mon");

  // Verify sessions created from dailyData: 3 for Sep 21, 2 for Sep 22 = 5 total
  const sessions = loadSessions(storage);
  assert.strictEqual(sessions.length, 5);

  const sep21Sessions = sessions.filter((s) => s.id.includes("Mon_Sep_21_2026"));
  assert.strictEqual(sep21Sessions.length, 3);
  assert.strictEqual(sep21Sessions[0].plannedSec, 1500);
  assert.strictEqual(sep21Sessions[0].actualSec, 1500);
  assert.strictEqual(sep21Sessions[0].completed, true);
  assert.strictEqual(sep21Sessions[0].legacy, true);

  // Verify legacy stats were untouched as backup
  assert.ok(storage.getItem(STORAGE_KEYS.STATS_LEGACY));
  // Verify todos and theme were untouched
  assert.strictEqual(storage.getItem(STORAGE_KEYS.THEME), "ocean");
});

test("storage: migration is idempotent (running twice produces same result without duplication)", () => {
  const v1Fixture = {
    [STORAGE_KEYS.STATS_LEGACY]: JSON.stringify({
      dailyData: { "Mon Sep 21 2026": 2 },
    }),
  };
  const storage = createMockStorage(v1Fixture);

  // Run 1
  assert.strictEqual(migrateToV2(storage), true);
  const countAfterRun1 = loadSessions(storage).length;
  assert.strictEqual(countAfterRun1, 2);

  // Run 2
  assert.strictEqual(migrateToV2(storage), false, "Second run should recognize schema version 2 and skip");
  const countAfterRun2 = loadSessions(storage).length;
  assert.strictEqual(countAfterRun2, 2, "Sessions count must not change on duplicate run");
});

test("storage: settings merge over defaults", () => {
  const storage = createMockStorage();

  // Initially loads default settings
  const defaults = loadSettings(storage);
  assert.deepStrictEqual(defaults, DEFAULT_SETTINGS);

  // Save partial settings
  saveSettings(storage, { focusTime: 45, keepAwake: true });
  const loaded = loadSettings(storage);
  assert.strictEqual(loaded.focusTime, 45);
  assert.strictEqual(loaded.keepAwake, true);
  assert.strictEqual(loaded.shortBreakTime, DEFAULT_SETTINGS.shortBreakTime);
  assert.strictEqual(loaded.soundOn, DEFAULT_SETTINGS.soundOn);
});

test("storage: quota error handling path", () => {
  let quotaErrorFired = false;
  let reportedKey = null;

  // Mock storage that throws QuotaExceededError
  const failingStorage = {
    setItem(key, value) {
      const err = new Error("Quota exceeded");
      err.name = "QuotaExceededError";
      err.code = 22;
      throw err;
    },
    getItem() {
      return null;
    },
  };

  const success = safeSet(
    failingStorage,
    "test_key",
    { huge: "payload" },
    (err, key) => {
      quotaErrorFired = true;
      reportedKey = key;
    },
  );

  assert.strictEqual(success, false, "safeSet should return false on quota error");
  assert.strictEqual(quotaErrorFired, true, "Quota error callback should be triggered");
  assert.strictEqual(reportedKey, "test_key", "Reported key should match");
});
