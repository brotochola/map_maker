// ============== SAVE / LOAD MAP ==============

const SAVEFILE_VERSION = 1;

function saveMap() {
    if (!grid || grid.length === 0) {
        showInfo('No map to save. Generate terrain first.');
        return;
    }

    const saveData = {
        version: SAVEFILE_VERSION,
        savedAt: new Date().toISOString(),

        // Core grid data
        grid: grid.map(row => row.map(cell => ({
            noise: cell.noise,
            isPassable: cell.isPassable,
            isWater: cell.isWater,
            roadIds: cell.roadIds,
            sidewalkRoadIds: cell.sidewalkRoadIds,
            houses: cell.houses,
            rocks: cell.rocks,
            trees: cell.trees
        }))),

        // Entity groups
        roads: roads,
        houses: houses,
        rocks: rocks,
        trees: trees,

        // Counters (to prevent ID collisions on new entities)
        counters: {
            roadIdCounter: roadIdCounter,
            houseGroupIdCounter: houseGroupIdCounter,
            rockGroupIdCounter: rockGroupIdCounter,
            treeGroupIdCounter: treeGroupIdCounter,
            materialIdCounter: materialIdCounter
        },

        // Settings
        cellSize: cellSize,
        materialDefinitions: materialDefinitions,
        roadColor: roadColor,
        sidewalkColor: sidewalkColor,
        defaultSidewalkWidth: defaultSidewalkWidth,
        roadAttractionWidth: roadAttractionWidth,
        
        // Road and sidewalk material settings
        roadMaterialDepth: roadMaterialDepth,
        sidewalkMaterialDepth: sidewalkMaterialDepth,
        roadMaterialNumber: roadMaterialNumber,
        sidewalkMaterialNumber: sidewalkMaterialNumber,

        // UI parameters (so terrain panel shows correct values)
        uiParams: {
            widthPx: parseInt(document.getElementById('widthPx').value),
            heightPx: parseInt(document.getElementById('heightPx').value),
            cellSizeInput: parseInt(document.getElementById('cellSizeInput').value),
            scale: parseFloat(document.getElementById('scale').value),
            octaves: parseInt(document.getElementById('octaves').value),
            persistence: parseFloat(document.getElementById('persistence').value),
            lacunarity: parseFloat(document.getElementById('lacunarity').value)
        }
    };

    const jsonString = JSON.stringify(saveData);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const filename = `map_save_${grid[0].length}x${grid.length}_${Date.now()}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showInfo(`Map saved: ${filename}`);
}

function loadMap() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const saveData = JSON.parse(event.target.result);
                applyLoadedMap(saveData);
            } catch (err) {
                showInfo('Failed to load map: Invalid file format.');
                console.error('Load error:', err);
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

function applyLoadedMap(saveData) {
    if (!saveData.grid || !Array.isArray(saveData.grid)) {
        showInfo('Failed to load map: Missing grid data.');
        return;
    }

    // Restore grid
    grid = saveData.grid.map(row => row.map(cell => ({
        noise: cell.noise,
        isPassable: cell.isPassable,
        isWater: cell.isWater,
        roadIds: cell.roadIds || [],
        sidewalkRoadIds: cell.sidewalkRoadIds || [],
        houses: cell.houses || [],
        rocks: cell.rocks || [],
        trees: cell.trees || []
    })));

    // Restore entity groups
    roads = saveData.roads || [];
    houses = saveData.houses || [];
    rocks = saveData.rocks || [];
    trees = saveData.trees || [];

    // Restore counters
    if (saveData.counters) {
        roadIdCounter = saveData.counters.roadIdCounter || 1;
        houseGroupIdCounter = saveData.counters.houseGroupIdCounter || 1;
        rockGroupIdCounter = saveData.counters.rockGroupIdCounter || 1;
        treeGroupIdCounter = saveData.counters.treeGroupIdCounter || 1;
        materialIdCounter = saveData.counters.materialIdCounter || 1;
    }

    // Restore settings
    cellSize = saveData.cellSize || 48;
    if (saveData.materialDefinitions) {
        materialDefinitions = saveData.materialDefinitions;
    }
    if (saveData.roadColor) {
        roadColor = saveData.roadColor;
        const colorPicker = document.getElementById('roadColorPicker');
        if (colorPicker) colorPicker.value = roadColor;
    }
    if (saveData.sidewalkColor) {
        sidewalkColor = saveData.sidewalkColor;
        const swColorPicker = document.getElementById('sidewalkColorPicker');
        if (swColorPicker) swColorPicker.value = sidewalkColor;
    }
    if (saveData.defaultSidewalkWidth !== undefined) {
        defaultSidewalkWidth = saveData.defaultSidewalkWidth;
    }
    if (saveData.roadAttractionWidth !== undefined) {
        roadAttractionWidth = saveData.roadAttractionWidth;
        const attrInput = document.getElementById('roadAttractionWidth');
        if (attrInput) attrInput.value = roadAttractionWidth;
    }
    
    // Restore road/sidewalk material settings
    if (saveData.roadMaterialDepth !== undefined) {
        roadMaterialDepth = saveData.roadMaterialDepth;
    }
    if (saveData.sidewalkMaterialDepth !== undefined) {
        sidewalkMaterialDepth = saveData.sidewalkMaterialDepth;
    }
    if (saveData.roadMaterialNumber !== undefined) {
        roadMaterialNumber = saveData.roadMaterialNumber;
    }
    if (saveData.sidewalkMaterialNumber !== undefined) {
        sidewalkMaterialNumber = saveData.sidewalkMaterialNumber;
    }

    // Restore UI parameters
    if (saveData.uiParams) {
        const params = saveData.uiParams;
        setInputValue('widthPx', params.widthPx);
        setInputValue('heightPx', params.heightPx);
        setInputValue('cellSizeInput', params.cellSizeInput);
        setInputValue('scale', params.scale);
        setInputValue('octaves', params.octaves);
        setInputValue('persistence', params.persistence);
        setInputValue('lacunarity', params.lacunarity);
    }

    // Reset view state
    flowfieldOverlay = null;
    sidewalkFlowfield = null;
    showingFlowfieldType = 'none';
    if (typeof resetFlowfieldButtons === 'function') resetFlowfieldButtons();
    invalidateTerrainCache();
    invalidateMaterialsCache();

    // Update UI and render
    if (typeof updateTileCountLabels === 'function') {
        updateTileCountLabels();
    }
    updateUI();
    drawGrid();
    fitToView();

    const stats = {
        houses: houses.reduce((sum, g) => sum + g.count, 0),
        rocks: rocks.reduce((sum, g) => sum + g.count, 0),
        trees: trees.reduce((sum, g) => sum + g.count, 0),
        roads: roads.length
    };

    showInfo(`Map loaded: ${grid[0].length}x${grid.length} tiles. ` +
        `${stats.houses} houses, ${stats.rocks} rocks, ${stats.trees} trees, ${stats.roads} roads.`);
}

function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) {
        el.value = value;
    }
}
