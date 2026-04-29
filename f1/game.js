const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

// Globális változók
let track = [];
const trackWidth = 400; // Kicsit szélesebb pálya
let gameActive = false;
const MAX_PLAYERS = 10;

// Saját adatok
const player = { x: 0, y: 0, angle: 0, speed: 0, maxSpeed: 40, accel: 0.6, friction: 0.98, turnSpeed: 0.03, color: '#e10600', name: 'Pilóta' };
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

window.addEventListener('keydown', e => { if (keys.hasOwnProperty(e.code)) keys[e.code] = true; });
window.addEventListener('keyup', e => { if (keys.hasOwnProperty(e.code)) keys[e.code] = false; });

// Hálózat
const prefix = "F1PRO-X-";
const genCode = () => Math.random().toString(36).substring(2, 7).toUpperCase();
let myId = genCode();
let peer = null, isHost = false, hostConn = null;
let clients = {}, gameData = {};

// Audio
let audioCtx, engineOsc, engineGain;
let lastCrashTime = 0;

async function loadTrack() {
    try {
        const response = await fetch('track.json');
        track = await response.json();
        console.log("Pálya betöltve:", track.length, "pont");
    } catch (error) {
        alert("Hiba a pálya betöltésekor! Biztosan lokális szerverről futtatod a játékot? (Böngésző letiltja a file:// protokolt)");
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
    engineOsc.frequency.value = 40;
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineOsc.start();
}

function updateAudio(speed) {
    if(!audioCtx) return;
    let absSpeed = Math.abs(speed);
    engineOsc.frequency.setTargetAtTime(40 + absSpeed * 4, audioCtx.currentTime, 0.1);
    engineGain.gain.setTargetAtTime(absSpeed > 1 ? 0.08 : 0.02, audioCtx.currentTime, 0.1);
}

function playCrashSound() {
    if(!audioCtx) return;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
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
            // Kezdeti dummy adatok, amíg nem küldi el a sajátját
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

// SETUP gombok
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
    initPeer(genCode());

    setTimeout(() => { 
        hostConn = peer.connect(prefix + code); 
        hostConn.on('open', () => { 
            document.getElementById('status').innerText = "Várakozás a Hostra..."; 
            // Amint csatlakozunk, küldjük a nevet/színt
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

function startGame() {
    document.getElementById('ui-layer').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    gameActive = true;
    
    // Kezdőpozíció
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
    requestAnimationFrame(gameLoop);
}

// Fizika
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
    if (minDist > (trackWidth / 2) - 20) return collisionNormal;
    return null;
}

function updatePhysics() {
    if (keys.ArrowUp) player.speed += player.accel;
    if (keys.ArrowDown) player.speed -= player.accel * 1.5;
    player.speed *= player.friction;

    if (Math.abs(player.speed) > 1) {
        let turnDir = player.speed > 0 ? 1 : -1;
        let currentTurnSpeed = player.turnSpeed * (1 - (Math.abs(player.speed) / player.maxSpeed) * 0.2);
        if (keys.ArrowLeft) player.angle -= currentTurnSpeed * turnDir;
        if (keys.ArrowRight) player.angle += currentTurnSpeed * turnDir;
    }

    player.x += Math.cos(player.angle) * player.speed;
    player.y += Math.sin(player.angle) * player.speed;

    let hitNormal = checkWallCollision(player);
    if (hitNormal) {
        player.speed *= 0.3; 
        player.x += hitNormal.x * 10; player.y += hitNormal.y * 10;
        if (Math.abs(player.speed) > 2 && Date.now() - lastCrashTime > 300) { playCrashSound(); lastCrashTime = Date.now(); }
    }

    if (player.speed > player.maxSpeed) player.speed = player.maxSpeed;
    if (player.speed < -player.maxSpeed/3) player.speed = -player.maxSpeed/3;
    updateAudio(player.speed);
}

// Render
function drawF1Car(ctx, x, y, angle, color, name) {
    ctx.save();
    ctx.translate(x, y);
    
    // Névtábla rajzolása elforgatás nélkül (hogy mindig vízszintes és olvasható maradjon)
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#000';
    ctx.fillText(name, 0, -40);
    ctx.shadowBlur = 0; // Árnyék reset a kocsinak
    
    ctx.rotate(angle);
    ctx.fillStyle = '#111'; // Kerekek
    ctx.fillRect(15, -22, 15, 8); ctx.fillRect(15, 14, 15, 8); 
    ctx.fillRect(-25, -22, 15, 10); ctx.fillRect(-25, 12, 15, 10);
    ctx.fillStyle = color; // Kasztni
    ctx.beginPath(); ctx.moveTo(35, -5); ctx.lineTo(35, 5); ctx.lineTo(10, 10); ctx.lineTo(-20, 12); 
    ctx.lineTo(-35, 8); ctx.lineTo(-35, -8); ctx.lineTo(-20, -12); ctx.lineTo(10, -10); ctx.fill();
    ctx.fillStyle = '#222'; // Szárnyak
    ctx.fillRect(25, -18, 8, 36); ctx.fillRect(-40, -18, 10, 36);
    ctx.fillStyle = '#000'; // Bukósisak
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
    ctx.setLineDash([60, 60]); ctx.stroke(); ctx.setLineDash([]);

    ctx.beginPath(); ctx.moveTo(track[0].x, track[0].y);
    for(let i=1; i<track.length; i++) ctx.lineTo(track[i].x, track[i].y);
    ctx.lineWidth = trackWidth; ctx.strokeStyle = '#444'; ctx.stroke();

    ctx.save();
    ctx.translate(track[0].x, track[0].y);
    let dx = track[1].x - track[0].x; let dy = track[1].y - track[0].y;
    ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = '#fff';
    for(let i = -trackWidth/2; i < trackWidth/2; i += 20) {
        ctx.fillRect(0, i, 10, 10); ctx.fillRect(10, i+10, 10, 10);
    }
    ctx.restore();
}

function gameLoop() {
    if (!gameActive) return;
    requestAnimationFrame(gameLoop);
    updatePhysics();
    document.getElementById('speedVal').innerText = Math.abs(Math.round(player.speed * 10));

    ctx.fillStyle = '#2b5c23'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    drawCircuit();

    for (let id in gameData) {
        if (id !== myId) {
            let p = gameData[id];
            drawF1Car(ctx, p.x, p.y, p.angle, p.color, p.name);
        }
    }
    drawF1Car(ctx, player.x, player.y, player.angle, player.color, player.name);
    ctx.restore();
}