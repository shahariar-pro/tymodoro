import test from "node:test";
import assert from "node:assert";
import {
  getStatsSummary,
  computeStreaks,
  getStartOfWeek,
  toLocalDayIndex,
  getDailyGoalProgress,
  getDailyActivity,
  getHistogramByHour,
  getTagBreakdown,
  getTaskBreakdown,
} from "../public/js/stats.js";

test("stats: day, week, month boundaries with weekStart mon, sat, sun", () => {
  // Fixed reference date: Wednesday 2026-09-23 14:00:00
  const refNow = new Date(2026, 8, 23, 14, 0, 0); // Month 8 is September

  // Mon Sep 21: this week (mon/sun/sat), this month
  const monSession = {
    id: "s_mon",
    start: new Date(2026, 8, 21, 10, 0, 0).getTime(),
    end: new Date(2026, 8, 21, 10, 25, 0).getTime(),
    plannedSec: 1500,
    actualSec: 1500,
    completed: true,
  };

  // Sun Sep 20:
  // - weekStart 'mon': previous week
  // - weekStart 'sun': this week (Sunday is start of week)
  // - weekStart 'sat': this week (Saturday was start of week)
  const sunSession = {
    id: "s_sun",
    start: new Date(2026, 8, 20, 11, 0, 0).getTime(),
    end: new Date(2026, 8, 20, 11, 25, 0).getTime(),
    plannedSec: 1500,
    actualSec: 1500,
    completed: true,
  };

  // Fri Sep 18:
  // - weekStart 'mon': previous week
  // - weekStart 'sun': previous week
  // - weekStart 'sat': previous week (ended Fri Sep 18)
  const prevWeekSession = {
    id: "s_prev_week",
    start: new Date(2026, 8, 18, 9, 0, 0).getTime(),
    end: new Date(2026, 8, 18, 9, 25, 0).getTime(),
    plannedSec: 1500,
    actualSec: 1500,
    completed: true,
  };

  // Today session: Wed Sep 23
  const todaySession = {
    id: "s_today",
    start: new Date(2026, 8, 23, 10, 0, 0).getTime(),
    end: new Date(2026, 8, 23, 10, 25, 0).getTime(),
    plannedSec: 1500,
    actualSec: 1500,
    completed: true,
  };

  // Last month: Aug 30 2026
  const lastMonthSession = {
    id: "s_last_month",
    start: new Date(2026, 7, 30, 10, 0, 0).getTime(), // August
    end: new Date(2026, 7, 30, 10, 25, 0).getTime(),
    plannedSec: 1500,
    actualSec: 1500,
    completed: true,
  };

  const sessions = [monSession, sunSession, prevWeekSession, todaySession, lastMonthSession];

  // Test with weekStart = 'mon'
  const statsMon = getStatsSummary(sessions, "mon", refNow);
  assert.strictEqual(statsMon.todaySessions, 1);
  // Mon Sep 21 + Wed Sep 23 = 2
  assert.strictEqual(statsMon.weekSessions, 2, "Monday weekStart should count Mon and Wed");
  // Sep 21 + Sep 20 + Sep 18 + Sep 23 = 4 in September
  assert.strictEqual(statsMon.monthSessions, 4, "September should have 4 sessions");
  assert.strictEqual(statsMon.totalSessions, 5);
  assert.strictEqual(statsMon.totalMinutes, 125); // 5 * 25

  // Test with weekStart = 'sun'
  const statsSun = getStatsSummary(sessions, "sun", refNow);
  // Sun Sep 20 + Mon Sep 21 + Wed Sep 23 = 3
  assert.strictEqual(statsSun.weekSessions, 3, "Sunday weekStart should include Sun Sep 20");

  // Test with weekStart = 'sat'
  const statsSat = getStatsSummary(sessions, "sat", refNow);
  // Sun Sep 20 + Mon Sep 21 + Wed Sep 23 = 3
  assert.strictEqual(statsSat.weekSessions, 3, "Saturday weekStart should include Sun Sep 20");
});

test("stats: streaks across gaps and streak not broken by empty today", () => {
  // Suppose today is Day 10
  const base = new Date(2026, 4, 10, 12, 0, 0); // May 10 2026

  // Case A: Sessions on Day 8 and Day 9 (yesterday). Today (Day 10) has no session yet.
  const sessionsA = [
    {
      id: "s1",
      start: new Date(2026, 4, 8, 12, 0, 0).getTime(),
      end: new Date(2026, 4, 8, 12, 25, 0).getTime(),
      completed: true,
    },
    {
      id: "s2",
      start: new Date(2026, 4, 9, 12, 0, 0).getTime(),
      end: new Date(2026, 4, 9, 12, 25, 0).getTime(),
      completed: true,
    },
  ];

  const streaksA = computeStreaks(sessionsA, base);
  assert.strictEqual(streaksA.currentStreak, 2, "Streak from yesterday should remain 2 even if today has no session yet");
  assert.strictEqual(streaksA.longestStreak, 2);

  // Case B: Session completed today (Day 10) extends the streak to 3
  const sessionsB = [
    ...sessionsA,
    {
      id: "s3",
      start: new Date(2026, 4, 10, 10, 0, 0).getTime(),
      end: new Date(2026, 4, 10, 10, 25, 0).getTime(),
      completed: true,
    },
  ];

  const streaksB = computeStreaks(sessionsB, base);
  assert.strictEqual(streaksB.currentStreak, 3, "Completing a session today should extend streak to 3");
  assert.strictEqual(streaksB.longestStreak, 3);

  // Case C: Gaps in history
  // Historical streak of 4 days: May 1 to May 4.
  // Gap on May 5, 6, 7.
  // Current streak of 2 days: May 8, May 9.
  const sessionsC = [
    ...sessionsA,
    { id: "h1", start: new Date(2026, 4, 1, 10, 0, 0).getTime(), completed: true },
    { id: "h2", start: new Date(2026, 4, 2, 10, 0, 0).getTime(), completed: true },
    { id: "h3", start: new Date(2026, 4, 3, 10, 0, 0).getTime(), completed: true },
    { id: "h4", start: new Date(2026, 4, 4, 10, 0, 0).getTime(), completed: true },
  ];

  const streaksC = computeStreaks(sessionsC, base);
  assert.strictEqual(streaksC.currentStreak, 2, "Current streak is 2");
  assert.strictEqual(streaksC.longestStreak, 4, "Longest streak should be 4 from the historical block");

  // Case D: Gap of more than 1 day before today breaks streak to 0
  const sessionsD = [
    { id: "old1", start: new Date(2026, 4, 7, 10, 0, 0).getTime(), completed: true }, // 3 days ago
  ];
  const streaksD = computeStreaks(sessionsD, base);
  assert.strictEqual(streaksD.currentStreak, 0, "No session today or yesterday should yield currentStreak 0");
  assert.strictEqual(streaksD.longestStreak, 1);
});

test("stats: DST-safe local-date handling", () => {
  // Spring forward and Fall back DST transitions
  // Ensure that day index differences are exactly 1 across the transition
  const springBefore = new Date(2026, 2, 8, 1, 0, 0); // March 8
  const springAfter = new Date(2026, 2, 9, 1, 0, 0);  // March 9

  const index1 = toLocalDayIndex(springBefore);
  const index2 = toLocalDayIndex(springAfter);
  assert.strictEqual(index2 - index1, 1, "Day index difference across Spring DST must be exactly 1");

  const fallBefore = new Date(2026, 10, 1, 1, 0, 0); // November 1
  const fallAfter = new Date(2026, 10, 2, 1, 0, 0);  // November 2

  const index3 = toLocalDayIndex(fallBefore);
  const index4 = toLocalDayIndex(fallAfter);
  assert.strictEqual(index4 - index3, 1, "Day index difference across Fall DST must be exactly 1");
});

test("stats: daily goal progress and achievement", () => {
  const today = new Date(2026, 8, 22, 14, 0, 0);

  const sessions = [
    { id: "s1", start: new Date(2026, 8, 22, 9, 0).getTime(), completed: true },
    { id: "s2", start: new Date(2026, 8, 22, 10, 0).getTime(), completed: true },
    { id: "s3", start: new Date(2026, 8, 22, 11, 0).getTime(), completed: true },
  ];

  // Goal = 4: 3/4 = 75%, not achieved
  const progress75 = getDailyGoalProgress(sessions, 4, today);
  assert.strictEqual(progress75.todayCount, 3);
  assert.strictEqual(progress75.goal, 4);
  assert.strictEqual(progress75.percent, 75);
  assert.strictEqual(progress75.achieved, false);

  // Goal = 3: 3/3 = 100%, achieved
  const progress100 = getDailyGoalProgress(sessions, 3, today);
  assert.strictEqual(progress100.percent, 100);
  assert.strictEqual(progress100.achieved, true);
});

test("stats: daily activity N-day range and hour histogram", () => {
  const refNow = new Date(2026, 8, 22, 16, 0, 0);

  const sessions = [
    // 2 sessions at 14:00 today
    { id: "s1", start: new Date(2026, 8, 22, 14, 0).getTime(), plannedSec: 1500, actualSec: 1500, completed: true },
    { id: "s2", start: new Date(2026, 8, 22, 14, 30).getTime(), plannedSec: 1500, actualSec: 1500, completed: true },
    // 1 session yesterday at 9:00
    { id: "s3", start: new Date(2026, 8, 21, 9, 0).getTime(), plannedSec: 1500, actualSec: 1500, completed: true },
  ];

  // Activity 7 days
  const activity7 = getDailyActivity(sessions, 7, refNow);
  assert.strictEqual(activity7.length, 7);
  // Last element is today
  assert.strictEqual(activity7[6].count, 2);
  assert.strictEqual(activity7[6].minutes, 50);
  // Second-to-last is yesterday
  assert.strictEqual(activity7[5].count, 1);
  assert.strictEqual(activity7[5].minutes, 25);

  // Histogram 24 hours
  const hist = getHistogramByHour(sessions);
  assert.strictEqual(hist.length, 24);
  assert.strictEqual(hist[14], 2, "Hour 14 should have 2 sessions");
  assert.strictEqual(hist[9], 1, "Hour 9 should have 1 session");
  assert.strictEqual(hist[0], 0, "Hour 0 should have 0 sessions");
});

test("stats: tag breakdown and task pomodoro breakdown", () => {
  const sessions = [
    { id: "s1", taskId: 101, tag: "Coding", plannedSec: 1500, actualSec: 1500, completed: true },
    { id: "s2", taskId: 101, tag: "Coding", plannedSec: 1500, actualSec: 1500, completed: true },
    { id: "s3", taskId: 102, tag: "Writing", plannedSec: 1500, actualSec: 1500, completed: true },
    { id: "s4", taskId: null, tag: null, plannedSec: 1500, actualSec: 1500, completed: true },
  ];

  const mockTodos = {
    "Tue Sep 22 2026": [
      { id: 101, text: "Build feature", tag: "Coding", estimate: 3, done: 2 },
      { id: 102, text: "Write documentation", tag: "Writing", estimate: 1, done: 1 },
    ],
  };

  // Tags
  const tagStats = getTagBreakdown(sessions);
  assert.strictEqual(tagStats.length, 3);
  // Top tag: Coding with 2 sessions
  assert.strictEqual(tagStats[0].tag, "Coding");
  assert.strictEqual(tagStats[0].sessions, 2);
  assert.strictEqual(tagStats[0].minutes, 50);

  // Tasks
  const taskStats = getTaskBreakdown(sessions, mockTodos);
  assert.strictEqual(taskStats.length, 2);
  // Task 101 should have 2 pomodoros
  assert.strictEqual(taskStats[0].taskId, 101);
  assert.strictEqual(taskStats[0].taskName, "Build feature");
  assert.strictEqual(taskStats[0].sessions, 2);
  assert.strictEqual(taskStats[0].minutes, 50);
});
