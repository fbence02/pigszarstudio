// Editor State
const editor = {
    points: [],
    selectedPointIndex: -1,
    zoom: 0.8,
    panX: 0,
    panY: 0,
    isDragging: false,
    currentTrackName: '',
    currentLapCount: 3,
    currentFileName: '',
    draggedPointIndex: -1,
    isPanning: false,
    startPanX: 0,
    startPanY: 0,
    referenceImage: null,
    referenceImageX: 0,
    referenceImageY: 0,
    referenceImageScale: 1,
};

const POINT_RADIUS = 120;
const POINT_COLOR = '#0ff';
const POINT_SELECTED_COLOR = '#00ff00';
const POINT_RADIUS_HIT = 240;

// Initialize
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('fileInput');

function resizeCanvas() {
    const container = document.getElementById('editorContainer');
    canvas.width = container.clientWidth - 250; // Minus info panel
    canvas.height = container.clientHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Drawing Functions
function clearCanvas() {
    ctx.fillStyle = '#2b5c23';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function worldToScreen(x, y) {
    return {
        x: (x + editor.panX) * editor.zoom + canvas.width / 2,
        y: (y + editor.panY) * editor.zoom + canvas.height / 2
    };
}

function screenToWorld(x, y) {
    return {
        x: (x - canvas.width / 2) / editor.zoom - editor.panX,
        y: (y - canvas.height / 2) / editor.zoom - editor.panY
    };
}

function drawGrid() {
    ctx.strokeStyle = '#1a4d1a';
    ctx.lineWidth = 1;
    const gridSize = 50;
    
    const startX = Math.floor(-editor.panX * editor.zoom) - (canvas.width / 2);
    const startY = Math.floor(-editor.panY * editor.zoom) - (canvas.height / 2);
    
    for (let x = startX; x < canvas.width; x += gridSize * editor.zoom) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    for (let y = startY; y < canvas.height; y += gridSize * editor.zoom) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawReferenceImage() {
    if (!editor.referenceImage) return;
    
    const screenPos = worldToScreen(editor.referenceImageX, editor.referenceImageY);
    const scaledWidth = editor.referenceImage.width * editor.referenceImageScale * editor.zoom;
    const scaledHeight = editor.referenceImage.height * editor.referenceImageScale * editor.zoom;
    
    ctx.globalAlpha = 0.3;
    ctx.drawImage(
        editor.referenceImage,
        screenPos.x,
        screenPos.y,
        scaledWidth,
        scaledHeight
    );
    ctx.globalAlpha = 1.0;
}

function drawTrack() {
    if (editor.points.length < 2) return;
    
    ctx.strokeStyle = '#e10600';
    ctx.lineWidth = 3 * editor.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    let firstPoint = worldToScreen(editor.points[0].x, editor.points[0].y);
    ctx.moveTo(firstPoint.x, firstPoint.y);
    
    for (let i = 1; i < editor.points.length; i++) {
        let point = worldToScreen(editor.points[i].x, editor.points[i].y);
        ctx.lineTo(point.x, point.y);
    }
    
    // Close the track
    ctx.lineTo(firstPoint.x, firstPoint.y);
    ctx.stroke();
}

function drawPoints() {
    for (let i = 0; i < editor.points.length; i++) {
        const point = editor.points[i];
        const screenPos = worldToScreen(point.x, point.y);
        
        // Point circle
        ctx.fillStyle = i === editor.selectedPointIndex ? POINT_SELECTED_COLOR : POINT_COLOR;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, POINT_RADIUS * editor.zoom, 0, Math.PI * 2);
        ctx.fill();
        
        // Point index
        ctx.fillStyle = '#000';
        ctx.font = `bold ${10 * editor.zoom}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i + 1, screenPos.x, screenPos.y);
    }
}

function draw() {
    clearCanvas();
    drawGrid();
    drawReferenceImage();
    drawTrack();
    drawPoints();
}

// Canvas Events
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (e.button === 0) { // Left click
        const worldPos = screenToWorld(x, y);
        
        // Check if clicking on existing point
        let clickedPoint = -1;
        for (let i = 0; i < editor.points.length; i++) {
            const screenPos = worldToScreen(editor.points[i].x, editor.points[i].y);
            const distance = Math.hypot(x - screenPos.x, y - screenPos.y);
            if (distance < POINT_RADIUS_HIT * editor.zoom) {
                clickedPoint = i;
                break;
            }
        }
        
        if (clickedPoint !== -1) {
            editor.selectedPointIndex = clickedPoint;
            editor.isDragging = true;
            editor.draggedPointIndex = clickedPoint;
        } else {
            // Place new point
            editor.points.push({ x: worldPos.x, y: worldPos.y });
            editor.selectedPointIndex = editor.points.length - 1;
            editor.isDragging = true;
            editor.draggedPointIndex = editor.selectedPointIndex;
        }
        updateStatus();
    } else if (e.button === 1) { // Middle click - pan
        editor.isPanning = true;
        editor.startPanX = x;
        editor.startPanY = y;
    } else if (e.button === 2) { // Right click - delete
        const worldPos = screenToWorld(x, y);
        
        for (let i = 0; i < editor.points.length; i++) {
            const distance = Math.hypot(
                worldPos.x - editor.points[i].x,
                worldPos.y - editor.points[i].y
            );
            if (distance < POINT_RADIUS_HIT / editor.zoom) {
                editor.points.splice(i, 1);
                if (editor.selectedPointIndex === i) {
                    editor.selectedPointIndex = -1;
                } else if (editor.selectedPointIndex > i) {
                    editor.selectedPointIndex--;
                }
                updateStatus();
                break;
            }
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (editor.isDragging && editor.draggedPointIndex !== -1) {
        const worldPos = screenToWorld(x, y);
        editor.points[editor.draggedPointIndex] = { x: worldPos.x, y: worldPos.y };
    } else if (editor.isPanning) {
        const deltaX = x - editor.startPanX;
        const deltaY = y - editor.startPanY;
        editor.panX += deltaX / editor.zoom;
        editor.panY += deltaY / editor.zoom;
        editor.startPanX = x;
        editor.startPanY = y;
    }
});

canvas.addEventListener('mouseup', () => {
    editor.isDragging = false;
    editor.draggedPointIndex = -1;
    editor.isPanning = false;
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const worldPosBefore = screenToWorld(x, y);
    
    const zoomFactor = e.deltaY > 0 ? 0.85 : 1.15;
    editor.zoom *= zoomFactor;
    editor.zoom = Math.max(0.1, Math.min(6, editor.zoom));
    
    const worldPosAfter = screenToWorld(x, y);
    editor.panX += worldPosBefore.x - worldPosAfter.x;
    editor.panY += worldPosBefore.y - worldPosAfter.y;
    
    updateStatus();
});

// Keyboard events
document.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') {
        if (editor.selectedPointIndex !== -1) {
            editor.points.splice(editor.selectedPointIndex, 1);
            editor.selectedPointIndex = -1;
            updateStatus();
        }
    }
});

// Update UI
function updateStatus() {
    document.getElementById('pointCount').textContent = editor.points.length;
    document.getElementById('selectedPoint').textContent = editor.selectedPointIndex !== -1 ? 
        `Point ${editor.selectedPointIndex + 1}` : 'None';
    document.getElementById('zoomLevel').textContent = Math.round(editor.zoom * 100) + '%';
}

// Animation loop
function gameLoop() {
    draw();
    requestAnimationFrame(gameLoop);
}
gameLoop();
updateStatus();

// ===== TOOLBAR FUNCTIONS =====

// Import Track
document.getElementById('btnImportTrack').addEventListener('click', showImportTrackModal);

async function showImportTrackModal() {
    const trackList = document.getElementById('trackList');
    trackList.innerHTML = '';
    
    try {
        const response = await fetch('./tracks');
        if (response.ok) {
            // If we can read the directory, populate it
            const text = await response.text();
            // Note: This won't work with a simple fetch - we need to load from known files
            loadDefaultTracks();
        } else {
            loadDefaultTracks();
        }
    } catch {
        loadDefaultTracks();
    }
    
    document.getElementById('importTrackModal').classList.add('active');
}

async function loadDefaultTracks() {
    const trackList = document.getElementById('trackList');
    const trackNames = ['track-1']; // You can expand this list
    
    // Try to load all possible tracks
    for (let i = 1; i <= 10; i++) {
        try {
            const response = await fetch(`./tracks/track-${i}.json`);
            if (response.ok) {
                const item = document.createElement('div');
                item.className = 'track-item';
                item.textContent = `track-${i}`;
                item.dataset.fileName = `track-${i}`;
                
                item.addEventListener('click', () => selectTrack(item, `track-${i}`));
                trackList.appendChild(item);
            }
        } catch (e) {
            // Track doesn't exist, continue
        }
    }
    
    // Also check the old naming conventions
    try {
        const response = await fetch(`./tracks/trackAlpha.json`);
        if (response.ok) {
            const item = document.createElement('div');
            item.className = 'track-item';
            item.textContent = 'trackAlpha';
            item.dataset.fileName = 'trackAlpha';
            
            item.addEventListener('click', () => selectTrack(item, 'trackAlpha'));
            trackList.appendChild(item);
        }
    } catch (e) {}
    
    try {
        const response = await fetch(`./tracks/trackSecond.json`);
        if (response.ok) {
            const item = document.createElement('div');
            item.className = 'track-item';
            item.textContent = 'trackSecond';
            item.dataset.fileName = 'trackSecond';
            
            item.addEventListener('click', () => selectTrack(item, 'trackSecond'));
            trackList.appendChild(item);
        }
    } catch (e) {}
}

async function selectTrack(element, fileName) {
    // Remove previous selection
    document.querySelectorAll('.track-item').forEach(item => item.classList.remove('selected'));
    element.classList.add('selected');
    
    // Load track info
    try {
        const path = `./tracks/${fileName}.json`;
        const response = await fetch(path);
        const trackData = await response.json();
        
        const trackInfo = document.getElementById('trackInfo');
        const pointCount = Array.isArray(trackData) ? trackData.length : trackData.points.length;
        const lapCount = trackData.laps || 3;
        const trackName = trackData.name || trackData.trackName || fileName;
        
        trackInfo.innerHTML = `
            <div class="track-info-content">
                <div class="track-info-item">
                    <strong>Track Name</strong>
                    ${trackName}
                </div>
                <div class="track-info-item">
                    <strong>File</strong>
                    ${fileName}.json
                </div>
                <div class="track-info-item">
                    <strong>Points</strong>
                    ${pointCount}
                </div>
                <div class="track-info-item">
                    <strong>Laps</strong>
                    ${lapCount}
                </div>
            </div>
        `;
        
        document.getElementById('openTrack').disabled = false;
        document.getElementById('openTrack').dataset.fileName = fileName;
    } catch (error) {
        console.error('Error loading track:', error);
    }
}

document.getElementById('openTrack').addEventListener('click', async () => {
    const fileName = document.getElementById('openTrack').dataset.fileName;
    if (!fileName) return;
    
    try {
        const path = `./tracks/${fileName}.json`;
        const response = await fetch(path);
        const trackData = await response.json();
        
        // Load track points
        if (Array.isArray(trackData)) {
            editor.points = trackData.map(p => ({ x: p.x, y: p.y }));
        } else if (trackData.points) {
            editor.points = trackData.points.map(p => ({ x: p.x, y: p.y }));
        }
        
        editor.currentTrackName = trackData.name || trackData.trackName || '';
        editor.currentLapCount = trackData.laps || 3;
        editor.currentFileName = fileName;
        
        // Reset view
        if (editor.points.length > 0) {
            const minX = Math.min(...editor.points.map(p => p.x));
            const maxX = Math.max(...editor.points.map(p => p.x));
            const minY = Math.min(...editor.points.map(p => p.y));
            const maxY = Math.max(...editor.points.map(p => p.y));
            
            const width = maxX - minX;
            const height = maxY - minY;
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            
            const padding = 50;
            const scaleX = (canvas.width - 500) / (width + padding * 2);
            const scaleY = (canvas.height - 100) / (height + padding * 2);
            
            editor.zoom = Math.min(scaleX, scaleY, 1);
            editor.panX = -centerX;
            editor.panY = -centerY;
        }
        
        editor.selectedPointIndex = -1;
        updateStatus();
        document.getElementById('importTrackModal').classList.remove('active');
    } catch (error) {
        console.error('Error importing track:', error);
        alert('Failed to import track');
    }
});

document.getElementById('closeImportTrack').addEventListener('click', () => {
    document.getElementById('importTrackModal').classList.remove('active');
});

document.getElementById('cancelImport').addEventListener('click', () => {
    document.getElementById('importTrackModal').classList.remove('active');
});

// Import Reference Image
document.getElementById('btnImportImage').addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                editor.referenceImage = img;
                editor.referenceImageX = 0;
                editor.referenceImageY = 0;
                editor.referenceImageScale = 1;
                updateStatus();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Handle reference image scaling with modifier keys
canvas.addEventListener('wheel', (e) => {
    if (e.ctrlKey && editor.referenceImage) {
        e.preventDefault();
        const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
        editor.referenceImageScale *= scaleFactor;
        editor.referenceImageScale = Math.max(0.1, Math.min(5, editor.referenceImageScale));
    }
});

// Reference image dragging (Shift + Middle Mouse)
let isDraggingRefImage = false;
let refImageStartX = 0;
let refImageStartY = 0;

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 && e.shiftKey && editor.referenceImage) {
        isDraggingRefImage = true;
        const rect = canvas.getBoundingClientRect();
        refImageStartX = e.clientX - rect.left;
        refImageStartY = e.clientY - rect.top;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isDraggingRefImage) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const deltaX = x - refImageStartX;
        const deltaY = y - refImageStartY;
        
        editor.referenceImageX += deltaX / editor.zoom;
        editor.referenceImageY += deltaY / editor.zoom;
        
        refImageStartX = x;
        refImageStartY = y;
    }
});

canvas.addEventListener('mouseup', () => {
    isDraggingRefImage = false;
});

// Export Track
document.getElementById('btnSave').addEventListener('click', () => {
    if (editor.points.length === 0) {
        alert('No points to save!');
        return;
    }
    
    document.getElementById('trackName').value = editor.currentTrackName || '';
    document.getElementById('lapCount').value = editor.currentLapCount || '3';
    document.getElementById('referenceImageWarning').innerHTML = editor.referenceImage ? 
        '<strong style="color: #ff9800;">⚠ Reference image will not be saved</strong>' : '';
    document.getElementById('exportModal').classList.add('active');
});

document.getElementById('saveTrack').addEventListener('click', async () => {
    const trackName = document.getElementById('trackName').value.trim() || editor.currentTrackName;
    const lapCount = parseInt(document.getElementById('lapCount').value) || editor.currentLapCount;
    
    if (!trackName) {
        alert('Please enter a track name');
        return;
    }
    
    if (isNaN(lapCount) || lapCount < 1) {
        alert('Please enter a valid lap count');
        return;
    }
    
    // Create track data
    const trackData = {
        name: trackName,
        laps: lapCount,
        points: editor.points
    };
    
    // Generate filename
    const fileName = trackName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'track';
    
    try {
        if (window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({
                suggestedName: `${fileName}.json`,
                types: [{
                    description: 'Track JSON',
                    accept: { 'application/json': ['.json'] }
                }]
            });
            const writable = await handle.createWritable();
            await writable.write(JSON.stringify(trackData, null, 2));
            await writable.close();
            alert(`Track saved as ${fileName}.json`);
        } else {
            const dataStr = JSON.stringify(trackData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${fileName}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            alert(`Track saved as ${fileName}.json\n\nPlace it in the tracks/ folder.`);
        }
        editor.currentTrackName = trackName;
        editor.currentLapCount = lapCount;
        document.getElementById('exportModal').classList.remove('active');
    } catch (error) {
        console.error('Error saving track:', error);
        alert('Unable to save track. Please ensure your browser supports file saving.');
    }
});

document.getElementById('closeExport').addEventListener('click', () => {
    document.getElementById('exportModal').classList.remove('active');
});

document.getElementById('cancelExport').addEventListener('click', () => {
    document.getElementById('exportModal').classList.remove('active');
});

// Back Button
document.getElementById('btnBack').addEventListener('click', () => {
    if (editor.points.length > 0) {
        document.getElementById('unsavedWarningModal').classList.add('active');
    } else {
        window.location.href = './index.html';
    }
});

document.getElementById('cancelLeave').addEventListener('click', () => {
    document.getElementById('unsavedWarningModal').classList.remove('active');
});

document.getElementById('confirmLeave').addEventListener('click', () => {
    window.location.href = './index.html';
});
