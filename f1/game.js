const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

// Globális változók
let track = [];
let totalLaps = 3;
const trackWidth = 650; 
let gameActive = false;
const MAX_PLAYERS = 10;
const CAMERA_ZOOM = 0.65; 

// Játékos
const player = { x: 0, y: 0, angle: 0, speed: 0, friction: 0.97, turnSpeed: 0.05, color: '#e10600', name: 'Pilóta', lap: 1, halfway: false, finished: false };
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

window.addEventListener('keydown', e => { if (keys.hasOwnProperty(e.code)) keys[e.code] = true; });
window.addEventListener('keyup', e => { if (keys.hasOwnProperty(e.code)) keys[e.code] = false; });

// Hálózat
const prefix = "F1PRO-X-";
let myId = sessionStorage.getItem('peerId') || Math.random().toString(36).substring(2, 7).toUpperCase();
let peer = null, isHost = false, hostConn = null;
let clients = {}, gameData = {};
let gameDataFromLobby = null;

// Audio & Rendszer
let audioCtx, engineOsc, engineGain;
let lastCrashTime = 0;
let currentGearDisplay = '1';
let currentRPM = 0;
let globalVolume = 1.0;
let particles = [];

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

// ÚJ: A JSON beolvasása figyelembe veszi a "laps" mezőt is
function initializeGame() {
    const gameDataStr = sessionStorage.getItem('gameData');
    if (gameDataStr) {
        gameDataFromLobby = JSON.parse(gameDataStr);
        totalLaps = gameDataFromLobby.laps;
        player.name = gameDataFromLobby.playerName || gameDataFromLobby.hostName || 'Pilóta';
        player.color = gameDataFromLobby.playerColor || '#e10600';
        isHost = gameDataFromLobby.isHost;

        if (gameDataFromLobby.track && gameDataFromLobby.track.data) {
            track = generateSmoothCurve(gameDataFromLobby.track.data.points, 5);
        }

        document.getElementById('totalLapsVal').innerText = totalLaps;
    }
    
    initAudio();
    initPeer();
    startGame();
}

function initAudio() {
    if(audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    engineOsc = audioCtx.createOscillator();
    engineGain = audioCtx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineOsc.start();
}

function updateAudio(speed, rpm) {
    if(!audioCtx) return;
    let absSpeed = Math.abs(speed);
    let freq = 50 + (rpm * 100); 
    engineOsc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.1);
    
    let baseVol = absSpeed > 1 ? 0.02 : 0.005;
    engineGain.gain.setTargetAtTime(baseVol * globalVolume, audioCtx.currentTime, 0.1);
}

function playCrashSound() {
    if(!audioCtx || globalVolume === 0) return; 
    
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.3);
    
    let crashVol = Math.max(0.0001, 0.05 * globalVolume); 
    gain.gain.setValueAtTime(crashVol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
    
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}

function initPeer() {
    peer = new Peer(prefix + myId);
    peer.on('open', () => {
        // Ready
    });
    
    peer.on('connection', (c) => {
        if (!isHost) return;
        if (Object.keys(clients).length >= MAX_PLAYERS - 1) {
            c.on('open', () => { c.send({ type: 'full' }); setTimeout(()=>c.close(), 500); });
            return;
        }

        c.on('open', () => {
            clients[c.peer] = c;
            gameData[c.peer] = { x: 0, y: 0, angle: 0, color: '#fff', name: '...' };
        });

        c.on('data', (data) => {
            if (data.type === 'sync' && gameData[c.peer]) {
                gameData[c.peer].x = data.x;
                gameData[c.peer].y = data.y;
                gameData[c.peer].angle = data.angle;
            }
            if (data.type === 'win') {
                for(let id in clients) clients[id].send({ type: 'win', name: data.name });
                showWinScreen(data.name);
            }
        });

        c.on('close', () => {
            delete clients[c.peer]; 
            delete gameData[c.peer];
        });
    });
    
    peer.on('error', (err) => { console.error("Peer hiba:", err); });
}



function startGame() {
    const hud = document.getElementById('hud');
    const volSlider = document.getElementById('volSlider');
    
    if (volSlider) {
        volSlider.addEventListener('input', (e) => {
            globalVolume = parseFloat(e.target.value);
            updateAudio(player.speed, currentRPM); 
        });
    }

    hud.style.display = 'block';
    gameActive = true;
    
    player.x = track[0].x;
    player.y = track[0].y;
    
    if (track.length > 1) {
        let dx = track[1].x - track[0].x;
        let dy = track[1].y - track[0].y;
        player.angle = Math.atan2(dy, dx);
    }
    
    if (isHost) {
        setInterval(() => {
            if (gameActive) {
                gameData[myId] = {x: player.x, y: player.y, angle: player.angle};
                for(let id in clients) {
                    if (clients[id] && clients[id].open) {
                        clients[id].send({ type: 'sync', x: player.x, y: player.y, angle: player.angle });
                    }
                }
            }
        }, 50);
    } else if (hostConn) {
        setInterval(() => {
            if (gameActive && hostConn && hostConn.open) {
                hostConn.send({ type: 'sync', x: player.x, y: player.y, angle: player.angle });
            }
        }, 50);
    }
    
    requestAnimationFrame((timestamp) => {
        lastTime = timestamp;
        gameLoop(timestamp);
    });
}

// --- ÚJ: GYŐZELEM ÉS ÚJRAINDÍTÁS FUNKCIÓK ---
function triggerWin(winnerName) {
    if (!gameActive) return; 
    gameActive = false; // Leállítja a mozgást
    
    if (isHost) {
        for(let id in clients) clients[id].send({ type: 'win', name: winnerName });
        showWinScreen(winnerName);
    } else if (hostConn && hostConn.open) {
        hostConn.send({ type: 'win', name: winnerName });
    }
}

function showWinScreen(winnerName) {
    gameActive = false;
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
        ${isHost ? '<button id="btnRestart" onclick="restartGame()">Új Verseny Indítása</button>' : '<p style="color: #aaa; font-weight: bold;">Várakozás a Hostra a folytatáshoz...</p>'}
        <button id="btnMenu" onclick="backToMenu()" class="secondary-btn" style="margin-top: 10px;">Menü</button>
    `;
    winMenu.style.display = 'block';
}

function restartGame() {
    let winMenu = document.getElementById('winMenu');
    if (winMenu) winMenu.style.display = 'none';
    
    // Játékos resetelése
    player.lap = 1;
    player.halfway = false;
    player.finished = false;
    player.speed = 0;
    player.x = track[0].x;
    player.y = track[0].y;
    if (track.length > 1) {
        player.angle = Math.atan2(track[1].y - track[0].y, track[1].x - track[0].x);
    }
    
    document.getElementById('hud').style.display = 'block';
    gameActive = true;
    
    requestAnimationFrame((timestamp) => {
        lastTime = timestamp;
        gameLoop(timestamp);
    });
}

// Visszaadja a szakaszt, amin az autó áll (index)
function getTrackDistanceAndNormal(p) {
    let minDist = Infinity;
    let normal = null;
    let closestIndex = 0; // ÚJ: Szükség van az indexre a körszámláláshoz
    for (let i = 0; i < track.length - 1; i++) {
        let v = track[i], w = track[i+1];
        let l2 = (w.x - v.x)**2 + (w.y - v.y)**2;
        let t = l2 === 0 ? 0 : ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t)); 
        let cx = v.x + t * (w.x - v.x);
        let cy = v.y + t * (w.y - v.y);
        let dx = p.x - cx, dy = p.y - cy;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < minDist) { minDist = dist; normal = { x: -dx/dist, y: -dy/dist }; closestIndex = i; }
    }
    return { dist: minDist, normal: normal, index: closestIndex };
}

function createImpactParticles(x, y, normal) {
    for(let i = 0; i < 25; i++) {
        particles.push({
            x: x, y: y,
            vx: normal.x * (Math.random() * 8 + 2) + (Math.random() - 0.5) * 8,
            vy: normal.y * (Math.random() * 8 + 2) + (Math.random() - 0.5) * 8,
            life: 1.0,
            color: Math.random() > 0.4 ? '#111' : '#ffcc00' 
        });
    }
}

function drawParticles(ctx, ts) {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx * ts; p.y += p.vy * ts;
        p.life -= 0.05 * ts;
        if (p.life <= 0) { particles.splice(i, 1); } 
        else {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.color === '#111' ? 6 : 3, p.color === '#111' ? 6 : 3);
        }
    }
    ctx.globalAlpha = 1.0;
}

// --- FIZIKA ÉS VÁLTÓ ---
function updatePhysics(ts) {
    let speedAbs = Math.abs(player.speed);
    let activeGear;

    if (player.speed < -0.5) { activeGear = { id: 'R', min: 0, max: 25, rate: 0.003 }; } 
    else if (speedAbs < 14) { activeGear = { id: '1', min: 0, max: 16, rate: 0.0025 }; } 
    else if (speedAbs < 28) { activeGear = { id: '2', min: 11, max: 31, rate: 0.002 }; } 
    else if (speedAbs < 42) { activeGear = { id: '3', min: 24, max: 45, rate: 0.0015 }; } 
    else if (speedAbs < 54) { activeGear = { id: '4', min: 38, max: 57, rate: 0.001 }; } 
    else if (speedAbs < 64) { activeGear = { id: '5', min: 50, max: 67, rate: 0.0008 }; } 
    else { activeGear = { id: '6', min: 60, max: 75, rate: 0.0005 }; }

    currentGearDisplay = activeGear.id;
    currentRPM = (speedAbs - activeGear.min) / (activeGear.max - activeGear.min);
    currentRPM = Math.max(0, Math.min(1, currentRPM));

    if (keys.ArrowUp) {
        if (player.speed < 0) { player.speed += 0.8 * ts; } 
        else { player.speed += (80 - player.speed) * activeGear.rate * ts; }
    } else if (keys.ArrowDown) {
        if (player.speed > 0) { player.speed -= 0.8 * ts; } 
        else { player.speed += (-25 - player.speed) * activeGear.rate * ts; }
    } else {
        player.speed *= Math.pow(player.friction, ts);
    }

    if (Math.abs(player.speed) > 0.5) {
        let turnDir = player.speed > 0 ? 1 : -1;
        let currentTurnSpeed = player.turnSpeed * (1 - (speedAbs / 80) * 0.6);
        if (keys.ArrowLeft) player.angle -= currentTurnSpeed * turnDir * ts;
        if (keys.ArrowRight) player.angle += currentTurnSpeed * turnDir * ts;
    }

    player.x += Math.cos(player.angle) * player.speed * ts;
    player.y += Math.sin(player.angle) * player.speed * ts;

    let trackInfo = getTrackDistanceAndNormal(player);
    let asphaltEdge = (trackWidth / 2) - 20; 
    let wallEdge = asphaltEdge + 180; 

    if (trackInfo.dist > wallEdge) {
        let normalAngle = Math.atan2(trackInfo.normal.y, trackInfo.normal.x);
        player.angle = 2 * normalAngle - Math.PI - player.angle; 
        player.speed *= 0.4; 
        player.x += trackInfo.normal.x * (trackInfo.dist - wallEdge + 5); 
        player.y += trackInfo.normal.y * (trackInfo.dist - wallEdge + 5);

        if (speedAbs > 5 && Date.now() - lastCrashTime > 200) { 
            playCrashSound(); 
            createImpactParticles(player.x, player.y, trackInfo.normal);
            lastCrashTime = Date.now(); 
        }
    } else if (trackInfo.dist > asphaltEdge) {
        player.speed *= Math.pow(0.975, ts); 
    }

    if (player.speed > 70) player.speed = 70;
    if (player.speed < -20) player.speed = -20;
    
    updateAudio(player.speed, currentRPM);

    // --- ÚJ: KÖRSZÁMLÁLÓ LOGIKA ÉS ANTI-CHEAT ---
    if (!player.finished) {
        let halfTrack = Math.floor(track.length / 2);
        
        // Ellenőrzés: Eljutott a pálya feléig?
        if (trackInfo.index > halfTrack) {
            player.halfway = true;
        }

        // Ha újra az első 20 szakaszon belül van, ÉS megjárta a felét
        if (trackInfo.index < 20 && player.halfway) {
            player.lap++;
            player.halfway = false; // Következő körhöz újra el kell mennie a feléig
            
            if (player.lap > totalLaps) {
                player.finished = true;
                player.lap = totalLaps; // A UI kiakadása ellen
                triggerWin(player.name);
            }
        }
    }
}

// Renderelés
function drawF1Car(ctx, x, y, angle, color, name) {
    ctx.save();
    ctx.translate(x, y);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Arial'; 
    ctx.textAlign = 'center';
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#000';
    ctx.fillText(name, 0, -45);
    ctx.shadowBlur = 0; 
    
    ctx.rotate(angle);
    ctx.fillStyle = '#111'; 
    ctx.fillRect(15, -22, 15, 8); ctx.fillRect(15, 14, 15, 8); 
    ctx.fillRect(-25, -22, 15, 10); ctx.fillRect(-25, 12, 15, 10);
    ctx.fillStyle = color; 
    ctx.beginPath(); ctx.moveTo(35, -5); ctx.lineTo(35, 5); ctx.lineTo(10, 10); ctx.lineTo(-20, 12); 
    ctx.lineTo(-35, 8); ctx.lineTo(-35, -8); ctx.lineTo(-20, -12); ctx.lineTo(10, -10); ctx.fill();
    ctx.fillStyle = '#222'; 
    ctx.fillRect(25, -18, 8, 36); ctx.fillRect(-40, -18, 10, 36);
    ctx.fillStyle = '#000'; 
    ctx.beginPath(); ctx.arc(-5, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawCircuit() {
    if(track.length === 0) return;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    
    ctx.beginPath(); ctx.moveTo(track[0].x, track[0].y);
    for(let i=1; i<track.length; i++) ctx.lineTo(track[i].x, track[i].y);
    ctx.lineWidth = trackWidth + 400; ctx.strokeStyle = '#111'; ctx.stroke();

    ctx.beginPath(); ctx.moveTo(track[0].x, track[0].y);
    for(let i=1; i<track.length; i++) ctx.lineTo(track[i].x, track[i].y);
    ctx.lineWidth = trackWidth + 360; ctx.strokeStyle = '#c4aa62'; ctx.stroke();

    ctx.beginPath(); ctx.moveTo(track[0].x, track[0].y);
    for(let i=1; i<track.length; i++) ctx.lineTo(track[i].x, track[i].y);
    ctx.lineWidth = trackWidth + 30; ctx.strokeStyle = '#fff'; ctx.stroke();

    ctx.beginPath(); ctx.moveTo(track[0].x, track[0].y);
    for(let i=1; i<track.length; i++) ctx.lineTo(track[i].x, track[i].y);
    ctx.lineWidth = trackWidth + 30; ctx.strokeStyle = '#e10600';
    ctx.setLineDash([80, 80]); ctx.stroke(); ctx.setLineDash([]); 

    ctx.beginPath(); ctx.moveTo(track[0].x, track[0].y);
    for(let i=1; i<track.length; i++) ctx.lineTo(track[i].x, track[i].y);
    ctx.lineWidth = trackWidth; ctx.strokeStyle = '#444'; ctx.stroke();

    ctx.save();
    ctx.translate(track[0].x, track[0].y);
    let dx = track[1].x - track[0].x; let dy = track[1].y - track[0].y;
    ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = '#fff';
    for(let i = -trackWidth/2; i < trackWidth/2; i += 30) {
        ctx.fillRect(0, i, 15, 15); ctx.fillRect(15, i+15, 15, 15);
    }
    ctx.restore();
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
    if(gearEl) gearEl.innerText = currentGearDisplay;
    
    // HUD Körszámláló frissítése
    let lapEl = document.getElementById('lapVal');
    if(lapEl) lapEl.innerText = player.lap;

    ctx.fillStyle = '#2b5c23'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height); 
    
    ctx.save();
    ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
    
    let camX = (canvas.width / 2) / CAMERA_ZOOM - player.x;
    let camY = (canvas.height / 2) / CAMERA_ZOOM - player.y;
    ctx.translate(camX, camY);

    drawCircuit();
    drawParticles(ctx, timeScale);

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

// Game startup
window.addEventListener('load', () => {
    initializeGame();
});