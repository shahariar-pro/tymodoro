/**
 * stats.js - Pure session statistics and streak calculations
 * Zero DOM dependencies; fully testable in Node.
 */

/**
 * Normalizes a date into an integer day index based on local year, month, date.
 * Immune to DST shifts because UTC representation of local (y, m, d) is used.
 */
export function toLocalDayIndex(date) {
  const d = new Date(date);
  return Math.floor(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000,
  );
}

/**
 * Formats a timestamp into a standard local YYYY-MM-DD string
 */
export function toLocalDateString(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Returns the start of the week for a given date and weekStart setting ("mon" | "sat" | "sun")
 */
export function getStartOfWeek(date, weekStart = "mon") {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 is Sun, 1 is Mon, 6 is Sat

  let diff = 0;
  if (weekStart === "sun") {
    diff = -day;
  } else if (weekStart === "sat") {
    diff = day === 6 ? 0 : -(day + 1);
  } else {
    // "mon"
    diff = day === 0 ? -6 : 1 - day;
  }

  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Computes consecutive day streaks.
 * Rule: consecutive local days with >= 1 completed focus session;
 * today without a session yet does not break yesterday's streak.
 */
export function computeStreaks(sessions = [], now = new Date()) {
  const completedSessions = sessions.filter((s) => s && s.completed);
  if (completedSessions.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Set of unique day indices with at least one completed session
  const dayIndices = new Set();
  for (const s of completedSessions) {
    const timestamp = s.end || s.start;
    if (timestamp) {
      dayIndices.add(toLocalDayIndex(timestamp));
    }
  }

  const sortedDays = Array.from(dayIndices).sort((a, b) => a - b);
  if (sortedDays.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Calculate longest streak across all history
  let longestStreak = 0;
  let currentBlock = 0;
  let lastDay = null;

  for (const day of sortedDays) {
    if (lastDay === null || day === lastDay + 1) {
      currentBlock++;
    } else {
      currentBlock = 1;
    }
    if (currentBlock > longestStreak) {
      longestStreak = currentBlock;
    }
    lastDay = day;
  }

  // Calculate current streak relative to `now`
  const todayIndex = toLocalDayIndex(now);
  const yesterdayIndex = todayIndex - 1;

  let currentStreak = 0;
  const hasToday = dayIndices.has(todayIndex);
  const hasYesterday = dayIndices.has(yesterdayIndex);

  if (hasToday || hasYesterday) {
    let checkDay = hasToday ? todayIndex : yesterdayIndex;
    while (dayIndices.has(checkDay)) {
      currentStreak++;
      checkDay--;
    }
  }

  return { currentStreak, longestStreak };
}

/**
 * Derives full statistics summary from session logs
 */
export function getStatsSummary(sessions = [], weekStart = "mon", now = new Date()) {
  const completedSessions = sessions.filter((s) => s && s.completed);
  const todayIndex = toLocalDayIndex(now);

  const startOfWeek = getStartOfWeek(now, weekStart);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let todaySessions = 0;
  let weekSessions = 0;
  let monthSessions = 0;
  let totalMinutes = 0;
  const dailyData = {};

  for (const s of completedSessions) {
    const ts = s.end || s.start || now.getTime();
    const d = new Date(ts);
    const dayIndex = toLocalDayIndex(d);
    const legacyDateKey = d.toDateString();

    // Daily count tracking
    dailyData[legacyDateKey] = (dailyData[legacyDateKey] || 0) + 1;

    // Actual elapsed minutes
    const actualSec = s.actualSec != null ? s.actualSec : (s.plannedSec || 1500);
    totalMinutes += Math.round(actualSec / 60);

    // Today
    if (dayIndex === todayIndex) {
      todaySessions++;
    }

    // This Week
    if (d >= startOfWeek && d < endOfWeek) {
      weekSessions++;
    }

    // This Month
    if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
      monthSessions++;
    }
  }

  const { currentStreak, longestStreak } = computeStreaks(completedSessions, now);

  return {
    totalSessions: completedSessions.length,
    todaySessions,
    weekSessions,
    monthSessions,
    totalMinutes,
    currentStreak,
    longestStreak,
    dailyData,
  };
}

/**
 * Calculates progress toward daily goal
 */
export function getDailyGoalProgress(sessions = [], dailyGoal = 4, now = new Date()) {
  const summary = getStatsSummary(sessions, "mon", now);
  const todayCount = summary.todaySessions;
  const goal = Math.max(1, dailyGoal || 4);
  const percent = Math.min(100, Math.round((todayCount / goal) * 100));

  return {
    todayCount,
    goal,
    percent,
    achieved: todayCount >= goal,
  };
}

/**
 * Returns daily activity over the last N days (7, 30, or 90)
 */
export function getDailyActivity(sessions = [], days = 7, now = new Date()) {
  const completedSessions = sessions.filter((s) => s && s.completed);
  const activityMap = new Map();

  // Index sessions by YYYY-MM-DD
  for (const s of completedSessions) {
    const ts = s.end || s.start || now.getTime();
    const dateStr = toLocalDateString(ts);
    const prev = activityMap.get(dateStr) || { count: 0, minutes: 0 };
    const sec = s.actualSec != null ? s.actualSec : (s.plannedSec || 1500);
    prev.count += 1;
    prev.minutes += Math.round(sec / 60);
    activityMap.set(dateStr, prev);
  }

  const result = [];
  const startDay = new Date(now);
  startDay.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(startDay);
    d.setDate(d.getDate() - i);
    const dateStr = toLocalDateString(d);
    const data = activityMap.get(dateStr) || { count: 0, minutes: 0 };
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    const shortDate = d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });

    result.push({
      dateStr,
      dayName,
      shortDate,
      count: data.count,
      minutes: data.minutes,
    });
  }

  return result;
}

/**
 * Returns 24-hour histogram of sessions started or completed by hour of day (0-23)
 */
export function getHistogramByHour(sessions = []) {
  const completedSessions = sessions.filter((s) => s && s.completed);
  const histogram = new Array(24).fill(0);

  for (const s of completedSessions) {
    const ts = s.start || s.end;
    if (ts) {
      const hour = new Date(ts).getHours();
      if (hour >= 0 && hour < 24) {
        histogram[hour]++;
      }
    }
  }

  return histogram;
}

/**
 * Computes breakdown of focus time and sessions by tag
 */
export function getTagBreakdown(sessions = []) {
  const completedSessions = sessions.filter((s) => s && s.completed);
  const map = new Map();

  for (const s of completedSessions) {
    const tag = (s.tag || "").trim() || "Untagged";
    const sec = s.actualSec != null ? s.actualSec : (s.plannedSec || 1500);
    const prev = map.get(tag) || { sessions: 0, minutes: 0 };
    prev.sessions++;
    prev.minutes += Math.round(sec / 60);
    map.set(tag, prev);
  }

  return Array.from(map.entries())
    .map(([tag, data]) => ({
      tag,
      sessions: data.sessions,
      minutes: data.minutes,
    }))
    .sort((a, b) => b.sessions - a.sessions || b.minutes - a.minutes);
}

/**
 * Computes breakdown of focus time and pomodoros by task
 */
export function getTaskBreakdown(sessions = [], allTodos = {}) {
  const completedSessions = sessions.filter((s) => s && s.completed && s.taskId);
  const map = new Map();

  // Build task title lookup from allTodos
  const taskLookup = new Map();
  if (allTodos && typeof allTodos === "object") {
    for (const dateKey of Object.keys(allTodos)) {
      const list = allTodos[dateKey];
      if (Array.isArray(list)) {
        for (const t of list) {
          if (t && t.id) {
            taskLookup.set(t.id, { text: t.text, tag: t.tag });
          }
        }
      }
    }
  }

  for (const s of completedSessions) {
    const taskId = s.taskId;
    const resolved = taskLookup.get(taskId);
    const taskName = resolved?.text || s.taskName || `Task #${String(taskId).slice(-4)}`;
    const tag = (s.tag || resolved?.tag || "").trim();
    const sec = s.actualSec != null ? s.actualSec : (s.plannedSec || 1500);

    const prev = map.get(taskId) || {
      taskId,
      taskName,
      tag,
      sessions: 0,
      minutes: 0,
    };
    prev.sessions++;
    prev.minutes += Math.round(sec / 60);
    map.set(taskId, prev);
  }

  return Array.from(map.values()).sort(
    (a, b) => b.sessions - a.sessions || b.minutes - a.minutes,
  );
}
