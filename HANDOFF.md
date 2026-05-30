# HANDOFF.md — Mini AI Overlay Widget (Cluely R&D Intern Application)

## Context

Kyle Goto Hale (kylegotohale@gmail.com) is applying for the **R&D Intern role at Cluely** — a real-time, screen-aware AI desktop assistant (a16z-backed, ~$200/hr intern pay). The application requires submitting a link to a published project with polished UI. Kyle chose to build something purpose-built for the role rather than submit an existing project.

**Goal:** A mini Electron desktop app that mimics what Cluely does — floats always-on-top, takes a screenshot of the screen on demand, and sends it to Claude's API to get real-time AI suggestions. Must look visually impressive and be deployable/linkable (GitHub releases or a demo video hosted somewhere).

---

## What This Agent Has Done

**Nothing has been built yet.** This HANDOFF was created to give the next agent a complete running start. No code has been written, no files scaffolded, no npm installs run.

---

## Recommended Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Shell | **Electron** | Easier cross-platform build, more tutorials, faster to ship than Tauri (which requires Rust) |
| Frontend | **React + Vite** (inside Electron renderer) | Kyle knows React well (CrowdSense, Campus Pulse) |
| Styling | **Tailwind CSS** | Kyle knows it; fast for polished UI |
| AI | **Anthropic Claude API** (`claude-sonnet-4-20250514`) | On-brand for Cluely application; vision capable |
| Screenshot | **Electron's `desktopCapturer`** or `screenshot-desktop` npm package | Built into Electron |
| Always-on-top | **`win.setAlwaysOnTop(true)`** in Electron `BrowserWindow` | Native Electron API |

---

## Architecture Plan

```
electron-overlay/
├── package.json
├── electron/
│   ├── main.js          # BrowserWindow setup, IPC handlers, screenshot capture
│   └── preload.js       # Exposes safe IPC bridge to renderer
├── src/
│   ├── App.jsx          # Main React UI
│   ├── main.jsx         # React entry
│   └── index.css        # Tailwind
├── vite.config.js
├── tailwind.config.js
└── .env                 # ANTHROPIC_API_KEY (never committed)
```

### Flow
1. App launches as a small floating window (~380×500px), always-on-top, no taskbar icon, semi-transparent dark UI
2. User presses a hotkey (Cmd/Ctrl+Shift+Space) or clicks "Capture" button
3. `main.js` uses `desktopCapturer` to grab a screenshot of the primary display
4. Screenshot is base64-encoded and sent via IPC to the renderer
5. Renderer calls Claude API (`claude-sonnet-4-20250514`) with the image + a system prompt like: *"You are a real-time AI assistant. The user has shared their screen. Provide concise, actionable suggestions about what you see."*
6. Streaming response renders word-by-word in the UI
7. User can also type a follow-up question

---

## UI Design Direction

Cluely's aesthetic: dark, minimal, fast, "invisible assistant" vibe.

- **Window:** 380px wide, rounded corners, frosted-glass dark bg (`bg-black/80 backdrop-blur`)
- **Header:** Small Cluely-inspired logo / "AI Overlay" text, drag handle, minimize/close buttons
- **Capture button:** Full-width pill button, subtle glow on hover
- **Response area:** Streaming text, monospace or clean sans-serif, subtle fade-in per token
- **Input:** Bottom text field for follow-up questions
- **Hotkey badge:** Shows the global hotkey in the corner

Reference Cluely's actual UI at https://cluely.com for visual inspiration.

---

## Step-by-Step Build Instructions for Next Agent

### 1. Scaffold the project
```bash
mkdir electron-overlay && cd electron-overlay
npm init -y
npm install electron vite @vitejs/plugin-react react react-dom tailwindcss autoprefixer postcss
npm install -D concurrently wait-on electron-builder
npx tailwindcss init -p
```

### 2. Configure package.json scripts
```json
"main": "electron/main.js",
"scripts": {
  "dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
  "build": "vite build && electron-builder",
  "start": "electron ."
}
```

### 3. Write electron/main.js
Key settings for the BrowserWindow:
```js
const win = new BrowserWindow({
  width: 380,
  height: 520,
  frame: false,
  transparent: true,
  alwaysOnTop: true,
  skipTaskbar: true,
  resizable: false,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
  }
});
win.setAlwaysOnTop(true, 'screen-saver'); // highest level
```

Register global hotkey:
```js
globalShortcut.register('CommandOrControl+Shift+Space', () => {
  captureAndSend();
});
```

Screenshot capture:
```js
const { desktopCapturer } = require('electron');
async function captureScreen() {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 }
  });
  return sources[0].thumbnail.toDataURL(); // base64 PNG
}
```

### 4. Write electron/preload.js
```js
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  onScreenshot: (cb) => ipcRenderer.on('screenshot', (_, data) => cb(data)),
  requestScreenshot: () => ipcRenderer.invoke('capture-screen'),
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
});
```

### 5. Claude API call (in React, renderer side)
```js
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'interleaved-thinking-2025-05-14' // optional
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    stream: true,
    system: "You are a real-time AI assistant embedded in the user's screen. When shown a screenshot, give concise, actionable, specific suggestions. Be brief — 2-4 bullet points max. Focus on what's most useful right now.",
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Data.split(',')[1] } },
        { type: 'text', text: userQuestion || 'What do you see? Give me real-time suggestions.' }
      ]
    }]
  })
});
// Parse SSE stream for streaming text display
```

### 6. Vite config (vite.config.js)
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist' }
});
```

### 7. Electron loads the app
- In dev: `loadURL('http://localhost:5173')`
- In prod: `loadFile(path.join(__dirname, '../dist/index.html'))`

---

## Known Gotchas / Things To Watch Out For

1. **`desktopCapturer` requires screen recording permission on macOS.** Electron will prompt for it. Make sure to handle the case where permission is denied gracefully.

2. **`alwaysOnTop` levels on macOS:** Use `win.setAlwaysOnTop(true, 'screen-saver')` — the default level isn't always-on-top enough. On Windows it's simpler.

3. **CORS:** The Anthropic API doesn't have CORS restrictions for direct fetch calls from Electron's renderer. Should work fine without proxying.

4. **API key security:** In production, move the API call to `main.js` via IPC so the key isn't exposed in renderer code. For demo/portfolio purposes, `VITE_ANTHROPIC_API_KEY` in `.env` is fine.

5. **Streaming SSE parsing:** The Anthropic streaming API returns `data: {...}` lines. Parse with:
```js
const reader = response.body.getReader();
const decoder = new TextDecoder();
// read chunks, split by \n, filter lines starting with "data: ", JSON.parse each
```

6. **Window dragging:** Since `frame: false`, add `-webkit-app-region: drag` CSS to the header div, and `-webkit-app-region: no-drag` to interactive elements inside it.

7. **electron-builder config for macOS:** Add `"mac": { "target": "dmg", "category": "public.app-category.productivity" }` to package.json under `"build"`.

---

## Publishing / Submitting

- Push to GitHub: `github.com/realkyle/ai-overlay` (or similar)
- Create a GitHub Release with a `.dmg` (Mac) and `.exe` (Windows) built via `electron-builder`
- Record a 30-60 second Loom or screen recording showing the hotkey trigger → screenshot → streaming AI response
- Submit the GitHub repo link OR the Loom link — both demonstrate the UI and tech

---

## Why This Will Impress Cluely

- Directly mirrors their core product (real-time screen-aware AI overlay)
- Shows Electron + React + API integration — exactly what the R&D intern JD mentions
- Visual quality of the UI is critical; aim for dark/glassy aesthetic matching Cluely's brand
- Solo-built, published, linkable — meets all application requirements

---

## Kyle's Background (Relevant to This Build)

- Comfortable with React + Tailwind (CrowdSense, Campus Pulse)
- Has FastAPI + Python experience but this project is JS/Electron
- Knows TypeScript — use it if time allows for cleaner code
- GitHub: github.com/realkyle
- No prior Electron experience mentioned, but the learning curve is ~2-4 hours for basics
