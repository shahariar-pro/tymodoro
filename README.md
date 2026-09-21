# Tymodoro

A fast, private, distraction-free Pomodoro focus timer and daily task companion designed to help you work with clarity and mindful rhythm.

## 🌟 What is Tymodoro?

Tymodoro combines the Pomodoro technique with local-first task planning, ambient sound synthesis, and detailed session statistics. It runs completely in your browser without requiring accounts, internet connectivity, or third-party services.

## ✨ Key Features

- **Pomodoro Timer**: Customizable focus sessions, quick breaks, and extended breaks with automatic cycle tracking and a live progress ring.
- **Task Companion**: Daily todo list with subtasks, inline editing, drag-and-drop reordering, and task-to-timer linking.
- **Calendar & Statistics**: Daily focus heatmap and live-computed session stats (Today, This Week starting Monday, This Month, Total Focus Minutes).
- **8 Custom Themes**: Dark, Light, Ocean, Forest, Sunset, Purple, Rose, and Blush with hover preview and instant switching.
- **Synthesized Ambient Audio**: 6 ambient nature sounds (Rain & Thunder, Forest, Ocean Waves, Coffee Shop, Fireplace, Wind) and 6 binaural focus frequencies synthesized entirely client-side via the Web Audio API (no audio asset downloads).
- **Floating Mini-Timer**: Secure popup mini-timer window synchronized bidirectionally with the main window using origin-restricted messaging.
- **Desktop Notifications & Sound**: Independent controls for audio beeps and desktop notifications, with polite permissions requested only on user action.
- **Live Document Title**: Real-time countdown in browser tab with clean restoration when idle.
- **Keyboard Shortcuts**:
  - `Space`: Start / Pause timer
  - `R`: Reset timer
  - `Esc`: Close open modal or panel

## 🚀 Running Locally

Tymodoro requires no build step or package dependencies. You can run it with any static web server:

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
│   ├── package.json          # Project manifest
│   ├── script.js             # Core state, timer, audio, and UI logic
│   ├── style.css             # Main stylesheet, CSS variables, and themes
│   ├── icons/
│   │   └── icon-192.png      # Application and notification icon
│   └── vendor/
│       └── lucide.min.js     # Pinned Lucide icons UMD build (offline)
├── TYMODORO_UPGRADE_SPEC.md  # Multi-phase renovation specification
└── README.md                 # Project documentation
```

## 🔒 Privacy & Local-First Philosophy

- **Zero External Network Requests**: All scripts, fonts, and assets are self-contained and vendored locally. No CDNs, no Google Fonts, and no analytics.
- **Local Storage Only**: All your data (settings, tasks, and statistics) stays strictly on your device inside `localStorage`.
- **Offline Capable**: Works offline without an internet connection.
