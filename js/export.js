// ============== EXPORT DATA ==============
function exportMapData() {
    if (!grid || grid.length === 0) {
        showInfo('No map to export. Generate terrain first.');
        return;
    }

    const exportType = document.getElementById('exportType').value;

    const parameters = {
        widthPx: parseInt(document.getElementById('widthPx').value),
        heightPx: parseInt(document.getElementById('heightPx').value),
        tilesX: grid[0].length,
        tilesY: grid.length,
        cellSize: cellSize,
        scale: parseFloat(document.getElementById('scale').value),
        octaves: parseInt(document.getElementById('octaves').value),
        persistence: parseFloat(document.getElementById('persistence').value),
        lacunarity: parseFloat(document.getElementById('lacunarity').value),
        minPassable: MIN_PASSABLE,
        maxPassable: MAX_PASSABLE,
        waterThreshold: WATER_THRESHOLD
    };

    const gridData = [];
    for (let y = 0; y < grid.length; y++) {
        const row = [];
        for (let x = 0; x < grid[y].length; x++) {
            const cell = grid[y][x];
            row.push({
                altitude: parseFloat(cell.noise.toFixed(4)),
                passable: cell.isPassable,
                isWater: cell.isWater,
                hasRoad: cell.roadIds.length > 0,
                hasSidewalk: cell.sidewalkRoadIds.length > 0
            });
        }
        gridData.push(row);
    }

    // Houses
    const housesData = [];
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            grid[y][x].houses.forEach(house => {
                const worldX = x * cellSize + house.offsetX * cellSize;
                const worldY = y * cellSize + house.offsetY * cellSize;
                housesData.push({
                    x: parseFloat(worldX.toFixed(2)),
                    y: parseFloat(worldY.toFixed(2)),
                    width: house.widthPx,
                    height: house.heightPx
                });
            });
        }
    }

    // Trees
    const treesData = [];
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            grid[y][x].trees.forEach(tree => {
                const worldX = x * cellSize + tree.offsetX * cellSize;
                const worldY = y * cellSize + tree.offsetY * cellSize;
                treesData.push({
                    x: parseFloat(worldX.toFixed(2)),
                    y: parseFloat(worldY.toFixed(2)),
                    radius: tree.crownRadiusPx
                });
            });
        }
    }

    // Rocks
    const rocksData = [];
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            grid[y][x].rocks.forEach(rock => {
                const worldX = x * cellSize + rock.offsetX * cellSize;
                const worldY = y * cellSize + rock.offsetY * cellSize;
                rocksData.push({
                    x: parseFloat(worldX.toFixed(2)),
                    y: parseFloat(worldY.toFixed(2)),
                    radius: rock.radiusPx
                });
            });
        }
    }

    // Roads
    const roadsData = roads.map(road => ({
        id: road.id,
        width: road.width || 1,
        cells: road.cells.map(c => ({
            x: parseFloat((c.x * cellSize).toFixed(2)),
            y: parseFloat((c.y * cellSize).toFixed(2))
        }))
    }));

    // Sidewalks
    const sidewalksData = [];
    for (const road of roads) {
        if (road.sidewalkCells && road.sidewalkCells.length > 0) {
            road.sidewalkCells.forEach(c => {
                sidewalksData.push({
                    x: parseFloat((c.x * cellSize).toFixed(2)),
                    y: parseFloat((c.y * cellSize).toFixed(2)),
                    roadId: road.id
                });
            });
        }
    }

    const materialsArray = generateMaterialsArray();

    let mapData;
    let filename;

    if (exportType === 'materials') {
        mapData = {
            materials: materialsArray,
            materialDefinitions: materialDefinitions.map(mat => ({
                name: mat.name,
                minAltitude: mat.minAltitude,
                maxAltitude: mat.maxAltitude,
                materialNumber: mat.materialNumber,
                color: mat.color,
                depth: mat.depth
            })).sort((a, b) => a.depth - b.depth),
            materialsConfig: {
                roadsAsMaterial: document.getElementById('roadsAsMaterial').checked,
                roadMaterialNumber: parseInt(document.getElementById('roadMaterialNumber').value) || 99,
                sidewalksAsMaterial: document.getElementById('sidewalksAsMaterial').checked,
                sidewalkMaterialNumber: parseInt(document.getElementById('sidewalkMaterialNumber').value) || 98
            },
            metadata: {
                exportDate: new Date().toISOString(),
                widthCells: grid[0].length,
                heightCells: grid.length,
                widthPx: grid[0].length * cellSize,
                heightPx: grid.length * cellSize,
                cellSizePx: cellSize
            }
        };
        filename = `materials_${parameters.tilesX}x${parameters.tilesY}_${Date.now()}.json`;
    } else if (exportType === 'layers') {
        const layers = generateLayeredMaterialsArray();
        mapData = {
            layers: layers,
            metadata: {
                exportDate: new Date().toISOString(),
                widthCells: grid[0].length,
                heightCells: grid.length,
                widthPx: grid[0].length * cellSize,
                heightPx: grid.length * cellSize,
                cellSizePx: cellSize
            }
        };
        filename = `layers_${parameters.tilesX}x${parameters.tilesY}_${Date.now()}.json`;
    } else if (exportType === 'objects') {
        mapData = {
            houses: housesData,
            trees: treesData,
            rocks: rocksData,
            roads: roadsData,
            sidewalks: sidewalksData,
            metadata: {
                exportDate: new Date().toISOString(),
                widthCells: grid[0].length,
                heightCells: grid.length,
                widthPx: grid[0].length * cellSize,
                heightPx: grid.length * cellSize,
                cellSizePx: cellSize,
                totalHouses: housesData.length,
                totalTrees: treesData.length,
                totalRocks: rocksData.length,
                totalRoads: roadsData.length,
                totalSidewalks: sidewalksData.length
            }
        };
        filename = `objects_${parameters.tilesX}x${parameters.tilesY}_${Date.now()}.json`;
    } else if (exportType === 'flowfield_roads') {
        const rawField = generateRoadFlowfield();
        if (!rawField) {
            showInfo('No roads to generate flowfield from.');
            return;
        }
        const exportField = rawField.map(row => row.map(c =>
            c.dist < 0 ? null : [parseFloat(c.dx.toFixed(4)), parseFloat(c.dy.toFixed(4))]
        ));
        mapData = {
            name: 'roads',
            description: 'Each cell: [dx, dy] = normalized direction along road (+ attraction zone), or null if not covered.',
            metadata: {
                widthCells: grid[0].length,
                heightCells: grid.length,
                widthPx: grid[0].length * cellSize,
                heightPx: grid.length * cellSize,
                cellSizePx: cellSize,
                totalRoads: roads.length,
                attractionWidth: roadAttractionWidth
            },
            data: exportField
        };
        filename = `flowfield_roads_${parameters.tilesX}x${parameters.tilesY}_${Date.now()}.json`;
    } else if (exportType === 'flowfield_sidewalks') {
        const rawField = generateSidewalkFlowfield();
        if (!rawField) {
            showInfo('No sidewalks to generate flowfield from.');
            return;
        }
        const exportField = rawField.map(row => row.map(c =>
            c.dist < 0 ? null : [parseFloat(c.dx.toFixed(4)), parseFloat(c.dy.toFixed(4))]
        ));
        mapData = {
            name: 'sidewalks',
            description: 'Each cell: [dx, dy] = normalized direction along sidewalk (+ attraction zone), or null if not covered.',
            metadata: {
                widthCells: grid[0].length,
                heightCells: grid.length,
                widthPx: grid[0].length * cellSize,
                heightPx: grid.length * cellSize,
                cellSizePx: cellSize,
                attractionWidth: sidewalkAttractionWidth
            },
            data: exportField
        };
        filename = `flowfield_sidewalks_${parameters.tilesX}x${parameters.tilesY}_${Date.now()}.json`;
    } else if (exportType === 'flowfields_all') {
        const roadsField = generateRoadFlowfield();
        const sidewalksField = generateSidewalkFlowfield();

        const roadsExport = roadsField ? roadsField.map(row => row.map(c =>
            c.dist < 0 ? null : [parseFloat(c.dx.toFixed(4)), parseFloat(c.dy.toFixed(4))]
        )) : null;

        const sidewalksExport = sidewalksField ? sidewalksField.map(row => row.map(c =>
            c.dist < 0 ? null : [parseFloat(c.dx.toFixed(4)), parseFloat(c.dy.toFixed(4))]
        )) : null;

        mapData = {
            Flowfields: {
                roads: roadsExport,
                sidewalks: sidewalksExport
            },
            metadata: {
                widthCells: grid[0].length,
                heightCells: grid.length,
                widthPx: grid[0].length * cellSize,
                heightPx: grid.length * cellSize,
                cellSizePx: cellSize,
                totalRoads: roads.length,
                roadAttractionWidth: roadAttractionWidth,
                sidewalkAttractionWidth: sidewalkAttractionWidth
            }
        };
        filename = `flowfields_${parameters.tilesX}x${parameters.tilesY}_${Date.now()}.json`;
    } else {
        mapData = {
            parameters: parameters,
            grid: gridData,
            materials: materialsArray,
            materialDefinitions: materialDefinitions.map(mat => ({
                name: mat.name,
                minAltitude: mat.minAltitude,
                maxAltitude: mat.maxAltitude,
                materialNumber: mat.materialNumber,
                color: mat.color,
                depth: mat.depth
            })).sort((a, b) => a.depth - b.depth),
            materialsConfig: {
                roadsAsMaterial: document.getElementById('roadsAsMaterial').checked,
                roadMaterialNumber: parseInt(document.getElementById('roadMaterialNumber').value) || 99,
                sidewalksAsMaterial: document.getElementById('sidewalksAsMaterial').checked,
                sidewalkMaterialNumber: parseInt(document.getElementById('sidewalkMaterialNumber').value) || 98
            },
            entities: {
                houses: housesData,
                trees: treesData,
                rocks: rocksData,
                roads: roadsData,
                sidewalks: sidewalksData
            },
            metadata: {
                exportDate: new Date().toISOString(),
                widthCells: grid[0].length,
                heightCells: grid.length,
                widthPx: grid[0].length * cellSize,
                heightPx: grid.length * cellSize,
                cellSizePx: cellSize,
                totalHouses: housesData.length,
                totalTrees: treesData.length,
                totalRocks: rocksData.length,
                totalRoads: roadsData.length,
                totalSidewalks: sidewalksData.length
            }
        };
        filename = `map_${parameters.tilesX}x${parameters.tilesY}_${Date.now()}.json`;
    }

    const jsonString = JSON.stringify(mapData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (exportType === 'materials') {
        showInfo(`Materials exported: ${grid[0].length}x${grid.length} array.`);
    } else if (exportType === 'layers') {
        showInfo(`Layers exported: ${mapData.layers.length} layers (${grid[0].length}x${grid.length} each, binary format).`);
    } else if (exportType === 'objects') {
        showInfo(`Objects exported: ${housesData.length} houses, ${treesData.length} trees, ${rocksData.length} rocks, ${roadsData.length} roads, ${sidewalksData.length} sidewalk cells.`);
    } else if (exportType === 'flowfield_roads') {
        showInfo(`Road flowfield exported: ${grid[0].length}x${grid.length} grid with ${roadAttractionWidth}-cell attraction zone.`);
    } else if (exportType === 'flowfield_sidewalks') {
        showInfo(`Sidewalk flowfield exported: ${grid[0].length}x${grid.length} grid with ${sidewalkAttractionWidth}-cell attraction zone. Right=with traffic, Left=against.`);
    } else if (exportType === 'flowfields_all') {
        showInfo(`All flowfields exported: Roads + Sidewalks in ${grid[0].length}x${grid.length} grid.`);
    } else {
        showInfo(`Map exported: ${housesData.length} houses, ${treesData.length} trees, ${rocksData.length} rocks, ${roadsData.length} roads, ${sidewalksData.length} sidewalk cells.`);
    }
}
