# FEATURES.md — Glance Feature Tracker

## Implemented Features

### 1. Full Screen Capture
Captures the entire primary display using Electron's `desktopCapturer`. Window hides 150ms before the shot so Glance itself is never in the frame.

**Hotkey:** `Ctrl+Shift+Space`

**Potential improvements:**
- Multi-monitor support — let user choose which display to capture
- Capture on a timer (auto-capture every N seconds)
- Capture on clipboard change (detect when user copies something)

---

### 2. Region Selection
Opens a fullscreen transparent overlay where the user drags a box. The selected rectangle is cropped from a full-resolution screenshot using `nativeImage.crop()` with DPI scale factor applied. Press Escape to cancel.

**Hotkey:** `Ctrl+Shift+D`

**Potential improvements:**
- Keyboard arrow nudging of the selection box for precision
- Remember last selection region and offer a "re-use last region" shortcut
- Show a preview of the selected region before confirming

---

### 3. Claude Vision Streaming
Sends screenshot(s) + conversation history to `claude-sonnet-4-6` via the Anthropic API with streaming enabled. SSE chunks are parsed and rendered word-by-word.

**Potential improvements:**
- Prompt caching — cache the system prompt to reduce costs on long sessions
- Token counter displayed in UI so users know how much context is left
- Configurable max tokens / response length
- Option to switch models (Haiku for speed, Opus for quality)

---

### 4. Auto-Context Mode Detection
The system prompt instructs Claude to output `Mode: X` as the first line of every response. Glance parses this line, shows a colored badge (Code=green, Browser=blue, Document=amber, Terminal=gray, Design=pink), and strips it from the displayed text.

**Potential improvements:**
- User-configurable custom modes with their own system prompts
- Detect context client-side before sending to API (e.g., OCR window title) to pre-select the prompt, reducing Claude's work
- Manual mode override — user pins a specific mode regardless of what Claude detects

---

### 5. Conversation Memory
Each capture and follow-up is added to a `messages[]` array. The full array (including all images) is sent to Claude on every request, giving it full session memory.

**Potential improvements:**
- Summarize older messages to prevent hitting token limits in long sessions
- Persist conversation to disk so it survives app restarts
- Named sessions — save and reload past conversations
- Export conversation to Markdown

---

### 6. Voice Input
Mic button starts Windows `System.Speech.Recognition` via a PowerShell child process. Interim results stream to the input in real time via `INTERIM:` stdout lines. Confirmed words accumulate via `FINAL:` lines. Click mic again to stop.

**Current limitation:** Recognition quality is poor — Windows' built-in engine is not competitive with modern STT services.

**Planned improvement:**
- Replace the PowerShell backend with **OpenAI Whisper API** or **Deepgram**
- Record audio using `getUserMedia` + `MediaRecorder` in the renderer
- Send audio blob to main process via IPC
- POST to transcription API, stream or return text
- Same UI — just a better engine

---

### 7. System Tray
The Glance window hides to tray instead of quitting when closed. Tray icon is a purple circle PNG generated at runtime using a hand-rolled PNG encoder — no icon file dependency. Left-click toggles show/hide; right-click → Quit.

**Potential improvements:**
- Tray icon animates while Claude is thinking
- Quick-capture from tray right-click menu without opening the window

---

### 8. Markdown Rendering
`**bold**` and `*italic*` patterns in Claude's responses are parsed with a regex and rendered as `<strong>` and `<em>` elements.

**Potential improvements:**
- Code block rendering with syntax highlighting (`fenced code blocks`)
- Clickable links in responses
- Copy button per response bubble

---

## Potential Future Features

### Diff Mode
Capture the screen at two different moments and ask Claude "what changed?" Useful for:
- Reviewing before/after of a UI change
- Tracking dashboard metrics over time
- Comparing two versions of a document

**Implementation sketch:**
- Add a "Diff" button that stores a "before" screenshot in state
- Second capture triggers a diff prompt with both images
- Claude compares them and describes what changed

---

### Voice Quality Upgrade (Whisper / Deepgram)
Replace the Windows Speech Recognition backend with a proper STT API:
- Record via `getUserMedia` + `MediaRecorder` (already works in Electron renderer)
- Send audio to OpenAI Whisper API (`/v1/audio/transcriptions`) or Deepgram
- Same mic button UI, same real-time feel

---

### Custom Glance Logo
Design a proper icon for the app:
- Replace the programmatically-generated purple circle tray icon with a real `.ico` / `.icns`
- Add it to the Electron window titlebar / dock
- Could be a stylized eye, lens, or glance-themed mark

**Implementation:** Add `assets/icon.ico` (Windows) and `assets/icon.icns` (Mac), reference in `package.json` build config under `win.icon` and `mac.icon`.

---

### UI Color Themes / User Preferences
Let users customize Glance's accent color and overall theme:
- Color picker for the primary purple accent
- Light / dark mode toggle (currently dark-only)
- Compact mode — smaller window footprint
- Store preferences in `electron-store` or a local JSON file

---

### Hotkey Customization
Allow users to rebind the global hotkeys:
- Settings panel inside the app
- Configurable full-screen and region hotkeys
- Save to `~/.glance/config.json`

---

### Copy Button on Responses
A small copy icon on each assistant message that copies the plain text to clipboard. Useful when the user wants to paste Claude's suggestion into another app.

**Implementation:** `navigator.clipboard.writeText(msg.text)` on click.

---

### Window Drag to Reposition
Currently the window is fixed to the top-right corner. Let users drag and reposition it anywhere on screen. Save position between sessions.

**Implementation:** The header already has `-webkit-app-region: drag`. Just need to save `win.getPosition()` on move and restore it on next launch.

---

### Mac Build via GitHub Actions
Kyle is on Windows and can't build a `.dmg` locally. Set up a GitHub Actions workflow that:
- Triggers on new tags (`v*`)
- Builds Windows `.exe` on `windows-latest`
- Builds Mac `.dmg` on `macos-latest`
- Attaches both to the GitHub Release automatically

---

### Auto-Capture Mode
A toggle that automatically captures the screen every N seconds (user-configurable: 10s, 30s, 60s) and streams a fresh Claude response. Useful for:
- Monitoring a dashboard
- Watching a build/deploy progress
- Passive "ambient AI" mode

---

### Clipboard-Triggered Capture
When the user copies text or an image to the clipboard, Glance automatically analyzes it. Useful for:
- Instantly getting context on something copied from a web page
- Code snippets — copy, get a review automatically
