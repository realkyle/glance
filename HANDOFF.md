# HANDOFF.md — Glance AI Overlay (Cluely R&D Intern Application)

## Context

Kyle Goto Hale (kylegotohale@gmail.com) is applying for the **R&D Intern role at Cluely** — a real-time, screen-aware AI desktop assistant. Glance is a purpose-built Electron app that mirrors what Cluely does. It is fully working and has been demoed. This handoff gives the next agent everything needed to continue without any prior context.

**GitHub:** https://github.com/realkyle/glance  
**Current version:** 1.1.0  
**Platform built/tested on:** Windows 10

---

## What Has Been Built

A working Electron desktop app with:

- Always-on-top floating dark overlay window (400×560px, top-right corner)
- **Full screen capture** via `Ctrl+Shift+Space` or button — window hides before capture so it's not in the shot
- **Region selection** via `Ctrl+Shift+D` or button — fullscreen transparent overlay, drag a box, crops to selection (DPI-aware)
- **Claude API streaming** (`claude-sonnet-4-6` with vision) — SSE parsed word-by-word
- **Auto-context mode** — Claude detects Code / Browser / Document / Terminal / Design from the screenshot and shows a colored badge, uses a tailored system prompt per context
- **Conversation memory** — captures and follow-ups chain into a persistent chat thread; Claude sees all prior messages and images
- **New Chat button** — clears conversation, resets to empty state
- **Voice input** — mic button starts Windows Speech Recognition via PowerShell `System.Speech`; real-time interim transcription updates the input as you speak
- **System tray** — closing the window hides to tray (purple circle icon generated at runtime, no icon file needed); right-click → Quit
- **Markdown rendering** — `**bold**` and `*italic*` render properly in responses
- **Portable `.exe` build** — single file, 88MB, no installer needed

---

## Tech Stack

| Layer | Choice |
|---|---|
| Shell | Electron 42 |
| Frontend | React 19 + Vite 8 |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite` plugin) |
| AI | Anthropic Claude API (`claude-sonnet-4-6`), streaming + vision |
| Screenshot | Electron `desktopCapturer` |
| Voice | Windows `System.Speech.Recognition` via PowerShell child process |
| Build | `electron-builder` portable target |

---

## File Structure

```
glance/
├── electron/
│   ├── main.js              # BrowserWindow, IPC, screenshot, tray, voice, region selector
│   ├── preload.js           # IPC bridge to renderer
│   ├── selector.html        # Fullscreen transparent region-select overlay (vanilla JS)
│   └── selector-preload.js  # IPC bridge for selector window
├── src/
│   ├── App.jsx              # All React UI — chat thread, capture buttons, voice, streaming
│   ├── main.jsx             # React entry
│   └── index.css            # Tailwind import + custom animations
├── index.html
├── vite.config.js           # @tailwindcss/vite + @vitejs/plugin-react
├── package.json             # "type": "commonjs", electron in devDependencies
├── .env                     # VITE_ANTHROPIC_API_KEY (never committed)
├── .env.example
└── HANDOFF.md
```

---

## How to Run

```bash
# Requires .env with: VITE_ANTHROPIC_API_KEY=sk-ant-...
npm install
npm run dev       # starts Vite + launches Electron
```

If `npm run dev` fails with PowerShell execution policy error, run it from Claude Code terminal with `! npm run dev`.

To build the distributable:
```bash
npm run build     # produces release/Glance 1.1.0.exe (portable, ~88MB)
```

---

## What Worked

- Electron `desktopCapturer` for screenshots — straightforward
- `win.hide()` + 150ms delay before capture — cleanly removes window from screenshot
- Region selection via a second fullscreen transparent `BrowserWindow` + `nativeImage.crop()` with `scaleFactor` for DPI scaling
- Claude streaming SSE parsing — split chunks on `\n`, filter `data:` lines, parse JSON
- System tray icon generated at runtime using a hand-rolled PNG encoder (CRC32 + zlib deflate) — no icon file dependency
- Auto-context mode via a single system prompt that tells Claude to output `Mode: X` as the first line — parsed out and shown as a colored badge
- Conversation memory by maintaining a `messages[]` array and sending full history to the API each time
- Portable build after enabling Windows Developer Mode (needed for symlink creation during signing tool extraction)
- Voice real-time transcription using PowerShell `Register-ObjectEvent` + `Wait-Event` loop to stream `INTERIM:` and `FINAL:` lines from `System.Speech.Recognition.SpeechRecognitionEngine`

---

## What Didn't Work / Gotchas

### 1. Web Speech API → "network" error in Electron
**Problem:** `window.SpeechRecognition` fails with `error: network` in Electron because Electron doesn't ship with Chrome's Google Speech API key.  
**Fix:** Replaced with Windows `System.Speech.Recognition` via PowerShell child process. Works offline.  
**Remaining issue:** Recognition quality is poor compared to modern STT services. Future fix: swap backend for OpenAI Whisper API or Deepgram — same UI, better engine.

### 2. Tailwind v4 — no `npx tailwindcss init`
**Problem:** The original HANDOFF suggested `npx tailwindcss init -p` but Tailwind v4 doesn't have this command.  
**Fix:** Install `@tailwindcss/vite`, add as Vite plugin, use `@import "tailwindcss"` in CSS. No `tailwind.config.js` needed.

### 3. NSIS build fails — symlink permission error
**Problem:** `electron-builder` downloads `winCodeSign` which contains macOS symlinks; Windows blocked creating them.  
**Fix:** Enable **Windows Developer Mode** (Settings → System → For developers). Then the portable build works.

### 4. Electron binary not auto-downloaded
**Problem:** After `npm install`, `node_modules/electron/dist/electron.exe` didn't exist and `path.txt` was missing.  
**Fix:** Manually extracted the zip from `%LOCALAPPDATA%\electron\Cache\` and wrote `path.txt` with content `electron.exe` (ASCII, no BOM).

### 5. `electron` must be in `devDependencies`
**Problem:** `electron-builder` throws if `electron` is in `dependencies`.  
**Fix:** Moved to `devDependencies`. Only `react` and `react-dom` stay in `dependencies`.

### 6. Anthropic API needs browser access header
**Problem:** Direct `fetch` to `api.anthropic.com` from Electron renderer fails without a special header.  
**Fix:** Add `'anthropic-dangerous-direct-browser-access': 'true'` to the request headers.

### 7. Wrong model name
**Problem:** Original HANDOFF had `claude-sonnet-4-20250514` which doesn't exist.  
**Fix:** Correct model ID is `claude-sonnet-4-6`.

### 8. `npm run dev` blocked by PowerShell execution policy
**Problem:** Running `npm run dev` in PowerShell throws `UnauthorizedAccess`.  
**Fix:** Either run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` once, or use `! npm run dev` in Claude Code's terminal.

### 9. Multiple IPC listeners stacking on hot reload
**Problem:** `ipcRenderer.on('screenshot', cb)` adds a new listener every hot reload, causing duplicate events.  
**Fix:** In preload, call `ipcRenderer.removeAllListeners('screenshot')` before adding the new listener.

---

## Known Remaining Issues / Next Steps

See `FEATURES.md` for the full feature roadmap.

**Highest priority next work:**
1. **Improve voice quality** — swap Windows Speech Recognition for OpenAI Whisper API or Deepgram. Record audio with `getUserMedia` + `MediaRecorder` in renderer, send blob to main process via IPC, POST to transcription API, return text.
2. **Demo video** — record a 30-60 second Loom: hotkey → screenshot → streaming response → region select → voice follow-up. This is the most important deliverable for the Cluely application.
3. **Mac build** — Electron code is cross-platform but `.dmg` must be built on a Mac. Could set up GitHub Actions for cross-platform CI builds.
4. **Release** — create GitHub Release v1.2.0 once voice is improved, attach the new `.exe`.

---

## API Key

The `.env` file contains Kyle's Anthropic API key. It is **not committed** to git (covered by `.gitignore`). The key is baked into the Vite build at compile time via `import.meta.env.VITE_ANTHROPIC_API_KEY`, so the `.exe` works standalone but should not be shared publicly.
