import test from "node:test";
import assert from "node:assert";
import {
  createState,
  start,
  pause,
  resume,
  tick,
  skip,
  reset,
  applySettings,
  restore,
  PHASES,
  STATUS,
} from "../public/js/timer.js";

const customSettings = {
  focusTime: 25,
  shortBreakTime: 5,
  longBreakTime: 15,
  longBreakAfter: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
};

test("timer: initial state is idle with correct duration", () => {
  const state = createState(customSettings);
  assert.strictEqual(state.status, STATUS.IDLE);
  assert.strictEqual(state.phase, PHASES.WORK);
  assert.strictEqual(state.plannedSec, 1500);
  assert.strictEqual(state.remainingSec, 1500);
  assert.strictEqual(state.cycleCount, 0);
  assert.strictEqual(state.endsAt, null);
});

test("timer: start, pause, resume math", () => {
  const t0 = 1000000;
  const state = createState(customSettings);

  // Start timer at t0
  const running = start(state, t0);
  assert.strictEqual(running.status, STATUS.RUNNING);
  assert.strictEqual(running.endsAt, t0 + 1500 * 1000);

  // 100 seconds elapsed
  const t1 = t0 + 100 * 1000;
  const ticked = tick(running, t1);
  assert.strictEqual(ticked.state.remainingSec, 1400);
  assert.strictEqual(ticked.event, "none");

  // Pause at t1
  const paused = pause(running, t1);
  assert.strictEqual(paused.status, STATUS.PAUSED);
  assert.strictEqual(paused.remainingSec, 1400);
  assert.strictEqual(paused.endsAt, null);

  // Resume 50 seconds later at t2
  const t2 = t1 + 50 * 1000;
  const resumed = resume(paused, t2);
  assert.strictEqual(resumed.status, STATUS.RUNNING);
  assert.strictEqual(resumed.remainingSec, 1400);
  assert.strictEqual(resumed.endsAt, t2 + 1400 * 1000);
});

test("timer: completes exactly at endsAt", () => {
  const t0 = 1000000;
  const state = createState(customSettings);
  const running = start(state, t0);

  // Tick 1ms before completion
  const tBefore = running.endsAt - 1;
  const tickBefore = tick(running, tBefore, customSettings);
  assert.strictEqual(tickBefore.event, "none");
  assert.strictEqual(tickBefore.completedSession, null);

  // Tick exactly at endsAt
  const tDone = running.endsAt;
  const tickDone = tick(running, tDone, customSettings);
  assert.strictEqual(tickDone.event, "completed");
  assert.ok(tickDone.completedSession);
  assert.strictEqual(tickDone.completedSession.actualSec, 1500);
  assert.strictEqual(tickDone.completedSession.completed, true);
  // Transitions to short break (cycleCount 1 of 4)
  assert.strictEqual(tickDone.state.phase, PHASES.SHORT_BREAK);
  assert.strictEqual(tickDone.state.status, STATUS.IDLE);
  assert.strictEqual(tickDone.state.cycleCount, 1);
  assert.strictEqual(tickDone.state.plannedSec, 300);
});

test("timer: skip at 89% vs 90%", () => {
  const t0 = 1000000;
  const state = createState(customSettings);
  const running = start(state, t0);

  // 89% elapsed: 1500 * 0.89 = 1335s elapsed, remaining = 165s
  const t89 = t0 + 1335 * 1000;
  const skip89 = skip(running, t89, customSettings);
  assert.strictEqual(skip89.event, "confirm_skip");
  assert.strictEqual(skip89.percentComplete, 89);
  assert.strictEqual(skip89.completedSession, null);

  // 90% elapsed: 1500 * 0.90 = 1350s elapsed
  const t90 = t0 + 1350 * 1000;
  const skip90 = skip(running, t90, customSettings);
  assert.strictEqual(skip90.event, "completed");
  assert.ok(skip90.completedSession);
  assert.strictEqual(skip90.completedSession.actualSec, 1350);
  assert.strictEqual(skip90.completedSession.completed, true);
  assert.strictEqual(skip90.state.phase, PHASES.SHORT_BREAK);
});

test("timer: long break appears every N sessions", () => {
  let state = createState(customSettings);
  const t0 = 1000000;

  // Run 4 work sessions
  for (let i = 1; i <= 4; i++) {
    state = start(state, t0);
    const result = tick(state, state.endsAt, customSettings);
    state = result.state;

    if (i < 4) {
      assert.strictEqual(state.phase, PHASES.SHORT_BREAK, `Session ${i} should transition to short break`);
      assert.strictEqual(state.cycleCount, i);
      // Finish short break
      state = start(state, t0);
      const breakResult = tick(state, state.endsAt, customSettings);
      state = breakResult.state;
      assert.strictEqual(state.phase, PHASES.WORK);
    } else {
      // 4th session should transition to long break and reset cycle count
      assert.strictEqual(state.phase, PHASES.LONG_BREAK, "4th session should transition to long break");
      assert.strictEqual(state.cycleCount, 0);
      assert.strictEqual(state.plannedSec, 900); // 15 minutes
    }
  }
});

test("timer: restore after long absence (finished while away)", () => {
  const t0 = 1000000;
  const state = createState(customSettings);
  const running = start(state, t0);

  // User closed tab, returned 10 minutes after timer finished
  const tReturn = running.endsAt + 600 * 1000;
  const restored = restore(running, tReturn, customSettings);

  assert.strictEqual(restored.awayCompleted, true);
  assert.strictEqual(restored.event, "completed");
  assert.ok(restored.completedSession);
  assert.strictEqual(restored.completedSession.actualSec, 1500);
  assert.strictEqual(restored.state.status, STATUS.IDLE);
  assert.strictEqual(restored.state.phase, PHASES.SHORT_BREAK);
});

test("timer: applySettings while idle vs running", () => {
  const idleState = createState(customSettings);
  const newSettings = { ...customSettings, focusTime: 50 };

  // Idle state updates immediately
  const updatedIdle = applySettings(idleState, newSettings);
  assert.strictEqual(updatedIdle.plannedSec, 3000);
  assert.strictEqual(updatedIdle.remainingSec, 3000);

  // Running state preserves current session duration
  const running = start(idleState, 1000000);
  const updatedRunning = applySettings(running, newSettings);
  assert.strictEqual(updatedRunning.plannedSec, 1500);
  assert.strictEqual(updatedRunning.endsAt, running.endsAt);
});

test("timer: reset restores current phase to full duration", () => {
  const state = createState(customSettings);
  const running = start(state, 1000000);
  const paused = pause(running, 1000000 + 500 * 1000); // 1000s left

  const resetState = reset(paused, customSettings);
  assert.strictEqual(resetState.status, STATUS.IDLE);
  assert.strictEqual(resetState.remainingSec, 1500);
  assert.strictEqual(resetState.endsAt, null);
});
