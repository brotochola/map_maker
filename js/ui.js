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
            <span class="name" title="${road.name}: ${road.cells.length} cells, width ${road.width || 1}, sw:${road.sidewalkCells ? road.sidewalkCells.length : 0}">${road.name} (${road.cells.length}) w${road.width || 1}</span>
            <input type="number" value="${road.sidewalkWidth || 0}" min="0" max="10"
                   onchange="updateSidewalkWidth(${road.id}, this.value)"
                   title="Sidewalk width (tiles)" style="width: 40px; padding: 2px 4px; font-size: 11px;">
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
    const totalSidewalkCells = roads.reduce((sum, r) => sum + (r.sidewalkCells ? r.sidewalkCells.length : 0), 0);
    const totalHouses = houses.reduce((sum, g) => sum + g.count, 0);
    const totalRocks = rocks.reduce((sum, g) => sum + g.count, 0);
    const totalTrees = trees.reduce((sum, g) => sum + g.count, 0);
    const totalCells = grid.length > 0 ? grid.length * grid[0].length : 0;

    document.getElementById('statsRoads').textContent = `Roads: ${roads.length} (${totalRoadCells} cells)`;
    document.getElementById('statsSidewalks').textContent = `Sidewalks: ${totalSidewalkCells} cells`;
    document.getElementById('statsHouses').textContent = `Houses: ${totalHouses}`;
    document.getElementById('statsRocks').textContent = `Rocks: ${totalRocks}`;
    document.getElementById('statsTrees').textContent = `Trees: ${totalTrees}`;
    document.getElementById('statsCells').textContent = `Cells: ${totalCells}`;
}

function showInfo(message) {
    document.getElementById('roadInfo').textContent = message;
}

function clearAll() {
    roads = [];
    houses = [];
    rocks = [];
    trees = [];
    flowfieldOverlay = null;
    sidewalkFlowfield = null;
    showingFlowfieldType = 'none';
    resetFlowfieldButtons();
    roadIdCounter = 1;
    houseGroupIdCounter = 1;
    rockGroupIdCounter = 1;
    treeGroupIdCounter = 1;
    selectedCells = [];

    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            grid[y][x].roadIds = [];
            grid[y][x].sidewalkRoadIds = [];
            grid[y][x].houses = [];
            grid[y][x].rocks = [];
            grid[y][x].trees = [];
        }
    }

    updateUI();
    drawGrid();
    showInfo('Everything cleared.');
}
