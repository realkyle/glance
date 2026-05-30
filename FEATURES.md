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

### 3. Pre-Capture Prompt
Users can type a question in the input field before capturing. The prompt is sent alongside the screenshot so Claude answers it directly rather than giving a generic analysis. Works with both full screen and region captures.

**Potential improvements:**
- Prompt history / quick-select recent prompts
- Prompt templates (e.g. "Explain this code", "Summarize this page")

---

### 4. Claude Vision Streaming
Sends screenshot(s) + conversation history to `claude-sonnet-4-6` via the Anthropic API with streaming enabled. SSE chunks are parsed and rendered word-by-word.

**Potential improvements:**
- Token counter displayed in UI so users know how much context is left
- Configurable max tokens / response length
- Option to switch models (Haiku for speed, Opus for quality)

---

### 5. Prompt Caching
The system prompt is sent as a `cache_control: ephemeral` content block. After the first request in a session, Claude caches it — reducing latency and cost on all follow-up requests.

**Potential improvements:**
- Cache the first few turns of a long session to further reduce costs

---

### 6. Auto-Context Mode Detection
The system prompt instructs Claude to output `Mode: X` as the first line of every response. Glance parses this line, shows a colored badge (Code=green, Browser=blue, Document=amber, Terminal=gray, Design=pink), and strips it from the displayed text.

**Potential improvements:**
- User-configurable custom modes with their own system prompts
- Detect context client-side (e.g., OCR window title) to pre-select the prompt
- Manual mode override — user pins a specific mode

---

### 7. Conversation Memory
Each capture and follow-up is added to a `messages[]` array. The full array (including all images) is sent to Claude on every request, giving it full session memory.

**Potential improvements:**
- Summarize older messages to prevent hitting token limits in long sessions
- Persist conversation to disk so it survives app restarts
- Named sessions — save and reload past conversations
- Export conversation to Markdown

---

### 8. Voice Input (Whisper)
Mic button records audio via `getUserMedia` + `MediaRecorder` in the renderer. On stop, the audio blob is POSTed to OpenAI Whisper API (`whisper-1`) and the transcript fills the input field. Requires `VITE_OPENAI_API_KEY`.

**Potential improvements:**
- **Deepgram streaming** — replace batch Whisper with Deepgram WebSocket for real-time word-by-word transcription (same mic UI, better feel)
- Visual waveform animation while recording

---

### 9. Collapse to Pill
The `−` button shrinks the window to a 220×52px floating pill anchored to the top-right corner of the previous window position. The purple circle on the left restores the window to its exact previous size and position. The rest of the pill is draggable.

**Potential improvements:**
- Smooth animation on collapse/expand
- Show a brief preview of the last response on hover

---

### 10. Resizable Window
The window is freely resizable by dragging any edge or corner. Minimum size is 300×400px. Opens at 400×560px by default.

**Potential improvements:**
- Save and restore window size/position between sessions

---

### 11. Eye/Lens Logo
SVG eye icon (outer lens curve, iris, pupil, specular highlight) used in the app header and collapsed pill. The tray icon and `.exe` icon are generated at build time from the same drawing logic via `scripts/generate-icon.js` (outputs `assets/icon.ico` at 16/32/48/256px).

---

### 12. System Tray
The Glance window hides to tray instead of quitting when closed. Tray icon is an eye PNG generated at runtime — no icon file dependency. Left-click toggles show/hide; right-click → Quit.

**Potential improvements:**
- Tray icon animates while Claude is thinking
- Quick-capture from tray right-click menu without opening the window

---

### 13. Markdown Rendering
`**bold**` and `*italic*` patterns in Claude's responses are parsed with a regex and rendered as `<strong>` and `<em>` elements.

**Potential improvements:**
- Code block rendering with syntax highlighting
- Clickable links in responses
- Copy button per response bubble

---

### 14. GitHub Actions CI
A workflow at `.github/workflows/build.yml` triggers on `v*` tags. Two parallel jobs build `Windows .exe` on `windows-latest` and `Mac .dmg` on `macos-latest`, attaching both to a GitHub Release automatically.

---

## In Progress

### Marketing Website
A landing page to advertise Glance, showcase features, and provide a download link for the `.exe`. Primary submission artifact for the Cluely application alongside the demo video.

**Plan:**
- Host on GitHub Pages at `realkyle.github.io/glance`
- Sections: hero, feature highlights, download, tech stack
- Use the `logo.svg` and brand purple (`rgb(139,92,246)`)
- Link to the GitHub Releases page for the `.exe` download

---

## Potential Future Features

### Demo Video
Record a 30-60 second Loom showing the core flow:
- Hotkey → full screen capture → streaming response
- Region select on something specific
- Voice follow-up
- Collapse to pill → restore

This is the most important deliverable for the Cluely application.

---

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

### Deepgram Streaming Voice
Replace batch Whisper with Deepgram WebSocket for real-time word-by-word transcription:
- Connect to Deepgram streaming endpoint via WebSocket
- Stream audio chunks from `MediaRecorder` in real time
- Words appear as you speak (no wait-on-stop)
- Same mic button UI, same final result

---

### UI Color Themes / User Preferences
Let users customize Glance's accent color and overall theme:
- Color picker for the primary purple accent
- Light / dark mode toggle (currently dark-only)
- Store preferences in `electron-store` or a local JSON file

---

### Hotkey Customization
Allow users to rebind the global hotkeys:
- Settings panel inside the app
- Configurable full-screen and region hotkeys
- Save to `~/.glance/config.json`

---

### Copy Button on Responses
A small copy icon on each assistant message that copies the plain text to clipboard.

**Implementation:** `navigator.clipboard.writeText(msg.text)` on click.

---

### Save Window Position
Save `win.getPosition()` and `win.getSize()` on move/resize and restore on next launch via a local JSON file or `electron-store`.

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
