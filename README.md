# Tymodoro

A fast, private, distraction-free Pomodoro focus timer and daily task companion designed to help you work with clarity and mindful rhythm. Built with pure HTML, modern CSS, and native ES modules — zero build steps, zero external dependencies, 100% offline capable.

---

## 🌟 What is Tymodoro?

Tymodoro is a local-first productivity tool that combines the Pomodoro Technique with daily task planning, ambient soundscapes, customizable alarms, and rich personal analytics. Everything is synthesized client-side via the Web Audio API and stored directly in your browser. Nothing ever leaves your device.

---

## 📸 Interface & Visual Preview

```text
+----------------------------------------------------------------------------------------------------+
| [Logo] TYMODORO          [Today's Date]          [Tasks] [Calendar] [Mixer] [Theme] [Stats] [Settings] |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|                                       Deep Focus Session                                           |
|                                                                                                    |
|                                          . - ~ ~ ~ - .                                             |
|                                      .-'     25:00     '-.                                         |
|                                     /    Ready to Start   \                                        |
|                                    |       [ ▶ Play ]      |                                       |
|                                     \     [ ↺ ]   [ ⏭ ]    /                                       |
|                                      '-.                 .-'                                       |
|                                          ' - . _ . - '                                             |
|                                                                                                    |
|                                     🎯 0/4 pomodoros today                                         |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

*(Screenshots can be captured and placed in `public/screenshots/` for visual store listings or previews).*

---

## ✨ Features

### ⏱️ Pomodoro Engine & Resilience
- **Pure State Machine**: Deterministic timer logic supporting focus sessions, quick breaks, and extended breaks with automatic cycle tracking.
- **Background Accuracy**: Dedicated Web Worker (`tick-worker.js`) posting ticks every 250ms with `setInterval` fallback. Accurate even when tabs are throttled.
- **Catch-up Recovery**: If you close the tab or your computer sleeps during a session, reopening logs the completed session and explains with a helpful toast.
- **Concentric Timer Rings**: Dual SVG rings displaying inner session countdown and outer daily goal progress simultaneously.
- **Screen Wake Lock**: Automatically keeps your screen awake during focus sessions (feature-detected and re-acquired on tab focus).

### 🎶 Ambient Sound Mixer & Binaural Frequencies
- **Multi-Sound Mixer**: Run any combination of 6 nature sounds concurrently at independent volumes:
  - ⛈️ **Storm**: Rain, wind, and distant thunder
  - 🌲 **Forest**: Birdsong, leaves, and gentle stream
  - 🌊 **Ocean**: Rolling waves and sea foam
  - ☕ **Café**: Ambient coffeehouse chatter and machines
  - 🔥 **Fireplace**: Cozy wood crackle and pops
  - 💨 **Wind**: Mountain breezes and gusts
- **Binaural Beats (Headphones)**: Pure client-side synthesized frequencies (40Hz Gamma, 20Hz Beta, 10Hz Alpha, 6Hz Theta, 3Hz Delta, 15Hz Focus). Enforces only one active tone at a time.
- **Master Volume & Mute**: Master volume control slider with quick one-click mute.
- **Sound Presets**: Built-in soundscapes (*Rainy Café*, *Cozy Fireplace*, *Forest Stream*, *Deep Focus*, *Calm Theta*) plus save/load up to 5 custom named presets that survive reloads.
- **Pause During Breaks**: Optional automatic silence during break sessions, resuming when focus restarts.

### 🔔 Synthesized Alarms & Completion Feedback
- **4 Custom Alarms**: Pleasant synthesized alarm tones (*Chime*, *Bell*, *Digital*, *Soft*) created with Web Audio API oscillators.
- **Alarm Settings**: Volume slider, repeat count (1–3 times), and instant preview button.
- **Non-blocking Notifications**: Desktop notifications requested strictly on user action, with polite fallback if denied.
- **Vibration Feedback**: Haptic pulses on supported mobile devices.
- **Tab Title Countdown**: Live countdown in browser tab (`24:13 · Focus`) and flash alert on completion.

### 📋 Tasks Companion
- **Estimates & Badges**: Set estimated pomodoros (0–12) for each task. Completed sessions auto-increment progress badges (e.g. `2/3`).
- **Color Tags**: Assign tags (with autocomplete datalist) to categorize sessions.
- **Carry Over**: One-click "Carry Over" button copies unfinished tasks from previous days without duplicates.
- **Subtasks & Priority**: Create subtasks with individual checkboxes and set High/Medium/Low priority levels.
- **Reordering**: Smooth drag-and-drop task reordering.

### 📊 Stats Dashboard & Analytics
- **Summary Cards**: Today, This Week (customizable Monday/Saturday/Sunday start), This Month, and All-Time totals (sessions and focus hours).
- **Streak Tracker**: Tracks current and longest daily focus streaks with gap tolerance (empty today does not break yesterday's streak).
- **Daily Goal Progress**: Visual progress bar and celebratory toast when reaching daily target.
- **Activity Bar Chart**: Pure inline hand-written SVG bar chart with toggleable 7, 30, and 90-day historical views.
- **24-Hour Focus Histogram**: Visual distribution chart showing your most productive hours of the day.
- **Breakdown Tables**: Detailed per-tag and per-task focus time distribution tables.
- **Heatmap Calendar**: Monthly interactive productivity calendar reading directly from the session log.

### 💾 Data Ownership & Backups
- **JSON Backup Export**: Download complete backups containing your sessions, tasks, settings, themes, and mixer presets (`tymodoro-backup-YYYY-MM-DD.json`).
- **CSV Export**: Export your focus sessions as a clean spreadsheet-ready CSV file.
- **Safe Import**: Comprehensive schema validation with preview summary (session count, task count). Choose between **Merge** (deduplicate without overwriting) or **Replace**.
- **Destructive Reset**: Hard reset requiring typed `RESET` confirmation with prior export prompt.

### 🪟 Distraction-Free Views
- **Focus Mode (F)**: Fullscreen desk-clock overlay with giant digits, current task label, play/pause, and skip controls.
- **Document Picture-in-Picture**: Modern Picture-in-Picture window that floats above all other apps on your desktop, with automatic fallback to popup window.
- **Break Suggestions**: Gentle rotating mindfulness reminders during breaks (*Drink water*, *20-20-20 eye rest*, *Shoulder stretch*, etc.).

### ♿ Accessibility & 8 Themes
- **Accessible (a11y)**: ARIA landmarks, polite live region announcements, focus traps in dialogs, visible `:focus-visible` outlines, touch targets ≥ 44px, and `prefers-reduced-motion` respect.
- **8 Distinct Themes**: Dark, Light, Ocean, Forest, Sunset, Purple, Rose, and Blush — all verified for WCAG AA text contrast.
- **PWA & Offline First**: Installable on desktop and mobile. Operates 100% offline via versioned Service Worker (`sw.js`).

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `Space` | Start / Pause timer |
| `R` | Reset timer |
| `S` | Skip session |
| `F` | Toggle Fullscreen Focus Mode |
| `T` | Toggle Tasks Companion |
| `M` | Mute / Unmute alarm sound |
| `?` or `Shift + /` | Open keyboard shortcuts cheat-sheet |
| `Esc` | Close open modal or exit Focus Mode |

*Shortcuts are automatically bypassed when typing in input fields.*

---

## 🛠️ Local Development & Running

Tymodoro requires no build tools, compilers, or bundlers. Any standard static file server can serve the app.

### Using Node.js
```bash
# Serve the public directory
npx serve public
```
Then navigate to `http://localhost:3000`.

### Using Python 3
```bash
# Serve the public directory
python3 -m http.server -d public
```
Then navigate to `http://localhost:8000`.

### Fast-Forward QA Mode (`?speed=N`)
Append `?speed=N` to the URL for fast-forward testing (1 real second = N timer seconds):
- `http://localhost:3000/?speed=60` — A 25-minute pomodoro finishes in 25 seconds.
- *This parameter is strictly for development and manual QA; it is never persisted.*

---

## 🧪 Automated Testing

Tests run using Node 20+ built-in test runner with zero dependencies:

```bash
# Run all unit test suites
node --test tests/*.test.mjs
```

### Test Suites Included:
- `tests/timer.test.mjs`: Pure timer state machine, math, cycles, skips, and recovery.
- `tests/stats.test.mjs`: Boundaries (Mon/Sat/Sun), streaks, DST handling, daily goals, activity charts, histograms, tag & task breakdowns.
- `tests/storage.test.mjs`: v1 → v2 migration, settings merge, quota handling, JSON export, CSV export, validation, merge deduplication, and lossless round-trip restore.
- `tests/audio.test.mjs`: `createSound` contract, multi-sound concurrent mixing, binaural single-tone rule, and preset persistence across reloads.

---

## 🚀 Release Checklist

When deploying a new version to production:
1. **Run tests**: Ensure `node --test tests/*.test.mjs` passes with 0 failures.
2. **Syntax check**: Verify `Get-ChildItem -Path public/js -Filter *.js -Recurse | ForEach-Object { node --check $_.FullName }` reports 0 errors.
3. **No inline handlers**: Ensure `git grep -n "onclick=" public` returns 0 results.
4. **Bump Cache Version**: In `public/sw.js`, bump `CACHE_VERSION` (e.g. `tymodoro-v2` -> `tymodoro-v3`).
5. **Commit and Push**:
   ```bash
   git add -A
   git commit -m "chore: release version X.Y.Z"
   git push origin main
   ```
6. **Verify PWA Update**: Users with an older Service Worker installed will receive a non-intrusive toast: *"Update available! Click to reload."*

---

## 🔒 Privacy Statement

**Nothing leaves your device.**
- **Zero Third-Party Requests**: All scripts, icons, and fonts are self-hosted locally in `public/`.
- **Zero Analytics & Tracking**: No telemetry, no tracking cookies, no advertising SDKs.
- **Local Storage Exclusively**: All your tasks, settings, timer states, and session logs reside solely in your browser's `localStorage`.
- **Complete Offline Independence**: Fully functional with no active internet connection.

---

## 📄 License

MIT License. Free to use, adapt, and build upon.
