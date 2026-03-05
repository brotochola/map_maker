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
            if (cell.roadIds.length > 0 || cell.sidewalkRoadIds.length > 0) continue;

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
