// ============== TILE COUNT UPDATES ==============
function updateTileCountLabels() {
    const widthPx = parseInt(document.getElementById('widthPx').value) || 1280;
    const heightPx = parseInt(document.getElementById('heightPx').value) || 640;
    const cs = parseInt(document.getElementById('cellSizeInput').value) || 128;
    
    const tilesX = Math.floor(widthPx / cs);
    const tilesY = Math.floor(heightPx / cs);
    
    document.getElementById('tilesXLabel').textContent = `= ${tilesX} tiles`;
    document.getElementById('tilesYLabel').textContent = `= ${tilesY} tiles`;
}

// ============== GRID GENERATION ==============
function generateGrid() {
    const widthPx = parseInt(document.getElementById('widthPx').value) || 1280;
    const heightPx = parseInt(document.getElementById('heightPx').value) || 640;
    cellSize = parseInt(document.getElementById('cellSizeInput').value) || 128;
    
    // Calculate number of cells from pixel dimensions
    const w = Math.floor(widthPx / cellSize);
    const h = Math.floor(heightPx / cellSize);
    
    if (w < 1 || h < 1) {
        showInfo('Map dimensions too small for the cell size.');
        return;
    }
    
    const scale = parseFloat(document.getElementById('scale').value);
    const octaves = parseInt(document.getElementById('octaves').value);
    const persistence = parseFloat(document.getElementById('persistence').value);
    const lacunarity = parseFloat(document.getElementById('lacunarity').value);

    simplex = new SimplexNoise();
    grid = [];
    roads = [];
    houses = [];
    rocks = [];
    flowfieldOverlay = null;
    trees = [];
    roadIdCounter = 1;
    houseGroupIdCounter = 1;
    rockGroupIdCounter = 1;
    treeGroupIdCounter = 1;

    for (let y = 0; y < h; y++) {
        grid[y] = [];
        for (let x = 0; x < w; x++) {
            let noise = 0;
            let amplitude = 1;
            let frequency = scale;
            let maxValue = 0;

            for (let i = 0; i < octaves; i++) {
                noise += simplex.noise(x * frequency, y * frequency) * amplitude;
                maxValue += amplitude;
                amplitude *= persistence;
                frequency *= lacunarity;
            }

            if (maxValue === 0) maxValue = 1;
            noise = noise / maxValue;
            const normalizedNoise = (noise + 1) / 2;

            grid[y][x] = {
                noise: normalizedNoise,
                isPassable: normalizedNoise >= MIN_PASSABLE && normalizedNoise <= MAX_PASSABLE,
                isWater: normalizedNoise < WATER_THRESHOLD,
                roadIds: [],
                sidewalkRoadIds: [],
                houses: [],
                rocks: [],
                trees: []
            };
        }
    }

    updateTileCountLabels();
    updateUI();
    drawGrid();
    fitToView();
    showInfo(`Terrain generated: ${w}x${h} tiles (${widthPx}x${heightPx}px). Enable road mode to create roads.`);
}

// ============== COLORS ==============
function getTerrainColor(value) {
    // Sort by depth descending - higher depth materials override lower ones
    const sortedMaterials = [...materialDefinitions].sort((a, b) => b.depth - a.depth);
    
    for (const mat of sortedMaterials) {
        if (value >= mat.minAltitude && value < mat.maxAltitude) {
            return mat.color;
        }
    }
    if (value < MIN_PASSABLE) return '#0a1f2e';
    if (value > MAX_PASSABLE) return '#4a4a4a';
    if (value < 0.3) return '#1a4d2e';
    if (value < 0.6) return '#8B4513';
    return '#90EE90';
}
