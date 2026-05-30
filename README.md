# Glance

A real-time AI screen overlay powered by Claude. Press a hotkey, get instant suggestions about what's on your screen.

> Built as part of my application for the Cluely R&D Intern role.

---

## What it does

Glance floats always-on-top as a minimal dark widget. Hit **Ctrl+Shift+Space** (or click Capture), and it:

1. Takes a screenshot of your primary display
2. Sends it to Claude's vision API
3. Streams back concise, actionable suggestions in real time
4. Lets you ask follow-up questions about what it sees

Close the window and it lives in the system tray — always ready, never in the way.

---

## Features

- **Always-on-top overlay** — stays above all other windows
- **Global hotkey** — `Ctrl+Shift+Space` captures without clicking into the app
- **Streaming responses** — text appears word-by-word as Claude thinks
- **Follow-up questions** — type anything about the current screenshot
- **System tray** — hides instead of closing; one click to bring back
- **Zero taskbar presence** — invisible until you need it

---

## Tech stack

| Layer | Choice |
|---|---|
| Shell | Electron |
| Frontend | React 19 + Vite |
| Styling | Tailwind CSS v4 |
| AI | Anthropic Claude (`claude-sonnet-4-6`) with streaming + vision |
| Screenshot | Electron `desktopCapturer` |

---

## Running locally

**Prerequisites:** Node.js 18+, an [Anthropic API key](https://console.anthropic.com)

```bash
git clone https://github.com/realkyle/glance.git
cd glance
npm install
cp .env.example .env
# Add your Anthropic API key to .env
npm run dev
```

The overlay window appears in the top-right corner of your screen.

---

## Download

Grab the latest Windows build from [Releases](https://github.com/realkyle/glance/releases) — unzip and run `Glance.exe`, no installer needed.

---

## License

MIT
