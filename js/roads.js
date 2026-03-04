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
        centerline: basePath,
        visible: true,
        color: roadColor,
        start: { x: start.x, y: start.y },
        end: { x: end.x, y: end.y },
        width: roadWidth,
        sidewalkWidth: defaultSidewalkWidth,
        sidewalkCells: []
    };

    roads.push(roadEntity);
    flowfieldOverlay = null;

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

    if (road.sidewalkCells) {
        road.sidewalkCells.forEach(cell => {
            const cellData = grid[cell.y][cell.x];
            cellData.sidewalkRoadIds = cellData.sidewalkRoadIds.filter(id => id !== roadId);
        });
    }

    roads.splice(roadIndex, 1);
    flowfieldOverlay = null;
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
