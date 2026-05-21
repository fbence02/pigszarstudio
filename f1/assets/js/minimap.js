// --- MINIMAP RENDSZER ---

const minimapConfig = {
    size: 220, // minimap szélessége és magassága pixelben
    padding: 15, // belső margó
    margin: 20, // képernyő szélétől való távolság
    bgColor: 'rgba(0, 0, 0, 0.65)',
    trackColor: 'rgba(255, 255, 255, 0.4)',
    trackOutlineColor: 'rgba(0, 0, 0, 0.8)',
    trackLineWidth: 6,
};

let minimapBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0, scale: 0 };

function calculateMinimapBounds() {
    if (!track || track.length === 0) return;
    
    minimapBounds.minX = Infinity;
    minimapBounds.maxX = -Infinity;
    minimapBounds.minY = Infinity;
    minimapBounds.maxY = -Infinity;

    for (let p of track) {
        if (p.x < minimapBounds.minX) minimapBounds.minX = p.x;
        if (p.x > minimapBounds.maxX) minimapBounds.maxX = p.x;
        if (p.y < minimapBounds.minY) minimapBounds.minY = p.y;
        if (p.y > minimapBounds.maxY) minimapBounds.maxY = p.y;
    }

    const trackWidthPx = minimapBounds.maxX - minimapBounds.minX;
    const trackHeightPx = minimapBounds.maxY - minimapBounds.minY;
    
    const availableSize = minimapConfig.size - minimapConfig.padding * 2;
    // Elkerüljük a nullával való osztást, ha esetleg nincs rendes kiterjedése a pályának
    if (trackWidthPx === 0 || trackHeightPx === 0) {
        minimapBounds.scale = 1;
        return;
    }
    minimapBounds.scale = Math.min(availableSize / trackWidthPx, availableSize / trackHeightPx);
}

function drawMinimap(ctx) {
    if (!track || track.length < 2) return;
    // Ha még nincs kiszámolva a skálázás, számoljuk újra (így új pálya esetén is működik)
    if (minimapBounds.scale === 0 && track.length > 0) {
        calculateMinimapBounds();
    }

    ctx.save();
    
    // Jobb alsó sarok pozicionálása
    const startX = ctx.canvas.width - minimapConfig.size - minimapConfig.margin;
    const startY = ctx.canvas.height - minimapConfig.size - minimapConfig.margin;

    // Háttér rajzolása
    ctx.fillStyle = minimapConfig.bgColor;
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(startX, startY, minimapConfig.size, minimapConfig.size, 12);
    } else {
        ctx.rect(startX, startY, minimapConfig.size, minimapConfig.size);
    }
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#444';
    ctx.stroke();

    // Segédfüggvény a játéktér koordinátáinak minimapra konvertálásához
    const mapX = (x) => startX + minimapConfig.padding + (x - minimapBounds.minX) * minimapBounds.scale + ((minimapConfig.size - minimapConfig.padding * 2) - (minimapBounds.maxX - minimapBounds.minX) * minimapBounds.scale) / 2;
    const mapY = (y) => startY + minimapConfig.padding + (y - minimapBounds.minY) * minimapBounds.scale + ((minimapConfig.size - minimapConfig.padding * 2) - (minimapBounds.maxY - minimapBounds.minY) * minimapBounds.scale) / 2;

    // Pálya rajzolása (Körvonal + Belső rész)
    ctx.beginPath();
    ctx.moveTo(mapX(track[0].x), mapY(track[0].y));
    for (let i = 1; i < track.length; i++) {
        ctx.lineTo(mapX(track[i].x), mapY(track[i].y));
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    ctx.strokeStyle = minimapConfig.trackOutlineColor;
    ctx.lineWidth = minimapConfig.trackLineWidth + 2;
    ctx.stroke();
    
    ctx.strokeStyle = minimapConfig.trackColor;
    ctx.lineWidth = minimapConfig.trackLineWidth;
    ctx.stroke();

    // Célvonal (Start/Finish) megjelölése
    const finishX = mapX(track[0].x);
    const finishY = mapY(track[0].y);
    
    ctx.fillStyle = '#fff';
    ctx.fillRect(finishX - 4, finishY - 4, 8, 8);
    ctx.fillStyle = '#000';
    ctx.fillRect(finishX - 4, finishY - 4, 4, 4);
    ctx.fillRect(finishX, finishY, 4, 4);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(finishX - 5, finishY - 5, 10, 10);

    // Többi játékos rajzolása
    for (let id in gameData) {
        if (id !== myId) {
            let p = gameData[id];
            ctx.fillStyle = p.color || '#aaa';
            ctx.beginPath();
            ctx.arc(mapX(p.x), mapY(p.y), 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#000';
            ctx.stroke();
        }
    }

    // Lokális játékos rajzolása (Kiemelt, nagyobb méretű + irányjelző)
    const px = mapX(player.x);
    const py = mapY(player.y);
    
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(player.angle) * 12, py + Math.sin(player.angle) * 12);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    
    ctx.fillStyle = player.color || '#0f0';
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff'; // Fehér keret, hogy jobban kitűnjön
    ctx.stroke();

    ctx.restore();
}