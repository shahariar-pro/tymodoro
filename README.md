# Tymodoro

A fast, private, distraction-free Pomodoro focus timer and daily task companion designed to help you work with clarity and mindful rhythm.

## 🌟 What is Tymodoro?

Tymodoro combines the Pomodoro technique with local-first task planning, ambient sound synthesis, and detailed session statistics. It runs completely in your browser without requiring accounts, internet connectivity, or third-party services.

## ✨ Key Features

- **Pomodoro Timer**: Pure state-machine timer engine supporting focus sessions, quick breaks, and extended breaks with automatic cycle tracking and a live progress ring.
- **Background Resilience**: Dedicated Web Worker tick source with `setInterval` fallback, keeping time accurate even when browser tabs are throttled or closed.
- **Task Companion**: Daily todo list with subtasks, inline editing, drag-and-drop reordering, and task-to-timer linking.
- **Calendar & Statistics**: Daily focus heatmap and live-computed session stats (Today, This Week starting Monday/Saturday/Sunday, This Month, Total Focus Minutes, and Streaks).
- **8 Custom Themes**: Dark, Light, Ocean, Forest, Sunset, Purple, Rose, and Blush with hover preview and instant switching.
- **Synthesized Ambient Audio**: 6 ambient nature sounds (Rain & Thunder, Forest, Ocean Waves, Coffee Shop, Fireplace, Wind) and 6 binaural focus frequencies synthesized entirely client-side via the Web Audio API (no audio asset downloads).
- **Floating Mini-Timer**: Secure popup mini-timer window synchronized bidirectionally with the main window using origin-restricted messaging.
- **Desktop Notifications & Sound**: Independent controls for audio beeps and desktop notifications, with polite permissions requested only on user action.
- **Live Document Title**: Real-time countdown in browser tab with clean restoration when idle.
- **Keyboard Shortcuts**:
  - `Space`: Start / Pause timer
  - `R`: Reset timer
  - `Esc`: Close open modal or panel

## 🛠️ Development & Testing

### Fast-Forward Dev Mode (?speed=N)
To rapidly test timer cycles, breaks, notifications, and streak recording without waiting real-time minutes, append `?speed=N` to the URL:
- `http://localhost:3000/?speed=60` — 1 real second = 60 timer seconds (a 25-minute Pomodoro completes in 25 seconds).
- This parameter is dev-only, never persisted, and safe for manual verification.

### Running Automated Tests
The test suite runs with Node 20+ built-in zero-dependency test runner:
```bash
node --test tests/*.test.mjs
```
Or via npm in the `public/` directory:
```bash
npm test --prefix public
```

## 🚀 Running Locally

Tymodoro requires no build step or bundlers. You can run it with any static web server:

### Using Python
```bash
python3 -m http.server -d public
```
Then navigate to `http://localhost:8000`.

### Using Node.js
```bash
npx serve public
```
Then navigate to `http://localhost:3000`.

## 📁 Project Structure

```
tymodoro/
├── public/
│   ├── index.html            # Main entry point and UI markup
│   ├── float-timer.html      # Floating mini-timer popup window
│   ├── package.json          # Project manifest & test script
│   ├── css/
│   │   └── style.css         # Main stylesheet, CSS variables, toggles, toasts
│   ├── js/
│   │   ├── main.js           # Application entry point & lifecycle
│   │   ├── timer.js          # Pure functional timer engine & state machine
│   │   ├── stats.js          # Pure statistics and streak calculation engine
│   │   ├── storage.js        # Schema migration (v1->v2), quota handling
│   │   ├── tasks.js          # Task manager, subtasks, drag & drop, filtering
│   │   ├── audio.js          # Web Audio API sound synthesizer
│   │   ├── tick-worker.js    # Dedicated background timer Web Worker
│   │   └── ui/
│   │       ├── modals.js     # Modal management and focus trap
│   │       ├── settings.js   # Settings modal UI & duration controls
│   │       ├── stats-view.js # Stats modal UI & calendar heatmap
│   │       └── toasts.js     # Accessible non-blocking toast notifications
│   ├── icons/
│   │   └── icon-192.png      # Application and notification icon
│   └── vendor/
│       └── lucide.min.js     # Pinned Lucide icons UMD build (offline)
├── tests/
│   ├── timer.test.mjs        # Timer math, cycles, skips, and recovery tests
│   ├── stats.test.mjs        # Streaks, boundaries, and DST safety tests
│   └── storage.test.mjs      # v1->v2 migration and quota handling tests
├── TYMODORO_UPGRADE_SPEC.md  # Multi-phase renovation specification
└── README.md                 # Project documentation
```

## 🔒 Privacy & Local-First Philosophy

- **Zero External Network Requests**: All scripts, fonts, and assets are self-contained and vendored locally. No CDNs, no Google Fonts, and no analytics.
- **Local Storage Only**: All your data (settings, tasks, and statistics) stays strictly on your device inside `localStorage`.
- **Idempotent Schema Migration**: Safe automated migration from v1 data models with zero data loss.
- **Offline Capable**: Works offline without an internet connection.
