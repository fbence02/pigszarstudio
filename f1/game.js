const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

// Globális változók
let track = [];
const trackWidth = 650; 
let gameActive = false;
const MAX_PLAYERS = 10;
const CAMERA_ZOOM = 0.65; // ZOOM MÉRTÉKE: Kisebb szám = távolabbi kamera

const player = { x: 0, y: 0, angle: 0, speed: 0, friction: 0.97, turnSpeed: 0.05, color: '#e10600', name: 'Pilóta' };
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

window.addEventListener('keydown', e => { if (keys.hasOwnProperty(e.code)) keys[e.code] = true; });
window.addEventListener('keyup', e => { if (keys.hasOwnProperty(e.code)) keys[e.code] = false; });

// Hálózat
const prefix = "F1PRO-X-";
const genCode = () => Math.random().toString(36).substring(2, 7).toUpperCase();
let myId = genCode(); 
let peer = null, isHost = false, hostConn = null;
let clients = {}, gameData = {};

// Audio & Rendszer
let audioCtx, engineOsc, engineGain;
let lastCrashTime = 0;
let currentGearDisplay = '1';
let currentRPM = 0;

async function loadTrack() {
    try {
        const response = await fetch('track.json');
        track = await response.json();
    } catch (error) {
        alert("Hiba a pálya betöltésekor!");
        console.error(error);
    }
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
    // Dinamikus motorhang fordulatszám (RPM) alapján!
    let freq = 50 + (rpm * 100); 
    engineOsc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.1);
    engineGain.gain.setTargetAtTime(absSpeed > 1 ? 0.02 : 0.005, audioCtx.currentTime, 0.1);
}

function playCrashSound() {
    if(!audioCtx) return;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}

function initPeer(id) {
    peer = new Peer(prefix + id);
    peer.on('open', () => { if(isHost) document.getElementById('myCode').innerText = id; });
    
    peer.on('connection', (c) => {
        if (!isHost) return;
        if (Object.keys(clients).length >= MAX_PLAYERS - 1) {
            c.on('open', () => { c.send({ type: 'full' }); setTimeout(()=>c.close(), 500); });
            return;
        }

        c.on('open', () => {
            clients[c.peer] = c;
            gameData[c.peer] = { x: 0, y: 0, angle: 0, color: '#fff', name: '...' };
            updatePlayerCount();
            if(gameActive) c.send({ type: 'start' });
        });

        c.on('data', (data) => {
            if (data.type === 'join' && gameData[c.peer]) {
                gameData[c.peer].name = data.name;
                gameData[c.peer].color = data.color;
            }
            if (data.type === 'sync' && gameData[c.peer]) {
                gameData[c.peer].x = data.x;
                gameData[c.peer].y = data.y;
                gameData[c.peer].angle = data.angle;
            }
        });

        c.on('close', () => {
            delete clients[c.peer]; delete gameData[c.peer]; updatePlayerCount();
        });
    });
    peer.on('error', (err) => { document.getElementById('status').innerText = "Hiba: " + err.type; });
}

function updatePlayerCount() {
    if(!gameActive) document.getElementById('playerCount').innerText = `Játékosok: ${Object.keys(clients).length + 1}/${MAX_PLAYERS}`;
}

function setupPlayerInputs() {
    player.name = document.getElementById('playerName').value.trim() || 'Pilóta';
    player.color = document.getElementById('playerColor').value;
}

document.getElementById('btnHost').onclick = async () => { 
    await loadTrack();
    if(track.length === 0) return;
    initAudio(); setupPlayerInputs();
    isHost = true; 
    document.getElementById('mainMenu').style.display = 'none'; 
    document.getElementById('hostMenu').style.display = 'block'; 
    gameData[myId] = {x: 0, y: 0, angle: 0, color: player.color, name: player.name}; 
    initPeer(myId); 
};

document.getElementById('btnStartRace').onclick = () => {
    for(let id in clients) clients[id].send({ type: 'start' });
    startGame();
};

document.getElementById('btnJoin').onclick = async () => {
    await loadTrack();
    if(track.length === 0) return;
    initAudio(); setupPlayerInputs();
    
    const code = document.getElementById('joinCode').value.toUpperCase().trim();
    if (code.length !== 5) return document.getElementById('status').innerText = "Hibás kód!";
    
    isHost = false; 
    document.getElementById('status').innerText = "Csatlakozás szerverhez...";
    initPeer(myId); 

    setTimeout(() => { 
        hostConn = peer.connect(prefix + code); 
        hostConn.on('open', () => { 
            document.getElementById('status').innerText = "Várakozás a Hostra..."; 
            hostConn.send({ type: 'join', name: player.name, color: player.color });
        });
        hostConn.on('data', (data) => {
            if (data.type === 'full') { alert("A szerver tele van!"); location.reload(); }
            if (data.type === 'start') { startGame(); }
            if (data.type === 'state') {
                for (let id in data.players) { if (id !== myId) gameData[id] = data.players[id]; }
                for (let id in gameData) { if (!data.players[id] && id !== myId) delete gameData[id]; }
            }
        });
    }, 1000);
};

let lastTime = 0;

function startGame() {
    let hud = document.getElementById('hud');
    // Automatikusan beszúrjuk a váltó UI-t, így nem kell a HTML-hez nyúlnod!
    if (!document.getElementById('gearVal')) {
        hud.innerHTML = `Sebesség: <span id="speedVal">0</span> km/h <span style="color:#666; margin: 0 10px;">|</span> Fokozat: <span id="gearVal" style="color:#e10600; font-size: 32px; font-weight: 900;">1</span><br><span style="font-size: 18px; color: #aaa;">Max 10 játékos</span>`;
    }

    document.getElementById('ui-layer').style.display = 'none';
    hud.style.display = 'block';
    gameActive = true;
    
    player.x = track[0].x;
    player.y = track[0].y;
    
    if (isHost) {
        setInterval(() => {
            gameData[myId].x = player.x; gameData[myId].y = player.y; gameData[myId].angle = player.angle;
            for(let id in clients) clients[id].send({ type: 'state', players: gameData });
        }, 50);
    } else {
        setInterval(() => {
            if (hostConn && hostConn.open) hostConn.send({ type: 'sync', x: player.x, y: player.y, angle: player.angle });
        }, 50);
    }
    
    requestAnimationFrame((timestamp) => {
        lastTime = timestamp;
        gameLoop(timestamp);
    });
}

function checkWallCollision(p) {
    let minDist = Infinity;
    let collisionNormal = null;
    for (let i = 0; i < track.length - 1; i++) {
        let v = track[i], w = track[i+1];
        let l2 = (w.x - v.x)**2 + (w.y - v.y)**2;
        let t = l2 === 0 ? 0 : ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t)); 
        let cx = v.x + t * (w.x - v.x);
        let cy = v.y + t * (w.y - v.y);
        let dx = p.x - cx, dy = p.y - cy;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < minDist) { minDist = dist; collisionNormal = { x: -dx/dist, y: -dy/dist }; }
    }
    if (minDist > (trackWidth / 2) - 30) return collisionNormal;
    return null;
}

// --- FIZIKA ÉS VÁLTÓ ---
function updatePhysics(ts) {
    let speedAbs = Math.abs(player.speed);
    let activeGear;

    // Automata sebességváltó és gyorsulási görbe (Gear config)
    if (player.speed < -0.5) {
        activeGear = { id: 'R', min: 0, max: 20, accel: 1.5 };
    } else if (speedAbs < 15) {
        activeGear = { id: '1', min: 0, max: 15, accel: 1.8 };
    } else if (speedAbs < 28) {
        activeGear = { id: '2', min: 15, max: 28, accel: 1.3 };
    } else if (speedAbs < 42) {
        activeGear = { id: '3', min: 28, max: 42, accel: 0.9 };
    } else if (speedAbs < 55) {
        activeGear = { id: '4', min: 42, max: 55, accel: 0.6 };
    } else {
        activeGear = { id: '5', min: 55, max: 70, accel: 0.35 }; // Végsebességhez közeledve alig gyorsul
    }

    currentGearDisplay = activeGear.id;

    // Virtuális Fordulatszám (RPM) kiszámítása (0.0 és 1.0 között) a hanghoz
    currentRPM = (speedAbs - activeGear.min) / (activeGear.max - activeGear.min);
    if (currentRPM < 0) currentRPM = 0; 
    if (currentRPM > 1) currentRPM = 1;

    // Gázadás és Fékezés dinamikusan a váltó alapján
    if (keys.ArrowUp) {
        // Ha rükvercben gurul, a felfelé nyíl fékként funkcionál (erős)
        player.speed += (player.speed < 0 ? 3 : activeGear.accel) * ts;
    }
    if (keys.ArrowDown) {
        // Ha előre megy, a lefelé nyíl fékként funkcionál (erős)
        player.speed -= (player.speed > 0 ? 3 : activeGear.accel) * ts; 
    }

    // Sebességfüggetlen légellenállás/súrlódás
    player.speed *= Math.pow(player.friction, ts);

    // Kormányzás (Enyhül nagy sebességnél a kipörgés elkerüléséért)
    if (Math.abs(player.speed) > 0.5) {
        let turnDir = player.speed > 0 ? 1 : -1;
        let currentTurnSpeed = player.turnSpeed * (1 - (speedAbs / 70) * 0.1);
        if (keys.ArrowLeft) player.angle -= currentTurnSpeed * turnDir * ts;
        if (keys.ArrowRight) player.angle += currentTurnSpeed * turnDir * ts;
    }

    // Pozíció módosítás
    player.x += Math.cos(player.angle) * player.speed * ts;
    player.y += Math.sin(player.angle) * player.speed * ts;

    // Ütközés
    let hitNormal = checkWallCollision(player);
    if (hitNormal) {
        player.speed *= 0.3; 
        player.x += hitNormal.x * 15; 
        player.y += hitNormal.y * 15;
        if (speedAbs > 2 && Date.now() - lastCrashTime > 300) { playCrashSound(); lastCrashTime = Date.now(); }
    }

    // Abszolút Max Sebesség Limitek
    if (player.speed > 70) player.speed = 70;
    if (player.speed < -20) player.speed = -20;
    
    updateAudio(player.speed, currentRPM);
}

// Renderelés
function drawF1Car(ctx, x, y, angle, color, name) {
    ctx.save();
    ctx.translate(x, y);
    
    // Névtábla
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Arial'; // Megnövelve, hogy a zoom miatt is olvasható maradjon
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
    ctx.lineWidth = trackWidth + 30; ctx.strokeStyle = '#fff'; ctx.stroke();

    ctx.beginPath(); ctx.moveTo(track[0].x, track[0].y);
    for(let i=1; i<track.length; i++) ctx.lineTo(track[i].x, track[i].y);
    ctx.lineWidth = trackWidth + 30; ctx.strokeStyle = '#e10600';
    ctx.setLineDash([80, 80]); ctx.stroke(); ctx.setLineDash([]); // Megnöveltem a rázókő méretét a zoom miatt

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
    
    // UI Frissítés (Egy kb 320 km/h-s max sebességre szorozva)
    document.getElementById('speedVal').innerText = Math.abs(Math.round(player.speed * 4.6));
    let gearEl = document.getElementById('gearVal');
    if(gearEl) gearEl.innerText = currentGearDisplay;

    // RENDERELÉS ZOOMMAL
    ctx.fillStyle = '#2b5c23'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height); // Háttér
    
    ctx.save();
    
    // Képernyő távolítása
    ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
    
    // Kamera pozícionálása (figyelembe véve a léptéket!)
    let camX = (canvas.width / 2) / CAMERA_ZOOM - player.x;
    let camY = (canvas.height / 2) / CAMERA_ZOOM - player.y;
    ctx.translate(camX, camY);

    drawCircuit();

    // Ellenfél és saját autó rajzolása
    for (let id in gameData) {
        if (id !== myId) {
            let p = gameData[id];
            drawF1Car(ctx, p.x, p.y, p.angle, p.color, p.name);
        }
    }
    drawF1Car(ctx, player.x, player.y, player.angle, player.color, player.name);
    
    ctx.restore();
}