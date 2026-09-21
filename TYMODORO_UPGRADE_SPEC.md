# Tymodoro Renovation Spec (for a coding agent)

Repo: `shahariar-pro/tymodoro`. Deployed on Vercel from Git (push = deploy).
Goal: turn the current single-file Pomodoro web app into a fast, private, installable, well-tested focus app. Fix the known bugs first, then add features in phases.

> **Agent: read this whole file before touching anything.** Work phase by phase. After each phase: run the tests, commit, then STOP and report (format in section 8). Do not start the next phase until the user says so.

---

## 1. Rules of engagement

- Work on a branch called `renovate`. Never commit to `main` directly. The user will test the Vercel preview deployment of the branch, then merge.
- One commit per task group, conventional messages (`fix:`, `feat:`, `refactor:`, `test:`, `docs:`). Small, reviewable commits.
- Read the existing code first (`public/script.js`, `public/index.html`, `public/style.css`, `public/float-timer.html`). Function names below are from a prior read; line numbers may be off, so search by name.
- Ask the user only when: (a) a decision needs their Vercel dashboard settings, (b) something would delete user data, (c) something costs money or adds a paid service. Everything else: decide, note it in the report, keep going.
- Never delete user data. Migrations must be idempotent and keep the old localStorage keys untouched as a backup.
- If something in this spec conflicts with what the code really does, trust the code, fix the plan, and say so in the report.
- Do not invent features outside this spec. Do not redesign the visual identity (minimal, black/white-first, 8 themes). Polish, don't restyle.

## 2. Hard constraints

| Constraint | Why |
|---|---|
| **No build step, no bundler, no framework.** Plain HTML/CSS + native ES modules, served statically from `public/`. | Keeps the existing Vercel setup working without touching dashboard settings. |
| Keep `public/index.html` as the entry and keep `public/` as the served root. | Same reason. |
| No runtime network requests to third parties (no CDN, no Google Fonts, no analytics). Vendor everything into `public/vendor/`. | Privacy is the selling point; also required for offline PWA. |
| Only one vendored dependency allowed: **Lucide** (pinned version, UMD build) in `public/vendor/`. | Icons already used everywhere. |
| Do not add `vercel.json` or a root `package.json`. | Unknown Vercel root/output settings; avoid breaking deploy. If you believe one is needed, stop and ask. |
| Data stays in `localStorage` (plus Cache Storage for the service worker). | Local-first, no accounts. |
| Browser support: current Chrome, Edge, Firefox, Safari 16.4+, mobile Chrome/Safari. Feature-detect and degrade gracefully (Document PiP, Wake Lock, Notifications, Web Worker). | Some APIs are Chromium-only. |
| Node 20+ only for tests (`node --test`). No test dependencies. | Zero-install testing. |

## 3. Current state (what exists)

Files in `public/`: `index.html`, `script.js` (~1,700 lines, globals + inline `onclick`), `style.css`, `float-timer.html` (popup mini timer via `window.open` + `postMessage`), `package.json` (name `my-v0-project`, no real build).

localStorage keys in use: `tymodoro-settings`, `tymodoro-stats`, `tymodoro-theme`, `tymodoro-all-todos`.

Existing features to **preserve**: timer (focus/short/long break, long break every N), progress ring, keyboard shortcuts (Space, R, Esc), per-day todo list (priority, subtasks, drag reorder, inline edit, hide completed, select task for timer), calendar heatmap, 8 themes with hover preview, 6 ambient + 6 binaural sounds synthesized with Web Audio, floating mini-timer window, skip-confirm modal (<90% of a focus session), About modal.

Known problems (all must be fixed, see phases):

1. Running timer, `sessionCount`, and current phase live only in memory. Reload loses them.
2. `weekSessions`, `monthSessions`, `todaySessions` are only incremented, never reset.
3. Skipping a focus session at 90%+ adds the *full* focus length to `totalMinutes`.
4. `setIsRunning(false)` always sets status text "Ready to Start", even when paused mid-session.
5. `index.html`: theme swatches for Sunset, Purple, Rose, Blush use `class_name=` instead of `class=`.
6. `showNotification` requires `soundEnabled`, so muting the beep also kills notifications.
7. Notification permission is requested on `DOMContentLoaded` (and via `confirm()` on iOS/Mac). No user gesture.
8. Notification icon `/favicon.ico` does not exist.
9. No `document.title` countdown.
10. Completion is detected inside a main-thread `setInterval`, which browsers throttle in background tabs.
11. `lucide@latest` loaded from unpkg in both HTML files (unpinned, breaks offline).
12. `loadSettings` replaces the whole settings object with the saved one, so any newly added setting key would be `undefined` for existing users.
13. `currentStreak` / `longestStreak` exist in the stats object but nothing updates or shows them.
14. Selecting a task for the timer does not record anything when a session completes.
15. Zero `aria-*`/`role` attributes, no focus trap in modals, no `prefers-reduced-motion`.
16. `postMessage(..., "*")` between main page and `float-timer.html` (no origin check on send).
17. README is generic; `package.json` name is `my-v0-project`.

---

## 4. Target architecture (reached in Phase 1)

```
public/
  index.html
  manifest.webmanifest        (Phase 2)
  sw.js                       (Phase 2)
  float-timer.html            (kept as PiP fallback)
  package.json                ("type": "module", real name/description; keep no build script needing deps)
  css/style.css               (moved from public/style.css; update links)
  js/
    main.js                   entry, wires everything
    timer.js                  PURE state machine (no DOM, no Date.now inside; `now` is passed in)
    tick-worker.js            Web Worker: posts a tick every 250ms
    storage.js                load/save/migrate; takes a storage object so tests can inject a fake
    stats.js                  PURE: derive stats from session log
    tasks.js                  todo logic + rendering
    audio.js                  AudioContext, alarm sounds, ambient mixer
    ui/                       modals.js (focus trap), settings.js, stats-view.js, focus-mode.js, pip.js, toasts.js
  vendor/lucide.min.js        pinned, with version in a header comment
  icons/                      icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
tests/
  timer.test.mjs
  stats.test.mjs
  storage.test.mjs
README.md
```

Rules: no inline `onclick` (use `addEventListener` or `data-action` delegation). No globals. `timer.js`, `stats.js`, `storage.js` must be importable in Node with no DOM.

### Data schemas (schema version 2)

Add key `tymodoro-schema` = `2`. New keys: `tymodoro-timer`, `tymodoro-sessions`, `tymodoro-mixer`. Keep existing key names for settings/todos/theme (upgrade their contents in place, non-destructively).

**Settings** (`tymodoro-settings`), always merged over defaults on load:

```js
{
  focusTime: 25, shortBreakTime: 5, longBreakTime: 15, longBreakAfter: 4,   // existing names, keep
  autoStartBreaks: false, autoStartFocus: false,
  soundOn: true, alarmSound: "chime", alarmVolume: 0.6, alarmRepeat: 1,
  notificationsOn: false,          // separate from soundOn
  keepAwake: false,                // Wake Lock during focus
  titleCountdown: true,
  dailyGoal: 4,                    // sessions per day
  weekStart: "mon"                 // "mon" | "sat" | "sun"
}
```

**Timer state** (`tymodoro-timer`):

```js
{
  v: 1,
  phase: "work" | "shortBreak" | "longBreak",
  status: "idle" | "running" | "paused",
  plannedSec: 1500,
  endsAt: 1760000000000,      // ms epoch, only meaningful when running
  remainingSec: 1500,         // authoritative when idle/paused
  cycleCount: 0,              // completed focus sessions in current long-break cycle
  taskId: null,
  startedAt: null             // ms epoch when this phase first started
}
```

**Session log** (`tymodoro-sessions`), array, focus sessions only:

```js
{ id: "s_<ts>_<rand>", start: ms, end: ms, plannedSec: 1500, actualSec: 1500,
  completed: true, taskId: null, tag: null, legacy: false }
```

`completed` is true if the timer ended naturally or the user skipped at >= 90% of planned time. `actualSec` is real elapsed focus time (fixes bug 3). Sessions under 90% that the user abandons are **not** logged.

**Tasks** (`tymodoro-all-todos`): keep the existing structure and the existing date-key format (inspect the code for the exact key format and reuse it). Add optional fields per task: `est` (int 0-12), `done` (int, default 0), `tag` (string or null). Missing fields must read as defaults.

### Migration (v1 → v2), in `storage.js`, idempotent

- If `tymodoro-schema` is missing or < 2: read old `tymodoro-stats.dailyData` (keys look like `"Mon Sep 21 2026"`, values are session counts). For each day with count N, create N synthetic sessions at 12:00 local that day: `plannedSec = actualSec = settings.focusTime*60`, `completed: true`, `legacy: true`. Write to `tymodoro-sessions`.
- Do not delete `tymodoro-stats`. Rename nothing. Just stop using it.
- Merge settings over defaults. Then set `tymodoro-schema = 2`.
- Running the migration twice must not duplicate sessions (guard on the schema flag and on legacy ids like `legacy_<date>_<i>`).

---

## 5. Phases

### Phase 0: Hotfix (no restructure, ship fast)

Patch the existing files in place. Do not modularize yet.

Tasks:
- [ ] Fix `class_name` → `class` in `index.html` theme swatches (bug 5).
- [ ] Add a real Paused state: status text "Paused" when paused with time elapsed, "Ready to Start" only when idle at full time; "In Progress" when running (bug 4).
- [ ] Live `document.title` countdown while running, e.g. `24:13 · Focus`; restore `TYMODORO - Focus Timer` when idle (bug 9).
- [ ] Split `soundOn` (beep + alarm) and `notificationsOn` (desktop notifications) into two settings with two toggles in Settings; the bell button toggles sound only (bug 6).
- [ ] Remove notification permission request from `DOMContentLoaded` and the `confirm()`. Request it on the first Start press, and only if `notificationsOn` is true. Handle "denied" quietly (show a small hint in Settings) (bug 7).
- [ ] Vendor Lucide: download a pinned version's UMD file into `public/vendor/lucide.min.js`, update both HTML files, remove unpkg (bug 11). Also self-host Inter if `float-timer.html`/CSS uses Google Fonts; otherwise use a system font stack.
- [ ] Replace notification icon path with an existing file: create `public/icons/icon-192.png` now (generate from the current logo: black circle, white ring, white dot) (bug 8).
- [ ] `loadSettings`: merge over defaults (bug 12).
- [ ] Stats correctness: compute today/week/month from `stats.dailyData` at display time instead of stored counters; on skip at >= 90% add only the elapsed minutes to `totalMinutes` (bugs 2, 3). Week start = Monday for now.
- [ ] Origin-restrict `postMessage` to `window.location.origin` on both sides and check `event.origin` on receive (bug 16).
- [ ] README rewrite (what it is, features, run locally with `python3 -m http.server -d public`, structure, privacy note) and `package.json` name `tymodoro` (bug 17).

Acceptance:
- App loads with zero requests to any third-party host (check the Network tab).
- Pause a timer at 10:00 elapsed: label says "Paused". Reload: no crash.
- Turn sound off: notification still fires if enabled (and vice versa).
- All 8 theme swatches render.
- Existing localStorage data from a previous version still loads with no errors.

Commit message suggestion: `fix: phase 0 hotfixes (paused state, title countdown, notifications, stats, vendored icons)`. **Stop and report.**

---

### Phase 1: New core (modules, persistence, tests)

Behavior stays the same for the user, except the fixes below. This is a refactor + engine swap.

Tasks:
- [ ] Split `script.js` into the module layout in section 4. Remove all inline `onclick` and globals. Keep every existing feature working (todos, drag reorder, subtasks, calendar, themes, sounds, floating window).
- [ ] `timer.js`: pure functions `createState`, `start(state, now)`, `pause(state, now)`, `resume(state, now)`, `tick(state, now)` → `{state, event}`, `skip(state, now)`, `reset(state)`, `applySettings(state, settings)`, `restore(state, now)`. Events: `"completed"`, `"none"`. Time comes from the `now` argument only.
- [ ] Persist timer state on every transition and every ~5s while running. On load, `restore`:
  - running and `endsAt > now`: continue.
  - running and `endsAt <= now` (finished while the tab was closed): log the session as completed with `actualSec = plannedSec`, advance to the next phase in `idle` state, show a toast "Your session finished while you were away".
  - paused: stay paused with `remainingSec`.
- [ ] `cycleCount` persisted, so the long-break rhythm survives reloads.
- [ ] Tick source: Web Worker (`tick-worker.js`) posting every 250ms; main thread computes remaining from `endsAt - now`. Fallback to main-thread `setInterval` if Worker construction fails. Also recompute on `visibilitychange`.
- [ ] Session log: on every completed focus session append to `tymodoro-sessions` with `taskId` if a task is selected. `stats.js` derives everything from the log (today, this week per `weekStart`, this month, total sessions, total focus minutes, current/longest streak). Streak rule: consecutive local days with >= 1 completed focus session; today without a session yet does not break yesterday's streak.
- [ ] `storage.js` with migration from section 4, plus a `safeSet` that catches quota errors and surfaces a toast.
- [ ] Add settings UI for `autoStartBreaks` and `autoStartFocus` and wire them into the state machine. When auto-start fires, the notification text says "Break started" / "Focus started".
- [ ] Add a dev-only URL param `?speed=N` that scales time (N seconds of timer per real second) for manual QA. Never persisted; documented in README.
- [ ] `package.json`: add `"type": "module"`, `"scripts": {"test": "node --test ../tests/"}`. Tests live in repo-root `tests/` as `*.test.mjs` and import from `../public/js/...`.
- [ ] Tests (node:test + node:assert), at minimum:
  - timer: start/pause/resume math, completion exactly at `endsAt`, skip at 89% vs 90%, long break every N, restore after long absence, `applySettings` while idle vs running.
  - stats: day/week/month boundaries (test with `weekStart` mon/sat/sun), streaks across gaps, streak not broken by an empty "today", DST-safe local-date handling.
  - storage: migration from a realistic v1 fixture, idempotent (run twice = same result), settings merge, quota error path.

Acceptance:
- `node --test tests/` passes.
- Start a 25-min timer, reload the page: it is still running with the correct remaining time. Close the tab, reopen after it should have ended: the session is logged and a toast explains it.
- "This Week" no longer equals "Total" once older sessions exist.
- Load the app with a v1-style localStorage fixture: all old todos/settings/theme preserved, calendar heatmap shows the old days.
- No console errors; no inline handlers left (`grep -n "onclick=" public` returns nothing).

**Stop and report.**

---

### Phase 2: App shell (PWA, focus mode, mini timer, sound, a11y)

Tasks:
- [ ] **PWA:** `manifest.webmanifest` (name "Tymodoro", short_name "Tymodoro", `start_url: "/"`, `display: "standalone"`, background/theme colors matching the dark theme, icons 192/512 + maskable 512, optional `shortcuts` for "Start focus"), `sw.js` with versioned cache name (`tymodoro-v1`), precache of all shell files, cache-first for same-origin GET, delete old caches on activate, and update flow: when a new SW is waiting, show a toast "Update available" with a Reload button. Register only on `https:` or `localhost`. Add `<link rel="manifest">`, `apple-touch-icon`, `<meta name="theme-color">` (update it when the theme changes), and `apple-mobile-web-app-capable`.
  - Generate icons from `icons/icon.svg` once with whatever tool is available (sharp, rsvg-convert, ImageMagick). Commit the PNG outputs. Do not add these tools as dependencies. If none works, tell the user.
  - Note in README: bump `CACHE_VERSION` in `sw.js` on every release that changes shell files.
  - Vercel serves static files revalidated by default, so no special headers should be needed. Verify `sw.js` is not served with long-lived cache headers on the preview URL; if it is, report it rather than adding config.
- [ ] **Alarm:** 4 synthesized alarm sounds (`chime`, `bell`, `digital`, `soft`), picker with preview button, volume, repeat 1-3. Call `audioContext.resume()` inside the Start click handler so iOS/Safari can play later.
- [ ] **Completion feedback:** sound (if `soundOn`), notification (if `notificationsOn` and granted), title flash "Time's up", `navigator.vibrate` on supporting devices.
- [ ] **Wake Lock:** if `keepAwake`, request `navigator.wakeLock` while a focus session runs; re-acquire on `visibilitychange`; release on pause/stop. Feature-detect.
- [ ] **Focus mode:** full-screen overlay (button + shortcut `F`): huge time, current task name, pause/skip, hides everything else. Optional Fullscreen API toggle. `Esc` exits. Works on a phone or a tablet as a desk clock.
- [ ] **Mini timer:** Document Picture-in-Picture when `window.documentPictureInPicture` exists (user-gesture only): compact timer (time, phase, play/pause, skip) with the current theme's CSS variables copied over; fall back to the existing `float-timer.html` popup otherwise. Both stay in sync with main state.
- [ ] **Keyboard shortcuts:** Space start/pause, `R` reset, `S` skip, `F` focus mode, `T` toggle tasks, `M` mute, `?` opens a shortcuts cheat-sheet. Ignore shortcuts while typing in inputs.
- [ ] **Accessibility:**
  - `aria-label` on every icon-only button.
  - Timer element `role="timer"` with `aria-live="off"`; a visually-hidden polite live region announces phase changes and completion.
  - Modals: `role="dialog"`, `aria-modal`, labelled by title, focus trap, `Esc` to close, return focus to the opener.
  - Visible `:focus-visible` outlines in every theme.
  - `@media (prefers-reduced-motion: reduce)` disables non-essential animation.
  - Touch targets >= 44px on mobile.
  - Check text contrast of each theme (aim WCAG AA); fix low-contrast tokens (Light, Blush especially).
- [ ] `<noscript>` message, meta description, Open Graph tags (title, description; skip image unless you generate one), proper `lang`.

Acceptance:
- Lighthouse (mobile) on the preview: Performance >= 90, Accessibility >= 95, Best Practices >= 95, PWA installable. Report the actual numbers.
- App installs from Chrome and works fully offline after first load (airplane-mode test).
- Keyboard-only run-through: start, pause, open settings, change a value, close, open stats, close, all without a mouse.
- Alarm plays on desktop Chrome and Safari after a Start click; notification fires when permitted.

**Stop and report.**

---

### Phase 3: Tasks, stats dashboard, data ownership

Tasks:
- [ ] **Task estimates:** optional estimate field in the add-task row (0-12 pomodoros). On session completion with a selected task, increment `task.done`. Show `done/est` on the task row (Lucide `timer` icon, not emoji). Optional `tag` field with a datalist of previously used tags. The session log stores `taskId` and `tag`.
- [ ] **Carry over:** button "Bring over unfinished tasks" that copies incomplete tasks from the previous day into the selected day (no duplicates).
- [ ] **Stats dashboard** (replace the current modal content; tabs or sections): Today / Week / Month / Total (sessions and focus hours), current + longest streak, daily-goal progress (uses `dailyGoal`), last 7/30/90 day bar chart, hour-of-day histogram ("when you focus best"), per-tag table, per-task pomodoro counts. Charts are hand-written inline SVG, no chart library, theme-aware via CSS variables, with text alternatives. Good empty states with a clear next action.
- [ ] Calendar heatmap reads from the session log.
- [ ] **Data tab in Settings:**
  - Export JSON: all `tymodoro-*` keys + `exportedAt` + schema version → `tymodoro-backup-YYYY-MM-DD.json`.
  - Export CSV of sessions.
  - Import JSON: validate schema and shape, show a summary ("312 sessions, 48 tasks"), choose **Merge** (dedupe by id) or **Replace** (with a confirm step). Never partially apply an invalid file.
  - Reset all data: requires typing `RESET`. Offer an export first.
- [ ] Tests: stats functions with tags/tasks, import validation (bad files rejected), merge dedupe.

Acceptance:
- Complete 2 sessions on a task with estimate 3: row shows `2/3`; stats show both sessions under the task and tag.
- Export → Reset → Import restores the exact same data (round trip test).
- Streak and goal numbers match hand calculation on a fixture.
- Dashboard readable and usable at 360px width.

**Stop and report.**

---

### Phase 4: Sound mixer and polish

Tasks:
- [ ] Refactor sound generators into `createSound(ctx, type)` returning `{ output, start(), stop() }` so several can run at once.
- [ ] **Ambient mixer:** each sound is a tile with a toggle and its own volume slider, plus a master volume. Any combination of the 6 nature sounds. Only one binaural tone at a time, with the copy "Experimental. Use headphones." (no health or performance claims). Save/load up to 5 named presets in `tymodoro-mixer`. Option "Pause ambient during breaks".
- [ ] Daily goal ring around or near the timer showing sessions toward `dailyGoal`, celebrated once (small toast) when reached.
- [ ] Break suggestions in break phases (stretch, water, look 20 ft away for 20 s), rotated, one line, toggleable in Settings.
- [ ] README with screenshots (placeholders are fine, mark clearly), feature list, keyboard shortcuts, privacy statement ("nothing leaves your device"), local dev, tests, release checklist (bump `CACHE_VERSION`).
- [ ] Final pass: remove dead code, ensure no console errors/warnings, run Lighthouse again, re-run all tests.

Acceptance:
- Storm + Café at different volumes run together; presets survive a reload.
- Mixer keeps playing across focus → break transitions per the setting.
- Lighthouse numbers same or better than Phase 2.

**Stop and report.**

---

## 6. Manual QA checklist (run before each report)

- [ ] Fresh browser profile: app loads, no errors, defaults sane.
- [ ] Existing-data profile (seed v1 localStorage): everything preserved after migration.
- [ ] Start → reload → still running. Pause → reload → still paused.
- [ ] `?speed=60` lets you complete a focus + break cycle in about 30 seconds; long break appears after N focus sessions.
- [ ] Background tab for 2+ minutes with a short timer: alert still fires promptly on return, correct time shown.
- [ ] Notifications denied: app still works, hint shown, nothing crashes.
- [ ] Offline (after Phase 2): full app works.
- [ ] All 8 themes: readable, focus outlines visible.
- [ ] Widths 360px, 768px, 1440px: no horizontal scroll, no overlapping controls.
- [ ] Safari (or WebKit) sanity check if available: audio unlock, layout.

## 7. Out of scope (do not build)

Accounts, cloud sync, website/app blocking, third-party integrations (calendar, Spotify, Notion), analytics, ads, payment. Mention ideas for these in the final report only.

## 8. Report format (after every phase)

```
Phase N report
- Summary: 2-4 lines
- Commits: list (hash + message)
- Files added/changed/removed
- Tests: what ran, results (paste the summary line)
- Manual QA: which checklist items you verified and how; which you could not
- Decisions I made that the spec did not cover
- Known issues / risks
- Anything the user must do (e.g. Vercel setting, test on a real phone)
- Ready for: Phase N+1 (wait for approval)
```
