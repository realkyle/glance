# HANDOFF.md — Glance AI Overlay (Cluely R&D Intern Application)

## Context

Kyle Goto Hale (kylegotohale@gmail.com) is applying for the **R&D Intern role at Cluely** — a real-time, screen-aware AI desktop assistant. Glance is a purpose-built Electron app that mirrors what Cluely does. It is fully working and has been demoed. This handoff gives the next agent everything needed to continue without any prior context.

**GitHub:** https://github.com/realkyle/glance  
**Current version:** 1.3.0  
**Platform built/tested on:** Windows 10

---

## What Has Been Built

A working Electron desktop app with:

- Always-on-top floating dark overlay window, freely resizable (default 400×560px, top-right corner)
- **Full screen capture** via `Ctrl+Shift+Space` or button — window hides before capture so it's not in the shot
- **Region selection** via `Ctrl+Shift+D` or button — fullscreen transparent overlay, drag a box, crops to selection (DPI-aware)
- **Pre-capture prompts** — type a question before capturing; sent with the screenshot for both full screen and region captures
- **Claude API streaming** (`claude-sonnet-4-6` with vision) — SSE parsed word-by-word
- **Prompt caching** — system prompt cached with `cache_control: ephemeral`, reducing latency and cost on long sessions
- **Auto-context mode** — Claude detects Code / Browser / Document / Terminal / Design from the screenshot and shows a colored badge
- **Conversation memory** — captures and follow-ups chain into a persistent chat thread; Claude sees all prior messages and images
- **New Chat button** — lives in the input bar (icon-only); clears conversation and resets state
- **Voice input** — mic button records audio via `getUserMedia` + `MediaRecorder`; on stop, audio is POSTed to OpenAI Whisper API (`whisper-1`) for accurate transcription
- **Collapse to pill** — `−` button animates the window in two stages (width in → height down) to a 220×52px floating pill; expand reverses (width out → height down); both use `easeOutCubic` at ~300ms total; purple circle on pill restores previous bounds; rest of pill is draggable
- **System tray** — closing the window hides to tray (eye icon generated at runtime); left-click toggles show/hide; right-click → Quit; `app.requestSingleInstanceLock()` prevents multiple tray icons when the app is launched more than once
- **Eye/lens logo** — SVG eye icon in the app header and collapsed pill; matching `.ico` generated at build time (16/32/48/256px) for the `.exe` and tray
- **Markdown rendering** — `**bold**` and `*italic*` render properly in responses
- **Portable `.exe` build** — single file, ~92MB, no installer needed
- **GitHub Actions CI** — pushes to `v*` tags build Windows `.exe` and Mac `.dmg` in parallel and attach to a GitHub Release
- **Marketing website** — `website/index.html` static site ready for Vercel deployment; dark/purple design matching the app; hero, features grid, how-it-works, download CTA; pill navbar, scroll-reveal animations, Space Grotesk headings, purple accent text

---

## Tech Stack

| Layer | Choice |
|---|---|
| Shell | Electron 42 |
| Frontend | React 19 + Vite 8 |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite` plugin) |
| AI | Anthropic Claude API (`claude-sonnet-4-6`), streaming + vision + prompt caching |
| Screenshot | Electron `desktopCapturer` |
| Voice | OpenAI Whisper API (`whisper-1`) via `getUserMedia` + `MediaRecorder` in renderer |
| Build | `electron-builder` portable target |
| CI | GitHub Actions — `windows-latest` + `macos-latest` on `v*` tags |

---

## File Structure

```
glance/
├── .github/
│   └── workflows/
│       └── build.yml        # CI: Windows .exe + Mac .dmg on version tags
├── electron/
│   ├── main.js              # BrowserWindow, IPC, screenshot, tray, collapse, region selector
│   ├── preload.js           # IPC bridge to renderer
│   ├── selector.html        # Fullscreen transparent region-select overlay (vanilla JS)
│   └── selector-preload.js  # IPC bridge for selector window
├── scripts/
│   └── generate-icon.js     # Generates assets/icon.ico at 16/32/48/256px before each build
├── src/
│   ├── App.jsx              # All React UI — chat thread, capture buttons, voice, streaming
│   ├── main.jsx             # React entry
│   └── index.css            # Tailwind import + custom animations
├── website/
│   └── index.html           # Marketing landing page — deploy root dir to Vercel
├── logo.svg                 # Standalone eye/lens logo for README + website
├── index.html
├── vite.config.js
├── package.json
├── .env                     # VITE_ANTHROPIC_API_KEY + VITE_OPENAI_API_KEY (never committed)
├── .env.example
├── FEATURES.md
└── HANDOFF.md
```

---

## How to Run

```bash
# Requires .env with:
#   VITE_ANTHROPIC_API_KEY=sk-ant-...
#   VITE_OPENAI_API_KEY=sk-...
npm install
npm run dev       # starts Vite + launches Electron
```

If `npm run dev` fails with PowerShell execution policy error, run it from Claude Code terminal with `! npm run dev`.

To build the distributable:
```bash
npm run build     # generates assets/icon.ico, builds Vite, produces release/Glance 1.3.0.exe
```

---

## What Worked

- Electron `desktopCapturer` for screenshots — straightforward
- `win.hide()` + 150ms delay before capture — cleanly removes window from screenshot
- Region selection via a second fullscreen transparent `BrowserWindow` + `nativeImage.crop()` with `scaleFactor` for DPI scaling
- Claude streaming SSE parsing — split chunks on `\n`, filter `data:` lines, parse JSON
- Prompt caching via `cache_control: { type: 'ephemeral' }` on the system prompt content block — no beta header needed for Claude 4 models
- Eye/lens tray icon generated at runtime using a hand-rolled PNG encoder (CRC32 + zlib deflate) — no icon file dependency
- Auto-context mode via a single system prompt that tells Claude to output `Mode: X` as the first line — parsed out and shown as a colored badge
- Conversation memory by maintaining a `messages[]` array and sending full history to the API each time
- Portable build after enabling Windows Developer Mode (needed for symlink creation during signing tool extraction)
- Whisper voice: `getUserMedia` + `MediaRecorder` in renderer → Blob → FormData → POST to OpenAI — entirely in the renderer, no IPC needed for audio
- Collapse to pill: `win.getBounds()` saves full bounds before collapse; `win.setBounds()` restores — more reliable than `win.setSize()` on Windows
- Transparent background: `backgroundColor: '#00000000'` on BrowserWindow + `html, body, #root { background: transparent }` in CSS
- `questionRef` pattern for pre-capture prompt — avoids stale closure in the `onScreenshot` IPC handler

---

## What Didn't Work / Gotchas

### 1. Web Speech API → "network" error in Electron
**Problem:** `window.SpeechRecognition` fails with `error: network` in Electron.  
**Fix:** Replaced with OpenAI Whisper via `getUserMedia` + `MediaRecorder`. Works offline for recording; requires internet for transcription.

### 2. Tailwind v4 — no `npx tailwindcss init`
**Problem:** Tailwind v4 doesn't have this command.  
**Fix:** Install `@tailwindcss/vite`, add as Vite plugin, use `@import "tailwindcss"` in CSS. No `tailwind.config.js` needed.

### 3. NSIS build fails — symlink permission error
**Problem:** `electron-builder` downloads `winCodeSign` which contains macOS symlinks; Windows blocked creating them.  
**Fix:** Enable **Windows Developer Mode** (Settings → System → For developers).

### 4. Electron binary not auto-downloaded
**Problem:** After `npm install`, `node_modules/electron/dist/electron.exe` didn't exist.  
**Fix:** Manually extracted the zip from `%LOCALAPPDATA%\electron\Cache\` and wrote `path.txt` with content `electron.exe` (ASCII, no BOM).

### 5. `electron` must be in `devDependencies`
**Problem:** `electron-builder` throws if `electron` is in `dependencies`.  
**Fix:** Keep `electron` in `devDependencies`.

### 6. Anthropic API needs browser access header
**Problem:** Direct `fetch` to `api.anthropic.com` from Electron renderer fails without a special header.  
**Fix:** Add `'anthropic-dangerous-direct-browser-access': 'true'` to the request headers.

### 7. Prompt caching beta header rejected on Claude 4
**Problem:** `anthropic-beta: prompt-caching-1` header causes an error on `claude-sonnet-4-6`.  
**Fix:** Remove the beta header — prompt caching is GA on Claude 4 models. Just use the `cache_control` content block.

### 8. `npm run dev` blocked by PowerShell execution policy
**Problem:** Running `npm run dev` in PowerShell throws `UnauthorizedAccess`.  
**Fix:** Use `! npm run dev` in Claude Code's terminal, or run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` once.

### 9. Multiple IPC listeners stacking on hot reload
**Problem:** `ipcRenderer.on('screenshot', cb)` adds a new listener every hot reload, causing duplicate events.  
**Fix:** In preload, call `ipcRenderer.removeAllListeners('screenshot')` before adding the new listener.

### 10. `win.setSize()` unreliable for collapse/expand on Windows
**Problem:** `win.setSize()` sometimes fails to restore the previous size on transparent frameless windows.  
**Fix:** Use `win.getBounds()` / `win.setBounds()` which saves and restores x, y, width, height atomically.

### 11. Multiple tray icons when launching multiple instances
**Problem:** Running `npm run dev` a second time (or if the app restarts) creates a new Electron instance alongside the existing one, each with its own tray icon.  
**Fix:** `app.requestSingleInstanceLock()` at startup — the second instance immediately calls `app.quit()` and the first instance's window is focused instead.

---

### 12. Collapse animation passes through a circular/bubble shape if height shrinks first
**Problem:** Animating height before width makes the window pass through a near-square intermediate (e.g. 400×400px) which, combined with the app's rounded corners, looks like a large bubble.  
**Fix:** Shrink width first (to 220px, keeping full height), then shrink height (to 52px). The narrow-column intermediate never looks circular.

---

### 13. `WebkitAppRegion: drag` overrides CSS cursor
**Problem:** Setting `cursor: grab` on a drag region has no effect — Electron overrides it.  
**Fix:** Not yet solved cleanly. `win.startMoving()` approach caused uncaught exceptions. Left as default cursor for now.

---

## Known Remaining Issues / Next Steps

See `FEATURES.md` for the full feature roadmap.

**Highest priority next work:**
1. **Demo video** — record a 30-60 second Loom: hotkey → screenshot → streaming response → region select → voice follow-up. Most important deliverable for the Cluely application.
2. **Deploy website to Vercel** — import `realkyle/glance` repo on Vercel, set root directory to `website/`, deploy. Add GIFs to the feature cards once the demo video is recorded.
3. **Deepgram streaming voice** — replace batch Whisper with Deepgram WebSocket for real-time word-by-word transcription. Same UI, better feel.
4. **Diff mode** — capture before/after screenshots and ask Claude "what changed?"
5. **Mac build** — CI already produces `.dmg` on `v*` tags; needs testing on a Mac.

---

## API Keys

Two keys required in `.env` (never committed):
- `VITE_ANTHROPIC_API_KEY` — Claude API (vision + streaming). Also needed as a GitHub Actions secret for CI builds.
- `VITE_OPENAI_API_KEY` — OpenAI Whisper for voice transcription.

Both keys are baked into the Vite build at compile time via `import.meta.env`, so the `.exe` works standalone but should not be shared publicly.
