function isPassable(x, y) {
    if (!grid || !grid[y] || !grid[y][x]) return false;
    return grid[y][x].isPassable;
}

function canBeRoad(x, y, maxHousesToDestroy = null, checkAltitude = true, checkPassability = true) {
    if (!grid || !grid[y] || !grid[y][x]) return false;
    const cell = grid[y][x];
    
    // Only check passability if specified (skip for pathfinding to allow roads anywhere)
    if (checkPassability && !cell.isPassable) return false;

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
            // Skip altitude and passability checks - allow roads on any cell
            if (canBeRoad(nx, ny, maxHousesToDestroy, false, false)) {
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

    // Calculate the radius to expand from each centerline cell
    // For width W, we want W cells total, so radius = floor((W-1)/2)
    const radius = Math.floor((width - 1) / 2);

    // For each cell in the centerline, add all cells within the radius
    // This guarantees consistent width regardless of path direction
    for (const centerCell of path) {
        // Add all cells in a square of size (2*radius+1) centered on this cell
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = centerCell.x + dx;
                const ny = centerCell.y + dy;
                const nKey = key({ x: nx, y: ny });

                // Skip if already added
                if (expandedSet.has(nKey)) continue;

                // Check grid bounds only - expand to ALL cells regardless of altitude/materials
                if (ny < 0 || ny >= grid.length) continue;
                if (nx < 0 || nx >= grid[0].length) continue;

                expandedSet.add(nKey);
                expandedPath.push({ x: nx, y: ny });
            }
        }
    }

    return expandedPath;
}
