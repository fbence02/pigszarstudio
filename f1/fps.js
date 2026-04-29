// --- BELSŐ NÉZET (FPS) MOTOR ---
window.isFpsMode = false;
let fpsTrack = [];
const FOV = 600; 
const CAMERA_HEIGHT = 100;

// Gombnyomás érzékelése
window.addEventListener('keydown', e => {
    if (e.code === 'KeyF') {
        window.isFpsMode = !window.isFpsMode;
    }
});

// A 2D pálya előkészítése a 3D rajzoláshoz
window.initFpsTrack = function(track) {
    fpsTrack = [];
    for (let i = 0; i < track.length; i++) {
        let p = track[i];
        let next = track[(i + 1) % track.length];
        let dx = next.x - p.x;
        let dy = next.y - p.y;
        let len = Math.sqrt(dx * dx + dy * dy);
        // Normálvektorok a pálya szélének kiszámításához
        fpsTrack.push({ x: p.x, y: p.y, nx: -dy / len, ny: dx / len, index: i });
    }
};

// 3D tér leképezése 2D képernyőre
function project3D(x, y, cx, cy, cangle, horizonY, canvas) {
    // A kamerát egy picit "hátrahúzzuk", hogy ne legyen lyukas a képernyő alja
    let pullBackDist = 200; 
    let camX = cx - Math.cos(cangle) * pullBackDist;
    let camY = cy - Math.sin(cangle) * pullBackDist;
    
    let tx = x - camX;
    let ty = y - camY;
    let cosA = Math.cos(cangle);
    let sinA = Math.sin(cangle);
    
    // Forgatás a kamera nézőpontjába
    let z = tx * cosA + ty * sinA; 
    let sx = tx * (-sinA) + ty * cosA; 
    
    if (z < 1) return null; // A kamera mögötti dolgokat nem rajzoljuk
    
    let scale = FOV / z;
    return {
        x: canvas.width / 2 + sx * scale,
        y: horizonY + CAMERA_HEIGHT * scale,
        z: z,
        scale: scale
    };
}

function drawTrapezoid(ctx, p1L, p1R, p2L, p2R, color) {
    if (!p1L || !p1R || !p2L || !p2R) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(p1L.x, p1L.y); ctx.lineTo(p1R.x, p1R.y);
    ctx.lineTo(p2R.x, p2R.y); ctx.lineTo(p2L.x, p2L.y);
    ctx.fill();
}

window.drawFpsView = function(ctx, canvas, player, trackWidth, gameData, myId) {
    if (fpsTrack.length === 0) return;
    let horizonY = canvas.height / 2 - 20;

    // 1. Égbolt és Föld rajzolása
    ctx.fillStyle = '#87CEEB'; ctx.fillRect(0, 0, canvas.width, horizonY);
    ctx.fillStyle = '#2b5c23'; ctx.fillRect(0, horizonY, canvas.width, canvas.height - horizonY);

    // 2. Megkeressük, hol van a játékos a pályán
    let minDist = Infinity, closestIdx = 0;
    for (let i = 0; i < fpsTrack.length; i++) {
        let dx = fpsTrack[i].x - player.x, dy = fpsTrack[i].y - player.y;
        let dist = dx * dx + dy * dy;
        if (dist < minDist) { minDist = dist; closestIdx = i; }
    }

    // 3. Haladási irány meghatározása
    let p1 = fpsTrack[closestIdx];
    let p2 = fpsTrack[(closestIdx + 1) % fpsTrack.length];
    let trackDirX = p2.x - p1.x, trackDirY = p2.y - p1.y;
    let dir = (Math.cos(player.angle) * trackDirX + Math.sin(player.angle) * trackDirY) > 0 ? 1 : -1;

    // Kigyűjtjük az előttünk lévő 70 útszakaszt
    let segments = [];
    for (let i = 0; i < 70; i++) {
        segments.push(fpsTrack[(closestIdx + i * dir + fpsTrack.length) % fpsTrack.length]);
    }

    // 4. Útszakaszok rajzolása hátulról előrefelé (Painter's algorithm)
    let rw = trackWidth / 2, cw = rw + 30, gw = cw + 180;

    for (let i = segments.length - 2; i >= 0; i--) {
        let s1 = segments[i], s2 = segments[i + 1];

        // Bal és Jobb oldali pontok 3D vetítése
        let p1_GL = project3D(s1.x + s1.nx*gw, s1.y + s1.ny*gw, player.x, player.y, player.angle, horizonY, canvas);
        let p1_GR = project3D(s1.x - s1.nx*gw, s1.y - s1.ny*gw, player.x, player.y, player.angle, horizonY, canvas);
        let p1_CL = project3D(s1.x + s1.nx*cw, s1.y + s1.ny*cw, player.x, player.y, player.angle, horizonY, canvas);
        let p1_CR = project3D(s1.x - s1.nx*cw, s1.y - s1.ny*cw, player.x, player.y, player.angle, horizonY, canvas);
        let p1_RL = project3D(s1.x + s1.nx*rw, s1.y + s1.ny*rw, player.x, player.y, player.angle, horizonY, canvas);
        let p1_RR = project3D(s1.x - s1.nx*rw, s1.y - s1.ny*rw, player.x, player.y, player.angle, horizonY, canvas);

        let p2_GL = project3D(s2.x + s2.nx*gw, s2.y + s2.ny*gw, player.x, player.y, player.angle, horizonY, canvas);
        let p2_GR = project3D(s2.x - s2.nx*gw, s2.y - s2.ny*gw, player.x, player.y, player.angle, horizonY, canvas);
        let p2_CL = project3D(s2.x + s2.nx*cw, s2.y + s2.ny*cw, player.x, player.y, player.angle, horizonY, canvas);
        let p2_CR = project3D(s2.x - s2.nx*cw, s2.y - s2.ny*cw, player.x, player.y, player.angle, horizonY, canvas);
        let p2_RL = project3D(s2.x + s2.nx*rw, s2.y + s2.ny*rw, player.x, player.y, player.angle, horizonY, canvas);
        let p2_RR = project3D(s2.x - s2.nx*rw, s2.y - s2.ny*rw, player.x, player.y, player.angle, horizonY, canvas);

        // Csíkozás a sebességérzetért (Alternáló színek)
        let colorMod = (s1.index % 6 < 3);
        drawTrapezoid(ctx, p1_GL, p1_CL, p2_GL, p2_CL, '#c4aa62'); // Bal sóder
        drawTrapezoid(ctx, p1_CR, p1_GR, p2_CR, p2_GR, '#c4aa62'); // Jobb sóder
        drawTrapezoid(ctx, p1_CL, p1_RL, p2_CL, p2_RL, colorMod ? '#e10600' : '#fff'); // Bal rázókő
        drawTrapezoid(ctx, p1_RR, p1_CR, p2_RR, p2_CR, colorMod ? '#e10600' : '#fff'); // Jobb rázókő
        drawTrapezoid(ctx, p1_RL, p1_RR, p2_RL, p2_RR, colorMod ? '#444' : '#555'); // Aszfalt
    }

    // 5. Ellenfelek rajzolása a 3D térbe
    let playersToDraw = [];
    for (let id in gameData) {
        if (id !== myId) {
            let p = gameData[id];
            let proj = project3D(p.x, p.y, player.x, player.y, player.angle, horizonY, canvas);
            if (proj && proj.z > 10) playersToDraw.push({ p: p, proj: proj });
        }
    }
    // Z-index alapján rendezés (Távolabbiakat rajzoljuk előbb)
    playersToDraw.sort((a, b) => b.proj.z - a.proj.z);
    for (let pd of playersToDraw) {
        drawFpsCar(ctx, pd.proj, pd.p.color, pd.p.name);
    }

    // 6. Saját műszerfal és kormány rajzolása
    drawDashboard(ctx, canvas, player);
};

// Autó billboard rajzoló (2D képek 3D-s térben)
function drawFpsCar(ctx, proj, color, name) {
    let s = proj.scale;
    ctx.save();
    ctx.translate(proj.x, proj.y);
    
    // Árnyék
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 0, 50*s, 15*s, 0, 0, Math.PI*2); ctx.fill();

    // Hátsó kerekek
    ctx.fillStyle = '#111';
    ctx.fillRect(-45*s, -35*s, 20*s, 35*s); ctx.fillRect(25*s, -35*s, 20*s, 35*s);

    // Hátsó szárny és kasztni
    ctx.fillStyle = '#222'; ctx.fillRect(-35*s, -60*s, 70*s, 20*s);
    ctx.fillStyle = color; ctx.fillRect(-20*s, -45*s, 40*s, 30*s);
    
    // Bukósisak
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -50*s, 10*s, 0, Math.PI*2); ctx.fill();

    // Névtábla
    ctx.fillStyle = '#fff'; ctx.font = 'bold ' + (16 * Math.min(s, 2)) + 'px Arial';
    ctx.textAlign = 'center'; ctx.fillText(name, 0, -80*s);
    ctx.restore();
}

function drawDashboard(ctx, canvas, player) {
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height + 80);
    
    // Rázkódás a sebességtől függően
    let vibX = (Math.random() - 0.5) * (player.speed / 15);
    let vibY = (Math.random() - 0.5) * (player.speed / 15);
    
    // Kormány elfordítása (a keys globális objektumból olvassuk)
    let turnAngle = 0;
    if (window.keys.ArrowLeft) turnAngle = -0.3;
    if (window.keys.ArrowRight) turnAngle = 0.3;
    
    ctx.rotate(turnAngle);
    
    // F1 Kormány íve
    ctx.beginPath(); ctx.arc(vibX, -200 + vibY, 150, Math.PI, 0);
    ctx.lineWidth = 35; ctx.lineCap = 'round'; ctx.strokeStyle = '#222'; ctx.stroke();

    // Középső panel
    ctx.beginPath(); ctx.moveTo(-135+vibX, -200+vibY); ctx.lineTo(135+vibX, -200+vibY);
    ctx.lineTo(vibX, -20+vibY); ctx.fillStyle = '#111'; ctx.fill();
    
    // Sebességváltó kijelzője a kormányon!
    ctx.fillStyle = '#0f0'; ctx.font = 'bold 50px Arial'; ctx.textAlign = 'center';
    ctx.fillText(window.currentGearDisplay || '1', vibX, -150+vibY);
    ctx.restore();
}