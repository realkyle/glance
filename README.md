<p align="center">
  <img src="logo.svg" width="80" height="80" alt="Glance" />
</p>

# Glance

A real-time AI screen overlay powered by Claude. Press a hotkey, get instant suggestions about what's on your screen.

> Built as part of my application for the Cluely R&D Intern role.

---

## What it does

Glance floats always-on-top as a minimal dark widget. Hit **Ctrl+Shift+Space** (or click Capture), and it:

1. Takes a screenshot of your primary display
2. Sends it to Claude's vision API with prompt caching
3. Streams back concise, actionable suggestions in real time
4. Lets you ask follow-up questions about what it sees

Collapse it to a pill when you don't need it — click the circle to restore.

---

## Features

- **Always-on-top overlay** — stays above all other windows, freely resizable
- **Full screen capture** — `Ctrl+Shift+Space` hides the window before shooting so Glance never appears in the frame
- **Region selection** — `Ctrl+Shift+D` drag a box to capture just part of the screen
- **Streaming responses** — text appears word-by-word as Claude thinks
- **Auto-context detection** — Claude identifies Code / Browser / Document / Terminal / Design and shows a colored badge
- **Conversation memory** — follow-up questions chain into a persistent session; Claude sees all prior messages and images
- **Voice input** — mic button records audio, transcribed via OpenAI Whisper for accurate speech-to-text
- **Prompt caching** — system prompt is cached across requests, reducing latency and cost on long sessions
- **Collapse to pill** — minimize button shrinks the app to a small floating pill; click the circle to restore to previous size
- **System tray** — hides instead of closing; left-click to toggle, right-click to quit
- **Markdown rendering** — `**bold**` and `*italic*` render in responses

---

## Tech stack

| Layer | Choice |
|---|---|
| Shell | Electron 42 |
| Frontend | React 19 + Vite |
| Styling | Tailwind CSS v4 |
| AI | Anthropic Claude (`claude-sonnet-4-6`), streaming + vision + prompt caching |
| Screenshot | Electron `desktopCapturer` |
| Voice | OpenAI Whisper API (`whisper-1`) via `getUserMedia` + `MediaRecorder` |
| Build | `electron-builder` portable target |
| CI | GitHub Actions — Windows `.exe` + Mac `.dmg` on version tags |

---

## Running locally

**Prerequisites:** Node.js 18+, an [Anthropic API key](https://console.anthropic.com), an [OpenAI API key](https://platform.openai.com) (for voice)

```bash
git clone https://github.com/realkyle/glance.git
cd glance
npm install
cp .env.example .env
# Add your keys to .env:
#   VITE_ANTHROPIC_API_KEY=sk-ant-...
#   VITE_OPENAI_API_KEY=sk-...
npm run dev
```

The overlay window appears in the top-right corner of your screen.

---

## Download

Grab the latest Windows build from [Releases](https://github.com/realkyle/glance/releases) — single `.exe`, no installer needed.

---

## License

MIT
