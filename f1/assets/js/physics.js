// --- FIZIKA ÉS ÜTKÖZÉSVizsgálat ---

function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}
function lerpAngle(a, b, amt) {
    let diff = b - a;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return a + diff * amt;
}

function getTrackDistanceAndNormal(p) {
    let minDist = Infinity;
    let normal = null;
    let closestIndex = 0;
    for (let i = 0; i < track.length - 1; i++) {
        let v = track[i], w = track[i + 1];
        let l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
        let t = l2 === 0 ? 0 : ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        let cx = v.x + t * (w.x - v.x);
        let cy = v.y + t * (w.y - v.y);
        let dx = p.x - cx, dy = p.y - cy;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) { minDist = dist; normal = { x: -dx / dist, y: -dy / dist }; closestIndex = i; }
    }
    if (!normal) normal = { x: 0, y: 1 };
    return { dist: minDist, normal: normal, index: closestIndex };
}

function checkCheckpointProximity(playerPos, checkpointIndex) {
    if (checkpointIndex >= checkpoints.length) return false;
    const cp = checkpoints[checkpointIndex];
    const dx = playerPos.x - cp.x;
    const dy = playerPos.y - cp.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < CHECKPOINT_PROXIMITY;
}

function updatePhysics(ts) {
    for (let id in gameData) {
        if (id !== myId) {
            let p = gameData[id];
            if (p.targetX !== undefined && p.targetY !== undefined) {
                if (Math.abs(p.targetX - p.x) > 500 || Math.abs(p.targetY - p.y) > 500) {
                    p.x = p.targetX;
                    p.y = p.targetY;
                    p.angle = p.targetAngle;
                } else {
                    p.x = lerp(p.x, p.targetX, 0.3 * ts);
                    p.y = lerp(p.y, p.targetY, 0.3 * ts);
                    p.angle = lerpAngle(p.angle, p.targetAngle, 0.3 * ts);
                }
            }
        }
    }

    if (player.finished) return;

    let speedAbs = Math.abs(player.speed);
    let activeGear;

    if (player.speed < -0.5) { activeGear = { id: 'R', min: 0, max: 25, rate: 0.003 }; }
    else if (speedAbs < 12) { activeGear = { id: '1', min: 0, max: 16, rate: 0.0025 }; }
    else if (speedAbs < 22) { activeGear = { id: '2', min: 11, max: 27, rate: 0.0022 }; }
    else if (speedAbs < 32) { activeGear = { id: '3', min: 22, max: 38, rate: 0.002 }; }
    else if (speedAbs < 42) { activeGear = { id: '4', min: 33, max: 49, rate: 0.0017 }; }
    else if (speedAbs < 52) { activeGear = { id: '5', min: 44, max: 60, rate: 0.0012 }; }
    else if (speedAbs < 62) { activeGear = { id: '6', min: 54, max: 66, rate: 0.0009 }; }
    else if (speedAbs < 72) { activeGear = { id: '7', min: 64, max: 74, rate: 0.0007 }; }
    else { activeGear = { id: '8', min: 70, max: 90, rate: 0.0005 }; }

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
        player.speed *= Math.pow(0.995, ts);
    }

    if (player.speed > 90) player.speed = 90;
    if (player.speed < -20) player.speed = -20;

    updateAudio(player.speed, currentRPM);

    if (!player.finished && checkpoints.length > 0) {
        const nextCheckpoint = (player.currentCheckpoint + 1) % checkpoints.length;

        if (checkCheckpointProximity(player, nextCheckpoint) && player.speed > 0.5) {
            player.currentCheckpoint = nextCheckpoint;

            if (nextCheckpoint === 0 && player.currentCheckpoint === 0) {
                const lapTime = Date.now() - player.lapStartTime;
                const finishedLap = player.lap;
                player.lap++;
                player.lapStartTime = Date.now();
                recordLapTime(player.name, player.color, lapTime, finishedLap);

                if (player.lap > totalLaps) {
                    player.finished = true;
                    player.lap = totalLaps;
                    triggerFinish(player.name);
                }
            }
        }
    }
}
