let socket = null;
let reconnectTimer = null;

let currentDeaths = null;
let currentWorldLost = null;

function connect() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${protocol}//${window.location.host}`);

    socket.addEventListener("message", (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type !== "state" || !data.state) return;

            updateGameName(data.state.gameName);
            updateDeathCounter(Number(data.state.deaths ?? 0), data.event);
            updateWorldLostState(Boolean(data.state.dead), data.event);
        } catch (error) {
            console.error("Invalid death counter server data:", error);
        }
    });

    socket.addEventListener("close", scheduleReconnect);
    socket.addEventListener("error", () => {});
}

function scheduleReconnect() {
    if (reconnectTimer) return;

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
    }, 2000);
}

function updateGameName(gameName) {
    const element = document.getElementById("gameName");
    if (!element) return;
    element.textContent = String(gameName || "CUSTOM GAME").toUpperCase();
}

function updateDeathCounter(deaths, eventName) {
    const numberElement = document.getElementById("deathNumber");
    const cardElement = document.getElementById("deathCard");

    if (!numberElement || !cardElement) return;

    if (currentDeaths === null) {
        currentDeaths = deaths;
        numberElement.textContent = deaths;
        return;
    }

    if (deaths === currentDeaths) return;

    currentDeaths = deaths;
    numberElement.textContent = deaths;

    cardElement.classList.remove("death-added", "death-removed", "state-reset");
    void cardElement.offsetWidth;

    if (eventName === "DEATH_ADDED") {
        cardElement.classList.add("death-added");
    } else if (eventName === "DEATH_REMOVED") {
        cardElement.classList.add("death-removed");
    } else if (eventName === "DEATHS_RESET" || eventName === "RESET") {
        cardElement.classList.add("state-reset");
    } else {
        cardElement.classList.add("death-added");
    }
}

function updateWorldLostState(worldLost, eventName) {
    const cardElement = document.getElementById("deathCard");
    const badgeElement = document.getElementById("lostBadge");

    if (!cardElement || !badgeElement) return;

    if (currentWorldLost === null) {
        currentWorldLost = worldLost;
        if (worldLost) {
            cardElement.classList.add("world-lost");
            badgeElement.textContent = "WORLD LOST";
        }
        return;
    }

    if (worldLost === currentWorldLost) return;

    currentWorldLost = worldLost;

    cardElement.classList.remove("world-lost");
    void cardElement.offsetWidth;

    if (worldLost || eventName === "WORLD_LOST") {
        cardElement.classList.add("world-lost");
        badgeElement.textContent = "WORLD LOST";
    } else {
        badgeElement.textContent = "SURVIVAL ACTIVE";
    }
}

connect();
