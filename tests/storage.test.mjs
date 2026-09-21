import test from "node:test";
import assert from "node:assert";
import {
  migrateToV2,
  loadSettings,
  saveSettings,
  loadSessions,
  appendSession,
  loadTodos,
  saveTodos,
  loadTheme,
  saveTheme,
  safeSet,
  safeGet,
  STORAGE_KEYS,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  exportDataJSON,
  exportSessionsCSV,
  validateImportData,
  mergeImportData,
  replaceImportData,
  resetAllData,
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

test("storage: exportDataJSON formats valid JSON with schema metadata", () => {
  const storage = createMockStorage();
  saveSettings(storage, { focusTime: 30, dailyGoal: 6 });
  saveTheme(storage, "synthwave");
  appendSession(storage, {
    id: "session_1",
    phase: "work",
    start: 1700000000000,
    end: 1700001500000,
    plannedSec: 1500,
    actualSec: 1500,
    completed: true,
    tag: "Coding",
  });
  saveTodos(storage, {
    "2026-09-22": [
      { id: "task_1", text: "Test Phase 3", completed: true, estimate: 3, tag: "Coding" },
    ],
  });

  const jsonStr = exportDataJSON(storage);
  assert.ok(typeof jsonStr === "string");
  const parsed = JSON.parse(jsonStr);

  assert.strictEqual(parsed.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.ok(parsed.exportedAt);
  assert.strictEqual(parsed.settings.focusTime, 30);
  assert.strictEqual(parsed.settings.dailyGoal, 6);
  assert.strictEqual(parsed.theme, "synthwave");
  assert.strictEqual(parsed.sessions.length, 1);
  assert.strictEqual(parsed.sessions[0].id, "session_1");
  assert.strictEqual(parsed.sessions[0].tag, "Coding");
  assert.strictEqual(parsed.todos["2026-09-22"].length, 1);
  assert.strictEqual(parsed.todos["2026-09-22"][0].estimate, 3);
});

test("storage: exportSessionsCSV formats valid CSV with proper headers and escaped rows", () => {
  const storage = createMockStorage();
  appendSession(storage, {
    id: "s1",
    phase: "work",
    start: 1700000000000,
    end: 1700001500000,
    plannedSec: 1500,
    actualSec: 1500,
    completed: true,
    taskId: "t1",
    tag: "Work, Urgent",
  });

  const csv = exportSessionsCSV(storage);
  const lines = csv.trim().split("\n");
  assert.strictEqual(lines.length, 2);
  assert.strictEqual(
    lines[0],
    "id,startTime,endTime,phase,plannedSec,actualSec,completed,taskId,tag",
  );
  // The tag containing a comma should be quoted: "Work, Urgent"
  assert.ok(lines[1].includes('"Work, Urgent"'));
  assert.ok(lines[1].startsWith("s1,"));
  assert.ok(lines[1].includes("true"));
});

test("storage: validateImportData validates structures and rejects invalid input", () => {
  // Empty
  assert.strictEqual(validateImportData("").valid, false);
  assert.strictEqual(validateImportData("   ").valid, false);
  // Malformed JSON
  assert.strictEqual(validateImportData("not a json").valid, false);
  // Array root instead of object
  assert.strictEqual(validateImportData("[]").valid, false);
  // Unrelated object
  assert.strictEqual(validateImportData('{"foo": "bar"}').valid, false);

  // Valid backup payload
  const validPayload = JSON.stringify({
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    settings: { focusTime: 25 },
    sessions: [{ id: "s1", completed: true }],
    todos: { "2026-09-22": [{ id: "t1", text: "Task" }] },
    theme: "nord",
  });
  const res = validateImportData(validPayload);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.summary.sessionCount, 1);
  assert.strictEqual(res.summary.todoCount, 1);
  assert.strictEqual(res.summary.dateCount, 1);
  assert.strictEqual(res.summary.schemaVersion, 2);
});

test("storage: mergeImportData deduplicates sessions and tasks without overwriting existing", () => {
  const storage = createMockStorage();

  // Pre-existing state
  appendSession(storage, { id: "s1", plannedSec: 1500, completed: true });
  saveTodos(storage, {
    "2026-09-22": [{ id: "t1", text: "Existing Task 1", completed: false }],
  });
  saveSettings(storage, { focusTime: 40 });

  // Incoming backup
  const incoming = {
    settings: { focusTime: 25, dailyGoal: 10 },
    sessions: [
      { id: "s1", plannedSec: 1500, completed: true }, // Duplicate id
      { id: "s2", plannedSec: 1200, completed: true }, // New id
    ],
    todos: {
      "2026-09-22": [
        { id: "t1", text: "Existing Task 1 duplicate", completed: false }, // Duplicate id
        { id: "t2", text: "New Task 2", completed: true }, // New id
      ],
      "2026-09-23": [
        { id: "t3", text: "Future Task", completed: false },
      ],
    },
  };

  const ok = mergeImportData(storage, incoming);
  assert.strictEqual(ok, true);

  // Sessions should have s1 and s2 (2 sessions total, s1 not duplicated)
  const sessions = loadSessions(storage);
  assert.strictEqual(sessions.length, 2);
  assert.deepStrictEqual(sessions.map((s) => s.id), ["s1", "s2"]);

  // Todos should preserve existing and add new
  const todos = loadTodos(storage);
  assert.strictEqual(todos["2026-09-22"].length, 2);
  assert.strictEqual(todos["2026-09-22"][0].text, "Existing Task 1");
  assert.strictEqual(todos["2026-09-22"][1].text, "New Task 2");
  assert.strictEqual(todos["2026-09-23"].length, 1);

  // Settings should keep existing focusTime: 40, and fill dailyGoal: 10
  const settings = loadSettings(storage);
  assert.strictEqual(settings.focusTime, 40);
  assert.strictEqual(settings.dailyGoal, 10);
});

test("storage: round-trip export -> resetAllData -> replaceImportData preserves data exactly", () => {
  const storage = createMockStorage();

  // Populate data
  saveSettings(storage, { focusTime: 50, alarmSound: "bell", dailyGoal: 8 });
  saveTheme(storage, "emerald");
  appendSession(storage, {
    id: "roundtrip_s1",
    phase: "work",
    start: 1700000000000,
    end: 1700003000000,
    plannedSec: 3000,
    actualSec: 3000,
    completed: true,
    tag: "Design",
  });
  saveTodos(storage, {
    "2026-09-22": [
      { id: "task_a", text: "Design Mockups", completed: true, estimate: 4, tag: "Design", pomodoros: 2 },
    ],
  });

  // Step 1: Export JSON
  const exportedJSON = exportDataJSON(storage);
  const validated = validateImportData(exportedJSON);
  assert.strictEqual(validated.valid, true);

  // Step 2: Reset all data
  resetAllData(storage);

  // Verify everything was wiped
  assert.deepStrictEqual(loadSessions(storage), []);
  assert.deepStrictEqual(loadTodos(storage), {});
  assert.strictEqual(loadTheme(storage), "dark");
  assert.strictEqual(loadSettings(storage).focusTime, DEFAULT_SETTINGS.focusTime);

  // Step 3: Replace from exported backup
  const replaced = replaceImportData(storage, validated.data);
  assert.strictEqual(replaced, true);

  // Step 4: Verify full fidelity
  const restoredSettings = loadSettings(storage);
  assert.strictEqual(restoredSettings.focusTime, 50);
  assert.strictEqual(restoredSettings.alarmSound, "bell");
  assert.strictEqual(restoredSettings.dailyGoal, 8);

  const restoredTheme = loadTheme(storage);
  assert.strictEqual(restoredTheme, "emerald");

  const restoredSessions = loadSessions(storage);
  assert.strictEqual(restoredSessions.length, 1);
  assert.strictEqual(restoredSessions[0].id, "roundtrip_s1");
  assert.strictEqual(restoredSessions[0].tag, "Design");
  assert.strictEqual(restoredSessions[0].actualSec, 3000);

  const restoredTodos = loadTodos(storage);
  assert.strictEqual(restoredTodos["2026-09-22"].length, 1);
  assert.strictEqual(restoredTodos["2026-09-22"][0].id, "task_a");
  assert.strictEqual(restoredTodos["2026-09-22"][0].estimate, 4);
  assert.strictEqual(restoredTodos["2026-09-22"][0].pomodoros, 2);
  assert.strictEqual(restoredTodos["2026-09-22"][0].tag, "Design");
});

