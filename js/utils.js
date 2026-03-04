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
