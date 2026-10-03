let socket = null;

let reconnectTimer = null;
let heartbeatTimer = null;

let reconnectDelay = 1000;

const MAX_RECONNECT_DELAY = 60000;
const HEARTBEAT_INTERVAL = 25000;

let currentDeaths = null;
let currentWorldLost = null;


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
                "BISON Death Counter WebSocket connected"
            );


            // Reset reconnect backoff after success.
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
                 * Heartbeat response.
                 */
                if (
                    data.type === "PONG"
                ) {

                    return;
                }


                /*
                 * Normal server state.
                 */
                if (
                    data.type !== "state" ||
                    !data.state
                ) {

                    return;
                }


                updateGameName(
                    data.state.gameName
                );


                updateDeathCounter(
                    Number(
                        data.state.deaths ?? 0
                    ),
                    data.event
                );


                updateWorldLostState(
                    Boolean(
                        data.state.dead
                    ),
                    data.event
                );

            } catch (error) {

                console.error(
                    "Invalid death counter server data:",
                    error
                );

            }
        }
    );


    socket.addEventListener(
        "close",
        () => {

            console.log(
                "BISON Death Counter WebSocket disconnected"
            );


            stopHeartbeat();

            scheduleReconnect();
        }
    );


    socket.addEventListener(
        "error",
        () => {

            console.warn(
                "BISON Death Counter WebSocket error"
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
        `BISON Death Counter reconnecting in ${delay}ms...`
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
   GAME NAME
   ========================================================== */

function updateGameName(gameName) {

    const element =
        document.getElementById(
            "gameName"
        );


    if (!element) {
        return;
    }


    element.textContent =
        String(
            gameName ||
            "CUSTOM GAME"
        ).toUpperCase();
}


/* ==========================================================
   DEATH COUNTER
   ========================================================== */

function updateDeathCounter(
    deaths,
    eventName
) {

    const numberElement =
        document.getElementById(
            "deathNumber"
        );


    const cardElement =
        document.getElementById(
            "deathCard"
        );


    if (
        !numberElement ||
        !cardElement
    ) {

        return;
    }


    /*
     * First state received.
     * Do not play an animation.
     */

    if (
        currentDeaths === null
    ) {

        currentDeaths =
            deaths;

        numberElement.textContent =
            deaths;

        return;
    }


    /*
     * No change.
     */

    if (
        deaths === currentDeaths
    ) {

        return;
    }


    currentDeaths =
        deaths;


    numberElement.textContent =
        deaths;


    /*
     * Restart animation.
     */

    cardElement.classList.remove(
        "death-added",
        "death-removed",
        "state-reset"
    );


    void cardElement.offsetWidth;


    if (
        eventName ===
        "DEATH_ADDED"
    ) {

        cardElement.classList.add(
            "death-added"
        );

        setTimeout(() => {

            cardElement.classList.remove(
                "death-added"
            );

        }, 750);

    }

    else if (
        eventName ===
        "DEATH_REMOVED"
    ) {

        cardElement.classList.add(
            "death-removed"
        );

        setTimeout(() => {

            cardElement.classList.remove(
                "death-removed"
            );

        }, 550);

    }

    else if (
        eventName === "DEATHS_RESET" ||
        eventName === "RESET"
    ) {

        cardElement.classList.add(
            "state-reset"
        );

        setTimeout(() => {

            cardElement.classList.remove(
                "state-reset"
            );

        }, 650);

    }

    else {

        cardElement.classList.add(
            "death-added"
        );
    }
}


/* ==========================================================
   WORLD LOST
   ========================================================== */

function updateWorldLostState(
    worldLost,
    eventName
) {

    const cardElement =
        document.getElementById(
            "deathCard"
        );


    const badgeElement =
        document.getElementById(
            "lostBadge"
        );


    if (
        !cardElement ||
        !badgeElement
    ) {

        return;
    }


    /*
     * First state received.
     */

    if (
        currentWorldLost === null
    ) {

        currentWorldLost =
            worldLost;


        if (worldLost) {

            cardElement.classList.add(
                "world-lost"
            );


            badgeElement.textContent =
                "WORLD LOST";
        }


        return;
    }


    /*
     * No change.
     */

    if (
        worldLost === currentWorldLost
    ) {

        return;
    }


    currentWorldLost =
        worldLost;


    cardElement.classList.remove(
        "world-lost"
    );


    void cardElement.offsetWidth;


    if (
        worldLost ||
        eventName === "WORLD_LOST"
    ) {

        cardElement.classList.add(
            "world-lost"
        );


        badgeElement.textContent =
            "WORLD LOST";

    }

    else {

        badgeElement.textContent =
            "SURVIVAL ACTIVE";
    }
}


/* ==========================================================
   START
   ========================================================== */

connect();