// Map Initialization and Global State
const map = L.map('map').setView([47.5316, 21.6273], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
let allStops = [];
let currentFilters = {
    accessible: false,
    sheltered: false,
    problematic: false,
    heatEmergency: false
};
let heatThreshold = 30;
let currentSort = 'asc';

// Utility Functions
function getColor(score) {
    if (score >= 60) return '#2ed573';
    if (score >= 33) return '#ffa502';
    return '#ff4757';
}

// Score Calculation Logic
function calculateRating(stop) {
    let infraScore = 0;
    if (stop["Covered"] === "Yes") infraScore += 15;
    if (stop["Wheelchair accessible"] === "Yes") infraScore += 15;
    if (stop["Lightning"] === "Yes") infraScore += 5;
    if (stop["Bus bay available"] === "Yes") infraScore += 5;

    let spaces = parseInt(stop["Spaces available"]) || 0;
    let comfortScore = 20 * (1 - Math.exp(-0.15 * spaces));

    let trees = parseInt(stop["Vegetation"]) || 0;
    let vegetationScore = 15 * (1 - Math.exp(-0.3 * trees));

    let temp = parseFloat(stop["Temperature"]) || 25;
    let humidity = parseFloat(stop["Humidity"]) || 50;
    let climateScore = 25;

    if (temp > 25) {
        let discomfort = (temp - 25) * (1 + (humidity / 100));
        let penalty = 1.5 * Math.pow(discomfort, 1.2);
        climateScore = Math.max(0, 25 - penalty);
    }

    let totalScore = infraScore + comfortScore + vegetationScore + climateScore;
    return Math.min(100, Math.max(0, Math.round(totalScore)));
}

// UI and Controls Initialization
function initControls(jsonData) {
    const listParent = document.querySelector('#bus-stop-list');

    if (listParent && !document.querySelector('#controls-container')) {
        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'controls-container';
        controlsContainer.style.marginBottom = '15px';
        controlsContainer.style.display = 'flex';
        controlsContainer.style.flexDirection = 'column';
        controlsContainer.style.gap = '10px';
        controlsContainer.style.backgroundColor = 'rgba(0,0,0,0.2)';
        controlsContainer.style.padding = '15px';
        controlsContainer.style.borderRadius = '8px';

        controlsContainer.innerHTML = `
            <div id="stats-panel" style="display: flex; gap: 10px; margin-bottom: 15px; width: 100%;"></div>

            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <span style="font-weight: bold; font-size: 1.1rem; color: #fff;">Basic Filters:</span>
                    <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                        <label style="color: #fff; display: flex; align-items: center; cursor: pointer;"><input type="checkbox" id="filter-accessible" style="margin-right: 5px;"> Wheelchair Accessible</label>
                        <label style="color: #fff; display: flex; align-items: center; cursor: pointer;"><input type="checkbox" id="filter-sheltered" style="margin-right: 5px;"> Sheltered</label>
                        <label style="color: #fff; display: flex; align-items: center; cursor: pointer;"><input type="checkbox" id="filter-problematic" style="margin-right: 5px;"> Has Issues</label>
                    </div>
                </div>
                <div style="display: flex; align-items: center;">
                    <label for="sort-select" style="margin-right: 10px; font-weight: bold; font-size: 1.1rem; color: #fff;">Sort by:</label>
                    <select id="sort-select" style="padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.2); background: rgba(0, 0, 0, 0.5); color: #fff; cursor: pointer; outline: none;">
                        <option value="asc">Score (Ascending)</option>
                        <option value="desc">Score (Descending)</option>
                        <option value="name_asc">Name (A-Z)</option>
                        <option value="name_desc">Name (Z-A)</option>
                    </select>
                </div>
            </div>

            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.2);">
                <label style="color: #ff4757; font-weight: bold; display: flex; align-items: center; cursor: pointer; font-size: 1.1rem;">
                    <input type="checkbox" id="filter-heatwave" style="margin-right: 10px; width: 18px; height: 18px;">
                    🚨 ENABLE HEATWAVE EMERGENCY MODE 🚨
                </label>
                
                <div id="heatwave-controls" style="display: none; margin-top: 10px; align-items: center; gap: 10px; background: rgba(255, 71, 87, 0.1); padding: 10px; border-radius: 6px;">
                    <span style="color: #fff;">Critical threshold:</span>
                    <input type="range" id="heat-slider" min="20" max="45" value="30" style="flex-grow: 1; cursor: pointer;">
                    <span id="heat-value" style="color: #ff4757; font-weight: bold; font-size: 1.2rem;">30°C</span>
                </div>
            </div>
        `;

        const ul = listParent.querySelector('ul');
        listParent.insertBefore(controlsContainer, ul);

        document.getElementById('filter-accessible').addEventListener('change', (e) => { currentFilters.accessible = e.target.checked; applyFiltersAndRender(); });
        document.getElementById('filter-sheltered').addEventListener('change', (e) => { currentFilters.sheltered = e.target.checked; applyFiltersAndRender(); });
        document.getElementById('filter-problematic').addEventListener('change', (e) => { currentFilters.problematic = e.target.checked; applyFiltersAndRender(); });
        document.getElementById('sort-select').addEventListener('change', (e) => { currentSort = e.target.value; applyFiltersAndRender(); });

        const heatFilter = document.getElementById('filter-heatwave');
        const heatControls = document.getElementById('heatwave-controls');
        const heatSlider = document.getElementById('heat-slider');
        const heatValue = document.getElementById('heat-value');

        heatFilter.addEventListener('change', (e) => {
            currentFilters.heatEmergency = e.target.checked;
            heatControls.style.display = e.target.checked ? 'flex' : 'none';
            applyFiltersAndRender();
        });

        heatSlider.addEventListener('input', (e) => {
            heatThreshold = parseInt(e.target.value);
            heatValue.textContent = heatThreshold + '°C';
            if (currentFilters.heatEmergency) {
                applyFiltersAndRender();
            }
        });
    }

    allStops = jsonData.map(stop => {
        const coords = stop["Coordinates"].split(", ");
        return {
            ...stop,
            lat: parseFloat(coords[1]),
            lng: parseFloat(coords[0]),
            score: calculateRating(stop)
        };
    });

    applyFiltersAndRender();
}

// Filtering and Sorting Logic
function applyFiltersAndRender() {
    let filteredStops = [...allStops];

    if (currentFilters.heatEmergency) {
        filteredStops = filteredStops.filter(stop => {
            const temp = parseFloat(stop.Temperature) || 0;
            const trees = parseInt(stop.Vegetation) || 0;
            
            return temp >= heatThreshold && stop["Covered"] === "No" && trees === 0;
        });
    } else {
        if (currentFilters.accessible) filteredStops = filteredStops.filter(stop => stop["Wheelchair accessible"] === "Yes");
        if (currentFilters.sheltered) filteredStops = filteredStops.filter(stop => stop["Covered"] === "Yes");
        if (currentFilters.problematic) filteredStops = filteredStops.filter(stop => stop["Problems"] && stop["Problems"] !== "None" && stop["Problems"] !== "No reported issues" && stop["Problems"] !== "");
    }

    if (currentSort === 'asc') filteredStops.sort((a, b) => a.score - b.score);
    else if (currentSort === 'desc') filteredStops.sort((a, b) => b.score - a.score);
    else if (currentSort === 'name_asc') filteredStops.sort((a, b) => a["Bus stop"].localeCompare(b["Bus stop"], 'en'));
    else if (currentSort === 'name_desc') filteredStops.sort((a, b) => b["Bus stop"].localeCompare(a["Bus stop"], 'en'));

    renderFilteredStops(filteredStops);
}

// Rendering Logic
function renderFilteredStops(stops) {
    updateStats(stops);
    const listContainer = document.querySelector('#bus-stop-list ul');
    listContainer.innerHTML = '';
    markersLayer.clearLayers();

    stops.forEach(stop => {
        const color = getColor(stop.score);
        
        const isHeatEmergency = stop.Temperature >= heatThreshold && 
                                stop["Covered"] === "No" && 
                                (parseInt(stop.Vegetation) || 0) === 0;

        const markerColor = currentFilters.heatEmergency ? '#ff0000' : color;
        const emergencyBadge = currentFilters.heatEmergency ? 
            `<div style="background-color: #ff0000; color: white; padding: 5px; border-radius: 5px; margin-top: 5px; font-weight: bold; text-align: center;">⚠️ CRITICAL HEAT!</div>` 
            : '';

        L.circleMarker([stop.lat, stop.lng], {
            radius: currentFilters.heatEmergency ? 14 : 12,
            fillColor: markerColor,
            color: currentFilters.heatEmergency ? '#000' : '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
        })
        .addTo(markersLayer)
        .bindPopup(`
            <b style="font-size:1.1rem;">${stop["Bus stop"]}</b><br>
            <hr style="margin:5px 0;">
            <b>Index:</b> <span style="color:${color}; font-weight:bold; font-size:1.1rem;">${stop.score}/100</span><br>
            <b>Temperature:</b> ${stop.Temperature} °C<br>
            ${emergencyBadge}
            <i style="display:block; margin-top:8px;">${stop.Problems && stop.Problems !== "No reported issues" && stop.Problems !== "None" ? "Issues: " + stop.Problems : "No reported issues"}</i>
        `);

        const li = document.createElement('li');
        li.style.marginBottom = "15px";
        li.style.padding = "15px";
        li.style.backgroundColor = currentFilters.heatEmergency ? "rgba(255, 0, 0, 0.15)" : "rgba(0,0,0,0.2)";
        li.style.borderRadius = "8px";
        li.style.borderLeft = `6px solid ${markerColor}`;
        li.style.listStyle = "none";
        
        li.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="font-size: 1.1rem;">${stop["Bus stop"]}</strong>
                <span style="background:${markerColor}; color:#fff; padding:3px 8px; border-radius:12px; font-weight:bold; font-size:0.9rem;">
                    ${stop.score}/100
                </span>
            </div>
            ${currentFilters.heatEmergency ? '<div style="color:#ff4757; font-weight:bold; margin-bottom:5px;">⚠️ High health risk! (No shade)</div>' : ''}
            <div style="font-size: 0.85rem; color: #ccc; margin-bottom: 5px;">
                Trees nearby: ${stop.Vegetation} | Temp: ${stop.Temperature}°C
            </div>
        `;
        listContainer.appendChild(li);
    });
}

// Statistics Update Logic
function updateStats(stops) {
    const statsDiv = document.getElementById('stats-panel');
    if (!statsDiv) return;

    const totalStops = stops.length;
    
    const avgScore = totalStops > 0 
        ? Math.round(stops.reduce((sum, stop) => sum + stop.score, 0) / totalStops) 
        : 0;
        
    const accessibleCount = stops.filter(s => s["Wheelchair accessible"] === "Yes").length;
    
    const problematicCount = stops.filter(s => s.Problems && s.Problems !== "No reported issues" && s.Problems !== "None").length;

    statsDiv.innerHTML = `
        <div style="flex: 1; background: rgba(46, 213, 115, 0.15); border-left: 4px solid #2ed573; padding: 10px; border-radius: 4px;">
            <div style="font-size: 0.85rem; color: #ccc; text-transform: uppercase; font-weight: bold;">Average Index</div>
            <div style="font-size: 1.8rem; font-weight: bold; color: #fff;">${avgScore}/100</div>
        </div>
        <div style="flex: 1; background: rgba(55, 162, 235, 0.15); border-left: 4px solid #37a2eb; padding: 10px; border-radius: 4px;">
            <div style="font-size: 0.85rem; color: #ccc; text-transform: uppercase; font-weight: bold;">Accessible</div>
            <div style="font-size: 1.8rem; font-weight: bold; color: #fff;">${accessibleCount} <span style="font-size: 1rem; font-weight: normal; color: #aaa;">stops</span></div>
        </div>
        <div style="flex: 1; background: rgba(255, 71, 87, 0.15); border-left: 4px solid #ff4757; padding: 10px; border-radius: 4px;">
            <div style="font-size: 0.85rem; color: #ccc; text-transform: uppercase; font-weight: bold;">Problematic</div>
            <div style="font-size: 1.8rem; font-weight: bold; color: #fff;">${problematicCount} <span style="font-size: 1rem; font-weight: normal; color: #aaa;">stops</span></div>
        </div>
    `;
}

// Data Fetching and App Initialization
fetch('BusStop.json')
    .then(response => {
        if (!response.ok) throw new Error('Hiba történt a fájl betöltése során (lehet, hogy nem fut a lokális szerver?)');
        return response.json();
    })
    .then(data => {
        if (!data || Object.keys(data).length === 0) {
            console.warn("A JSON fájl üres vagy érvénytelen adatokat tartalmaz.");
            return;
        }
        initControls(data);
    })
    .catch(error => console.error("Hiba a JSON betöltése során:", error));