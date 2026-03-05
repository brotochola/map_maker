// ============== FLOWFIELD ==============
function computeFlowfield(sourceCells, respectPassability = true) {
    if (!grid || grid.length === 0) return null;

    const h = grid.length;
    const w = grid[0].length;

    const dist = Array.from({ length: h }, () => new Int32Array(w).fill(-1));
    const dirX = Array.from({ length: h }, () => new Int8Array(w));
    const dirY = Array.from({ length: h }, () => new Int8Array(w));

    const queue = [];
    for (const c of sourceCells) {
        if (c.y >= 0 && c.y < h && c.x >= 0 && c.x < w) {
            dist[c.y][c.x] = 0;
            queue.push(c);
        }
    }

    const dirs = [
        { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
        { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
    ];

    let head = 0;
    while (head < queue.length) {
        const cur = queue[head++];
        const curDist = dist[cur.y][cur.x];

        for (const d of dirs) {
            const nx = cur.x + d.x;
            const ny = cur.y + d.y;

            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            if (dist[ny][nx] !== -1) continue;
            if (respectPassability && !grid[ny][nx].isPassable) continue;

            dist[ny][nx] = curDist + 1;
            dirX[ny][nx] = -d.x;
            dirY[ny][nx] = -d.y;
            queue.push({ x: nx, y: ny });
        }
    }

    const data = [];
    for (let y = 0; y < h; y++) {
        const row = [];
        for (let x = 0; x < w; x++) {
            row.push({
                dx: dirX[y][x],
                dy: dirY[y][x],
                dist: dist[y][x]
            });
        }
        data.push(row);
    }

    return data;
}

function generateRoadFlowfield() {
    if (!grid || grid.length === 0 || roads.length === 0) return null;

    const h = grid.length;
    const w = grid[0].length;

    const field = Array.from({ length: h }, () =>
        Array.from({ length: w }, () => ({ dx: 0, dy: 0, dist: -1 }))
    );

    for (const road of roads) {
        const cl = road.centerline;
        if (!cl || cl.length === 0) continue;

        const clData = [];
        let accumDist = 0;

        for (let i = 0; i < cl.length; i++) {
            let dx, dy;
            if (cl.length === 1) {
                dx = 0; dy = 0;
            } else if (i === 0) {
                dx = cl[1].x - cl[0].x;
                dy = cl[1].y - cl[0].y;
            } else if (i === cl.length - 1) {
                dx = cl[i].x - cl[i - 1].x;
                dy = cl[i].y - cl[i - 1].y;
            } else {
                dx = cl[i + 1].x - cl[i - 1].x;
                dy = cl[i + 1].y - cl[i - 1].y;
            }

            const mag = Math.sqrt(dx * dx + dy * dy);
            if (i > 0) {
                const sx = cl[i].x - cl[i - 1].x;
                const sy = cl[i].y - cl[i - 1].y;
                accumDist += Math.sqrt(sx * sx + sy * sy);
            }

            clData.push({
                x: cl[i].x,
                y: cl[i].y,
                dx: mag > 0 ? dx / mag : 0,
                dy: mag > 0 ? dy / mag : 0,
                dist: accumDist
            });
        }

        const clMap = new Map();
        clData.forEach((c, idx) => clMap.set(`${c.x},${c.y}`, idx));

        for (const cell of road.cells) {
            const clIdx = clMap.get(`${cell.x},${cell.y}`);
            if (clIdx !== undefined) {
                const c = clData[clIdx];
                field[cell.y][cell.x] = { dx: c.dx, dy: c.dy, dist: c.dist };
            } else {
                let minD = Infinity;
                let bestIdx = 0;
                for (let i = 0; i < clData.length; i++) {
                    const d = (cell.x - clData[i].x) ** 2 + (cell.y - clData[i].y) ** 2;
                    if (d < minD) { minD = d; bestIdx = i; }
                }
                const c = clData[bestIdx];
                field[cell.y][cell.x] = { dx: c.dx, dy: c.dy, dist: c.dist };
            }
        }
    }

    smoothFlowfield(field, h, w);

    // Expand attraction zone around roads
    if (roadAttractionWidth > 0) {
        expandAttractionZone(field, h, w, roadAttractionWidth);
    }

    return field;
}

function expandAttractionZone(field, h, w, iterations) {
    const dirs = [
        { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
        { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
    ];

    for (let iter = 0; iter < iterations; iter++) {
        const cellsToAdd = [];

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (field[y][x].dist < 0) continue;

                for (const d of dirs) {
                    const nx = x + d.x;
                    const ny = y + d.y;
                    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                    if (field[ny][nx].dist >= 0) continue;

                    const mag = Math.sqrt(d.x * d.x + d.y * d.y);
                    cellsToAdd.push({
                        x: nx,
                        y: ny,
                        dx: -d.x / mag,
                        dy: -d.y / mag,
                        dist: field[y][x].dist
                    });
                }
            }
        }

        for (const c of cellsToAdd) {
            if (field[c.y][c.x].dist < 0) {
                field[c.y][c.x] = { dx: c.dx, dy: c.dy, dist: c.dist, isAttraction: true };
            }
        }
    }
}

function generateSidewalkFlowfield() {
    if (!grid || grid.length === 0 || roads.length === 0) return null;

    const h = grid.length;
    const w = grid[0].length;

    const field = Array.from({ length: h }, () =>
        Array.from({ length: w }, () => ({ dx: 0, dy: 0, dist: -1, side: null }))
    );

    for (const road of roads) {
        if (!road.sidewalkCells || road.sidewalkCells.length === 0) continue;
        const cl = road.centerline;
        if (!cl || cl.length < 2) continue;

        const clData = [];
        let accumDist = 0;

        for (let i = 0; i < cl.length; i++) {
            let dx, dy;
            if (i === 0) {
                dx = cl[1].x - cl[0].x;
                dy = cl[1].y - cl[0].y;
            } else if (i === cl.length - 1) {
                dx = cl[i].x - cl[i - 1].x;
                dy = cl[i].y - cl[i - 1].y;
            } else {
                dx = cl[i + 1].x - cl[i - 1].x;
                dy = cl[i + 1].y - cl[i - 1].y;
            }

            const mag = Math.sqrt(dx * dx + dy * dy);
            if (i > 0) {
                const sx = cl[i].x - cl[i - 1].x;
                const sy = cl[i].y - cl[i - 1].y;
                accumDist += Math.sqrt(sx * sx + sy * sy);
            }

            clData.push({
                x: cl[i].x,
                y: cl[i].y,
                dx: mag > 0 ? dx / mag : 0,
                dy: mag > 0 ? dy / mag : 0,
                perpX: mag > 0 ? -dy / mag : 0,
                perpY: mag > 0 ? dx / mag : 0,
                dist: accumDist
            });
        }

        for (const swCell of road.sidewalkCells) {
            let minD = Infinity;
            let bestIdx = 0;
            for (let i = 0; i < clData.length; i++) {
                const d = (swCell.x - clData[i].x) ** 2 + (swCell.y - clData[i].y) ** 2;
                if (d < minD) { minD = d; bestIdx = i; }
            }

            const clPoint = clData[bestIdx];
            const toSidewalkX = swCell.x - clPoint.x;
            const toSidewalkY = swCell.y - clPoint.y;
            const dot = toSidewalkX * clPoint.perpX + toSidewalkY * clPoint.perpY;

            let finalDx, finalDy, side;
            if (dot >= 0) {
                finalDx = clPoint.dx;
                finalDy = clPoint.dy;
                side = 'right';
            } else {
                finalDx = -clPoint.dx;
                finalDy = -clPoint.dy;
                side = 'left';
            }

            const existing = field[swCell.y][swCell.x];
            if (existing.dist < 0) {
                field[swCell.y][swCell.x] = {
                    dx: finalDx,
                    dy: finalDy,
                    dist: clPoint.dist,
                    side: side,
                    count: 1
                };
            } else {
                existing.dx += finalDx;
                existing.dy += finalDy;
                existing.count = (existing.count || 1) + 1;
                existing.side = 'mixed';
            }
        }
    }

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const c = field[y][x];
            if (c.dist >= 0 && c.count > 1) {
                const mag = Math.sqrt(c.dx * c.dx + c.dy * c.dy);
                if (mag > 0) {
                    c.dx /= mag;
                    c.dy /= mag;
                }
            }
        }
    }

    smoothFlowfield(field, h, w);

    return field;
}

function smoothFlowfield(field, h, w) {
    const dirs = [
        { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
        { x: -1, y:  0 },                   { x: 1, y:  0 },
        { x: -1, y:  1 }, { x: 0, y:  1 }, { x: 1, y:  1 }
    ];

    const newDx = Array.from({ length: h }, () => new Float64Array(w));
    const newDy = Array.from({ length: h }, () => new Float64Array(w));

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const c = field[y][x];
            if (c.dist < 0) continue;

            let sumX = c.dx;
            let sumY = c.dy;
            let count = 1;

            for (const d of dirs) {
                const nx = x + d.x;
                const ny = y + d.y;
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                const n = field[ny][nx];
                if (n.dist < 0) continue;
                if (n.dx === 0 && n.dy === 0) continue;
                sumX += n.dx;
                sumY += n.dy;
                count++;
            }

            const mag = Math.sqrt(sumX * sumX + sumY * sumY);
            newDx[y][x] = mag > 0 ? sumX / mag : 0;
            newDy[y][x] = mag > 0 ? sumY / mag : 0;
        }
    }

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (field[y][x].dist < 0) continue;
            field[y][x].dx = newDx[y][x];
            field[y][x].dy = newDy[y][x];
        }
    }
}

function toggleFlowfieldOverlay(type = null) {
    const roadBtn = document.getElementById('flowfieldToggleBtn');
    const sidewalkBtn = document.getElementById('sidewalkFlowfieldBtn');

    if (!grid || grid.length === 0) {
        showInfo('Generate terrain first.');
        return;
    }

    if (type === null) {
        if (showingFlowfieldType === 'none') {
            type = 'roads';
        } else {
            type = 'none';
        }
    }

    flowfieldOverlay = null;
    sidewalkFlowfield = null;
    showingFlowfieldType = type;

    if (roadBtn) {
        roadBtn.classList.remove('active');
        roadBtn.textContent = '🧭 Roads';
    }
    if (sidewalkBtn) {
        sidewalkBtn.classList.remove('active');
        sidewalkBtn.textContent = '🚶 Sidewalks';
    }

    if (type === 'roads') {
        if (roads.length === 0) {
            showInfo('No roads to generate flowfield from.');
            showingFlowfieldType = 'none';
            drawGrid();
            return;
        }
        flowfieldOverlay = generateRoadFlowfield();
        if (roadBtn) {
            roadBtn.classList.add('active');
            roadBtn.textContent = '🧭 Roads ✓';
        }
        showInfo('Road flowfield enabled. Arrows show direction along roads + attraction zone.');
    } else if (type === 'sidewalks') {
        const hasSidewalks = roads.some(r => r.sidewalkCells && r.sidewalkCells.length > 0);
        if (!hasSidewalks) {
            showInfo('No sidewalks to generate flowfield from. Generate sidewalks first.');
            showingFlowfieldType = 'none';
            drawGrid();
            return;
        }
        sidewalkFlowfield = generateSidewalkFlowfield();
        if (sidewalkBtn) {
            sidewalkBtn.classList.add('active');
            sidewalkBtn.textContent = '🚶 Sidewalks ✓';
        }
        showInfo('Sidewalk flowfield enabled. Right side walks with traffic, left side against.');
    } else {
        showInfo('Flowfield overlay hidden.');
    }

    drawGrid();
}

function drawFlowfieldOverlay(ctx, cs) {
    const field = flowfieldOverlay || sidewalkFlowfield;
    if (!field) return;

    const isSidewalk = !!sidewalkFlowfield;
    const h = field.length;
    const w = field[0].length;

    let maxDist = 1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (field[y][x].dist > maxDist) {
                maxDist = field[y][x].dist;
            }
        }
    }

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const cell = field[y][x];
            if (cell.dist < 0) continue;

            const cx = x * cs + cs * 0.5;
            const cy = y * cs + cs * 0.5;

            let hue, saturation, lightness, alpha;

            if (isSidewalk) {
                if (cell.side === 'right') {
                    hue = 120;
                    saturation = 80;
                } else if (cell.side === 'left') {
                    hue = 280;
                    saturation = 80;
                } else {
                    hue = 60;
                    saturation = 70;
                }
                lightness = 55;
                alpha = 0.9;
            } else {
                const t = maxDist > 0 ? Math.min(cell.dist / maxDist, 1) : 0;
                if (cell.isAttraction) {
                    hue = 30;
                    saturation = 100;
                    lightness = 50;
                    alpha = 0.7;
                } else {
                    hue = 180 - t * 120;
                    saturation = 90;
                    lightness = 60;
                    alpha = 0.9;
                }
            }

            ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
            ctx.fillStyle = ctx.strokeStyle;

            const mag = Math.sqrt(cell.dx * cell.dx + cell.dy * cell.dy);
            if (mag < 0.001) {
                ctx.beginPath();
                ctx.arc(cx, cy, Math.max(1.5, cs * 0.1), 0, Math.PI * 2);
                ctx.fill();
                continue;
            }

            const len = cs * 0.38;
            const tailLen = len * 0.3;
            const sx = cx - cell.dx * tailLen;
            const sy = cy - cell.dy * tailLen;
            const ex = cx + cell.dx * len;
            const ey = cy + cell.dy * len;

            ctx.lineWidth = Math.max(1, cs * 0.06);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
            ctx.stroke();

            const headLen = Math.max(2, cs * 0.15);
            const angle = Math.atan2(cell.dy, cell.dx);
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(
                ex - headLen * Math.cos(angle - 0.5),
                ey - headLen * Math.sin(angle - 0.5)
            );
            ctx.lineTo(
                ex - headLen * Math.cos(angle + 0.5),
                ey - headLen * Math.sin(angle + 0.5)
            );
            ctx.closePath();
            ctx.fill();
        }
    }
}

function resetFlowfieldButtons() {
    const roadBtn = document.getElementById('flowfieldToggleBtn');
    const sidewalkBtn = document.getElementById('sidewalkFlowfieldBtn');

    if (roadBtn) {
        roadBtn.classList.remove('active');
        roadBtn.textContent = '🧭 Roads';
    }
    if (sidewalkBtn) {
        sidewalkBtn.classList.remove('active');
        sidewalkBtn.textContent = '🚶 Sidewalks';
    }
}
