const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

// Globális változók
let track = [];
let checkpoints = [];
let totalLaps = 3;
const trackWidth = 650;
let gameActive = false;
const MAX_PLAYERS = 10;
var cameraZoom = 0.65;
let lapHistory = [];
let bestLapTime = null;
let countdownActive = false;
let countdownSeconds = 3;
let globalWinner = null;
let globalWinnerTime = Infinity;
const CHECKPOINT_PROXIMITY = 400; // Distance threshold to consider passing a checkpoint
let cameraAngle = 0; // Kamera forgatásához szükséges változó

function playCountdownTone(freq, duration = 180) {
    if (!audioCtx) initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2 * globalVolume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration / 1000);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration / 1000);
}

function playStartSound() {
    if (!audioCtx) initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 400;
    gain.gain.setValueAtTime(0.22 * globalVolume, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.frequency.exponentialRampToValueAtTime(950, audioCtx.currentTime + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
    osc.stop(audioCtx.currentTime + 0.25);
}

function playLapFinishSound() {
    if (!audioCtx) initAudio();
    const chordFreqs = [440, 550, 660];
    const now = audioCtx.currentTime;
    chordFreqs.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.08 * globalVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + index * 0.02);
        osc.stop(now + 0.28);
    });
}

function playFastestLapSound() {
    if (!audioCtx) initAudio();
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    const now = audioCtx.currentTime;
    notes.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12 * globalVolume, now + index * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.1 + 0.15);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + index * 0.1);
        osc.stop(now + index * 0.1 + 0.15);
    });
}

function updateCountdownLights(count, go = false) {
    const lights = document.querySelectorAll('#countdownLights .countdown-light');
    lights.forEach((light, index) => {
        if (go) {
            light.style.background = '#1fc800';
            light.style.boxShadow = '0 0 20px rgba(31, 200, 0, 0.8)';
        } else if (index < count) {
            light.style.background = '#ff2b2b';
            light.style.boxShadow = '0 0 20px rgba(255, 40, 40, 0.8)';
        } else {
            light.style.background = '#300';
            light.style.boxShadow = 'inset 0 0 12px rgba(255, 0, 0, 0.08)';
        }
    });
}

function showCountdownPanel() {
    const panel = document.getElementById('raceCountdown');
    if (!panel) return;
    panel.style.display = 'flex';
    countdownActive = true;
}

function hideCountdownPanel() {
    const panel = document.getElementById('raceCountdown');
    if (!panel) return;
    panel.style.display = 'none';
    countdownActive = false;
}

function beginRace() {
    countdownActive = false;
    gameActive = true;
    player.lapStartTime = Date.now();
    player.raceStartTime = Date.now(); // ÚJ: Verseny kezdetének mérése az eltelt időhöz
    lapHistory = [];
    bestLapTime = null;
    updateLapHistoryUI();

    if (isHost) {
        setInterval(() => {
            if (gameActive) {
                gameData[myId] = { x: player.x, y: player.y, angle: player.angle, finished: player.finished, finishTime: player.finishTime, lap: player.lap, name: player.name, color: player.color, currentCheckpoint: player.currentCheckpoint };
                for (let id in clients) {
                    if (clients[id] && clients[id].open) {
                        clients[id].send({ type: 'state', players: gameData });
                    }
                }
            }
        }, 50);
    } else if (hostConn) {
        setInterval(() => {
            if (gameActive && hostConn && hostConn.open) {
                hostConn.send({ type: 'sync', x: player.x, y: player.y, angle: player.angle, finished: player.finished, finishTime: player.finishTime, lap: player.lap, name: player.name, color: player.color, currentCheckpoint: player.currentCheckpoint });
            }
        }, 50);
    }

    requestAnimationFrame((timestamp) => {
        lastTime = timestamp;
        gameLoop(timestamp);
    });
}

function startCountdown() {
    showCountdownPanel();
    const textEl = document.getElementById('countdownText');
    if (!textEl) return;

    let count = countdownSeconds;
    const tick = () => {
        if (count > 0) {
            textEl.innerText = count;
            updateCountdownLights(countdownSeconds - count + 1);
            playCountdownTone(450 + (count * 70));
            count -= 1;
            setTimeout(tick, 1000);
        } else {
            textEl.innerText = 'GO!';
            updateCountdownLights(3, true);
            playStartSound();
            setTimeout(() => {
                hideCountdownPanel();
                beginRace();
            }, 700);
        }
    };
    tick();
}

function formatLapTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const fraction = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${fraction.toString().padStart(2, '0')}`;
}

function updateLapHistoryUI() {
    const listEl = document.getElementById('lapTimeList');
    if (!listEl) return;

    const playerLaps = lapHistory.filter(item => item.name === player.name);
    if (playerLaps.length === 0) {
        listEl.innerHTML = '<div style="color: #ccc; font-size: 12px;">No lap times yet.</div>';
        return;
    }

    const sorted = [...playerLaps].sort((a, b) => b.timestamp - a.timestamp);
    bestLapTime = sorted.reduce((best, item) => best === null || item.lapTime < best ? item.lapTime : best, null);

    listEl.innerHTML = sorted.map((item, index) => {
        const isFastest = item.lapTime === bestLapTime;
        const badgeColor = isFastest ? '#7d3cff' : '#1fc800';
        let diffText = '';
        if (index < sorted.length - 1) {
            const prevLap = sorted[index + 1].lapTime;
            const diff = item.lapTime - prevLap;
            const sign = diff > 0 ? '+' : '';
            diffText = ` (${sign}${formatLapTime(Math.abs(diff))})`;
        }
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px; border-radius: 8px; background: ${badgeColor}; color: #fff; box-shadow: 0 0 0 1px rgba(255,255,255,0.06); margin-bottom: 4px; font-size: 12px;">
                <div style="display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0;">
                    <span style="font-size: 11px; opacity: 0.9;">${item.name}</span>
                    <span style="font-size: 12px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Lap ${item.lapNumber}</span>
                </div>
                <span style="font-size: 11px; font-weight: bold; margin-left: 8px; white-space: nowrap;">${formatLapTime(item.lapTime)}${diffText}</span>
            </div>
        `;
    }).join('');
}

function recordLapTime(name, color, lapTime, lapNumber) {
    const previousBest = bestLapTime;
    lapHistory.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: name || 'Pilóta',
        color: color || '#e10600',
        lapTime,
        lapNumber,
        timestamp: Date.now()
    });
    updateLapHistoryUI();
    const isNowFastest = bestLapTime !== null && lapTime === bestLapTime && lapTime !== previousBest;
    if (isNowFastest) {
        playFastestLapSound();
    } else {
        playLapFinishSound();
    }
}

// Játékos
const player = { x: 0, y: 0, angle: 0, speed: 0, friction: 0.97, turnSpeed: 0.05, color: '#e10600', name: 'Pilóta', lap: 1, halfway: false, finished: false, finishTime: null, raceStartTime: null, currentCheckpoint: 0, checkpointTimes: [] };
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

window.addEventListener('keydown', e => { if (keys.hasOwnProperty(e.code)) keys[e.code] = true; });
window.addEventListener('keyup', e => { if (keys.hasOwnProperty(e.code)) keys[e.code] = false; });

// Hálózat
const prefix = "F1PRO-X-";
let myId = sessionStorage.getItem('peerId') || Math.random().toString(36).substring(2, 7).toUpperCase();
let peer = null, isHost = false, hostConn = null;
let clients = {}, gameData = {};
let gameDataFromLobby = null;

let lastCrashTime = 0;
let currentGearDisplay = '1';
let currentRPM = 0;

// --- Algoritmikus Görbesimító (Chaikin's Algorithm) ---
function generateSmoothCurve(path, iterations = 4) {
    if (path.length < 3) return path;
    let smoothed = [...path];

    for (let iter = 0; iter < iterations; iter++) {
        let newPath = [];
        for (let i = 0; i < smoothed.length; i++) {
            let p1 = smoothed[i];
            let p2 = smoothed[(i + 1) % smoothed.length];

            newPath.push({ x: p1.x * 0.75 + p2.x * 0.25, y: p1.y * 0.75 + p2.y * 0.25 });
            newPath.push({ x: p1.x * 0.25 + p2.x * 0.75, y: p1.y * 0.25 + p2.y * 0.75 });
        }
        smoothed = newPath;
    }
    return smoothed;
}


function generateCheckpointsFromTrack() {
    if (track.length === 0) return;
    checkpoints = [];

    // Generate checkpoints every N points along the track (4-5 checkpoints typically)
    const checkpointInterval = Math.max(1, Math.floor(track.length / 5));

    for (let i = 0; i < track.length; i += checkpointInterval) {
        checkpoints.push({
            index: checkpoints.length,
            x: track[i].x,
            y: track[i].y,
            trackIndex: i
        });
    }

    // Always ensure checkpoint 0 is at the start/finish
    checkpoints[0] = {
        index: 0,
        x: track[0].x,
        y: track[0].y,
        trackIndex: 0
    };

    console.log(`Generated ${checkpoints.length} checkpoints for track`);
}
function initializeGame() {
    const gameDataStr = sessionStorage.getItem('gameData');
    if (gameDataStr) {
        gameDataFromLobby = JSON.parse(gameDataStr);
        totalLaps = gameDataFromLobby.laps;
        player.name = gameDataFromLobby.playerName || gameDataFromLobby.hostName || 'Pilóta';
        player.color = gameDataFromLobby.playerColor || '#e10600';
        isHost = gameDataFromLobby.isHost;

        if (gameDataFromLobby.track) {
            let trackObj = gameDataFromLobby.track;
            if (typeof trackObj === 'string') {
                try { trackObj = JSON.parse(trackObj); } catch (e) { }
            }
            const points = trackObj.data?.points || trackObj.points;
            if (Array.isArray(points)) {
                track = generateSmoothCurve(points, 5);
                generateCheckpointsFromTrack();
            }
        }

        document.getElementById('totalLapsVal').innerText = totalLaps;
    }

    initAudio();
    initPeer();
    startGame();
}

let reconnectTimer = null; // Biztonsági időzítő a kliensnek

function initPeer() {
    peer = new Peer(prefix + myId, {
        config: { 'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] }
    });

    peer.on('open', () => {
        if (!isHost && gameDataFromLobby) {
            let hostId = gameDataFromLobby.joinCode || gameDataFromLobby.hostId || gameDataFromLobby.host;
            if (hostId) {
                connectToHostWithRetry(hostId, 6);
            }
        }
    });

    peer.on('connection', (c) => {
        if (!isHost) return;

        c.on('open', () => {
            if (Object.keys(clients).length >= MAX_PLAYERS - 1) {
                c.send({ type: 'full' }); setTimeout(() => c.close(), 500);
                return;
            }
            clients[c.peer] = c;
            // Alapértelmezett értékek megadása, ha még nincs pozíció
            gameData[c.peer] = { x: track[0]?.x || 0, y: track[0]?.y || 0, angle: 0, color: '#fff', name: '...', finished: false, lap: 1, currentCheckpoint: 0 };
        });

        c.on('data', (data) => {
            if (data.type === 'sync' && gameData[c.peer]) {
                if (data.finishTime !== undefined) gameData[c.peer].finishTime = data.finishTime;
                gameData[c.peer].x = data.x;
                gameData[c.peer].y = data.y;
                gameData[c.peer].angle = data.angle;
                gameData[c.peer].finished = data.finished;
                if (data.finishTime !== undefined) gameData[c.peer].finishTime = data.finishTime;
                gameData[c.peer].lap = data.lap;
                gameData[c.peer].currentCheckpoint = data.currentCheckpoint;
                // Kliens nevének és színének frissítése, amint megérkezik
                gameData[c.peer].finishTime = data.time;
                if (data.name) gameData[c.peer].name = data.name;
                if (data.color) gameData[c.peer].color = data.color;
            }
            if (data.type === 'finished') {
                gameData[c.peer].finished = true;
                gameData[c.peer].finishTime = data.time;
                if (data.time < globalWinnerTime) {
                    globalWinner = data.name;
                    globalWinnerTime = data.time;
                }
            }
        });

        c.on('close', () => {
            delete clients[c.peer];
            delete gameData[c.peer];
        });
    });

    peer.on('error', (err) => {
        console.error("Peer hiba:", err);
        if (err.type === 'peer-unavailable' && !isHost && gameDataFromLobby) {
            let hostId = gameDataFromLobby.joinCode || gameDataFromLobby.hostId || gameDataFromLobby.host;
            if (hostId) {
                console.log("Host is loading... Trying again in 1 second");
                setTimeout(() => { connectToHostWithRetry(hostId, 5); }, 1000);
            }
        }
    });
}

// --- ÚJ FÜGGVÉNY: Kliens csatlakozása újrapróbálkozással ---
function connectToHostWithRetry(hostId, attemptsLeft) {
    hostConn = peer.connect(prefix + hostId, { reliable: true });

    hostConn.on('open', () => {
        console.log("Sikeresen csatlakozva a Hosthoz!");
        // Amint sikeres a csatlakozás, a kliens beküldi a nevét és színét!
        hostConn.send({ type: 'sync', x: player.x, y: player.y, angle: player.angle, speed: player.speed, finished: false, lap: player.lap, name: player.name, color: player.color, currentCheckpoint: player.currentCheckpoint });
    });

    hostConn.on('data', (data) => {
        if (data.type === 'state') {
            let myFullId = prefix + myId;
            for (let id in data.players) {
                if (id !== myId && id !== myFullId) {
                    if (!gameData[id]) {
                        gameData[id] = data.players[id];
                    } else {
                        gameData[id].targetX = data.players[id].x;
                        gameData[id].targetY = data.players[id].y;
                        gameData[id].targetAngle = data.players[id].angle;
                        gameData[id].speed = data.players[id].speed;
                        gameData[id].finished = data.players[id].finished;
                        gameData[id].finishTime = data.players[id].finishTime;
                        gameData[id].lap = data.players[id].lap;
                        gameData[id].currentCheckpoint = data.players[id].currentCheckpoint;
                        if (data.players[id].name) gameData[id].name = data.players[id].name;
                        if (data.players[id].color) gameData[id].color = data.players[id].color;
                    }
                }
            }
            for (let id in gameData) {
                if (!data.players[id] && id !== myId && id !== myFullId) delete gameData[id];
            }
        }
        if (data.type === 'allFinished' || data.type === 'win') {
            showWinScreen(data.winner || data.name);
        }
        if (data.type === 'restart') {
            restartGame();
        }
        if (data.type === 'returnToLobby') {
            const code = sessionStorage.getItem('lastJoinCode');
            if (code) sessionStorage.setItem('autoJoinCode', code);
            if (peer) peer.destroy();
            if (hostConn) hostConn.close();
            window.location.href = './lobby.html';
        }
    });

    hostConn.on('close', () => {
        if (attemptsLeft > 0) {
            console.log("Host nem válaszol, újrapróbálkozás... Még " + attemptsLeft + " kísérlet.");
            clearTimeout(reconnectTimer);
            // 1 másodperc múlva újra megpróbálja
            reconnectTimer = setTimeout(() => connectToHostWithRetry(hostId, attemptsLeft - 1), 1000);
        } else {
            console.error("Végleges kapcsolat megszakadás a Hosttal.");
            // Ide jöhet egy alert, ha teljesen sikertelen
        }
    });
}



function startGame() {
    document.getElementById('hud').style.display = 'block';
    gameActive = false;

    player.currentCheckpoint = 0;

    if (track && track.length > 0) {
        player.x = track[0].x;
        player.y = track[0].y;
        if (track.length > 1) {
            let dx = track[1].x - track[0].x;
            let dy = track[1].y - track[0].y;
            player.angle = Math.atan2(dy, dx);
        }
    }
    cameraAngle = player.angle; // Kamera szögének szinkronizálása a játékos kezdeti szögével
    player.lapStartTime = null;
    lapHistory = [];
    bestLapTime = null;
    updateLapHistoryUI();
    gameData[myId] = { x: player.x, y: player.y, angle: player.angle, finished: false, lap: player.lap, currentCheckpoint: player.currentCheckpoint };

    drawScene();
    startCountdown();
}

// --- ÚJ: GYŐZELEM ÉS ÚJRAINDÍTÁS FUNKCIÓK ---
function checkAllFinished() {
    if (!isHost) return;
    let allFinished = true;
    for (let id in gameData) {
        if (!gameData[id].finished) {
            allFinished = false;
            break;
        }
    }
    if (allFinished && globalWinner !== null) {
        for (let id in clients) {
            if (clients[id] && clients[id].open) {
                clients[id].send({ type: 'allFinished', winner: globalWinner });
            }
        }
        showWinScreen(globalWinner);
    }
}

function triggerFinish(finisherName) {
    player.finished = true;
    player.finishTime = Date.now() - player.raceStartTime; // Abszolút idő helyett eltelt időt használunk (Nincs több óra-elcsúszási hiba!)

    if (typeof stopEngineSound === 'function') {
        stopEngineSound();
    }

    if (gameData[myId]) {
        gameData[myId].finished = true;
        gameData[myId].finishTime = player.finishTime;
    }

    if (globalWinnerTime > player.finishTime) {
        globalWinner = finisherName;
        globalWinnerTime = player.finishTime;
    }

    if (isHost) {
        for (let id in clients) {
            if (clients[id] && clients[id].open) {
                clients[id].send({ type: 'finished', name: finisherName, time: player.finishTime });
            }
        }
        checkAllFinished();
    } else if (hostConn && hostConn.open) {
        hostConn.send({ type: 'finished', name: finisherName, time: player.finishTime });
    }
}

function showWinScreen(winnerName) {
    gameActive = false;
    if (typeof stopEngineSound === 'function') {
        stopEngineSound();
    }
    document.getElementById('hud').style.display = 'none';

    let winMenu = document.getElementById('winMenu');
    if (!winMenu) {
        winMenu = document.createElement('div');
        winMenu.id = 'winMenu';
        winMenu.className = 'menu';
        winMenu.style.position = 'absolute';
        winMenu.style.top = '50%';
        winMenu.style.left = '50%';
        winMenu.style.transform = 'translate(-50%, -50%)';
        winMenu.style.zIndex = '20';
        document.body.appendChild(winMenu);
    }

    winMenu.innerHTML = `
        <h1 style="font-size: 40px; margin-bottom: 10px;">🏁 KOCKÁS ZÁSZLÓ! 🏁</h1>
        <p style="font-size: 26px; color: #0f0; font-weight: bold; margin-bottom: 30px;">A győztes: ${winnerName}!</p>
        ${isHost ? `
            <div style="display: flex; gap: 15px; justify-content: center; flex-direction: column; align-items: center;">
                <button id="btnRestart" onclick="restartGame()" style="padding: 12px 24px; font-size: 18px; background: #1fc800; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; width: 100%; max-width: 300px;">Új Verseny Indítása</button>
                <button id="btnLobby" onclick="returnToLobbyHost()" style="padding: 12px 24px; font-size: 18px; background: #ff9800; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; width: 100%; max-width: 300px;">Vissza a lobbyba</button>
            </div>
        ` : '<p style="color: #aaa; font-weight: bold;">Várakozás a Hostra a folytatáshoz vagy kilépéshez...</p>'}
        <button id="btnMenu" onclick="backToMenu()" class="secondary-btn" style="margin-top: 20px; padding: 10px 20px; font-size: 16px; background: #444; color: #fff; border: none; border-radius: 5px; cursor: pointer;">Kilépés a Főmenübe</button>
    `;
    winMenu.style.display = 'block';
}

function restartGame() {
    let winMenu = document.getElementById('winMenu');
    if (winMenu) winMenu.style.display = 'none';

    // 1. HOST JELZI MINDENKINEK AZ ÚJRAINDÍTÁST!
    if (isHost) {
        for (let id in clients) {
            if (clients[id] && clients[id].open) {
                clients[id].send({ type: 'restart' });
            }
        }
    }

    // 2. SAJÁT JÁTÉKOS RESETELÉSE
    player.lap = 1;
    player.currentCheckpoint = 0;
    player.finished = false;
    player.finishTime = null;
    player.raceStartTime = null;
    player.speed = 0;
    if (track && track.length > 0) {
        player.x = track[0].x;
        player.y = track[0].y;
        if (track.length > 1) {
            player.angle = Math.atan2(track[1].y - track[0].y, track[1].x - track[0].x);
        }
    }
    cameraAngle = player.angle; // Kamera visszaállítása újraindításnál
    resetLapHistory();
    globalWinner = null;
    globalWinnerTime = Infinity;

    // 3. TÖBBI JÁTÉKOS RESETELÉSE A MEMÓRIÁBAN (Hogy ők is mozoghassanak)
    for (let id in gameData) {
        gameData[id].finished = false;
        gameData[id].finishTime = null;
        gameData[id].lap = 1;
        gameData[id].currentCheckpoint = 0;
    }

    document.getElementById('hud').style.display = 'block';

    // 4. JÁTÉK INDÍTÁSA
    if (typeof startCountdown === "function") {
        startCountdown();
    } else {
        gameActive = true;
        player.lapStartTime = Date.now();
    }
}

// Calculate current leaderboard based on checkpoint progress and times
function calculateLeaderboard() {
    const allPlayers = [
        { id: myId, ...player, isSelf: true }
    ];

    for (let id in gameData) {
        if (id !== myId) {
            allPlayers.push({ id: id, ...gameData[id], isSelf: false });
        }
    }

    // Sort by: finished status desc, lap desc, currentCheckpoint desc
    allPlayers.sort((a, b) => {
        if (a.finished && !b.finished) return -1;
        if (!a.finished && b.finished) return 1;
        if (a.finished && b.finished) {
            return (a.finishTime || Infinity) - (b.finishTime || Infinity);
        }
        if (b.lap !== a.lap) return b.lap - a.lap;
        if (b.currentCheckpoint !== a.currentCheckpoint) return b.currentCheckpoint - a.currentCheckpoint;
        return 0;
    });

    return allPlayers;
}

// Update the leaderboard UI
function updateLeaderboardUI() {
    const leaderboard = calculateLeaderboard();
    const leaderEl = document.getElementById('leaderboard');
    if (!leaderEl) return;

    let html = '';

    leaderboard.slice(0, 10).forEach((p, idx) => {
        const position = idx + 1;
        const nextPlayer = idx < leaderboard.length - 1 ? leaderboard[idx + 1] : null;
        let timeDelta = '';
        if (nextPlayer) {
            timeDelta = calculateTimeGap(p, nextPlayer);
        }

        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px; border-bottom: 1px solid #333; color: ${p.isSelf ? '#ffd700' : '#fff'};">
                <span style="font-size: 14px;">${position}. ${p.name || 'Játékos'} ${p.isSelf ? '(Te)' : ''}</span>
                <span style="font-size: 12px; font-weight: bold; margin-left: 10px; white-space: nowrap; color: #8cff8c;">${timeDelta}</span>
            </div>
        `;
    });

    leaderEl.innerHTML = html;
}

// Calculate time gap between two players
function calculateTimeGap(player1, player2) {
    if (!player2) return '';

    if (player1.finished && player2.finished) {
        const timeDiff = Math.abs((player1.finishTime || 0) - (player2.finishTime || 0));
        return '+' + formatLapTime(timeDiff);
    }
    if (player1.finished && !player2.finished) {
        const lapsBehind = totalLaps - player2.lap + 1;
        if (lapsBehind > 0) return '+' + lapsBehind + ' kör';
    }
    const lapDiff = player1.lap - player2.lap;
    if (lapDiff > 0) return '+' + lapDiff + ' kör';
    const cpDiff = player1.currentCheckpoint - player2.currentCheckpoint;
    if (cpDiff > 0) return '+' + cpDiff + ' CP';
    return '';
}

function resetLapHistory() {
    lapHistory = [];
    bestLapTime = null;
    player.lapStartTime = null;
    updateLapHistoryUI();
}

function gameLoop(timestamp) {
    if (!gameActive) return;
    requestAnimationFrame(gameLoop);

    let dt = timestamp - lastTime;
    if (dt > 100) dt = 16.66;
    lastTime = timestamp;
    let timeScale = dt / 16.666;

    updatePhysics(timeScale);

    document.getElementById('speedVal').innerText = Math.abs(Math.round(player.speed * 4.6));
    let gearEl = document.getElementById('gearVal');
    if (gearEl) gearEl.innerText = currentGearDisplay;

    // HUD Körszámláló frissítése
    let lapEl = document.getElementById('lapVal');
    if (lapEl) lapEl.innerText = player.lap;

    // Update leaderboard
    updateLeaderboardUI();

    ctx.fillStyle = '#2b5c23';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    let followX = player.x, followY = player.y;
    let followAngle = player.angle;
    if (player.finished) {
        // Spectate an active player
        for (let id in gameData) {
            if (id !== myId && !gameData[id].finished) {
                followX = gameData[id].x;
                followY = gameData[id].y;
                followAngle = gameData[id].angle;
                break;
            }
        }
    }

    let targetAngle;
    if (window.gameSettings && window.gameSettings.cameraLock) {
        targetAngle = -Math.PI / 2;
    } else {
        targetAngle = followAngle;
    }

    let angleDiff = targetAngle - cameraAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    cameraAngle += angleDiff * 0.08 * timeScale;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(cameraZoom, cameraZoom);
    ctx.rotate(-cameraAngle - Math.PI / 2);
    ctx.translate(-followX, -followY);

    drawCircuit();
    if (window.gameSettings && window.gameSettings.particles) {
        drawParticles(ctx, timeScale);
    }
    for (let id in gameData) {
        if (id !== myId) {
            let p = gameData[id];
            drawF1Car(ctx, p.x, p.y, p.angle, p.color, p.name);
        }
    }
    drawF1Car(ctx, player.x, player.y, player.angle, player.color, player.name);

    ctx.restore();
}

let lastTime = 0;

function backToMenu() {
    if (peer) peer.destroy();
    if (hostConn) hostConn.close();
    sessionStorage.clear();
    window.location.href = './index.html';
}

function returnToLobbyHost() {
    if (isHost) {
        for (let id in clients) {
            if (clients[id] && clients[id].open) {
                clients[id].send({ type: 'returnToLobby' });
            }
        }
        setTimeout(() => {
            if (peer) peer.destroy();
            window.location.href = './lobby.html';
        }, 500);
    }
}

// Game startup
window.addEventListener('load', () => {
    initializeGame();
});