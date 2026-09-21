# Tymodoro

A fast, private, distraction-free Pomodoro focus timer and daily task companion designed to help you work with clarity and mindful rhythm.

## 🌟 What is Tymodoro?

Tymodoro combines the Pomodoro technique with local-first task planning, synthesized ambient audio, customizable alarms, and detailed session statistics. It runs completely in your browser without requiring accounts, internet connectivity, or third-party services.

## ✨ Key Features

- **Pomodoro Timer**: Pure state-machine timer engine supporting focus sessions, quick breaks, and extended breaks with automatic cycle tracking and a live progress ring.
- **Background Resilience**: Dedicated Web Worker tick source with `setInterval` fallback, keeping time accurate even when browser tabs are throttled or closed.
- **PWA & Offline Capable**: Fully installable Progressive Web App (`manifest.webmanifest`, versioned Service Worker `sw.js`, crisp icons), offering complete offline functionality.
- **Fullscreen Focus Mode**: Distraction-free, desk-clock style overlay with huge time digits, task label, and controls (shortcut `F`).
- **Mini-Timer & Picture-in-Picture**: Supports modern Document Picture-in-Picture API with automatic fallback to the floating popup window, staying live in sync.
- **Screen Wake Lock**: Automatically keeps the screen awake during deep focus sessions (feature-detected and re-acquired on tab return).
- **Synthesized Alarm Sounds**: 4 pleasant synthesized completion alarms (`chime`, `bell`, `digital`, `soft`) with volume slider, repeat count (1-3), and in-settings audio preview.
- **Ambient Sound & Binaural Beats**: 6 ambient nature sounds (Rain & Storm, Forest, Ocean Waves, Café, Fireplace, Wind) and 6 binaural focus frequencies synthesized client-side via the Web Audio API (zero audio asset downloads).
- **Task Companion**: Daily todo list with subtasks, inline editing, drag-and-drop reordering, and task-to-timer linking.
- **Calendar & Statistics**: Daily focus heatmap and live-computed session stats (Today, This Week with customizable Monday/Saturday/Sunday week start, This Month, Total Focus Minutes, and Streaks).
- **8 Custom Themes**: Dark, Light, Ocean, Forest, Sunset, Purple, Rose, and Blush with WCAG AA compliant text contrast, hover preview, and instant switching.
- **Accessibility (a11y)**: Screen reader polite live region announcements, ARIA landmarks, dialog focus trapping, high-contrast `:focus-visible` rings, touch targets >= 44px, and `@media (prefers-reduced-motion: reduce)`.
- **Desktop Notifications & Sound**: Independent controls for audio beeps, synthesized alarms, and desktop notifications, with polite permissions requested only on user action.
- **Keyboard Shortcuts**:
  - `Space`: Start / Pause timer
  - `R`: Reset timer
  - `S`: Skip session
  - `F`: Toggle Fullscreen Focus Mode
  - `T`: Toggle Tasks list
  - `M`: Toggle Sound (Mute/Unmute)
  - `?`: Open keyboard shortcuts cheat-sheet
  - `Esc`: Close open modal / Exit focus mode

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

### Service Worker Cache Management
When updating shell files for a production release, increment `CACHE_VERSION` in `public/sw.js` (e.g. `tymodoro-v2`). The application will detect the update and prompt the user with an "Update available! Click to reload" toast.

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
│   ├── index.html            # Main entry point and accessible UI markup
│   ├── float-timer.html      # Floating mini-timer popup window
│   ├── manifest.webmanifest  # PWA installation manifest
│   ├── sw.js                 # Service Worker with offline caching & update flow
│   ├── package.json          # Project manifest & test script
│   ├── css/
│   │   └── style.css         # Main stylesheet, CSS variables, toggles, toasts, focus mode
│   ├── js/
│   │   ├── main.js           # App entry point, PWA, PiP, Wake Lock, shortcuts, lifecycle
│   │   ├── timer.js          # Pure functional timer engine & state machine
│   │   ├── stats.js          # Pure statistics and streak calculation engine
│   │   ├── storage.js        # Schema migration (v1->v2), quota handling
│   │   ├── tasks.js          # Task manager, subtasks, drag & drop, filtering
│   │   ├── audio.js          # Web Audio API ambient synthesizer & 4 alarm sounds
│   │   ├── tick-worker.js    # Dedicated background timer Web Worker
│   │   └── ui/
│   │       ├── modals.js     # Modal management, focus trap, accessibility
│   │       ├── settings.js   # Settings modal UI, duration sliders, alarm picker
│   │       ├── stats-view.js # Stats modal UI & calendar heatmap
│   │       └── toasts.js     # Accessible non-blocking toast notifications
│   ├── icons/
│   │   ├── icon.svg          # Master vector icon
│   │   ├── icon-192.png      # 192x192 PWA icon
│   │   ├── icon-512.png      # 512x512 PWA icon
│   │   ├── icon-maskable-512.png # 512x512 maskable icon with safe-zone margin
│   │   └── apple-touch-icon.png  # iOS touch icon
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
- **100% Offline Capable**: Works offline after first load via standard Service Worker caching.
