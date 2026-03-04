// ============== DRAWING ==============
function drawGrid() {
    if (!grid || grid.length === 0 || !grid[0]) return;

    const btn = document.getElementById('flowfieldToggleBtn');
    if (btn) {
        if (flowfieldOverlay) {
            btn.classList.add('active');
            btn.textContent = '🧭 Hide Flowfield';
        } else {
            btn.classList.remove('active');
            btn.textContent = '🧭 Show Flowfield';
        }
    }

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

    // Build a set of cells with visible sidewalks for quick lookup
    const cellsWithSidewalks = new Set();
    roads.forEach(road => {
        if (road.visible && road.sidewalkCells) {
            road.sidewalkCells.forEach(c => cellsWithSidewalks.add(`${c.x},${c.y}`));
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

    // LAYER 2: Draw all sidewalks
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            if (cellsWithSidewalks.has(`${x},${y}`) && !cellsWithRoads.has(`${x},${y}`)) {
                ctx.fillStyle = sidewalkColor;
                ctx.fillRect(x * cs, y * cs, cs, cs);
            }
        }
    }

    // LAYER 3: Draw all roads
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            const visibleRoad = roads.find(r => r.visible && r.cells.some(c => c.x === x && c.y === y));
            if (visibleRoad) {
                ctx.fillStyle = visibleRoad.color;
                ctx.fillRect(x * cs, y * cs, cs, cs);
            }
        }
    }

    // LAYER 4: Draw cell borders
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = Math.max(1, cs * 0.02);
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            ctx.strokeRect(x * cs, y * cs, cs, cs);
        }
    }

    // LAYER 5: Draw all rocks (only in cells without visible roads)
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

    // LAYER 6: Draw all houses (only in cells without visible roads)
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

    // LAYER 7: Draw all trees
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

    // LAYER 8: Flowfield overlay
    drawFlowfieldOverlay(ctx, cs);

    // LAYER 9: Draw selection borders
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
