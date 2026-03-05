// ============== HOUSES ==============
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
            if (!cellData.isPassable || cellData.roadIds.length > 0 || cellData.sidewalkRoadIds.length > 0) {
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
            if (cell.roadIds.length > 0 || cell.sidewalkRoadIds.length > 0) continue;

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
