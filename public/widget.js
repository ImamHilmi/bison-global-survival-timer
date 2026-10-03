let socket = null;

let reconnectTimer = null;
let heartbeatTimer = null;

let reconnectDelay = 1000;

const MAX_RECONNECT_DELAY = 60000;
const HEARTBEAT_INTERVAL = 25000;


let state = {
    gameName: "Palworld",
    modeName: "HARDCORE SURVIVAL",
    elapsed: 0,
    running: false,
    dead: false,
    status: "NEW"
};


let localStartedAt = null;
let lastEvent = "INITIAL";


const timerCard = () => document.getElementById("timerCard");


/* ==========================================================
   WEBSOCKET CONNECTION
   ========================================================== */

function connect() {

    if (
        socket &&
        (
            socket.readyState === WebSocket.OPEN ||
            socket.readyState === WebSocket.CONNECTING
        )
    ) {
        return;
    }


    const protocol =
        window.location.protocol === "https:"
            ? "wss:"
            : "ws:";


    socket = new WebSocket(
        `${protocol}//${window.location.host}`
    );


    socket.addEventListener(
        "open",
        () => {

            console.log(
                "BISON Timer WebSocket connected"
            );


            /*
             * Connection succeeded.
             * Reset exponential reconnect delay.
             */
            reconnectDelay = 1000;


            if (reconnectTimer) {

                clearTimeout(
                    reconnectTimer
                );

                reconnectTimer = null;
            }


            startHeartbeat();
        }
    );


    socket.addEventListener(
        "message",
        (event) => {

            try {

                const data =
                    JSON.parse(
                        event.data
                    );


                /*
                 * Server heartbeat response.
                 */
                if (
                    data.type === "PONG"
                ) {

                    return;
                }


                /*
                 * Normal timer state update.
                 */
                if (
                    data.type !== "state" ||
                    !data.state
                ) {

                    return;
                }


                lastEvent =
                    data.event ||
                    "STATE";


                updateState(
                    data.state
                );


                triggerEventAnimation(
                    lastEvent
                );

            } catch (error) {

                console.error(
                    "Invalid timer server data:",
                    error
                );
            }
        }
    );


    socket.addEventListener(
        "close",
        () => {

            console.log(
                "BISON Timer WebSocket disconnected"
            );


            stopHeartbeat();

            scheduleReconnect();
        }
    );


    socket.addEventListener(
        "error",
        () => {

            console.warn(
                "BISON Timer WebSocket error"
            );

        }
    );
}


/* ==========================================================
   HEARTBEAT
   ========================================================== */

function startHeartbeat() {

    stopHeartbeat();


    heartbeatTimer =
        setInterval(
            () => {

                if (
                    socket &&
                    socket.readyState ===
                    WebSocket.OPEN
                ) {

                    socket.send(
                        JSON.stringify({
                            type: "PING"
                        })
                    );

                }

            },
            HEARTBEAT_INTERVAL
        );
}


function stopHeartbeat() {

    if (heartbeatTimer) {

        clearInterval(
            heartbeatTimer
        );

        heartbeatTimer = null;
    }
}


/* ==========================================================
   RECONNECT
   ========================================================== */

function scheduleReconnect() {

    if (reconnectTimer) {
        return;
    }


    const delay =
        reconnectDelay;


    console.log(
        `BISON Timer reconnecting in ${delay}ms...`
    );


    reconnectTimer =
        setTimeout(
            () => {

                reconnectTimer = null;


                connect();


                /*
                 * Exponential backoff:
                 *
                 * 1s
                 * 2s
                 * 4s
                 * 8s
                 * 16s
                 * 32s
                 * 60s max
                 */

                reconnectDelay =
                    Math.min(
                        reconnectDelay * 2,
                        MAX_RECONNECT_DELAY
                    );

            },
            delay
        );
}


/* ==========================================================
   STATE
   ========================================================== */

function updateState(
    serverState
) {

    state = {
        ...state,
        ...serverState
    };


    if (state.running) {

        localStartedAt =
            Date.now() -
            state.elapsed;

    } else {

        localStartedAt = null;

    }


    render();
}


/* ==========================================================
   RENDER
   ========================================================== */

function render() {

    const timerElement =
        document.getElementById(
            "timer"
        );


    const gameNameElement =
        document.getElementById(
            "gameName"
        );


    const modeNameElement =
        document.getElementById(
            "modeName"
        );


    const stateTextElement =
        document.getElementById(
            "stateText"
        );


    const stateDotElement =
        document.getElementById(
            "stateDot"
        );


    const card =
        timerCard();


    if (
        !timerElement ||
        !gameNameElement ||
        !modeNameElement ||
        !stateTextElement ||
        !stateDotElement ||
        !card
    ) {

        return;
    }


    let elapsed =
        state.elapsed;


    if (
        state.running &&
        localStartedAt
    ) {

        elapsed =
            Date.now() -
            localStartedAt;
    }


    timerElement.textContent =
        formatTime(
            elapsed
        );


    gameNameElement.textContent =
        String(
            state.gameName ||
            "CUSTOM GAME"
        ).toUpperCase();


    modeNameElement.textContent =
        String(
            state.modeName ||
            "SURVIVAL"
        ).toUpperCase();


    card.classList.remove(
        "playing",
        "paused",
        "world-lost"
    );


    if (
        state.status ===
            "WORLD_LOST" ||
        state.dead
    ) {

        card.classList.add(
            "world-lost"
        );


        stateTextElement.textContent =
            "WORLD LOST";

    }

    else if (
        state.status ===
            "PLAYING" ||
        state.running
    ) {

        card.classList.add(
            "playing"
        );


        stateTextElement.textContent =
            "PLAYING";

    }

    else {

        card.classList.add(
            "paused"
        );


        stateTextElement.textContent =
            state.status === "NEW"
                ? "READY"
                : "PAUSED";
    }
}


/* ==========================================================
   EVENT ANIMATION
   ========================================================== */

function triggerEventAnimation(
    eventName
) {

    const card =
        timerCard();


    if (
        !card ||
        !eventName ||
        eventName === "HEARTBEAT" ||
        eventName === "STATE" ||
        eventName === "INITIAL"
    ) {

        return;
    }


    card.classList.remove(
        "event-start",
        "event-resume",
        "event-pause",
        "event-reset"
    );


    void card.offsetWidth;


    if (
        eventName === "START"
    ) {

        card.classList.add(
            "event-start"
        );
    }


    if (
        eventName === "RESUME"
    ) {

        card.classList.add(
            "event-resume"
        );
    }


    if (
        eventName === "PAUSE"
    ) {

        card.classList.add(
            "event-pause"
        );
    }


    if (
        eventName === "RESET"
    ) {

        card.classList.add(
            "event-reset"
        );
    }
}


/* ==========================================================
   TIME FORMAT
   ========================================================== */

function formatTime(
    milliseconds
) {

    const totalSeconds =
        Math.max(
            0,
            Math.floor(
                milliseconds / 1000
            )
        );


    const hours =
        Math.floor(
            totalSeconds / 3600
        );


    const minutes =
        Math.floor(
            (totalSeconds % 3600) / 60
        );


    const seconds =
        totalSeconds % 60;


    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}


function pad(number) {

    return String(
        number
    ).padStart(
        2,
        "0"
    );
}


/* ==========================================================
   START
   ========================================================== */

setInterval(
    render,
    250
);


connect();


render();