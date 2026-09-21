/**
 * storage.js - Local-first Storage and Idempotent Schema Migration
 * Accepts an injectable storage backend (localStorage by default) so tests can pass in a mock.
 */

export const STORAGE_KEYS = {
  SCHEMA: "tymodoro-schema",
  SETTINGS: "tymodoro-settings",
  TIMER: "tymodoro-timer",
  SESSIONS: "tymodoro-sessions",
  TODOS: "tymodoro-all-todos",
  THEME: "tymodoro-theme",
  STATS_LEGACY: "tymodoro-stats",
  MIXER: "tymodoro-mixer",
};

export const CURRENT_SCHEMA_VERSION = 2;

export const DEFAULT_SETTINGS = {
  focusTime: 25,
  shortBreakTime: 5,
  longBreakTime: 15,
  longBreakAfter: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  soundOn: true,
  alarmSound: "chime",
  alarmVolume: 0.6,
  alarmRepeat: 1,
  notificationsOn: false,
  keepAwake: false,
  titleCountdown: true,
  dailyGoal: 4,
  weekStart: "mon",
};

/**
 * Resolves the active storage backend (window.localStorage or custom mock)
 */
function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  // In-memory fallback if no storage is available
  return {
    _data: {},
    getItem(k) {
      return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null;
    },
    setItem(k, v) {
      this._data[k] = String(v);
    },
    removeItem(k) {
      delete this._data[k];
    },
    clear() {
      this._data = {};
    },
  };
}

/**
 * Safely writes to storage, catching QuotaExceededError and invoking an error callback.
 */
export function safeSet(storage, key, value, onQuotaError = null) {
  const store = resolveStorage(storage);
  try {
    store.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    return true;
  } catch (error) {
    const isQuotaError =
      error &&
      (error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        error.code === 22 ||
        error.code === 1014);

    if (isQuotaError && typeof onQuotaError === "function") {
      onQuotaError(error, key);
    } else {
      console.error(`Storage error saving key "${key}":`, error);
    }
    return false;
  }
}

/**
 * Safely reads and parses JSON from storage
 */
export function safeGet(storage, key, defaultValue = null) {
  const store = resolveStorage(storage);
  try {
    const item = store.getItem(key);
    if (item === null || item === undefined) return defaultValue;
    return JSON.parse(item);
  } catch (error) {
    console.error(`Storage error reading key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Idempotent v1 -> v2 Migration
 */
export function migrateToV2(storage, onQuotaError = null) {
  const store = resolveStorage(storage);
  const rawSchema = store.getItem(STORAGE_KEYS.SCHEMA);
  const currentSchema = rawSchema ? parseInt(rawSchema, 10) : 1;

  if (currentSchema >= CURRENT_SCHEMA_VERSION) {
    return false; // Already migrated
  }

  // 1. Merge settings over defaults
  const existingSettings = safeGet(store, STORAGE_KEYS.SETTINGS, {});
  const mergedSettings = { ...DEFAULT_SETTINGS, ...existingSettings };
  safeSet(store, STORAGE_KEYS.SETTINGS, mergedSettings, onQuotaError);

  // 2. Read legacy dailyData and synthesize sessions
  const legacyStats = safeGet(store, STORAGE_KEYS.STATS_LEGACY, null);
  const existingSessions = safeGet(store, STORAGE_KEYS.SESSIONS, []);
  const existingIds = new Set(existingSessions.map((s) => s.id));

  const focusDurationSec = (mergedSettings.focusTime || 25) * 60;
  const migratedSessions = [...existingSessions];

  if (legacyStats && legacyStats.dailyData) {
    for (const [dateStr, count] of Object.entries(legacyStats.dailyData)) {
      const sessionCount = parseInt(count, 10) || 0;
      const baseDate = new Date(dateStr);

      if (!isNaN(baseDate.getTime())) {
        baseDate.setHours(12, 0, 0, 0); // 12:00 local time
        const baseMs = baseDate.getTime();

        for (let i = 0; i < sessionCount; i++) {
          const legacyId = `legacy_${dateStr.replace(/\s+/g, "_")}_${i}`;
          if (!existingIds.has(legacyId)) {
            existingIds.add(legacyId);
            migratedSessions.push({
              id: legacyId,
              start: baseMs + i * 60000,
              end: baseMs + i * 60000 + focusDurationSec * 1000,
              plannedSec: focusDurationSec,
              actualSec: focusDurationSec,
              completed: true,
              taskId: null,
              tag: null,
              legacy: true,
            });
          }
        }
      }
    }
  }

  safeSet(store, STORAGE_KEYS.SESSIONS, migratedSessions, onQuotaError);

  // 3. Mark schema as version 2
  safeSet(store, STORAGE_KEYS.SCHEMA, CURRENT_SCHEMA_VERSION.toString(), onQuotaError);

  return true;
}

/**
 * Loads settings merged over defaults
 */
export function loadSettings(storage) {
  const store = resolveStorage(storage);
  const saved = safeGet(store, STORAGE_KEYS.SETTINGS, null);
  if (!saved) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...saved };
}

/**
 * Saves settings
 */
export function saveSettings(storage, settings, onQuotaError = null) {
  return safeSet(storage, STORAGE_KEYS.SETTINGS, settings, onQuotaError);
}

/**
 * Loads timer state
 */
export function loadTimerState(storage) {
  return safeGet(storage, STORAGE_KEYS.TIMER, null);
}

/**
 * Saves timer state
 */
export function saveTimerState(storage, state, onQuotaError = null) {
  return safeSet(storage, STORAGE_KEYS.TIMER, state, onQuotaError);
}

/**
 * Loads session history
 */
export function loadSessions(storage) {
  return safeGet(storage, STORAGE_KEYS.SESSIONS, []);
}

/**
 * Appends a completed session to history
 */
export function appendSession(storage, session, onQuotaError = null) {
  if (!session) return false;
  const sessions = loadSessions(storage);
  sessions.push(session);
  return safeSet(storage, STORAGE_KEYS.SESSIONS, sessions, onQuotaError);
}

/**
 * Loads all todos
 */
export function loadTodos(storage) {
  return safeGet(storage, STORAGE_KEYS.TODOS, {});
}

/**
 * Saves all todos
 */
export function saveTodos(storage, todos, onQuotaError = null) {
  return safeSet(storage, STORAGE_KEYS.TODOS, todos, onQuotaError);
}

/**
 * Loads current theme
 */
export function loadTheme(storage) {
  const store = resolveStorage(storage);
  return store.getItem(STORAGE_KEYS.THEME) || "dark";
}

/**
 * Saves current theme
 */
export function saveTheme(storage, theme, onQuotaError = null) {
  return safeSet(storage, STORAGE_KEYS.THEME, theme, onQuotaError);
}

/**
 * Exports all Tymodoro data as a JSON string with metadata
 */
export function exportDataJSON(storage) {
  const store = resolveStorage(storage);
  const backup = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: loadSettings(store),
    sessions: loadSessions(store),
    todos: loadTodos(store),
    theme: loadTheme(store),
  };
  return JSON.stringify(backup, null, 2);
}

/**
 * Exports completed sessions as a CSV string
 */
export function exportSessionsCSV(storage) {
  const sessions = loadSessions(storage);
  const headers = [
    "id",
    "startTime",
    "endTime",
    "phase",
    "plannedSec",
    "actualSec",
    "completed",
    "taskId",
    "tag",
  ];

  const escapeCsv = (val) => {
    if (val == null) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = sessions.map((s) =>
    [
      escapeCsv(s.id),
      escapeCsv(s.start ? new Date(s.start).toISOString() : ""),
      escapeCsv(s.end ? new Date(s.end).toISOString() : ""),
      escapeCsv(s.phase || "work"),
      escapeCsv(s.plannedSec || 1500),
      escapeCsv(s.actualSec != null ? s.actualSec : s.plannedSec || 1500),
      escapeCsv(s.completed ? "true" : "false"),
      escapeCsv(s.taskId || ""),
      escapeCsv(s.tag || ""),
    ].join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Validates imported JSON data structure and contents
 */
export function validateImportData(jsonString) {
  if (typeof jsonString !== "string" || !jsonString.trim()) {
    return { valid: false, error: "The provided file is empty." };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return { valid: false, error: "Invalid JSON syntax. File could not be parsed." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { valid: false, error: "Invalid backup format: root must be a JSON object." };
  }

  const hasSessions = Array.isArray(parsed.sessions);
  const hasTodos =
    parsed.todos && typeof parsed.todos === "object" && !Array.isArray(parsed.todos);
  const hasSettings = parsed.settings && typeof parsed.settings === "object";

  if (!hasSessions && !hasTodos && !hasSettings) {
    return {
      valid: false,
      error: "Backup file contains no recognizable Tymodoro sessions, tasks, or settings.",
    };
  }

  let sessionCount = hasSessions ? parsed.sessions.length : 0;
  let todoCount = 0;
  let dateCount = 0;

  if (hasTodos) {
    for (const dateKey of Object.keys(parsed.todos)) {
      if (Array.isArray(parsed.todos[dateKey])) {
        dateCount++;
        todoCount += parsed.todos[dateKey].length;
      }
    }
  }

  return {
    valid: true,
    data: parsed,
    summary: {
      sessionCount,
      todoCount,
      dateCount,
      schemaVersion: parsed.schemaVersion || 1,
      exportedAt: parsed.exportedAt || null,
    },
  };
}

/**
 * Merges imported backup data with current storage without deleting existing data
 */
export function mergeImportData(storage, importedData, onQuotaError = null) {
  const store = resolveStorage(storage);

  // 1. Merge sessions (deduplicate by session id)
  if (Array.isArray(importedData.sessions)) {
    const existingSessions = loadSessions(store);
    const existingIds = new Set(existingSessions.map((s) => s.id));
    for (const s of importedData.sessions) {
      if (s && s.id && !existingIds.has(s.id)) {
        existingSessions.push(s);
        existingIds.add(s.id);
      }
    }
    safeSet(store, STORAGE_KEYS.SESSIONS, existingSessions, onQuotaError);
  }

  // 2. Merge todos (deduplicate by task id within date)
  if (importedData.todos && typeof importedData.todos === "object") {
    const existingTodos = loadTodos(store);
    for (const dateKey of Object.keys(importedData.todos)) {
      const incomingList = importedData.todos[dateKey];
      if (Array.isArray(incomingList)) {
        if (!existingTodos[dateKey]) {
          existingTodos[dateKey] = [];
        }
        const existingTaskIds = new Set(existingTodos[dateKey].map((t) => t.id));
        for (const t of incomingList) {
          if (t && t.id && !existingTaskIds.has(t.id)) {
            existingTodos[dateKey].push(t);
            existingTaskIds.add(t.id);
          }
        }
      }
    }
    safeSet(store, STORAGE_KEYS.TODOS, existingTodos, onQuotaError);
  }

  // 3. Merge settings (keep existing, fill missing)
  if (importedData.settings && typeof importedData.settings === "object") {
    const currentSettings = safeGet(store, STORAGE_KEYS.SETTINGS, {});
    const mergedSettings = { ...DEFAULT_SETTINGS, ...importedData.settings, ...currentSettings };
    safeSet(store, STORAGE_KEYS.SETTINGS, mergedSettings, onQuotaError);
  }

  // 4. Ensure schema is current
  store.setItem(STORAGE_KEYS.SCHEMA, CURRENT_SCHEMA_VERSION.toString());
  return true;
}

/**
 * Replaces all current storage data with imported data
 */
export function replaceImportData(storage, importedData, onQuotaError = null) {
  const store = resolveStorage(storage);

  if (Array.isArray(importedData.sessions)) {
    safeSet(store, STORAGE_KEYS.SESSIONS, importedData.sessions, onQuotaError);
  }

  if (importedData.todos && typeof importedData.todos === "object") {
    safeSet(store, STORAGE_KEYS.TODOS, importedData.todos, onQuotaError);
  }

  if (importedData.settings && typeof importedData.settings === "object") {
    const settings = { ...DEFAULT_SETTINGS, ...importedData.settings };
    safeSet(store, STORAGE_KEYS.SETTINGS, settings, onQuotaError);
  }

  if (importedData.theme && typeof importedData.theme === "string") {
    safeSet(store, STORAGE_KEYS.THEME, importedData.theme, onQuotaError);
  }

  store.setItem(STORAGE_KEYS.SCHEMA, CURRENT_SCHEMA_VERSION.toString());
  return true;
}

/**
 * Resets all user data to fresh defaults (destructive action)
 */
export function resetAllData(storage) {
  const store = resolveStorage(storage);
  for (const key of Object.values(STORAGE_KEYS)) {
    store.removeItem(key);
  }
  store.setItem(STORAGE_KEYS.SCHEMA, CURRENT_SCHEMA_VERSION.toString());
  safeSet(store, STORAGE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS });
  safeSet(store, STORAGE_KEYS.SESSIONS, []);
  safeSet(store, STORAGE_KEYS.TODOS, {});
  safeSet(store, STORAGE_KEYS.THEME, "dark");
  return true;
}
