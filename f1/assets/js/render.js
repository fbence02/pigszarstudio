// --- KIRAJZOLÁS ÉS EFFEKTEK ---
let particles = [];

function createImpactParticles(x, y, normal) {
    for (let i = 0; i < 25; i++) {
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

function drawF1Car(ctx, x, y, angle, color, name) {
    ctx.save();
    ctx.translate(x, y);

    ctx.save();
    ctx.rotate(cameraAngle + Math.PI / 2); // Játékosok nevének vízszintesen tartása
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#000';
    ctx.fillText(name, 0, -45);
    ctx.restore();

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

function drawScene() {
    ctx.fillStyle = '#2b5c23';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    let followX = player.x, followY = player.y;
    if (player.finished) {
        // Spectate an active player
        for (let id in gameData) {
            if (id !== myId && !gameData[id].finished) {
                followX = gameData[id].x;
                followY = gameData[id].y;
                break;
            }
        }
    }
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
    ctx.rotate(-cameraAngle - Math.PI / 2);
    ctx.translate(-followX, -followY);

    drawCircuit();
    drawParticles(ctx, 1);
    for (let id in gameData) {
        if (id !== myId) {
            const p = gameData[id];
            drawF1Car(ctx, p.x, p.y, p.angle, p.color, p.name);
        }
    }
    drawF1Car(ctx, player.x, player.y, player.angle, player.color, player.name);
    ctx.restore();
}

function drawCircuit() {
    if (!track || track.length < 2) return;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath(); ctx.moveTo(track[0].x, track[0].y);
    for (let i = 1; i < track.length; i++) ctx.lineTo(track[i].x, track[i].y);
    ctx.lineWidth = trackWidth + 400; ctx.strokeStyle = '#111'; ctx.stroke();

    ctx.beginPath(); ctx.moveTo(track[0].x, track[0].y);
    for (let i = 1; i < track.length; i++) ctx.lineTo(track[i].x, track[i].y);
    ctx.lineWidth = trackWidth + 360; ctx.strokeStyle = '#3498db'; ctx.stroke();

    ctx.beginPath(); ctx.moveTo(track[0].x, track[0].y);
    for (let i = 1; i < track.length; i++) ctx.lineTo(track[i].x, track[i].y);
    ctx.lineWidth = trackWidth + 40; ctx.strokeStyle = '#fff'; ctx.stroke();

    ctx.beginPath(); ctx.moveTo(track[0].x, track[0].y);
    for (let i = 1; i < track.length; i++) ctx.lineTo(track[i].x, track[i].y);
    ctx.lineWidth = trackWidth + 40;
    ctx.strokeStyle = '#e10600';

    ctx.lineCap = 'butt';
    ctx.setLineDash([60, 60]);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.lineCap = 'round';

    ctx.beginPath(); ctx.moveTo(track[0].x, track[0].y);
    for (let i = 1; i < track.length; i++) ctx.lineTo(track[i].x, track[i].y);
    ctx.lineWidth = trackWidth; ctx.strokeStyle = '#444'; ctx.stroke();

    ctx.save();
    ctx.translate(track[0].x, track[0].y);
    let dx = track[1].x - track[0].x; let dy = track[1].y - track[0].y;
    ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = '#fff';
    for (let i = -trackWidth / 2; i < trackWidth / 2; i += 30) {
        ctx.fillRect(0, i, 15, 15); ctx.fillRect(15, i + 15, 15, 15);
    }
    ctx.restore();
}
