// ============== SIMPLEX NOISE ==============
class SimplexNoise {
    constructor() {
        this.perm = [];
        for (let i = 0; i < 256; i++) {
            this.perm[i] = i;
        }
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.perm[i], this.perm[j]] = [this.perm[j], this.perm[i]];
        }
        for (let i = 0; i < 256; i++) {
            this.perm[256 + i] = this.perm[i];
        }
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }

    grad(hash, x, y) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);

        const u = this.fade(x);
        const v = this.fade(y);

        const a = this.perm[X] + Y;
        const aa = this.perm[a];
        const ab = this.perm[a + 1];
        const b = this.perm[X + 1] + Y;
        const ba = this.perm[b];
        const bb = this.perm[b + 1];

        return this.lerp(v,
            this.lerp(u, this.grad(this.perm[aa], x, y),
                this.grad(this.perm[ba], x - 1, y)),
            this.lerp(u, this.grad(this.perm[ab], x, y - 1),
                this.grad(this.perm[bb], x - 1, y - 1))
        );
    }
}

// ============== GLOBAL STATE ==============
let grid = [];
let roads = [];
let houses = [];
let simplex;
let roadMode = false;
let selectedCells = [];
let roadIdCounter = 1;
let houseGroupIdCounter = 1;
let rocks = [];
let trees = [];
let rockGroupIdCounter = 1;
let treeGroupIdCounter = 1;

// Material definitions
let materialDefinitions = [];
let materialIdCounter = 1;

let cellSize = 48;
const MIN_PASSABLE = 0.25;
const MAX_PASSABLE = 0.75;
const WATER_THRESHOLD = 0.3;

// Zoom and pan state
let zoom = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let lastPanX = 0;
let lastPanY = 0;

// Render scale
let renderScale = 0.1;

// Default road color (user can change via color picker)
let roadColor = '#FFD700';

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

// ============== SPATIAL HASHING FOR COLLISION DETECTION ==============

// Get world-space bounding box for any entity
function getEntityWorldBounds(cellX, cellY, entity, type) {
    const worldBaseX = cellX * cellSize + entity.offsetX * cellSize;
    const worldBaseY = cellY * cellSize + entity.offsetY * cellSize;
    
    if (type === 'house') {
        return {
            left: worldBaseX,
            top: worldBaseY,
            right: worldBaseX + entity.widthPx,
            bottom: worldBaseY + entity.heightPx
        };
    } else {
        // For circles (rocks and trees)
        const radius = type === 'rock' ? entity.radiusPx : entity.crownRadiusPx;
        return {
            left: worldBaseX - radius,
            top: worldBaseY - radius,
            right: worldBaseX + radius,
            bottom: worldBaseY + radius
        };
    }
}

// Get all cells that overlap with a world-space bounding box
function getCellsInWorldBounds(left, top, right, bottom) {
    if (!grid || grid.length === 0) return [];
    
    const cells = [];
    const minCellX = Math.max(0, Math.floor(left / cellSize));
    const maxCellX = Math.min(grid[0].length - 1, Math.floor(right / cellSize));
    const minCellY = Math.max(0, Math.floor(top / cellSize));
    const maxCellY = Math.min(grid.length - 1, Math.floor(bottom / cellSize));
    
    for (let y = minCellY; y <= maxCellY; y++) {
        for (let x = minCellX; x <= maxCellX; x++) {
            cells.push({ x, y });
        }
    }
    return cells;
}

// Get cells that an entity occupies (based on its bounds)
function getEntityOccupiedCells(cellX, cellY, entity, type) {
    const bounds = getEntityWorldBounds(cellX, cellY, entity, type);
    return getCellsInWorldBounds(bounds.left, bounds.top, bounds.right, bounds.bottom);
}

// Collect all entities from cells that could collide with a given world-space area
// Uses spatial hashing - only checks cells that could contain overlapping entities
function getEntitiesInArea(worldLeft, worldTop, worldRight, worldBottom) {
    if (!grid || grid.length === 0) return { houses: [], rocks: [], trees: [] };
    
    // Expand search area by maximum possible entity size to catch entities 
    // whose anchor cell is outside but whose bounds extend into our area
    const maxEntitySize = Math.max(
        parseInt(document.getElementById('rockMaxRadiusPx')?.value) || 32,
        parseInt(document.getElementById('treeMaxRadiusPx')?.value) || 38,
        parseInt(document.getElementById('houseWidthPx')?.value) || 32,
        parseInt(document.getElementById('houseHeightPx')?.value) || 26
    );
    
    const expandedLeft = worldLeft - maxEntitySize;
    const expandedTop = worldTop - maxEntitySize;
    const expandedRight = worldRight + maxEntitySize;
    const expandedBottom = worldBottom + maxEntitySize;
    
    const cells = getCellsInWorldBounds(expandedLeft, expandedTop, expandedRight, expandedBottom);
    
    const result = {
        houses: [],
        rocks: [],
        trees: []
    };
    
    // Track already added entities to avoid duplicates
    const addedHouses = new Set();
    const addedRocks = new Set();
    const addedTrees = new Set();
    
    for (const cell of cells) {
        const cellData = grid[cell.y][cell.x];
        
        // Collect houses with their world positions
        for (let i = 0; i < cellData.houses.length; i++) {
            const house = cellData.houses[i];
            const key = `${cell.x},${cell.y},${i}`;
            if (!addedHouses.has(key)) {
                addedHouses.add(key);
                result.houses.push({
                    ...house,
                    worldX: cell.x * cellSize + house.offsetX * cellSize,
                    worldY: cell.y * cellSize + house.offsetY * cellSize,
                    cellX: cell.x,
                    cellY: cell.y
                });
            }
        }
        
        // Collect rocks with their world positions
        for (let i = 0; i < cellData.rocks.length; i++) {
            const rock = cellData.rocks[i];
            const key = `${cell.x},${cell.y},${i}`;
            if (!addedRocks.has(key)) {
                addedRocks.add(key);
                result.rocks.push({
                    ...rock,
                    worldX: cell.x * cellSize + rock.offsetX * cellSize,
                    worldY: cell.y * cellSize + rock.offsetY * cellSize,
                    cellX: cell.x,
                    cellY: cell.y
                });
            }
        }
        
        // Collect trees with their world positions
        for (let i = 0; i < cellData.trees.length; i++) {
            const tree = cellData.trees[i];
            const key = `${cell.x},${cell.y},${i}`;
            if (!addedTrees.has(key)) {
                addedTrees.add(key);
                result.trees.push({
                    ...tree,
                    worldX: cell.x * cellSize + tree.offsetX * cellSize,
                    worldY: cell.y * cellSize + tree.offsetY * cellSize,
                    cellX: cell.x,
                    cellY: cell.y
                });
            }
        }
    }
    
    return result;
}

// Check if a rectangle collides with any existing entity in the world
function checkRectCollision(worldX, worldY, width, height, excludeNewEntities = []) {
    const entities = getEntitiesInArea(worldX, worldY, worldX + width, worldY + height);
    
    // Check against houses
    for (const house of entities.houses) {
        if (rectanglesOverlap(
            worldX, worldY, width, height,
            house.worldX, house.worldY, house.widthPx, house.heightPx
        )) {
            return true;
        }
    }
    
    // Check against rocks
    for (const rock of entities.rocks) {
        if (circleRectOverlap(rock.worldX, rock.worldY, rock.radiusPx, worldX, worldY, width, height)) {
            return true;
        }
    }
    
    // Check against trees
    for (const tree of entities.trees) {
        if (circleRectOverlap(tree.worldX, tree.worldY, tree.crownRadiusPx, worldX, worldY, width, height)) {
            return true;
        }
    }
    
    // Check against newly placed entities in current batch (not yet in grid)
    for (const newEntity of excludeNewEntities) {
        if (newEntity.type === 'house') {
            if (rectanglesOverlap(
                worldX, worldY, width, height,
                newEntity.worldX, newEntity.worldY, newEntity.widthPx, newEntity.heightPx
            )) {
                return true;
            }
        } else if (newEntity.type === 'rock') {
            if (circleRectOverlap(newEntity.worldX, newEntity.worldY, newEntity.radiusPx, worldX, worldY, width, height)) {
                return true;
            }
        } else if (newEntity.type === 'tree') {
            if (circleRectOverlap(newEntity.worldX, newEntity.worldY, newEntity.crownRadiusPx, worldX, worldY, width, height)) {
                return true;
            }
        }
    }
    
    return false;
}

// Check if a circle collides with any existing entity in the world
function checkCircleCollision(worldX, worldY, radius, excludeNewEntities = []) {
    const entities = getEntitiesInArea(worldX - radius, worldY - radius, worldX + radius, worldY + radius);
    
    // Check against houses
    for (const house of entities.houses) {
        if (circleRectOverlap(worldX, worldY, radius, house.worldX, house.worldY, house.widthPx, house.heightPx)) {
            return true;
        }
    }
    
    // Check against rocks
    for (const rock of entities.rocks) {
        if (circlesOverlap(worldX, worldY, radius, rock.worldX, rock.worldY, rock.radiusPx)) {
            return true;
        }
    }
    
    // Check against trees
    for (const tree of entities.trees) {
        if (circlesOverlap(worldX, worldY, radius, tree.worldX, tree.worldY, tree.crownRadiusPx)) {
            return true;
        }
    }
    
    // Check against newly placed entities in current batch (not yet in grid)
    for (const newEntity of excludeNewEntities) {
        if (newEntity.type === 'house') {
            if (circleRectOverlap(worldX, worldY, radius, newEntity.worldX, newEntity.worldY, newEntity.widthPx, newEntity.heightPx)) {
                return true;
            }
        } else if (newEntity.type === 'rock') {
            if (circlesOverlap(worldX, worldY, radius, newEntity.worldX, newEntity.worldY, newEntity.radiusPx)) {
                return true;
            }
        } else if (newEntity.type === 'tree') {
            if (circlesOverlap(worldX, worldY, radius, newEntity.worldX, newEntity.worldY, newEntity.crownRadiusPx)) {
                return true;
            }
        }
    }
    
    return false;
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

// ============== ZOOM AND PAN ==============
function getMinZoom() {
    if (!grid || grid.length === 0 || !grid[0]) return 0.1;

    const container = document.getElementById('canvasContainer');
    const containerRect = container.getBoundingClientRect();

    const fullWidth = grid[0].length * cellSize;
    const fullHeight = grid.length * cellSize;

    const padding = 20;
    const zoomX = (containerRect.width - padding * 2) / fullWidth;
    const zoomY = (containerRect.height - padding * 2) / fullHeight;

    return Math.min(zoomX, zoomY);
}

function updateZoomUI() {
    const zoomPercent = Math.round(zoom * 100);
    document.getElementById('zoomLevel').textContent = `${zoomPercent}%`;
    document.getElementById('zoomSlider').value = zoomPercent;
}

function setZoom(percent) {
    const minZoom = getMinZoom();
    zoom = Math.max(minZoom, percent / 100);
    updateZoomUI();
    applyTransform();
}

function zoomIn() {
    zoom = Math.min(3, zoom + 0.1);
    updateZoomUI();
    applyTransform();
}

function zoomOut() {
    const minZoom = getMinZoom();
    zoom = Math.max(minZoom, zoom - 0.1);
    updateZoomUI();
    applyTransform();
}

function resetView() {
    zoom = 1;
    panX = 0;
    panY = 0;
    updateZoomUI();
    applyTransform();
}

function fitToView() {
    if (!grid || grid.length === 0 || !grid[0]) return;

    const container = document.getElementById('canvasContainer');
    const containerRect = container.getBoundingClientRect();

    const fullWidth = grid[0].length * cellSize;
    const fullHeight = grid.length * cellSize;

    zoom = Math.min(getMinZoom(), 1);

    const scaledWidth = fullWidth * zoom;
    const scaledHeight = fullHeight * zoom;
    panX = (containerRect.width - scaledWidth) / 2;
    panY = (containerRect.height - scaledHeight) / 2;

    updateZoomUI();
    applyTransform();
}

function applyTransform() {
    const canvas = document.getElementById('gridCanvas');
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
}

function setRenderScale(value) {
    renderScale = parseFloat(value);
    drawGrid();
}

function handleWheel(event) {
    event.preventDefault();

    const container = document.getElementById('canvasContainer');
    const rect = container.getBoundingClientRect();

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const oldZoom = zoom;

    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    const minZoom = getMinZoom();
    zoom = Math.max(minZoom, Math.min(3, zoom + delta));

    const zoomRatio = zoom / oldZoom;
    panX = mouseX - (mouseX - panX) * zoomRatio;
    panY = mouseY - (mouseY - panY) * zoomRatio;

    updateZoomUI();
    applyTransform();
}

function handlePanStart(event) {
    if (roadMode || event.button !== 0) return;

    isPanning = true;
    lastPanX = event.clientX;
    lastPanY = event.clientY;
    event.preventDefault();
}

function handlePanMove(event) {
    if (!isPanning) return;

    const deltaX = event.clientX - lastPanX;
    const deltaY = event.clientY - lastPanY;

    panX += deltaX;
    panY += deltaY;

    lastPanX = event.clientX;
    lastPanY = event.clientY;

    applyTransform();
}

function handlePanEnd() {
    isPanning = false;
}

// ============== DRAWING ==============
function drawGrid() {
    if (!grid || grid.length === 0 || !grid[0]) return;

    const canvas = document.getElementById('gridCanvas');
    const ctx = canvas.getContext('2d');

    const scaledCellSize = cellSize * renderScale;
    const fullWidth = grid[0].length * cellSize;
    const fullHeight = grid.length * cellSize;
    const canvasWidth = Math.ceil(grid[0].length * scaledCellSize);
    const canvasHeight = Math.ceil(grid.length * scaledCellSize);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    canvas.style.width = fullWidth + 'px';
    canvas.style.height = fullHeight + 'px';

    applyTransform();

    const cs = scaledCellSize;

    // Build a set of cells with visible roads for quick lookup
    const cellsWithRoads = new Set();
    roads.forEach(road => {
        if (road.visible) {
            road.cells.forEach(c => cellsWithRoads.add(`${c.x},${c.y}`));
        }
    });

    // LAYER 1: Draw all terrain
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            const cell = grid[y][x];
            ctx.fillStyle = getTerrainColor(cell.noise);
            ctx.fillRect(x * cs, y * cs, cs, cs);
        }
    }

    // LAYER 2: Draw all roads
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            const visibleRoad = roads.find(r => r.visible && r.cells.some(c => c.x === x && c.y === y));
            if (visibleRoad) {
                ctx.fillStyle = visibleRoad.color;
                ctx.fillRect(x * cs, y * cs, cs, cs);
            }
        }
    }

    // LAYER 3: Draw cell borders
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = Math.max(1, cs * 0.02);
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            ctx.strokeRect(x * cs, y * cs, cs, cs);
        }
    }

    // LAYER 4: Draw all rocks (only in cells without visible roads)
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            if (cellsWithRoads.has(`${x},${y}`)) continue;
            
            const cell = grid[y][x];
            const visibleRocks = cell.rocks.filter(r => {
                const group = rocks.find(g => g.id === r.groupId);
                return group && group.visible;
            });

            visibleRocks.forEach(rock => {
                const rx = x * cs + rock.offsetX * cs;
                const ry = y * cs + rock.offsetY * cs;
                const rRadius = rock.radiusPx * renderScale;

                // Shadow
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.beginPath();
                ctx.ellipse(rx + rRadius * 0.15, ry + rRadius * 0.15, rRadius, rRadius * 0.7, 0, 0, Math.PI * 2);
                ctx.fill();

                // Rock body
                const grayShade = rock.shade || 100;
                ctx.fillStyle = `rgb(${grayShade}, ${grayShade - 10}, ${grayShade - 5})`;
                ctx.beginPath();
                ctx.arc(rx, ry, rRadius, 0, Math.PI * 2);
                ctx.fill();

                // Highlight
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.beginPath();
                ctx.arc(rx - rRadius * 0.3, ry - rRadius * 0.3, rRadius * 0.3, 0, Math.PI * 2);
                ctx.fill();

                // Border
                ctx.strokeStyle = '#4a4a4a';
                ctx.lineWidth = Math.max(0.5, cs * 0.04);
                ctx.beginPath();
                ctx.arc(rx, ry, rRadius, 0, Math.PI * 2);
                ctx.stroke();
            });
        }
    }

    // LAYER 5: Draw all houses (only in cells without visible roads)
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            if (cellsWithRoads.has(`${x},${y}`)) continue;
            
            const cell = grid[y][x];
            const visibleHouses = cell.houses.filter(h => {
                const group = houses.find(g => g.id === h.groupId);
                return group && group.visible;
            });

            visibleHouses.forEach(house => {
                const houseW = house.widthPx * renderScale;
                const houseH = house.heightPx * renderScale;
                const hx = x * cs + house.offsetX * cs;
                const hy = y * cs + house.offsetY * cs;

                // House rectangle
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(hx, hy, houseW, houseH);

                // Border
                ctx.strokeStyle = '#922b21';
                ctx.lineWidth = Math.max(1, renderScale * 2);
                ctx.strokeRect(hx, hy, houseW, houseH);
            });
        }
    }

    // LAYER 6: Draw all trees
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            const cell = grid[y][x];
            const visibleTrees = cell.trees.filter(t => {
                const group = trees.find(g => g.id === t.groupId);
                return group && group.visible;
            });

            visibleTrees.forEach(tree => {
                const tx = x * cs + tree.offsetX * cs;
                const ty = y * cs + tree.offsetY * cs;
                const crownRadius = tree.crownRadiusPx * renderScale;

                // Shadow
                ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
                ctx.beginPath();
                ctx.ellipse(tx + crownRadius * 0.2, ty + crownRadius * 0.2, crownRadius, crownRadius * 0.6, 0, 0, Math.PI * 2);
                ctx.fill();

                // Tree crown (dark green base)
                ctx.fillStyle = '#1a5f1a';
                ctx.beginPath();
                ctx.arc(tx, ty, crownRadius, 0, Math.PI * 2);
                ctx.fill();

                // Inner crown (lighter green)
                ctx.fillStyle = '#228B22';
                ctx.beginPath();
                ctx.arc(tx - crownRadius * 0.15, ty - crownRadius * 0.15, crownRadius * 0.7, 0, Math.PI * 2);
                ctx.fill();

                // Highlight
                ctx.fillStyle = 'rgba(144, 238, 144, 0.4)';
                ctx.beginPath();
                ctx.arc(tx - crownRadius * 0.3, ty - crownRadius * 0.3, crownRadius * 0.35, 0, Math.PI * 2);
                ctx.fill();

                // Crown border
                ctx.strokeStyle = '#0d3d0d';
                ctx.lineWidth = Math.max(0.5, cs * 0.04);
                ctx.beginPath();
                ctx.arc(tx, ty, crownRadius, 0, Math.PI * 2);
                ctx.stroke();
            });
        }
    }

    // LAYER 7: Draw selection borders
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            const isSelected = selectedCells.some(c => c.x === x && c.y === y);
            if (isSelected) {
                ctx.strokeStyle = '#FF00FF';
                ctx.lineWidth = Math.max(2, cs * 0.08);
                const selOffset = Math.max(1, cs * 0.04);
                ctx.strokeRect(x * cs + selOffset, y * cs + selOffset, cs - 2 * selOffset, cs - 2 * selOffset);
            }
        }
    }

    updateStats();
}

// ============== ROADS ==============
function toggleRoadMode() {
    roadMode = !roadMode;
    selectedCells = [];

    const canvas = document.getElementById('gridCanvas');
    const container = document.getElementById('canvasContainer');
    const modeStatus = document.getElementById('modeStatus');
    const btn = document.getElementById('roadModeBtn');

    if (roadMode) {
        canvas.classList.add('road-mode');
        container.classList.add('road-mode');
        modeStatus.textContent = 'ON';
        btn.classList.add('active');
        const minAlt = parseFloat(document.getElementById('roadMinAltitude').value) || 0;
        const maxAlt = parseFloat(document.getElementById('roadMaxAltitude').value) || 1;
        showInfo(`Road mode enabled. Click 2 cells with altitude between ${minAlt}-${maxAlt} to create a road.`);
    } else {
        canvas.classList.remove('road-mode');
        container.classList.remove('road-mode');
        modeStatus.textContent = 'OFF';
        btn.classList.remove('active');
        showInfo('Road mode disabled.');
    }

    drawGrid();
}

function isPassable(x, y) {
    if (!grid || !grid[y] || !grid[y][x]) return false;
    return grid[y][x].isPassable;
}

function canBeRoad(x, y, maxHousesToDestroy = null, checkAltitude = true) {
    if (!grid || !grid[y] || !grid[y][x]) return false;
    const cell = grid[y][x];
    if (!cell.isPassable) return false;

    // Only check altitude if specified (for start/end point validation)
    if (checkAltitude) {
        const minAltitude = parseFloat(document.getElementById('roadMinAltitude').value) || 0;
        const maxAltitude = parseFloat(document.getElementById('roadMaxAltitude').value) || 1;

        if (cell.noise < minAltitude || cell.noise > maxAltitude) {
            return false;
        }
    }

    if (maxHousesToDestroy === null) {
        maxHousesToDestroy = parseInt(document.getElementById('maxHousesToDestroy').value) || 0;
    }

    return cell.houses.length <= maxHousesToDestroy;
}

function getHouseDestroyCost(x, y) {
    if (!grid || !grid[y] || !grid[y][x]) return 0;
    const cell = grid[y][x];
    return cell.houses.length * 50;
}

function hasRoad(x, y) {
    if (!grid || !grid[y] || !grid[y][x]) return false;
    return grid[y][x].roadIds.length > 0;
}

function handleCanvasClick(event) {
    if (!roadMode || !grid || grid.length === 0) return;

    const canvas = document.getElementById('gridCanvas');
    const container = document.getElementById('canvasContainer');
    const rect = container.getBoundingClientRect();

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const canvasX = (mouseX - panX) / zoom;
    const canvasY = (mouseY - panY) / zoom;

    const x = Math.floor(canvasX / cellSize);
    const y = Math.floor(canvasY / cellSize);

    if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
        if (!canBeRoad(x, y)) {
            const cell = grid[y][x];
            const minAltitude = parseFloat(document.getElementById('roadMinAltitude').value) || 0;
            const maxAltitude = parseFloat(document.getElementById('roadMaxAltitude').value) || 1;

            if (!isPassable(x, y)) {
                showInfo(`Cell (${x}, ${y}) is impassable.`);
            } else if (cell.noise < minAltitude || cell.noise > maxAltitude) {
                showInfo(`Cell (${x}, ${y}) altitude ${cell.noise.toFixed(2)} outside allowed range (${minAltitude}-${maxAltitude}).`);
            } else {
                showInfo(`Cell (${x}, ${y}) has houses. Cannot be road start/end.`);
            }
            return;
        }

        const index = selectedCells.findIndex(c => c.x === x && c.y === y);
        if (index !== -1) {
            selectedCells.splice(index, 1);
            showInfo(`Cell (${x}, ${y}) deselected. ${selectedCells.length}/2 cells.`);
        } else if (selectedCells.length < 2) {
            selectedCells.push({ x, y });
            showInfo(`Cell (${x}, ${y}) selected. ${selectedCells.length}/2 cells.`);

            if (selectedCells.length === 2) {
                setTimeout(createRoad, 100);
            }
        } else {
            selectedCells = [{ x, y }];
            showInfo(`New selection. Cell (${x}, ${y}) selected. 1/2 cells.`);
        }

        drawGrid();
    }
}

function createRoad() {
    if (selectedCells.length !== 2) return;

    const start = selectedCells[0];
    const end = selectedCells[1];
    const roadWidth = parseInt(document.getElementById('roadWidth').value) || 1;
    const maxHousesToDestroy = parseInt(document.getElementById('maxHousesToDestroy').value) || 0;

    const basePath = aStar(start, end);

    if (basePath.length === 0) {
        const minAlt = parseFloat(document.getElementById('roadMinAltitude').value) || 0;
        const maxAlt = parseFloat(document.getElementById('roadMaxAltitude').value) || 1;
        showInfo(`Could not find a path (may be blocked by houses, impassable zones, or cells outside altitude range ${minAlt}-${maxAlt}).`);
        selectedCells = [];
        drawGrid();
        return;
    }

    const path = expandRoadPath(basePath, roadWidth, maxHousesToDestroy);

    const roadEntity = {
        id: roadIdCounter++,
        name: `Road ${roadIdCounter - 1}`,
        cells: path,
        visible: true,
        color: roadColor,
        start: { x: start.x, y: start.y },
        end: { x: end.x, y: end.y },
        width: roadWidth
    };

    roads.push(roadEntity);

    let destroyedHouses = 0;
    let destroyedRocks = 0;
    let destroyedTrees = 0;

    path.forEach(cell => {
        const cellData = grid[cell.y][cell.x];

        cellData.roadIds.push(roadEntity.id);

        if (cellData.houses.length > 0) {
            destroyedHouses += cellData.houses.length;
            cellData.houses.forEach(house => {
                const group = houses.find(g => g.id === house.groupId);
                if (group) {
                    group.count--;
                }
            });
            cellData.houses = [];
        }

        if (cellData.rocks.length > 0) {
            destroyedRocks += cellData.rocks.length;
            cellData.rocks.forEach(rock => {
                const group = rocks.find(g => g.id === rock.groupId);
                if (group) {
                    group.count--;
                }
            });
            cellData.rocks = [];
        }

        if (cellData.trees.length > 0) {
            destroyedTrees += cellData.trees.length;
            cellData.trees.forEach(tree => {
                const group = trees.find(g => g.id === tree.groupId);
                if (group) {
                    group.count--;
                }
            });
            cellData.trees = [];
        }
    });

    houses = houses.filter(g => g.count > 0);
    rocks = rocks.filter(g => g.count > 0);
    trees = trees.filter(g => g.count > 0);

    selectedCells = [];
    updateUI();
    drawGrid();

    let msg = `Road created (width ${roadWidth}): ${path.length} cells from (${start.x},${start.y}) to (${end.x},${end.y})`;
    const destroyed = [];
    if (destroyedHouses > 0) destroyed.push(`${destroyedHouses} houses`);
    if (destroyedRocks > 0) destroyed.push(`${destroyedRocks} rocks`);
    if (destroyedTrees > 0) destroyed.push(`${destroyedTrees} trees`);
    if (destroyed.length > 0) {
        msg += `. Destroyed: ${destroyed.join(', ')}.`;
    }
    showInfo(msg);
}

function deleteRoad(roadId) {
    const roadIndex = roads.findIndex(r => r.id === roadId);
    if (roadIndex === -1) return;

    const road = roads[roadIndex];

    road.cells.forEach(cell => {
        const cellData = grid[cell.y][cell.x];
        cellData.roadIds = cellData.roadIds.filter(id => id !== roadId);
    });

    roads.splice(roadIndex, 1);
    updateUI();
    drawGrid();
}

function toggleRoadVisibility(roadId) {
    const road = roads.find(r => r.id === roadId);
    if (road) {
        road.visible = !road.visible;
        updateUI();
        drawGrid();
    }
}

function toggleAllRoads(visible) {
    roads.forEach(r => r.visible = visible);
    updateUI();
    drawGrid();
}

function updateAllRoadColors(newColor) {
    roadColor = newColor;
    roads.forEach(r => r.color = newColor);
    updateUI();
    drawGrid();
}

// ============== HOUSES ==============
function calculateProximityBonus(x, y, radius, importance, checkFn) {
    if (importance <= 0) return 0;

    let bonus = 0;
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (dx === 0 && dy === 0) continue;

            const nx = x + dx;
            const ny = y + dy;

            if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length) {
                if (checkFn(nx, ny)) {
                    const d2 = dx * dx + dy * dy;
                    bonus += importance / d2;
                }
            }
        }
    }
    return bonus;
}

function rectanglesOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(x1 + w1 <= x2 || x2 + w2 <= x1 || y1 + h1 <= y2 || y2 + h2 <= y1);
}

function circleRectOverlap(cx, cy, radius, rx, ry, rw, rh) {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX;
    const dy = cy - closestY;
    const distanceSquared = dx * dx + dy * dy;
    return distanceSquared < (radius * radius);
}

function circlesOverlap(x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (r1 + r2);
}

function tryPlaceHouse(cellX, cellY, newEntitiesBatch = [], maxAttempts = 30, minHeight = 0, maxHeight = 1) {
    // Get house dimensions in pixels
    const houseWidthPx = parseInt(document.getElementById('houseWidthPx').value) || 32;
    const houseHeightPx = parseInt(document.getElementById('houseHeightPx').value) || 26;
    
    const margin = 0.05 * cellSize; // margin in pixels
    
    // Calculate the world-space bounds the house could occupy
    const maxWorldRight = cellX * cellSize + cellSize - margin + houseWidthPx;
    const maxWorldBottom = cellY * cellSize + cellSize - margin + houseHeightPx;
    
    // Check if the house would extend beyond map bounds
    const mapWidthPx = grid[0].length * cellSize;
    const mapHeightPx = grid.length * cellSize;
    
    if (maxWorldRight > mapWidthPx || maxWorldBottom > mapHeightPx) {
        // Adjust available space or reject if too close to edge
        // For simplicity, reject cells too close to the edge for large houses
        const availableWidthPx = mapWidthPx - (cellX * cellSize + margin);
        const availableHeightPx = mapHeightPx - (cellY * cellSize + margin);
        if (availableWidthPx < houseWidthPx || availableHeightPx < houseHeightPx) {
            return null;
        }
    }
    
    // Calculate available space for random offset within the anchor cell (in relative 0-1 coords)
    const marginRel = margin / cellSize;
    const availableWidth = 1 - 2 * marginRel;
    const availableHeight = 1 - 2 * marginRel;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const offsetX = marginRel + Math.random() * availableWidth;
        const offsetY = marginRel + Math.random() * availableHeight;
        
        // Calculate world-space position
        const worldX = cellX * cellSize + offsetX * cellSize;
        const worldY = cellY * cellSize + offsetY * cellSize;
        
        // Check if house extends into invalid cells (roads, impassable, wrong altitude)
        const houseBoundsLeft = worldX;
        const houseBoundsTop = worldY;
        const houseBoundsRight = worldX + houseWidthPx;
        const houseBoundsBottom = worldY + houseHeightPx;
        
        const occupiedCells = getCellsInWorldBounds(houseBoundsLeft, houseBoundsTop, houseBoundsRight, houseBoundsBottom);
        
        let validPlacement = true;
        for (const cell of occupiedCells) {
            const cellData = grid[cell.y][cell.x];
            if (!cellData.isPassable || cellData.roadIds.length > 0) {
                validPlacement = false;
                break;
            }
            if (cellData.noise < minHeight || cellData.noise > maxHeight) {
                validPlacement = false;
                break;
            }
        }
        
        if (!validPlacement) continue;
        
        // Use spatial hashing to check collisions with existing entities
        if (!checkRectCollision(worldX, worldY, houseWidthPx, houseHeightPx, newEntitiesBatch)) {
            return { offsetX: offsetX, offsetY: offsetY, widthPx: houseWidthPx, heightPx: houseHeightPx };
        }
    }

    return null;
}


function generateHouses() {
    const minHeight = parseFloat(document.getElementById('minHeight').value);
    const maxHeight = parseFloat(document.getElementById('maxHeight').value);
    const roadImportance = parseInt(document.getElementById('roadImportance').value) / 100;
    const neighborImportance = parseInt(document.getElementById('neighborImportance').value) / 100;
    const searchRadius = parseInt(document.getElementById('searchRadius').value);
    const baseProbability = parseInt(document.getElementById('houseProbability').value) / 100;
    const maxHousesPerCell = parseInt(document.getElementById('maxHousesPerCell').value);

    if (!grid || grid.length === 0) {
        showInfo('Generate terrain first.');
        return;
    }

    const hasRoads = roads.length > 0;

    // Track newly placed entities for batch collision checking
    const newEntitiesBatch = [];
    let totalHouses = 0;
    let cellsWithHouses = new Set();

    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            const cell = grid[y][x];

            if (!cell.isPassable) continue;
            if (cell.noise < minHeight || cell.noise > maxHeight) continue;
            if (cell.roadIds.length > 0) continue;

            const currentHouseCount = cell.houses.length;
            if (currentHouseCount >= maxHousesPerCell) continue;

            let probability = baseProbability;

            const totalImportance = roadImportance + neighborImportance;

            if (totalImportance > 0) {
                if (hasRoads && roadImportance > 0) {
                    const roadBonus = calculateProximityBonus(x, y, searchRadius, roadImportance, (nx, ny) => {
                        return grid[ny][nx].roadIds.length > 0;
                    });
                    probability += roadBonus;
                }

                if (neighborImportance > 0) {
                    const neighborBonus = calculateProximityBonus(x, y, searchRadius, neighborImportance, (nx, ny) => {
                        return grid[ny][nx].houses.length > 0;
                    });
                    probability += neighborBonus;
                }
            }

            probability = Math.max(0, Math.min(1, probability));

            if (Math.random() > probability) continue;

            const maxToAdd = maxHousesPerCell - currentHouseCount;
            const numHousesToAdd = Math.min(
                Math.floor(Math.random() * maxHousesPerCell) + 1,
                maxToAdd
            );

            for (let i = 0; i < numHousesToAdd; i++) {
                const housePos = tryPlaceHouse(x, y, newEntitiesBatch, 30, minHeight, maxHeight);

                if (housePos) {
                    // Calculate world position for batch tracking
                    const worldX = x * cellSize + housePos.offsetX * cellSize;
                    const worldY = y * cellSize + housePos.offsetY * cellSize;
                    
                    newEntitiesBatch.push({
                        type: 'house',
                        cellX: x,
                        cellY: y,
                        worldX: worldX,
                        worldY: worldY,
                        widthPx: housePos.widthPx,
                        heightPx: housePos.heightPx,
                        offsetX: housePos.offsetX,
                        offsetY: housePos.offsetY
                    });
                    totalHouses++;
                    cellsWithHouses.add(`${x},${y}`);
                }
            }
        }
    }

    if (newEntitiesBatch.length === 0) {
        showInfo('No houses generated. Try increasing probability or adjusting filters.');
        return;
    }

    const houseGroup = {
        id: houseGroupIdCounter++,
        name: `Group ${houseGroupIdCounter - 1}`,
        visible: true,
        count: totalHouses,
        params: { minHeight, maxHeight, roadImportance, neighborImportance, searchRadius, baseProbability, maxHousesPerCell }
    };

    houses.push(houseGroup);

    // Add houses to their anchor cells in the grid
    newEntitiesBatch.forEach(h => {
        grid[h.cellY][h.cellX].houses.push({
            groupId: houseGroup.id,
            offsetX: h.offsetX,
            offsetY: h.offsetY,
            widthPx: h.widthPx,
            heightPx: h.heightPx
        });
    });

    updateUI();
    drawGrid();
    showInfo(`Generated ${totalHouses} houses in ${cellsWithHouses.size} cells.`);
}

function deleteHouseGroup(groupId) {
    const groupIndex = houses.findIndex(g => g.id === groupId);
    if (groupIndex === -1) return;

    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            grid[y][x].houses = grid[y][x].houses.filter(h => h.groupId !== groupId);
        }
    }

    houses.splice(groupIndex, 1);
    updateUI();
    drawGrid();
}

function toggleHouseGroupVisibility(groupId) {
    const group = houses.find(g => g.id === groupId);
    if (group) {
        group.visible = !group.visible;
        updateUI();
        drawGrid();
    }
}

function toggleAllHouses(visible) {
    houses.forEach(g => g.visible = visible);
    updateUI();
    drawGrid();
}

function clearAllHouses() {
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            grid[y][x].houses = [];
        }
    }
    houses = [];
    houseGroupIdCounter = 1;
    updateUI();
    drawGrid();
    showInfo('All houses have been removed.');
}

function clearAll() {
    roads = [];
    houses = [];
    rocks = [];
    trees = [];
    roadIdCounter = 1;
    houseGroupIdCounter = 1;
    rockGroupIdCounter = 1;
    treeGroupIdCounter = 1;
    selectedCells = [];

    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            grid[y][x].roadIds = [];
            grid[y][x].houses = [];
            grid[y][x].rocks = [];
            grid[y][x].trees = [];
        }
    }

    updateUI();
    drawGrid();
    showInfo('Everything cleared.');
}

// ============== ROCKS ==============
function tryPlaceRock(cellX, cellY, newEntitiesBatch = [], minRadiusPx, maxRadiusPx, maxAttempts = 20) {
    const radiusPx = minRadiusPx + Math.random() * (maxRadiusPx - minRadiusPx);
    const marginPx = radiusPx + 2; // margin in pixels
    const marginRel = marginPx / cellSize;
    const availableSpace = 1 - 2 * marginRel;

    if (availableSpace <= 0) return null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const offsetX = marginRel + Math.random() * availableSpace;
        const offsetY = marginRel + Math.random() * availableSpace;
        
        // Calculate world-space position
        const worldX = cellX * cellSize + offsetX * cellSize;
        const worldY = cellY * cellSize + offsetY * cellSize;
        
        // Check if rock extends beyond map bounds
        if (worldX - radiusPx < 0 || worldX + radiusPx > grid[0].length * cellSize ||
            worldY - radiusPx < 0 || worldY + radiusPx > grid.length * cellSize) {
            continue;
        }
        
        // Use spatial hashing to check collisions
        if (!checkCircleCollision(worldX, worldY, radiusPx, newEntitiesBatch)) {
            const shade = 80 + Math.floor(Math.random() * 40);
            return { offsetX: offsetX, offsetY: offsetY, radiusPx: radiusPx, shade: shade };
        }
    }

    return null;
}

function generateRocks() {
    const baseProbability = parseInt(document.getElementById('rockProbability').value) / 100;
    const maxRocksPerCell = parseInt(document.getElementById('maxRocksPerCell').value);
    const minRadiusPx = parseInt(document.getElementById('rockMinRadiusPx').value) || 10;
    const maxRadiusPx = parseInt(document.getElementById('rockMaxRadiusPx').value) || 32;
    const minAltitude = parseFloat(document.getElementById('rockMinAltitude').value) || 0;
    const maxAltitude = parseFloat(document.getElementById('rockMaxAltitude').value) || 1;

    if (!grid || grid.length === 0) {
        showInfo('Generate terrain first.');
        return;
    }

    // Track newly placed entities for batch collision checking
    const newEntitiesBatch = [];
    let totalRocks = 0;
    let cellsWithRocks = new Set();

    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            const cell = grid[y][x];

            // Check altitude range
            if (cell.noise < minAltitude || cell.noise > maxAltitude) continue;
            if (cell.roadIds.length > 0) continue;

            const currentRockCount = cell.rocks.length;
            if (currentRockCount >= maxRocksPerCell) continue;

            if (Math.random() > baseProbability) continue;

            const maxToAdd = maxRocksPerCell - currentRockCount;
            const numRocksToAdd = Math.min(
                Math.floor(Math.random() * maxRocksPerCell) + 1,
                maxToAdd
            );

            for (let i = 0; i < numRocksToAdd; i++) {
                const rockPos = tryPlaceRock(x, y, newEntitiesBatch, minRadiusPx, maxRadiusPx);

                if (rockPos) {
                    // Calculate world position for batch tracking
                    const worldX = x * cellSize + rockPos.offsetX * cellSize;
                    const worldY = y * cellSize + rockPos.offsetY * cellSize;
                    
                    newEntitiesBatch.push({
                        type: 'rock',
                        cellX: x,
                        cellY: y,
                        worldX: worldX,
                        worldY: worldY,
                        radiusPx: rockPos.radiusPx,
                        offsetX: rockPos.offsetX,
                        offsetY: rockPos.offsetY,
                        shade: rockPos.shade
                    });
                    totalRocks++;
                    cellsWithRocks.add(`${x},${y}`);
                }
            }
        }
    }

    if (newEntitiesBatch.length === 0) {
        showInfo('No rocks generated. Try increasing probability or adjusting altitude range.');
        return;
    }

    const rockGroup = {
        id: rockGroupIdCounter++,
        name: `Rocks ${rockGroupIdCounter - 1}`,
        visible: true,
        count: totalRocks
    };

    rocks.push(rockGroup);

    // Add rocks to their anchor cells in the grid
    newEntitiesBatch.forEach(r => {
        grid[r.cellY][r.cellX].rocks.push({
            groupId: rockGroup.id,
            offsetX: r.offsetX,
            offsetY: r.offsetY,
            radiusPx: r.radiusPx,
            shade: r.shade
        });
    });

    updateUI();
    drawGrid();
    showInfo(`Generated ${totalRocks} rocks in ${cellsWithRocks.size} cells.`);
}

function deleteRockGroup(groupId) {
    const groupIndex = rocks.findIndex(g => g.id === groupId);
    if (groupIndex === -1) return;

    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            grid[y][x].rocks = grid[y][x].rocks.filter(r => r.groupId !== groupId);
        }
    }

    rocks.splice(groupIndex, 1);
    updateUI();
    drawGrid();
}

function toggleRockGroupVisibility(groupId) {
    const group = rocks.find(g => g.id === groupId);
    if (group) {
        group.visible = !group.visible;
        updateUI();
        drawGrid();
    }
}

function toggleAllRocks(visible) {
    rocks.forEach(g => g.visible = visible);
    updateUI();
    drawGrid();
}

function clearAllRocks() {
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            grid[y][x].rocks = [];
        }
    }
    rocks = [];
    rockGroupIdCounter = 1;
    updateUI();
    drawGrid();
    showInfo('All rocks have been removed.');
}

// ============== TREES ==============
function countNearbyTrees(x, y, radius) {
    let count = 0;
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length) {
                count += grid[ny][nx].trees.length;
            }
        }
    }
    return count;
}

function countNearbyHouses(x, y, radius) {
    let count = 0;
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length) {
                count += grid[ny][nx].houses.length;
            }
        }
    }
    return count;
}

function tryPlaceTree(cellX, cellY, newEntitiesBatch = [], minCrownRadiusPx, maxCrownRadiusPx, maxAttempts = 30) {
    const crownRadiusPx = minCrownRadiusPx + Math.random() * (maxCrownRadiusPx - minCrownRadiusPx);
    const marginPx = crownRadiusPx + 2; // margin in pixels
    const marginRel = marginPx / cellSize;
    const availableSpace = 1 - 2 * marginRel;

    if (availableSpace <= 0) return null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const offsetX = marginRel + Math.random() * availableSpace;
        const offsetY = marginRel + Math.random() * availableSpace;
        
        // Calculate world-space position
        const worldX = cellX * cellSize + offsetX * cellSize;
        const worldY = cellY * cellSize + offsetY * cellSize;
        
        // Check if tree extends beyond map bounds
        if (worldX - crownRadiusPx < 0 || worldX + crownRadiusPx > grid[0].length * cellSize ||
            worldY - crownRadiusPx < 0 || worldY + crownRadiusPx > grid.length * cellSize) {
            continue;
        }
        
        // Use spatial hashing to check collisions
        if (!checkCircleCollision(worldX, worldY, crownRadiusPx, newEntitiesBatch)) {
            return { offsetX: offsetX, offsetY: offsetY, crownRadiusPx: crownRadiusPx };
        }
    }

    return null;
}

function generateTrees() {
    const baseProbability = parseInt(document.getElementById('treeProbability').value) / 100;
    const maxTreesPerCell = parseInt(document.getElementById('maxTreesPerCell').value);
    const minCrownRadiusPx = parseInt(document.getElementById('treeMinRadiusPx').value) || 16;
    const maxCrownRadiusPx = parseInt(document.getElementById('treeMaxRadiusPx').value) || 38;
    const minAltitude = parseFloat(document.getElementById('treeMinAltitude').value) || 0;
    const maxAltitude = parseFloat(document.getElementById('treeMaxAltitude').value) || 1;
    const casePenalty = parseInt(document.getElementById('treeCasePenalty').value) / 100;
    const searchRadius = parseInt(document.getElementById('treeSearchRadius').value);
    const treeAttraction = parseInt(document.getElementById('treeTreeAttraction').value) / 100;

    if (!grid || grid.length === 0) {
        showInfo('Generate terrain first.');
        return;
    }

    // Track newly placed entities for batch collision checking
    const newEntitiesBatch = [];
    let totalTrees = 0;
    let cellsWithTrees = new Set();

    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            const cell = grid[y][x];

            // Check altitude range
            if (cell.noise < minAltitude || cell.noise > maxAltitude) continue;
            if (cell.roadIds.length > 0) continue;

            const currentTreeCount = cell.trees.length;
            if (currentTreeCount >= maxTreesPerCell) continue;

            // Base probability
            let probability = baseProbability;

            // Tree attraction bonus (neighbor trees)
            if (treeAttraction > 0) {
                const treeBonus = calculateProximityBonus(x, y, searchRadius, treeAttraction, (nx, ny) => {
                    return grid[ny][nx].trees.length > 0;
                });
                probability += treeBonus;
            }

            // House penalty
            const nearbyHouses = countNearbyHouses(x, y, searchRadius);
            const housePenalty = Math.max(0, 1 - nearbyHouses * casePenalty);
            probability *= housePenalty;

            probability = Math.max(0, Math.min(1, probability));

            if (Math.random() > probability) continue;

            const maxToAdd = maxTreesPerCell - currentTreeCount;
            const numTreesToAdd = Math.min(
                Math.floor(Math.random() * maxTreesPerCell) + 1,
                maxToAdd
            );

            for (let i = 0; i < numTreesToAdd; i++) {
                const treePos = tryPlaceTree(x, y, newEntitiesBatch, minCrownRadiusPx, maxCrownRadiusPx);

                if (treePos) {
                    // Calculate world position for batch tracking
                    const worldX = x * cellSize + treePos.offsetX * cellSize;
                    const worldY = y * cellSize + treePos.offsetY * cellSize;
                    
                    newEntitiesBatch.push({
                        type: 'tree',
                        cellX: x,
                        cellY: y,
                        worldX: worldX,
                        worldY: worldY,
                        crownRadiusPx: treePos.crownRadiusPx,
                        offsetX: treePos.offsetX,
                        offsetY: treePos.offsetY
                    });
                    totalTrees++;
                    cellsWithTrees.add(`${x},${y}`);
                }
            }
        }
    }

    if (newEntitiesBatch.length === 0) {
        showInfo('No trees generated. Try increasing probability or adjusting parameters.');
        return;
    }

    const treeGroup = {
        id: treeGroupIdCounter++,
        name: `Trees ${treeGroupIdCounter - 1}`,
        visible: true,
        count: totalTrees
    };

    trees.push(treeGroup);

    // Add trees to their anchor cells in the grid
    newEntitiesBatch.forEach(t => {
        grid[t.cellY][t.cellX].trees.push({
            groupId: treeGroup.id,
            offsetX: t.offsetX,
            offsetY: t.offsetY,
            crownRadiusPx: t.crownRadiusPx
        });
    });

    updateUI();
    drawGrid();
    showInfo(`Generated ${totalTrees} trees in ${cellsWithTrees.size} cells.`);
}

function deleteTreeGroup(groupId) {
    const groupIndex = trees.findIndex(g => g.id === groupId);
    if (groupIndex === -1) return;

    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            grid[y][x].trees = grid[y][x].trees.filter(t => t.groupId !== groupId);
        }
    }

    trees.splice(groupIndex, 1);
    updateUI();
    drawGrid();
}

function toggleTreeGroupVisibility(groupId) {
    const group = trees.find(g => g.id === groupId);
    if (group) {
        group.visible = !group.visible;
        updateUI();
        drawGrid();
    }
}

function toggleAllTrees(visible) {
    trees.forEach(g => g.visible = visible);
    updateUI();
    drawGrid();
}

function clearAllTrees() {
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            grid[y][x].trees = [];
        }
    }
    trees = [];
    treeGroupIdCounter = 1;
    updateUI();
    drawGrid();
    showInfo('All trees have been removed.');
}

// ============== MATERIAL DEFINITIONS ==============
function addMaterialDefinition(minAlt = 0, maxAlt = 0.1, materialNum = 1, name = '', color = '#ffffff', depth = null) {
    const id = materialIdCounter++;
    // Auto-assign depth based on current max depth + 1 if not provided
    if (depth === null) {
        const maxDepth = materialDefinitions.length > 0 
            ? Math.max(...materialDefinitions.map(m => m.depth || 0)) 
            : -1;
        depth = maxDepth + 1;
    }
    materialDefinitions.push({
        id: id,
        minAltitude: minAlt,
        maxAltitude: maxAlt,
        materialNumber: materialNum,
        name: name || `Material ${materialNum}`,
        color: color,
        depth: depth
    });
    updateMaterialsList();
}

function deleteMaterialDefinition(id) {
    materialDefinitions = materialDefinitions.filter(m => m.id !== id);
    updateMaterialsList();
    drawGrid();
}

function updateMaterialsList() {
    const container = document.getElementById('materialsList');
    if (materialDefinitions.length === 0) {
        container.innerHTML = '<div style="color: #666; font-size: 11px; text-align: center; padding: 8px;">No materials defined</div>';
        return;
    }

    // Sort by depth for rendering order (lower depth = rendered first = appears below)
    const sortedMaterials = [...materialDefinitions].sort((a, b) => a.depth - b.depth);

    container.innerHTML = sortedMaterials.map(mat => `
        <div class="material-item" draggable="true" data-material-id="${mat.id}">
            <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
            <input type="color" value="${mat.color}" 
                   onchange="updateMaterialColor(${mat.id}, this.value)" 
                   title="Material color">
            <input type="text" value="${mat.name}" 
                   onchange="updateMaterialName(${mat.id}, this.value)" 
                   placeholder="Name"
                   title="Material name">
            <input type="number" value="${mat.minAltitude}" 
                   onchange="updateMaterialMin(${mat.id}, this.value)" 
                   min="0" max="1" step="0.01"
                   title="Min altitude">
            <span style="color: #666;">-</span>
            <input type="number" value="${mat.maxAltitude}" 
                   onchange="updateMaterialMax(${mat.id}, this.value)" 
                   min="0" max="1" step="0.01"
                   title="Max altitude">
            <span style="color: #666;">=</span>
            <input type="number" value="${mat.materialNumber}" 
                   onchange="updateMaterialNumber(${mat.id}, this.value)" 
                   min="0" max="255"
                   title="Material number">
            <span class="depth-label">D:</span>
            <input type="number" value="${mat.depth}" 
                   onchange="updateMaterialDepth(${mat.id}, this.value)" 
                   min="0" max="99"
                   class="depth-input"
                   title="Depth (render order: lower = below)">
            <button class="delete-btn small danger" onclick="deleteMaterialDefinition(${mat.id})" title="Delete">🗑️</button>
        </div>
    `).join('');

    // Setup drag and drop handlers
    setupMaterialDragAndDrop();
}



function updateMaterialName(id, value) {
    const mat = materialDefinitions.find(m => m.id === id);
    if (mat) {
        mat.name = value;
        
    }
}

function updateMaterialMin(id, value) {
    const mat = materialDefinitions.find(m => m.id === id);
    if (mat) {
        mat.minAltitude = parseFloat(value);
        drawGrid();
    }
}

function updateMaterialMax(id, value) {
    const mat = materialDefinitions.find(m => m.id === id);
    if (mat) {
        mat.maxAltitude = parseFloat(value);
        drawGrid();
    }
}

function updateMaterialNumber(id, value) {
    const mat = materialDefinitions.find(m => m.id === id);
    if (mat) mat.materialNumber = parseInt(value);
}

function updateMaterialColor(id, value) {
    const mat = materialDefinitions.find(m => m.id === id);
    if (mat) {
        mat.color = value;
        drawGrid();
    }
}

function updateMaterialDepth(id, value) {
    const mat = materialDefinitions.find(m => m.id === id);
    if (mat) {
        mat.depth = parseInt(value) || 0;
        updateMaterialsList();
        drawGrid();
    }
}

// Drag and drop functionality for materials
let draggedMaterialId = null;

function setupMaterialDragAndDrop() {
    const container = document.getElementById('materialsList');
    const items = container.querySelectorAll('.material-item');
    
    items.forEach(item => {
        item.addEventListener('dragstart', handleMaterialDragStart);
        item.addEventListener('dragend', handleMaterialDragEnd);
        item.addEventListener('dragover', handleMaterialDragOver);
        item.addEventListener('dragenter', handleMaterialDragEnter);
        item.addEventListener('dragleave', handleMaterialDragLeave);
        item.addEventListener('drop', handleMaterialDrop);
    });
}

function handleMaterialDragStart(e) {
    draggedMaterialId = parseInt(this.dataset.materialId);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedMaterialId);
}

function handleMaterialDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.material-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    draggedMaterialId = null;
}

function handleMaterialDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleMaterialDragEnter(e) {
    e.preventDefault();
    const targetId = parseInt(this.dataset.materialId);
    if (targetId !== draggedMaterialId) {
        this.classList.add('drag-over');
    }
}

function handleMaterialDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleMaterialDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    const targetId = parseInt(this.dataset.materialId);
    if (targetId === draggedMaterialId) return;
    
    const draggedMat = materialDefinitions.find(m => m.id === draggedMaterialId);
    const targetMat = materialDefinitions.find(m => m.id === targetId);
    
    if (!draggedMat || !targetMat) return;
    
    // Swap depths
    const tempDepth = draggedMat.depth;
    draggedMat.depth = targetMat.depth;
    targetMat.depth = tempDepth;
    
    updateMaterialsList();
    drawGrid();
}

function toggleRoadMaterial() {
    const checkbox = document.getElementById('roadsAsMaterial');
    const input = document.getElementById('roadMaterialInput');
    input.style.display = checkbox.checked ? 'block' : 'none';
}

function initializeDefaultMaterials() {
    materialDefinitions = [];
    materialIdCounter = 1;
    // depth parameter controls render order (lower = rendered first = appears below)
    addMaterialDefinition(0, 1, 10, 'bg', '#ffffff', 0);
    addMaterialDefinition(0.1, 0.3, 1, 'dry_grass', '#c4a44a', 1);
    addMaterialDefinition(0.25, 0.5, 2, 'green_grass', '#4a8c4a', 2);
    addMaterialDefinition(0.45, 0.6, 3, 'dark_grass', '#2d5c2d', 3);
    addMaterialDefinition(0.7, 0.8, 4, 'sidewalk', '#8c8c8c', 4);
    addMaterialDefinition(0.75, 1.0, 5, 'house_area', '#6b4423', 5);
}

function generateMaterialsArray() {
    if (!grid || grid.length === 0) return [];

    const roadsAsMaterial = document.getElementById('roadsAsMaterial').checked;
    const roadMaterialNum = parseInt(document.getElementById('roadMaterialNumber').value) || 99;

    const materialsArray = [];

    for (let y = 0; y < grid.length; y++) {
        const row = [];
        for (let x = 0; x < grid[y].length; x++) {
            const cell = grid[y][x];

            if (roadsAsMaterial && cell.roadIds.length > 0) {
                row.push(roadMaterialNum);
            } else {
                const altitude = cell.noise;
                let materialNum = 0;

                for (const mat of materialDefinitions) {
                    if (altitude >= mat.minAltitude && altitude < mat.maxAltitude) {
                        materialNum = mat.materialNumber;
                        break;
                    }
                }

                row.push(materialNum);
            }
        }
        materialsArray.push(row);
    }

    return materialsArray;
}

function generateLayeredMaterialsArray() {
    if (!grid || grid.length === 0) return [];

    const roadsAsMaterial = document.getElementById('roadsAsMaterial').checked;
    const roadMaterialNum = parseInt(document.getElementById('roadMaterialNumber').value) || 99;
    const roadDestroyMaterials = document.getElementById('roadDestroyMaterials').checked;

    const layers = [];

    // Sort by depth for layer order (lower depth = first in array)
    const sortedMaterials = [...materialDefinitions].sort((a, b) => a.depth - b.depth);

    // Create a layer for each material definition
    for (const mat of sortedMaterials) {
        const layerData = [];

        for (let y = 0; y < grid.length; y++) {
            const row = [];
            for (let x = 0; x < grid[y].length; x++) {
                const cell = grid[y][x];
                const altitude = cell.noise;

                // Check if this cell belongs to this material
                if (altitude >= mat.minAltitude && altitude < mat.maxAltitude) {
                    // If roadDestroyMaterials is enabled and this cell has a road, clear the material
                    if (roadDestroyMaterials && roadsAsMaterial && cell.roadIds.length > 0) {
                        row.push(0); // Road destroys underlying material
                    } else {
                        row.push(1); // Binary: 1 means this material is present
                    }
                } else {
                    row.push(0);
                }
            }
            layerData.push(row);
        }

        layers.push({
            name: mat.name,
            materialNumber: mat.materialNumber,
            depth: mat.depth,
            data: layerData
        });
    }

    // Add road layer if roads are treated as material
    if (roadsAsMaterial) {
        const roadLayerData = [];

        for (let y = 0; y < grid.length; y++) {
            const row = [];
            for (let x = 0; x < grid[y].length; x++) {
                const cell = grid[y][x];
                row.push(cell.roadIds.length > 0 ? 1 : 0);
            }
            roadLayerData.push(row);
        }

        // Road layer gets highest depth (rendered on top)
        const maxDepth = sortedMaterials.length > 0 
            ? Math.max(...sortedMaterials.map(m => m.depth)) + 1 
            : 0;
        layers.push({
            name: 'Road',
            materialNumber: roadMaterialNum,
            depth: maxDepth,
            data: roadLayerData
        });
    }

    return layers;
}

// ============== EXPORT DATA ==============
function exportMapData() {
    if (!grid || grid.length === 0) {
        showInfo('No map to export. Generate terrain first.');
        return;
    }

    const exportType = document.getElementById('exportType').value;

    const parameters = {
        widthPx: parseInt(document.getElementById('widthPx').value),
        heightPx: parseInt(document.getElementById('heightPx').value),
        tilesX: grid[0].length,
        tilesY: grid.length,
        cellSize: cellSize,
        scale: parseFloat(document.getElementById('scale').value),
        octaves: parseInt(document.getElementById('octaves').value),
        persistence: parseFloat(document.getElementById('persistence').value),
        lacunarity: parseFloat(document.getElementById('lacunarity').value),
        minPassable: MIN_PASSABLE,
        maxPassable: MAX_PASSABLE,
        waterThreshold: WATER_THRESHOLD
    };

    const gridData = [];
    for (let y = 0; y < grid.length; y++) {
        const row = [];
        for (let x = 0; x < grid[y].length; x++) {
            const cell = grid[y][x];
            row.push({
                altitude: parseFloat(cell.noise.toFixed(4)),
                passable: cell.isPassable,
                isWater: cell.isWater,
                hasRoad: cell.roadIds.length > 0
            });
        }
        gridData.push(row);
    }

    // Houses
    const housesData = [];
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            grid[y][x].houses.forEach(house => {
                const worldX = x * cellSize + house.offsetX * cellSize;
                const worldY = y * cellSize + house.offsetY * cellSize;
                housesData.push({
                    x: parseFloat(worldX.toFixed(2)),
                    y: parseFloat(worldY.toFixed(2)),
                    width: house.widthPx,
                    height: house.heightPx
                });
            });
        }
    }

    // Trees
    const treesData = [];
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            grid[y][x].trees.forEach(tree => {
                const worldX = x * cellSize + tree.offsetX * cellSize;
                const worldY = y * cellSize + tree.offsetY * cellSize;
                treesData.push({
                    x: parseFloat(worldX.toFixed(2)),
                    y: parseFloat(worldY.toFixed(2)),
                    radius: tree.crownRadiusPx
                });
            });
        }
    }

    // Rocks
    const rocksData = [];
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            grid[y][x].rocks.forEach(rock => {
                const worldX = x * cellSize + rock.offsetX * cellSize;
                const worldY = y * cellSize + rock.offsetY * cellSize;
                rocksData.push({
                    x: parseFloat(worldX.toFixed(2)),
                    y: parseFloat(worldY.toFixed(2)),
                    radius: rock.radiusPx
                });
            });
        }
    }

    // Roads
    const roadsData = roads.map(road => ({
        id: road.id,
        width: road.width || 1,
        cells: road.cells.map(c => ({
            x: parseFloat((c.x * cellSize).toFixed(2)),
            y: parseFloat((c.y * cellSize).toFixed(2))
        }))
    }));

    const materialsArray = generateMaterialsArray();

    let mapData;
    let filename;

    if (exportType === 'materials') {
        mapData = {
            materials: materialsArray,
            materialDefinitions: materialDefinitions.map(mat => ({
                name: mat.name,
                minAltitude: mat.minAltitude,
                maxAltitude: mat.maxAltitude,
                materialNumber: mat.materialNumber,
                color: mat.color,
                depth: mat.depth
            })).sort((a, b) => a.depth - b.depth),
            materialsConfig: {
                roadsAsMaterial: document.getElementById('roadsAsMaterial').checked,
                roadMaterialNumber: parseInt(document.getElementById('roadMaterialNumber').value) || 99
            },
            metadata: {
                exportDate: new Date().toISOString(),
                gridWidth: grid[0].length,
                gridHeight: grid.length
            }
        };
        filename = `materials_${parameters.tilesX}x${parameters.tilesY}_${Date.now()}.json`;
    } else if (exportType === 'layers') {
        const layers = generateLayeredMaterialsArray();
        mapData = {
            layers: layers
        };
        filename = `layers_${parameters.tilesX}x${parameters.tilesY}_${Date.now()}.json`;
    } else if (exportType === 'objects') {
        mapData = {
            houses: housesData,
            trees: treesData,
            rocks: rocksData,
            roads: roadsData,
            metadata: {
                exportDate: new Date().toISOString(),
                cellSize: cellSize,
                gridWidth: grid[0].length,
                gridHeight: grid.length,
                worldWidth: grid[0].length * cellSize,
                worldHeight: grid.length * cellSize,
                totalHouses: housesData.length,
                totalTrees: treesData.length,
                totalRocks: rocksData.length,
                totalRoads: roadsData.length
            }
        };
        filename = `objects_${parameters.tilesX}x${parameters.tilesY}_${Date.now()}.json`;
    } else {
        mapData = {
            parameters: parameters,
            grid: gridData,
            materials: materialsArray,
            materialDefinitions: materialDefinitions.map(mat => ({
                name: mat.name,
                minAltitude: mat.minAltitude,
                maxAltitude: mat.maxAltitude,
                materialNumber: mat.materialNumber,
                color: mat.color,
                depth: mat.depth
            })).sort((a, b) => a.depth - b.depth),
            materialsConfig: {
                roadsAsMaterial: document.getElementById('roadsAsMaterial').checked,
                roadMaterialNumber: parseInt(document.getElementById('roadMaterialNumber').value) || 99
            },
            entities: {
                houses: housesData,
                trees: treesData,
                rocks: rocksData,
                roads: roadsData
            },
            metadata: {
                exportDate: new Date().toISOString(),
                gridWidth: grid[0].length,
                gridHeight: grid.length,
                totalHouses: housesData.length,
                totalTrees: treesData.length,
                totalRocks: rocksData.length,
                totalRoads: roadsData.length
            }
        };
        filename = `map_${parameters.tilesX}x${parameters.tilesY}_${Date.now()}.json`;
    }

    const jsonString = JSON.stringify(mapData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (exportType === 'materials') {
        showInfo(`Materials exported: ${grid[0].length}x${grid.length} array.`);
    } else if (exportType === 'layers') {
        showInfo(`Layers exported: ${mapData.layers.length} layers (${grid[0].length}x${grid.length} each, binary format).`);
    } else if (exportType === 'objects') {
        showInfo(`Objects exported: ${housesData.length} houses, ${treesData.length} trees, ${rocksData.length} rocks, ${roadsData.length} roads.`);
    } else {
        showInfo(`Map exported: ${housesData.length} houses, ${treesData.length} trees, ${rocksData.length} rocks, ${roadsData.length} roads. Materials: ${grid[0].length}x${grid.length} array.`);
    }
}

// ============== A* PATHFINDING ==============
function aStar(start, end, maxHousesToDestroy = null) {
    if (maxHousesToDestroy === null) {
        maxHousesToDestroy = parseInt(document.getElementById('maxHousesToDestroy').value) || 0;
    }

    const openSet = [start];
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const key = (p) => `${p.x},${p.y}`;
    gScore.set(key(start), 0);
    fScore.set(key(start), heuristic(start, end));

    while (openSet.length > 0) {
        openSet.sort((a, b) => fScore.get(key(a)) - fScore.get(key(b)));
        const current = openSet.shift();

        if (current.x === end.x && current.y === end.y) {
            return reconstructPath(cameFrom, current);
        }

        const neighbors = getNeighbors(current, maxHousesToDestroy);
        for (let neighbor of neighbors) {
            const tentativeGScore = gScore.get(key(current)) + cost(current, neighbor);

            if (!gScore.has(key(neighbor)) || tentativeGScore < gScore.get(key(neighbor))) {
                cameFrom.set(key(neighbor), current);
                gScore.set(key(neighbor), tentativeGScore);
                fScore.set(key(neighbor), tentativeGScore + heuristic(neighbor, end));

                if (!openSet.some(p => p.x === neighbor.x && p.y === neighbor.y)) {
                    openSet.push(neighbor);
                }
            }
        }
    }

    return [];
}

function heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function cost(a, b) {
    if (!grid || !grid[a.y] || !grid[b.y]) return 1;
    const heightDiff = Math.abs(grid[a.y][a.x].noise - grid[b.y][b.x].noise);
    const houseCost = getHouseDestroyCost(b.x, b.y);
    return 1 + heightDiff * 5 + houseCost;
}

function getNeighbors(cell, maxHousesToDestroy) {
    if (!grid || grid.length === 0) return [];

    const neighbors = [];
    const dirs = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];

    for (let dir of dirs) {
        const nx = cell.x + dir.x;
        const ny = cell.y + dir.y;
        if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length) {
            // Don't check altitude during pathfinding - draw complete roads
            if (canBeRoad(nx, ny, maxHousesToDestroy, false)) {
                neighbors.push({ x: nx, y: ny });
            }
        }
    }
    return neighbors;
}

function reconstructPath(cameFrom, current) {
    const path = [current];
    const key = (p) => `${p.x},${p.y}`;

    while (cameFrom.has(key(current))) {
        current = cameFrom.get(key(current));
        path.unshift(current);
    }
    return path;
}

function expandRoadPath(path, width, maxHousesToDestroy) {
    if (width <= 1 || path.length === 0) return path;

    const key = (p) => `${p.x},${p.y}`;
    const expandedSet = new Set();
    const expandedPath = [];

    path.forEach(cell => {
        expandedSet.add(key(cell));
        expandedPath.push({ x: cell.x, y: cell.y });
    });

    let currentLayer = [...path];
    const layersToAdd = width - 1;

    for (let layer = 0; layer < layersToAdd; layer++) {
        const nextLayer = [];

        for (const cell of currentLayer) {
            const neighbors = [
                { x: cell.x, y: cell.y + 1 },
                { x: cell.x + 1, y: cell.y }
            ];

            for (const neighbor of neighbors) {
                const nKey = key(neighbor);

                if (expandedSet.has(nKey)) continue;

                if (neighbor.y < 0 || neighbor.y >= grid.length) continue;
                if (neighbor.x < 0 || neighbor.x >= grid[0].length) continue;

                // Don't check altitude when expanding road width
                if (canBeRoad(neighbor.x, neighbor.y, maxHousesToDestroy, false)) {
                    expandedSet.add(nKey);
                    expandedPath.push({ x: neighbor.x, y: neighbor.y });
                    nextLayer.push(neighbor);
                }
            }
        }

        currentLayer = nextLayer;
    }

    return expandedPath;
}

// ============== UI ==============
function updateUI() {
    updateRoadsList();
    updateHousesList();
    updateRocksList();
    updateTreesList();
    updateStats();
}

function updateRoadsList() {
    const container = document.getElementById('roadsList');
    if (roads.length === 0) {
        container.innerHTML = '<div style="color: #666; font-size: 12px; text-align: center; padding: 10px;">No roads</div>';
        return;
    }

    container.innerHTML = roads.map(road => `
        <div class="entity-item">
            <div class="entity-color" style="background: ${road.color};"></div>
            <span class="name" title="${road.name}: ${road.cells.length} cells, width ${road.width || 1}">${road.name} (${road.cells.length}) w${road.width || 1}</span>
            <button class="visibility-btn small ${road.visible ? '' : 'secondary'}" onclick="toggleRoadVisibility(${road.id})">
                ${road.visible ? '👁️' : '🙈'}
            </button>
            <button class="delete-btn small danger" onclick="deleteRoad(${road.id})">🗑️</button>
        </div>
    `).join('');
}

function updateHousesList() {
    const container = document.getElementById('housesList');
    if (houses.length === 0) {
        container.innerHTML = '<div style="color: #666; font-size: 12px; text-align: center; padding: 10px;">No houses</div>';
        return;
    }

    container.innerHTML = houses.map(group => `
        <div class="entity-item">
            <div class="entity-color" style="background: #e74c3c;"></div>
            <span class="name" title="${group.name}: ${group.count} houses">${group.name} (${group.count})</span>
            <button class="visibility-btn small ${group.visible ? '' : 'secondary'}" onclick="toggleHouseGroupVisibility(${group.id})">
                ${group.visible ? '👁️' : '🙈'}
            </button>
            <button class="delete-btn small danger" onclick="deleteHouseGroup(${group.id})">🗑️</button>
        </div>
    `).join('');
}

function updateRocksList() {
    const container = document.getElementById('rocksList');
    if (rocks.length === 0) {
        container.innerHTML = '<div style="color: #666; font-size: 12px; text-align: center; padding: 10px;">No rocks</div>';
        return;
    }

    container.innerHTML = rocks.map(group => `
        <div class="entity-item">
            <div class="entity-color" style="background: #6b6b6b; border-radius: 50%;"></div>
            <span class="name" title="${group.name}: ${group.count} rocks">${group.name} (${group.count})</span>
            <button class="visibility-btn small ${group.visible ? '' : 'secondary'}" onclick="toggleRockGroupVisibility(${group.id})">
                ${group.visible ? '👁️' : '🙈'}
            </button>
            <button class="delete-btn small danger" onclick="deleteRockGroup(${group.id})">🗑️</button>
        </div>
    `).join('');
}

function updateTreesList() {
    const container = document.getElementById('treesList');
    if (trees.length === 0) {
        container.innerHTML = '<div style="color: #666; font-size: 12px; text-align: center; padding: 10px;">No trees</div>';
        return;
    }

    container.innerHTML = trees.map(group => `
        <div class="entity-item">
            <div class="entity-color" style="background: #228B22; border-radius: 50%;"></div>
            <span class="name" title="${group.name}: ${group.count} trees">${group.name} (${group.count})</span>
            <button class="visibility-btn small ${group.visible ? '' : 'secondary'}" onclick="toggleTreeGroupVisibility(${group.id})">
                ${group.visible ? '👁️' : '🙈'}
            </button>
            <button class="delete-btn small danger" onclick="deleteTreeGroup(${group.id})">🗑️</button>
        </div>
    `).join('');
}

function updateStats() {
    const totalRoadCells = roads.reduce((sum, r) => sum + r.cells.length, 0);
    const totalHouses = houses.reduce((sum, g) => sum + g.count, 0);
    const totalRocks = rocks.reduce((sum, g) => sum + g.count, 0);
    const totalTrees = trees.reduce((sum, g) => sum + g.count, 0);
    const totalCells = grid.length > 0 ? grid.length * grid[0].length : 0;

    document.getElementById('statsRoads').textContent = `Roads: ${roads.length} (${totalRoadCells} cells)`;
    document.getElementById('statsHouses').textContent = `Houses: ${totalHouses}`;
    document.getElementById('statsRocks').textContent = `Rocks: ${totalRocks}`;
    document.getElementById('statsTrees').textContent = `Trees: ${totalTrees}`;
    document.getElementById('statsCells').textContent = `Cells: ${totalCells}`;
}

function showInfo(message) {
    document.getElementById('roadInfo').textContent = message;
}

// ============== INITIALIZATION ==============
window.addEventListener('load', function () {
    initializeDefaultMaterials();
    
    updateTileCountLabels();
    
    // Sync road color from color picker
    roadColor = document.getElementById('roadColor').value;

    generateGrid();

    const canvas = document.getElementById('gridCanvas');
    const container = document.getElementById('canvasContainer');

    canvas.addEventListener('click', handleCanvasClick);
    container.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handlePanStart);
    window.addEventListener('mousemove', handlePanMove);
    window.addEventListener('mouseup', handlePanEnd);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Add input listeners for tile count updates
    document.getElementById('widthPx').addEventListener('input', updateTileCountLabels);
    document.getElementById('heightPx').addEventListener('input', updateTileCountLabels);
    document.getElementById('cellSizeInput').addEventListener('input', updateTileCountLabels);
});
