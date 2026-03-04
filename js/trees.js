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
