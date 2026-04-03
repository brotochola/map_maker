// ============== SIDEWALKS ==============
function expandSidewalk(road, overlap = 0) {
  if (!road.sidewalkWidth || road.sidewalkWidth < 1) return [];

  // Build set of all road cells (from all roads)
  const roadCellSet = new Set();
  roads.forEach((r) =>
    r.cells.forEach((c) => roadCellSet.add(`${c.x},${c.y}`)),
  );

  const visited = new Set();
  // Mark all road cells as visited (so we expand outward from them)
  road.cells.forEach((c) => visited.add(`${c.x},${c.y}`));

  const sidewalkCells = [];
  const radius = road.sidewalkWidth;

  // For each road cell, add all cells within radius that aren't road cells
  for (const roadCell of road.cells) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = roadCell.x + dx;
        const ny = roadCell.y + dy;
        const key = `${nx},${ny}`;

        // Skip if already processed
        if (visited.has(key)) continue;
        visited.add(key);

        // Check grid bounds only - expand to ALL cells regardless of altitude/materials
        if (ny < 0 || ny >= grid.length || nx < 0 || nx >= grid[0].length)
          continue;

        // Skip if it's part of any road
        if (roadCellSet.has(key)) continue;

        sidewalkCells.push({ x: nx, y: ny });
      }
    }
  }

  // Add overlap: include road edge cells within `overlap` distance of non-road cells
  if (overlap > 0) {
    const addedOverlap = new Set();
    for (const roadCell of road.cells) {
      const cellKey = `${roadCell.x},${roadCell.y}`;
      if (addedOverlap.has(cellKey)) continue;

      // Calculate minimum distance to a non-road cell
      let minDistToEdge = Infinity;
      for (let dy = -overlap; dy <= overlap; dy++) {
        for (let dx = -overlap; dx <= overlap; dx++) {
          const nx = roadCell.x + dx;
          const ny = roadCell.y + dy;
          const key = `${nx},${ny}`;

          // Check if this neighbor is a non-road cell (or out of bounds)
          const isNonRoad =
            ny < 0 ||
            ny >= grid.length ||
            nx < 0 ||
            nx >= grid[0].length ||
            !roadCellSet.has(key);

          if (isNonRoad) {
            const dist = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev distance
            minDistToEdge = Math.min(minDistToEdge, dist);
          }
        }
      }

      // If this road cell is within `overlap` distance of the edge, include it in sidewalk
      if (minDistToEdge <= overlap) {
        addedOverlap.add(cellKey);
        sidewalkCells.push({ x: roadCell.x, y: roadCell.y });
      }
    }
  }

  return sidewalkCells;
}

function generateSidewalks() {
  if (!grid || grid.length === 0) {
    showInfo("Generate terrain first.");
    return;
  }
  if (roads.length === 0) {
    showInfo("No roads to generate sidewalks from.");
    return;
  }

  clearAllSidewalks(true);

  // Read current sidewalk width from input and apply to all roads
  const sidewalkWidth =
    parseInt(document.getElementById("defaultSidewalkWidth").value) || 0;
  const overlap =
    parseInt(document.getElementById("sidewalkOverlap").value) || 0;

  for (const road of roads) {
    road.sidewalkWidth = sidewalkWidth;
  }

  let totalSidewalkCells = 0;

  // Sidewalks are a material layer - just mark cells, don't destroy entities
  for (const road of roads) {
    const swCells = expandSidewalk(road, overlap);
    road.sidewalkCells = swCells;

    for (const cell of swCells) {
      const cellData = grid[cell.y][cell.x];
      if (!cellData.sidewalkRoadIds.includes(road.id)) {
        cellData.sidewalkRoadIds.push(road.id);
      }
    }

    totalSidewalkCells += swCells.length;
  }

  updateUI();
  drawGrid();

  let msg = `Sidewalks generated: ${totalSidewalkCells} cells across ${roads.length} roads.`;
  if (overlap > 0) msg += ` (${overlap} cell overlap with road)`;
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
    showInfo("All sidewalks removed.");
  }
}

function updateSidewalkWidth(roadId, width) {
  const road = roads.find((r) => r.id === roadId);
  if (road) {
    road.sidewalkWidth = parseInt(width) || 0;
  }
}

function updateAllSidewalkColors(newColor) {
  sidewalkColor = newColor;
  markPreviewDirty();
}
