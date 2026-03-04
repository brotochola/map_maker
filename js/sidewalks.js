// ============== SIDEWALKS ==============
function expandSidewalk(road) {
    if (!road.sidewalkWidth || road.sidewalkWidth < 1) return [];

    const roadCellSet = new Set();
    roads.forEach(r => r.cells.forEach(c => roadCellSet.add(`${c.x},${c.y}`)));

    const visited = new Set();
    road.cells.forEach(c => visited.add(`${c.x},${c.y}`));

    let currentLayer = [...road.cells];
    const sidewalkCells = [];
    const dirs = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];

    for (let layer = 0; layer < road.sidewalkWidth; layer++) {
        const nextLayer = [];

        for (const cell of currentLayer) {
            for (const dir of dirs) {
                const nx = cell.x + dir.x;
                const ny = cell.y + dir.y;
                const key = `${nx},${ny}`;

                if (visited.has(key)) continue;
                visited.add(key);

                if (ny < 0 || ny >= grid.length || nx < 0 || nx >= grid[0].length) continue;

                const cellData = grid[ny][nx];
                if (!cellData.isPassable) continue;

                if (roadCellSet.has(key)) continue;

                sidewalkCells.push({ x: nx, y: ny });
                nextLayer.push({ x: nx, y: ny });
            }
        }

        currentLayer = nextLayer;
    }

    return sidewalkCells;
}

function generateSidewalks() {
    if (!grid || grid.length === 0) {
        showInfo('Generate terrain first.');
        return;
    }
    if (roads.length === 0) {
        showInfo('No roads to generate sidewalks from.');
        return;
    }

    clearAllSidewalks(true);

    sidewalkDestroyEntities = document.getElementById('sidewalkDestroyEntities').checked;

    let totalSidewalkCells = 0;
    let destroyedHouses = 0;
    let destroyedRocks = 0;
    let destroyedTrees = 0;

    for (const road of roads) {
        const swCells = expandSidewalk(road);
        road.sidewalkCells = swCells;

        for (const cell of swCells) {
            const cellData = grid[cell.y][cell.x];
            if (!cellData.sidewalkRoadIds.includes(road.id)) {
                cellData.sidewalkRoadIds.push(road.id);
            }

            if (sidewalkDestroyEntities) {
                if (cellData.houses.length > 0) {
                    destroyedHouses += cellData.houses.length;
                    cellData.houses.forEach(house => {
                        const group = houses.find(g => g.id === house.groupId);
                        if (group) group.count--;
                    });
                    cellData.houses = [];
                }
                if (cellData.rocks.length > 0) {
                    destroyedRocks += cellData.rocks.length;
                    cellData.rocks.forEach(rock => {
                        const group = rocks.find(g => g.id === rock.groupId);
                        if (group) group.count--;
                    });
                    cellData.rocks = [];
                }
                if (cellData.trees.length > 0) {
                    destroyedTrees += cellData.trees.length;
                    cellData.trees.forEach(tree => {
                        const group = trees.find(g => g.id === tree.groupId);
                        if (group) group.count--;
                    });
                    cellData.trees = [];
                }
            }
        }

        totalSidewalkCells += swCells.length;
    }

    if (sidewalkDestroyEntities) {
        houses = houses.filter(g => g.count > 0);
        rocks = rocks.filter(g => g.count > 0);
        trees = trees.filter(g => g.count > 0);
    }

    updateUI();
    drawGrid();

    let msg = `Sidewalks generated: ${totalSidewalkCells} cells across ${roads.length} roads.`;
    const destroyed = [];
    if (destroyedHouses > 0) destroyed.push(`${destroyedHouses} houses`);
    if (destroyedRocks > 0) destroyed.push(`${destroyedRocks} rocks`);
    if (destroyedTrees > 0) destroyed.push(`${destroyedTrees} trees`);
    if (destroyed.length > 0) msg += ` Destroyed: ${destroyed.join(', ')}.`;
    showInfo(msg);
}

function clearAllSidewalks(silent = false) {
    for (const road of roads) {
        road.sidewalkCells = [];
    }

    if (grid && grid.length > 0) {
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                grid[y][x].sidewalkRoadIds = [];
            }
        }
    }

    if (!silent) {
        updateUI();
        drawGrid();
        showInfo('All sidewalks removed.');
    }
}

function updateSidewalkWidth(roadId, width) {
    const road = roads.find(r => r.id === roadId);
    if (road) {
        road.sidewalkWidth = parseInt(width) || 0;
    }
}

function updateAllSidewalkColors(newColor) {
    sidewalkColor = newColor;
    drawGrid();
}
