// ============== TILE COUNT UPDATES ==============
function updateTileCountLabels() {
    const widthPx = parseInt(document.getElementById('widthPx').value) || 1280;
    const heightPx = parseInt(document.getElementById('heightPx').value) || 640;
    const cs = parseInt(document.getElementById('cellSizeInput').value) || 128;
    const previewScale = parseFloat(document.getElementById('renderScaleSelect')?.value) || renderScale;
    const metrics = buildMapMetrics(widthPx, heightPx, cs, previewScale);
    const sizeHint = document.getElementById('mapSizeHint');

    document.getElementById('tilesXLabel').textContent = `= ${metrics.tilesX} tiles`;
    document.getElementById('tilesYLabel').textContent = `= ${metrics.tilesY} tiles`;

    if (!sizeHint) return;

    sizeHint.className = 'info-text size-hint';

    if (metrics.tilesX < 1 || metrics.tilesY < 1) {
        sizeHint.textContent = 'Increase width/height or lower cell size to create at least 1 tile.';
        return;
    }

    sizeHint.textContent =
        `Map: ${metrics.totalCells.toLocaleString()} tiles. ` +
        `Preview: ${metrics.previewWidth.toLocaleString()}x${metrics.previewHeight.toLocaleString()} px at ${Math.round(metrics.previewScale * 100)}%.`;

    if (metrics.isCellDanger || metrics.isPreviewDanger) {
        sizeHint.classList.add('danger');
        sizeHint.textContent +=
            ` Very large map. It may become slow or freeze the browser while generating or updating preview.`;
        return;
    }

    if (metrics.isCellWarning || metrics.isPreviewWarning) {
        sizeHint.classList.add('warning');
        sizeHint.textContent +=
            ` Large map. Recommended to stay under ${MAP_SIZE_WARNING_CELLS.toLocaleString()} tiles for smoother editing.`;
    }
}

// ============== GRID GENERATION ==============
function generateGrid() {
    const widthPx = parseInt(document.getElementById('widthPx').value) || 1280;
    const heightPx = parseInt(document.getElementById('heightPx').value) || 640;
    const nextCellSize = parseInt(document.getElementById('cellSizeInput').value) || 128;
    const previewScale = parseFloat(document.getElementById('renderScaleSelect')?.value) || renderScale;
    const metrics = buildMapMetrics(widthPx, heightPx, nextCellSize, previewScale);
    const w = metrics.tilesX;
    const h = metrics.tilesY;
    
    if (w < 1 || h < 1) {
        showInfo('Map dimensions too small for the cell size.');
        return;
    }

    cellSize = nextCellSize;
    
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
    sidewalkFlowfield = null;
    showingFlowfieldType = 'none';
    if (typeof resetFlowfieldButtons === 'function') resetFlowfieldButtons();
    trees = [];
    roadIdCounter = 1;
    houseGroupIdCounter = 1;
    rockGroupIdCounter = 1;
    treeGroupIdCounter = 1;
    invalidateTerrainCache();

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
    showInfo(
        `Terrain generated: ${w}x${h} tiles (${widthPx}x${heightPx}px). ` +
        `Enable road mode to create roads.` +
        (metrics.isCellDanger || metrics.isPreviewDanger
            ? ' Very large map detected; it may become slow or freeze during preview updates.'
            : (metrics.isCellWarning || metrics.isPreviewWarning
                ? ' Large map detected; use Update Preview after tweaking visual settings.'
                : ''))
    );
}

// ============== COLORS ==============
function getTerrainColor(value) {
    const sortedMaterials = getSortedMaterials();
    
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

function getTerrainColorRGB(value) {
    const hex = getTerrainColor(value);
    return hexToRGB(hex);
}

function hexToRGB(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}
