(function () {
    const defaultSettings = {
        volume: 1.0,
        cameraLock: false,
        particles: true,
        cameraZoom: 0.65,
        minimapSize: 220
    };

    window.gameSettings = { ...defaultSettings };

    function saveSettings() {
        localStorage.setItem('f1GameSettings', JSON.stringify(window.gameSettings));
    }

    function loadSettings() {
        const saved = localStorage.getItem('f1GameSettings');
        if (saved) {
            Object.assign(window.gameSettings, JSON.parse(saved));
        }
    }

    function applySettings() {
        // Volume (targets globalVolume in audio.js)
        if (typeof window.globalVolume !== 'undefined') {
            window.globalVolume = window.gameSettings.volume;
        }

        // Camera Zoom (targets cameraZoom in game.js)
        if (typeof window.cameraZoom !== 'undefined') {
            window.cameraZoom = window.gameSettings.cameraZoom;
        }

        // Minimap méret alkalmazása
        if (typeof minimapConfig !== 'undefined') {
            if (minimapConfig.size !== window.gameSettings.minimapSize) {
                minimapConfig.size = window.gameSettings.minimapSize;
                if (typeof minimapBounds !== 'undefined') minimapBounds.scale = 0; // Skálázás újraszámolása a méretváltozás miatt
            }
        }
    }

    function createMenu() {
        const menuHTML = `
            <h3>Beállítások</h3>
            <div class="setting-item">
                <label for="volume-slider">Hangerő</label>
                <input type="range" id="volume-slider" min="0" max="1" step="0.05">
            </div>
            <div class="setting-item">
                <label for="zoom-slider">Kamera Zoom</label>
                <input type="range" id="zoom-slider" min="0.2" max="1.5" step="0.05">
            </div>
            <div class="setting-item">
                <label for="minimap-slider">Minimap Méret</label>
                <input type="range" id="minimap-slider" min="100" max="400" step="10">
            </div>
            <div class="setting-item">
                <label for="cam-lock-toggle">Fix Kamera</label>
                <label class="toggle-switch">
                    <input type="checkbox" id="cam-lock-toggle">
                    <span class="slider round"></span>
                </label>
            </div>
            <div class="setting-item">
                <label for="particles-toggle">Effektek</label>
                <label class="toggle-switch">
                    <input type="checkbox" id="particles-toggle">
                    <span class="slider round"></span>
                </label>
            </div>
            <div style="margin-top: 15px; border-top: 1px solid #444; padding-top: 15px;">
                <button id="settings-lobby-btn" style="width: 100%; padding: 10px; background: #ff9800; color: #fff; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">Vissza a Lobbyba</button>
            </div>
        `;

        const menu = document.createElement('div');
        menu.id = 'settings-menu';
        menu.innerHTML = menuHTML;

        const button = document.createElement('button');
        button.id = 'settings-btn';
        button.innerHTML = '⚙️';

        // Beállítások gomb áthelyezése a bal alsó sarokba
        button.style.position = 'absolute';
        button.style.bottom = '20px';
        button.style.left = '20px';
        button.style.top = 'auto';
        button.style.right = 'auto';
        button.style.zIndex = '100';

        document.body.appendChild(button);
        document.body.appendChild(menu);

        button.addEventListener('click', () => {
            menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
        });

        const volumeSlider = document.getElementById('volume-slider');
        const zoomSlider = document.getElementById('zoom-slider');
        const minimapSlider = document.getElementById('minimap-slider');
        const camLockToggle = document.getElementById('cam-lock-toggle');
        const particlesToggle = document.getElementById('particles-toggle');

        volumeSlider.value = window.gameSettings.volume;
        zoomSlider.value = window.gameSettings.cameraZoom;
        minimapSlider.value = window.gameSettings.minimapSize;
        camLockToggle.checked = window.gameSettings.cameraLock;
        particlesToggle.checked = window.gameSettings.particles;

        volumeSlider.addEventListener('input', (e) => { window.gameSettings.volume = parseFloat(e.target.value); applySettings(); saveSettings(); });
        zoomSlider.addEventListener('input', (e) => { window.gameSettings.cameraZoom = parseFloat(e.target.value); applySettings(); saveSettings(); });
        minimapSlider.addEventListener('input', (e) => { window.gameSettings.minimapSize = parseInt(e.target.value); applySettings(); saveSettings(); });
        camLockToggle.addEventListener('change', (e) => { window.gameSettings.cameraLock = e.target.checked; applySettings(); saveSettings(); });
        particlesToggle.addEventListener('change', (e) => { window.gameSettings.particles = e.target.checked; applySettings(); saveSettings(); });

        // Lobby gomb eseménykezelője
        const lobbyBtn = document.getElementById('settings-lobby-btn');
        if (lobbyBtn) {
            lobbyBtn.addEventListener('click', () => {
                if (typeof isHost !== 'undefined' && isHost && typeof returnToLobbyHost === 'function') {
                    returnToLobbyHost(); // Ha Host, mindenkit kirak és visszavisz
                } else {
                    if (typeof peer !== 'undefined' && peer) peer.destroy();
                    if (typeof hostConn !== 'undefined' && hostConn) hostConn.close();
                    window.location.href = './lobby.html';
                }
            });
        }
    }

    window.addEventListener('load', () => {
        loadSettings();
        createMenu();
        applySettings();
    });

})();