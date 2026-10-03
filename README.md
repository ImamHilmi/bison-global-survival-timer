# BISON Global Survival Timer

A reusable timer + death counter system for stream overlays.

## Routes

- `/` — control panel
- `/widget.html` — OBS/Streamlabs timer overlay
- `/death-widget.html` — OBS/Streamlabs death counter overlay
- `/health` — health check
- `/api/state` — current public state

## Features

- Game selector with built-in choices and custom game name
- Mode selector
- Count-up timer
- Start / Pause / Resume / World Lost
- Independent death counter
- Reset Deaths
- Reset World while preserving death count
- WebSocket synchronization across multiple browser sources/devices
- Reconnect handling
- BISON-themed animations
- Remote GitHub-hosted visual assets

## Local run

```bash
npm install
npm start
```

Open:

- `http://localhost:3000/`
- `http://localhost:3000/widget.html`
- `http://localhost:3000/death-widget.html`

## Deployment note

The app is written to use `process.env.PORT` so it can run on a Node.js web service.

The current persistence layer is `data/timer.json`. On a local machine or a VM this persists normally. For cloud hosting, use a persistent disk or external database before relying on the timer state across infrastructure restarts/deploys.

## Assets

The overlays use these public assets:

- `https://raw.githubusercontent.com/ImamHilmi/bison-stream-assets/main/chat/alert-popup-japan-night.png`
- `https://raw.githubusercontent.com/ImamHilmi/bison-stream-assets/main/chat/chat-samurai.png`

The first asset is used as a subtle background texture so the overlay remains usable across different games.
