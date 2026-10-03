const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = Number(process.env.PORT) || 3000;

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "timer.json");

const DEFAULT_STATE = {
    gameName: "Palworld",
    modeName: "HARDCORE SURVIVAL",

    elapsed: 0,
    deaths: 0,

    started: false,
    running: false,
    dead: false,

    startedAt: null,
    updatedAt: Date.now()
};

fs.mkdirSync(DATA_DIR, { recursive: true });

let state = loadState();

function loadState() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            saveStateObject(DEFAULT_STATE);
            return { ...DEFAULT_STATE };
        }

        const raw = fs.readFileSync(DATA_FILE, "utf8");
        const parsed = JSON.parse(raw);

        return {
            ...DEFAULT_STATE,
            ...parsed,
            gameName:
                typeof parsed.gameName === "string" && parsed.gameName.trim()
                    ? parsed.gameName.trim()
                    : DEFAULT_STATE.gameName,
            modeName:
                typeof parsed.modeName === "string" && parsed.modeName.trim()
                    ? parsed.modeName.trim()
                    : DEFAULT_STATE.modeName,
            deaths: Number.isFinite(parsed.deaths) ? Math.max(0, parsed.deaths) : 0,
            elapsed: Number.isFinite(parsed.elapsed) ? Math.max(0, parsed.elapsed) : 0
        };
    } catch (error) {
        console.error("Failed to load timer state:", error);
        saveStateObject(DEFAULT_STATE);
        return { ...DEFAULT_STATE };
    }
}

function saveStateObject(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (error) {
        console.error("Failed to save timer state:", error);
    }
}

function saveState() {
    state.updatedAt = Date.now();
    saveStateObject(state);
}

function getElapsed() {
    if (!state.running || !state.startedAt) {
        return state.elapsed;
    }

    return state.elapsed + (Date.now() - state.startedAt);
}

function getStatus() {
    if (state.dead) return "WORLD_LOST";
    if (state.running) return "PLAYING";
    if (state.started) return "PAUSED";
    return "NEW";
}

function getPublicState() {
    return {
        gameName: state.gameName,
        modeName: state.modeName,
        elapsed: getElapsed(),
        deaths: Number.isFinite(state.deaths) ? state.deaths : 0,
        started: Boolean(state.started),
        running: Boolean(state.running),
        dead: Boolean(state.dead),
        status: getStatus(),
        updatedAt: state.updatedAt
    };
}

function broadcastState(event = "STATE") {
    const payload = JSON.stringify({
        type: "state",
        event,
        state: getPublicState()
    });

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

function handleAction(action, payload = {}) {
    switch (action) {
        case "START": {
            if (!state.started && !state.dead) {
                state.started = true;
                state.running = true;
                state.dead = false;
                state.startedAt = Date.now();
                saveState();
                broadcastState("START");
                return;
            }
            break;
        }

        case "PAUSE": {
            if (state.started && state.running && !state.dead) {
                state.elapsed = getElapsed();
                state.running = false;
                state.startedAt = null;
                saveState();
                broadcastState("PAUSE");
                return;
            }
            break;
        }

        case "RESUME": {
            if (state.started && !state.running && !state.dead) {
                state.running = true;
                state.startedAt = Date.now();
                saveState();
                broadcastState("RESUME");
                return;
            }
            break;
        }

        case "WORLD_LOST": {
            if (state.started && !state.dead) {
                if (state.running) {
                    state.elapsed = getElapsed();
                }

                state.running = false;
                state.dead = true;
                state.startedAt = null;
                saveState();
                broadcastState("WORLD_LOST");
                return;
            }
            break;
        }

        case "RESET": {
            const currentDeaths = Number.isFinite(state.deaths) ? state.deaths : 0;

            state = {
                ...DEFAULT_STATE,
                gameName: state.gameName,
                modeName: state.modeName,
                deaths: currentDeaths,
                updatedAt: Date.now()
            };

            saveState();
            broadcastState("RESET");
            return;
        }

        case "ADD_DEATH": {
            if (!state.dead) {
                state.deaths = Number.isFinite(state.deaths)
                    ? state.deaths + 1
                    : 1;

                saveState();
                broadcastState("DEATH_ADDED");
                return;
            }
            break;
        }

        case "REMOVE_DEATH": {
            if (state.deaths > 0) {
                state.deaths -= 1;
                saveState();
                broadcastState("DEATH_REMOVED");
                return;
            }
            break;
        }

        case "RESET_DEATHS": {
            state.deaths = 0;
            saveState();
            broadcastState("DEATHS_RESET");
            return;
        }

        case "SET_GAME": {
            if (!state.running && !state.dead) {
                const gameName = String(payload.gameName || "").trim();

                if (gameName) {
                    state.gameName = gameName.slice(0, 48);
                    saveState();
                    broadcastState("GAME_CHANGED");
                    return;
                }
            }
            break;
        }

        case "SET_MODE": {
            if (!state.running && !state.dead) {
                const modeName = String(payload.modeName || "").trim();

                if (modeName) {
                    state.modeName = modeName.slice(0, 48);
                    saveState();
                    broadcastState("MODE_CHANGED");
                    return;
                }
            }
            break;
        }

        default:
            console.log(`Unknown action: ${action}`);
            break;
    }

    // Invalid/blocked actions still return the current state so all clients stay synced.
    broadcastState("STATE");
}

wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.send(
        JSON.stringify({
            type: "state",
            event: "INITIAL",
            state: getPublicState()
        })
    );

    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message.toString());

            if (!data || !data.action) return;

            handleAction(data.action, data.payload || {});
        } catch (error) {
            console.error("Invalid WebSocket message:", error);
        }
    });

    ws.on("close", () => {
        console.log("Client disconnected");
    });
});

// Persist timer progress periodically while keeping an absolute startedAt timestamp.
setInterval(() => {
    if (state.running && state.startedAt) {
        state.elapsed = getElapsed();
        state.startedAt = Date.now();
        saveState();
    }

    broadcastState("HEARTBEAT");
}, 5000);

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "bison-global-survival-timer"
    });
});

app.get("/api/state", (req, res) => {
    res.json(getPublicState());
});

app.use(express.static(path.join(__dirname, "public")));

server.listen(PORT, "0.0.0.0", () => {
    console.log("========================================");
    console.log(" BISON Global Survival Timer");
    console.log("========================================");
    console.log(`Port    : ${PORT}`);
    console.log("Control : /");
    console.log("Timer   : /widget.html");
    console.log("Deaths  : /death-widget.html");
    console.log("Health  : /health");
    console.log("WebSocket: enabled");
    console.log("========================================");
});
