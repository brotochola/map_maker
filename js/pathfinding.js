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
