/**
 * timer.js - Pure Pomodoro Timer State Machine
 * Zero DOM dependencies, zero Date.now() calls internally (time is always passed in as `now` in ms).
 */

export const PHASES = {
  WORK: "work",
  SHORT_BREAK: "shortBreak",
  LONG_BREAK: "longBreak",
};

export const STATUS = {
  IDLE: "idle",
  RUNNING: "running",
  PAUSED: "paused",
};

export const DEFAULT_SETTINGS = {
  focusTime: 25,
  shortBreakTime: 5,
  longBreakTime: 15,
  longBreakAfter: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
};

/**
 * Get planned seconds for a given phase and settings
 */
export function getPhaseDurationSec(phase, settings = DEFAULT_SETTINGS) {
  if (phase === PHASES.SHORT_BREAK) {
    return (settings.shortBreakTime || 5) * 60;
  }
  if (phase === PHASES.LONG_BREAK) {
    return (settings.longBreakTime || 15) * 60;
  }
  return (settings.focusTime || 25) * 60;
}

/**
 * Creates initial timer state
 */
export function createState(settings = DEFAULT_SETTINGS, phase = PHASES.WORK) {
  const plannedSec = getPhaseDurationSec(phase, settings);
  return {
    v: 1,
    phase,
    status: STATUS.IDLE,
    plannedSec,
    endsAt: null,
    remainingSec: plannedSec,
    cycleCount: 0,
    taskId: null,
    startedAt: null,
  };
}

/**
 * Starts an idle timer or resumes a paused timer
 */
export function start(state, now, speed = 1) {
  if (state.status === STATUS.RUNNING) {
    return state;
  }
  const remainingSec = state.remainingSec > 0 ? state.remainingSec : state.plannedSec;
  const endsAt = now + Math.round((remainingSec * 1000) / speed);
  const startedAt = state.startedAt !== null ? state.startedAt : now;

  return {
    ...state,
    status: STATUS.RUNNING,
    endsAt,
    remainingSec,
    startedAt,
  };
}

/**
 * Pauses a running timer
 */
export function pause(state, now, speed = 1) {
  if (state.status !== STATUS.RUNNING) {
    return state;
  }
  const remainingSec = Math.max(
    0,
    Math.ceil(((state.endsAt - now) * speed) / 1000),
  );

  return {
    ...state,
    status: STATUS.PAUSED,
    endsAt: null,
    remainingSec,
  };
}

/**
 * Resumes a paused timer
 */
export function resume(state, now, speed = 1) {
  if (state.status !== STATUS.PAUSED) {
    return state;
  }
  return start(state, now, speed);
}

/**
 * Advances to the next phase based on cycle count and settings
 */
export function getNextPhaseTransition(state, settings = DEFAULT_SETTINGS) {
  let nextPhase = PHASES.WORK;
  let nextCycleCount = state.cycleCount;

  if (state.phase === PHASES.WORK) {
    nextCycleCount = state.cycleCount + 1;
    if (nextCycleCount >= (settings.longBreakAfter || 4)) {
      nextPhase = PHASES.LONG_BREAK;
      nextCycleCount = 0;
    } else {
      nextPhase = PHASES.SHORT_BREAK;
    }
  } else {
    nextPhase = PHASES.WORK;
  }

  const nextPlannedSec = getPhaseDurationSec(nextPhase, settings);
  return { nextPhase, nextCycleCount, nextPlannedSec };
}

/**
 * Completes the current session and transitions to the next phase
 */
function completeCurrentSession(state, settings = DEFAULT_SETTINGS, actualSec = null, now = null, speed = 1) {
  const isWork = state.phase === PHASES.WORK;
  const sessionActualSec = actualSec !== null ? actualSec : state.plannedSec;

  const completedSession = isWork
    ? {
        id: `s_${now || Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        start: state.startedAt || ((now || Date.now()) - sessionActualSec * 1000),
        end: now || Date.now(),
        plannedSec: state.plannedSec,
        actualSec: sessionActualSec,
        completed: true,
        taskId: state.taskId || null,
        tag: null,
        legacy: false,
      }
    : null;

  const { nextPhase, nextCycleCount, nextPlannedSec } = getNextPhaseTransition(
    state,
    settings,
  );

  const shouldAutoStart =
    (nextPhase === PHASES.WORK && settings.autoStartFocus) ||
    ((nextPhase === PHASES.SHORT_BREAK || nextPhase === PHASES.LONG_BREAK) &&
      settings.autoStartBreaks);

  let nextState = {
    v: 1,
    phase: nextPhase,
    status: STATUS.IDLE,
    plannedSec: nextPlannedSec,
    endsAt: null,
    remainingSec: nextPlannedSec,
    cycleCount: nextCycleCount,
    taskId: state.taskId,
    startedAt: null,
  };

  if (shouldAutoStart && now !== null) {
    nextState = start(nextState, now, speed);
  }

  return {
    state: nextState,
    event: "completed",
    completedSession,
    autoStarted: Boolean(shouldAutoStart),
  };
}

/**
 * Tick function called periodically with the current timestamp
 */
export function tick(state, now, settings = DEFAULT_SETTINGS, speed = 1) {
  if (state.status !== STATUS.RUNNING) {
    return { state, event: "none", completedSession: null };
  }

  if (now >= state.endsAt) {
    return completeCurrentSession(state, settings, state.plannedSec, now, speed);
  }

  const remainingSec = Math.max(
    0,
    Math.ceil(((state.endsAt - now) * speed) / 1000),
  );

  return {
    state: {
      ...state,
      remainingSec,
    },
    event: "none",
    completedSession: null,
  };
}

/**
 * Skip the current phase.
 * If work phase and >= 90% completed, logs completed session with actual elapsed time.
 * If work phase and < 90%, forceAbandon=true advances without logging.
 */
export function skip(state, now, settings = DEFAULT_SETTINGS, speed = 1, forceAbandon = false) {
  let remainingSec = state.remainingSec;
  if (state.status === STATUS.RUNNING && state.endsAt !== null) {
    remainingSec = Math.max(
      0,
      Math.ceil(((state.endsAt - now) * speed) / 1000),
    );
  }

  const elapsedSec = Math.max(0, state.plannedSec - remainingSec);
  const percentComplete = (elapsedSec / state.plannedSec) * 100;

  if (state.phase === PHASES.WORK && percentComplete < 90 && !forceAbandon) {
    return {
      state,
      event: "confirm_skip",
      percentComplete: Math.round(percentComplete),
      elapsedSec,
      completedSession: null,
    };
  }

  // If work phase and >= 90%, or break phase, or user confirmed abandonment
  if (state.phase === PHASES.WORK && percentComplete >= 90) {
    return completeCurrentSession(state, settings, elapsedSec, now, speed);
  }

  // Break phase or abandoned work session (< 90%)
  const { nextPhase, nextCycleCount, nextPlannedSec } = getNextPhaseTransition(
    state,
    settings,
  );

  return {
    state: {
      v: 1,
      phase: nextPhase,
      status: STATUS.IDLE,
      plannedSec: nextPlannedSec,
      endsAt: null,
      remainingSec: nextPlannedSec,
      cycleCount: state.phase === PHASES.WORK ? state.cycleCount : nextCycleCount,
      taskId: state.taskId,
      startedAt: null,
    },
    event: state.phase === PHASES.WORK ? "abandoned" : "completed",
    completedSession: null,
    autoStarted: false,
  };
}

/**
 * Resets the timer to the beginning of the current phase
 */
export function reset(state, settings = DEFAULT_SETTINGS) {
  const plannedSec = getPhaseDurationSec(state.phase, settings);
  return {
    ...state,
    status: STATUS.IDLE,
    plannedSec,
    endsAt: null,
    remainingSec: plannedSec,
    startedAt: null,
  };
}

/**
 * Switch session phase explicitly (e.g. user selects Break or Focus)
 */
export function setPhase(state, phase, settings = DEFAULT_SETTINGS) {
  const plannedSec = getPhaseDurationSec(phase, settings);
  return {
    ...state,
    phase,
    status: STATUS.IDLE,
    plannedSec,
    endsAt: null,
    remainingSec: plannedSec,
    startedAt: null,
  };
}

/**
 * Apply new settings to the state.
 * If idle: updates plannedSec and remainingSec to the new setting.
 * If running or paused: plannedSec and remainingSec remain untouched until phase completes.
 */
export function applySettings(state, settings) {
  if (state.status === STATUS.IDLE) {
    const plannedSec = getPhaseDurationSec(state.phase, settings);
    return {
      ...state,
      plannedSec,
      remainingSec: plannedSec,
    };
  }
  return state;
}

/**
 * Restores timer state from storage across page reloads
 */
export function restore(state, now, settings = DEFAULT_SETTINGS, speed = 1) {
  if (!state) {
    return { state: createState(settings), event: "none", awayCompleted: false, completedSession: null };
  }

  if (state.status === STATUS.RUNNING) {
    if (state.endsAt > now) {
      const remainingSec = Math.max(
        0,
        Math.ceil(((state.endsAt - now) * speed) / 1000),
      );
      return {
        state: { ...state, remainingSec },
        event: "none",
        awayCompleted: false,
        completedSession: null,
      };
    }

    // Timer completed while away
    const completion = completeCurrentSession(state, settings, state.plannedSec, state.endsAt || now, speed);
    // Ensure idle after absence rather than auto-running
    completion.state.status = STATUS.IDLE;
    completion.state.endsAt = null;

    return {
      state: completion.state,
      event: "completed",
      awayCompleted: true,
      completedSession: completion.completedSession,
    };
  }

  if (state.status === STATUS.PAUSED) {
    return {
      state: {
        ...state,
        status: STATUS.PAUSED,
        endsAt: null,
      },
      event: "none",
      awayCompleted: false,
      completedSession: null,
    };
  }

  // Idle state
  return {
    state: {
      ...state,
      status: STATUS.IDLE,
      endsAt: null,
    },
    event: "none",
    awayCompleted: false,
    completedSession: null,
  };
}
