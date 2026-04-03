// ============== DRAWING ==============

// Offscreen canvas for terrain caching
let terrainOffscreenCanvas = null;

function getCurrentPreviewMetrics() {
  if (!grid || grid.length === 0 || !grid[0]) return null;
  return buildMapMetrics(
    grid[0].length * cellSize,
    grid.length * cellSize,
    cellSize,
    renderScale,
  );
}

function renderTerrainToImageData(width, height, cs) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const cell = grid[y][x];
      const rgb = getTerrainColorRGB(cell.noise);

      const startX = Math.floor(x * cs);
      const startY = Math.floor(y * cs);
      const endX = Math.floor((x + 1) * cs);
      const endY = Math.floor((y + 1) * cs);

      for (let py = startY; py < endY && py < height; py++) {
        for (let px = startX; px < endX && px < width; px++) {
          const idx = (py * width + px) * 4;
          data[idx] = rgb.r;
          data[idx + 1] = rgb.g;
          data[idx + 2] = rgb.b;
          data[idx + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function ensureTerrainCache(canvasWidth, canvasHeight, cs) {
  if (
    !terrainCacheDirty &&
    terrainOffscreenCanvas &&
    terrainOffscreenCanvas.width === canvasWidth &&
    terrainOffscreenCanvas.height === canvasHeight
  ) {
    return;
  }

  terrainOffscreenCanvas = renderTerrainToImageData(
    canvasWidth,
    canvasHeight,
    cs,
  );
  terrainCacheDirty = false;
}

function drawGrid() {
  if (!grid || grid.length === 0 || !grid[0]) return;

  const previewMetrics = getCurrentPreviewMetrics();
  if (previewMetrics && previewMetrics.isPreviewDanger) {
    const message =
      `Preview is very large at ${previewMetrics.previewWidth.toLocaleString()}x${previewMetrics.previewHeight.toLocaleString()} px. ` +
      `Updating it may be slow.`;
    if (document.getElementById("roadInfo")?.textContent !== message) {
      showInfo(message);
    }
  }

  const roadBtn = document.getElementById("flowfieldToggleBtn");
  const sidewalkBtn = document.getElementById("sidewalkFlowfieldBtn");
  if (roadBtn) {
    if (showingFlowfieldType === "roads") {
      roadBtn.classList.add("active");
      roadBtn.textContent = "🧭 Roads ✓";
    } else {
      roadBtn.classList.remove("active");
      roadBtn.textContent = "🧭 Roads";
    }
  }
  if (sidewalkBtn) {
    if (showingFlowfieldType === "sidewalks") {
      sidewalkBtn.classList.add("active");
      sidewalkBtn.textContent = "🚶 Sidewalks ✓";
    } else {
      sidewalkBtn.classList.remove("active");
      sidewalkBtn.textContent = "🚶 Sidewalks";
    }
  }

  const canvas = document.getElementById("gridCanvas");
  const ctx = canvas.getContext("2d");

  const scaledCellSize = cellSize * renderScale;
  const fullWidth = grid[0].length * cellSize;
  const fullHeight = grid.length * cellSize;
  const canvasWidth = Math.ceil(grid[0].length * scaledCellSize);
  const canvasHeight = Math.ceil(grid.length * scaledCellSize);

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  canvas.style.width = fullWidth + "px";
  canvas.style.height = fullHeight + "px";

  applyTransform();

  const cs = scaledCellSize;
  const gridWidth = grid[0].length;
  const gridHeight = grid.length;

  // Build lookup maps for O(1) access
  const cellsWithRoads = new Set();
  const roadColorMap = new Map();
  roads.forEach((road) => {
    if (road.visible) {
      road.cells.forEach((c) => {
        const key = `${c.x},${c.y}`;
        cellsWithRoads.add(key);
        roadColorMap.set(key, road.color);
      });
    }
  });

  const cellsWithSidewalks = new Set();
  roads.forEach((road) => {
    if (road.visible && road.sidewalkCells) {
      road.sidewalkCells.forEach((c) =>
        cellsWithSidewalks.add(`${c.x},${c.y}`),
      );
    }
  });

  // LAYER 1: Draw terrain (cached)
  ensureTerrainCache(canvasWidth, canvasHeight, cs);
  ctx.drawImage(terrainOffscreenCanvas, 0, 0);

  // LAYER 2: Draw all rocks
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const cell = grid[y][x];
      const visibleRocks = cell.rocks.filter((r) => {
        const group = rocks.find((g) => g.id === r.groupId);
        return group && group.visible;
      });

      visibleRocks.forEach((rock) => {
        const rx = x * cs + rock.offsetX * cs;
        const ry = y * cs + rock.offsetY * cs;
        const rRadius = rock.radiusPx * renderScale;

        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.beginPath();
        ctx.ellipse(
          rx + rRadius * 0.15,
          ry + rRadius * 0.15,
          rRadius,
          rRadius * 0.7,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        const grayShade = rock.shade || 100;
        ctx.fillStyle = `rgb(${grayShade}, ${grayShade - 10}, ${grayShade - 5})`;
        ctx.beginPath();
        ctx.arc(rx, ry, rRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.beginPath();
        ctx.arc(
          rx - rRadius * 0.3,
          ry - rRadius * 0.3,
          rRadius * 0.3,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        ctx.strokeStyle = "#4a4a4a";
        ctx.lineWidth = Math.max(0.5, cs * 0.04);
        ctx.beginPath();
        ctx.arc(rx, ry, rRadius, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
  }

  // LAYER 3: Draw all houses
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const cell = grid[y][x];
      const visibleHouses = cell.houses.filter((h) => {
        const group = houses.find((g) => g.id === h.groupId);
        return group && group.visible;
      });

      visibleHouses.forEach((house) => {
        const houseW = house.widthPx * renderScale;
        const houseH = house.heightPx * renderScale;
        const hx = x * cs + house.offsetX * cs;
        const hy = y * cs + house.offsetY * cs;

        ctx.fillStyle = "#e74c3c";
        ctx.fillRect(hx, hy, houseW, houseH);

        ctx.strokeStyle = "#922b21";
        ctx.lineWidth = Math.max(1, renderScale * 2);
        ctx.strokeRect(hx, hy, houseW, houseH);
      });
    }
  }

  // LAYER 4: Draw all trees
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const cell = grid[y][x];
      const visibleTrees = cell.trees.filter((t) => {
        const group = trees.find((g) => g.id === t.groupId);
        return group && group.visible;
      });

      visibleTrees.forEach((tree) => {
        const tx = x * cs + tree.offsetX * cs;
        const ty = y * cs + tree.offsetY * cs;
        const crownRadius = tree.crownRadiusPx * renderScale;

        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.beginPath();
        ctx.ellipse(
          tx + crownRadius * 0.2,
          ty + crownRadius * 0.2,
          crownRadius,
          crownRadius * 0.6,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        ctx.fillStyle = "#1a5f1a";
        ctx.beginPath();
        ctx.arc(tx, ty, crownRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#228B22";
        ctx.beginPath();
        ctx.arc(
          tx - crownRadius * 0.15,
          ty - crownRadius * 0.15,
          crownRadius * 0.7,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        ctx.fillStyle = "rgba(144, 238, 144, 0.4)";
        ctx.beginPath();
        ctx.arc(
          tx - crownRadius * 0.3,
          ty - crownRadius * 0.3,
          crownRadius * 0.35,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        ctx.strokeStyle = "#0d3d0d";
        ctx.lineWidth = Math.max(0.5, cs * 0.04);
        ctx.beginPath();
        ctx.arc(tx, ty, crownRadius, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
  }

  // LAYER 5: Draw all sidewalks (on top of entities)
  ctx.fillStyle = sidewalkColor;
  ctx.beginPath();
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const key = `${x},${y}`;
      if (cellsWithSidewalks.has(key) && !cellsWithRoads.has(key)) {
        ctx.rect(x * cs, y * cs, cs, cs);
      }
    }
  }
  ctx.fill();

  // LAYER 6: Draw all roads (on top of sidewalks and entities)
  const roadsByColor = new Map();
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const key = `${x},${y}`;
      const color = roadColorMap.get(key);
      if (color) {
        if (!roadsByColor.has(color)) {
          roadsByColor.set(color, []);
        }
        roadsByColor.get(color).push({ x, y });
      }
    }
  }

  roadsByColor.forEach((cells, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    cells.forEach((c) => ctx.rect(c.x * cs, c.y * cs, cs, cs));
    ctx.fill();
  });

  // LAYER 7: Draw cell borders (batched as lines)
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = Math.max(1, cs * 0.02);
  ctx.beginPath();

  for (let y = 0; y <= gridHeight; y++) {
    ctx.moveTo(0, y * cs);
    ctx.lineTo(gridWidth * cs, y * cs);
  }
  for (let x = 0; x <= gridWidth; x++) {
    ctx.moveTo(x * cs, 0);
    ctx.lineTo(x * cs, gridHeight * cs);
  }
  ctx.stroke();

  // LAYER 8: Altitude overlay (grayscale)
  if (showAltitudeOverlay) {
    drawAltitudeOverlay(ctx, cs, gridWidth, gridHeight);
  }

  // LAYER 9: Flowfield overlay
  drawFlowfieldOverlay(ctx, cs);

  // LAYER 10: Draw selection borders (batched)
  const selectedSet = new Set(selectedCells.map((c) => `${c.x},${c.y}`));
  if (selectedSet.size > 0) {
    ctx.strokeStyle = "#FF00FF";
    ctx.lineWidth = Math.max(2, cs * 0.08);
    const selOffset = Math.max(1, cs * 0.04);

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        if (selectedSet.has(`${x},${y}`)) {
          ctx.strokeRect(
            x * cs + selOffset,
            y * cs + selOffset,
            cs - 2 * selOffset,
            cs - 2 * selOffset,
          );
        }
      }
    }
  }

  previewDirty = false;
  if (typeof updatePreviewControls === "function") {
    updatePreviewControls();
  }
  updateStats();
}

function renderFullResolution(exportScale = 1) {
  if (!grid || grid.length === 0 || !grid[0]) return null;

  const gridWidth = grid[0].length;
  const gridHeight = grid.length;
  const cs = cellSize * exportScale;
  const canvasWidth = gridWidth * cs;
  const canvasHeight = gridHeight * cs;

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");

  // Build lookup maps
  const cellsWithRoads = new Set();
  const roadColorMap = new Map();
  roads.forEach((road) => {
    if (road.visible) {
      road.cells.forEach((c) => {
        const key = `${c.x},${c.y}`;
        cellsWithRoads.add(key);
        roadColorMap.set(key, road.color);
      });
    }
  });

  const cellsWithSidewalks = new Set();
  roads.forEach((road) => {
    if (road.visible && road.sidewalkCells) {
      road.sidewalkCells.forEach((c) =>
        cellsWithSidewalks.add(`${c.x},${c.y}`),
      );
    }
  });

  // LAYER 1: Terrain via ImageData
  const imageData = ctx.createImageData(canvasWidth, canvasHeight);
  const data = imageData.data;

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const cell = grid[y][x];
      const rgb = getTerrainColorRGB(cell.noise);

      const startX = Math.floor(x * cs);
      const startY = Math.floor(y * cs);
      const endX = Math.floor((x + 1) * cs);
      const endY = Math.floor((y + 1) * cs);

      for (let py = startY; py < endY && py < canvasHeight; py++) {
        for (let px = startX; px < endX && px < canvasWidth; px++) {
          const idx = (py * canvasWidth + px) * 4;
          data[idx] = rgb.r;
          data[idx + 1] = rgb.g;
          data[idx + 2] = rgb.b;
          data[idx + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);

  // LAYER 2: Rocks
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const cell = grid[y][x];
      const visibleRocks = cell.rocks.filter((r) => {
        const group = rocks.find((g) => g.id === r.groupId);
        return group && group.visible;
      });

      visibleRocks.forEach((rock) => {
        const rx = x * cs + rock.offsetX * cs;
        const ry = y * cs + rock.offsetY * cs;
        const rRadius = rock.radiusPx * exportScale;

        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.beginPath();
        ctx.ellipse(
          rx + rRadius * 0.15,
          ry + rRadius * 0.15,
          rRadius,
          rRadius * 0.7,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        const grayShade = rock.shade || 100;
        ctx.fillStyle = `rgb(${grayShade}, ${grayShade - 10}, ${grayShade - 5})`;
        ctx.beginPath();
        ctx.arc(rx, ry, rRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.beginPath();
        ctx.arc(
          rx - rRadius * 0.3,
          ry - rRadius * 0.3,
          rRadius * 0.3,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        ctx.strokeStyle = "#4a4a4a";
        ctx.lineWidth = Math.max(0.5, cs * 0.04);
        ctx.beginPath();
        ctx.arc(rx, ry, rRadius, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
  }

  // LAYER 3: Houses
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const cell = grid[y][x];
      const visibleHouses = cell.houses.filter((h) => {
        const group = houses.find((g) => g.id === h.groupId);
        return group && group.visible;
      });

      visibleHouses.forEach((house) => {
        const houseW = house.widthPx * exportScale;
        const houseH = house.heightPx * exportScale;
        const hx = x * cs + house.offsetX * cs;
        const hy = y * cs + house.offsetY * cs;

        ctx.fillStyle = "#e74c3c";
        ctx.fillRect(hx, hy, houseW, houseH);

        ctx.strokeStyle = "#922b21";
        ctx.lineWidth = Math.max(1, exportScale * 2);
        ctx.strokeRect(hx, hy, houseW, houseH);
      });
    }
  }

  // LAYER 4: Trees
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const cell = grid[y][x];
      const visibleTrees = cell.trees.filter((t) => {
        const group = trees.find((g) => g.id === t.groupId);
        return group && group.visible;
      });

      visibleTrees.forEach((tree) => {
        const tx = x * cs + tree.offsetX * cs;
        const ty = y * cs + tree.offsetY * cs;
        const crownRadius = tree.crownRadiusPx * exportScale;

        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.beginPath();
        ctx.ellipse(
          tx + crownRadius * 0.2,
          ty + crownRadius * 0.2,
          crownRadius,
          crownRadius * 0.6,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        ctx.fillStyle = "#1a5f1a";
        ctx.beginPath();
        ctx.arc(tx, ty, crownRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#228B22";
        ctx.beginPath();
        ctx.arc(
          tx - crownRadius * 0.15,
          ty - crownRadius * 0.15,
          crownRadius * 0.7,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        ctx.fillStyle = "rgba(144, 238, 144, 0.4)";
        ctx.beginPath();
        ctx.arc(
          tx - crownRadius * 0.3,
          ty - crownRadius * 0.3,
          crownRadius * 0.35,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        ctx.strokeStyle = "#0d3d0d";
        ctx.lineWidth = Math.max(0.5, cs * 0.04);
        ctx.beginPath();
        ctx.arc(tx, ty, crownRadius, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
  }

  // LAYER 5: Sidewalks (on top of entities)
  ctx.fillStyle = sidewalkColor;
  ctx.beginPath();
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const key = `${x},${y}`;
      if (cellsWithSidewalks.has(key) && !cellsWithRoads.has(key)) {
        ctx.rect(x * cs, y * cs, cs, cs);
      }
    }
  }
  ctx.fill();

  // LAYER 6: Roads (on top of sidewalks and entities)
  const roadsByColor = new Map();
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const key = `${x},${y}`;
      const color = roadColorMap.get(key);
      if (color) {
        if (!roadsByColor.has(color)) {
          roadsByColor.set(color, []);
        }
        roadsByColor.get(color).push({ x, y });
      }
    }
  }

  roadsByColor.forEach((cells, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    cells.forEach((c) => ctx.rect(c.x * cs, c.y * cs, cs, cs));
    ctx.fill();
  });

  // LAYER 7: Borders
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = Math.max(1, cs * 0.02);
  ctx.beginPath();
  for (let y = 0; y <= gridHeight; y++) {
    ctx.moveTo(0, y * cs);
    ctx.lineTo(gridWidth * cs, y * cs);
  }
  for (let x = 0; x <= gridWidth; x++) {
    ctx.moveTo(x * cs, 0);
    ctx.lineTo(x * cs, gridHeight * cs);
  }
  ctx.stroke();

  return canvas;
}

function drawAltitudeOverlay(ctx, cs, gridWidth, gridHeight) {
  // ctx.globalAlpha = 0.7;

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const cell = grid[y][x];
      const altitude = cell.noise;
      const grayValue = Math.floor(altitude * 255);
      ctx.fillStyle = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
      ctx.fillRect(x * cs, y * cs, cs, cs);
    }
  }

  ctx.globalAlpha = 1.0;
}

function toggleAltitudeOverlay(enabled) {
  showAltitudeOverlay = enabled;
  markPreviewDirty();
}

function exportMapImage(scale = 1) {
  if (!grid || grid.length === 0) {
    showInfo("No map to export. Generate terrain first.");
    return;
  }

  const canvas = renderFullResolution(scale);
  if (!canvas) return;

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `map_${grid[0].length}x${grid.length}_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showInfo(`Map image exported at ${canvas.width}x${canvas.height}px`);
  }, "image/png");
}
