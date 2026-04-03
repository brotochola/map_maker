// ============== MATERIAL DEFINITIONS ==============
function addMaterialDefinition(minAlt = 0, maxAlt = 0.1, materialNum = 1, name = '', color = '#ffffff', depth = null) {
    const id = materialIdCounter++;
    if (depth === null) {
        const maxDepth = materialDefinitions.length > 0 
            ? Math.max(...materialDefinitions.map(m => m.depth || 0)) 
            : -1;
        depth = maxDepth + 1;
    }
    materialDefinitions.push({
        id: id,
        minAltitude: minAlt,
        maxAltitude: maxAlt,
        materialNumber: materialNum,
        name: name || `Material ${materialNum}`,
        color: color,
        depth: depth
    });
    invalidateMaterialsCache();
    updateMaterialsList();
    markPreviewDirty();
}

function deleteMaterialDefinition(id) {
    materialDefinitions = materialDefinitions.filter(m => m.id !== id);
    invalidateMaterialsCache();
    updateMaterialsList();
    markPreviewDirty();
}

function updateMaterialsList() {
    const container = document.getElementById('materialsList');
    
    // Build unified list of all materials including roads and sidewalks
    const allItems = [];
    
    // Add regular materials
    materialDefinitions.forEach(mat => {
        allItems.push({
            type: 'material',
            id: mat.id,
            name: mat.name,
            color: mat.color,
            minAltitude: mat.minAltitude,
            maxAltitude: mat.maxAltitude,
            materialNumber: mat.materialNumber,
            depth: mat.depth,
            deletable: true
        });
    });
    
    // Add sidewalk (always present)
    allItems.push({
        type: 'sidewalk',
        id: 'sidewalk',
        name: 'Sidewalk',
        color: sidewalkColor,
        materialNumber: sidewalkMaterialNumber,
        depth: sidewalkMaterialDepth,
        deletable: false
    });
    
    // Add road (always present)
    allItems.push({
        type: 'road',
        id: 'road',
        name: 'Road',
        color: roadColor,
        materialNumber: roadMaterialNumber,
        depth: roadMaterialDepth,
        deletable: false
    });
    
    // Sort all items by depth
    allItems.sort((a, b) => a.depth - b.depth);

    container.innerHTML = allItems.map(item => {
        if (item.type === 'material') {
            return `
                <div class="material-item" draggable="true" data-material-id="${item.id}" data-item-type="material">
                    <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
                    <input type="color" value="${item.color}" 
                           onchange="updateMaterialColor(${item.id}, this.value)" 
                           title="Material color">
                    <input type="text" value="${item.name}" 
                           onchange="updateMaterialName(${item.id}, this.value)" 
                           placeholder="Name"
                           title="Material name">
                    <input type="number" value="${item.minAltitude}" 
                           onchange="updateMaterialMin(${item.id}, this.value)" 
                           min="0" max="1" step="0.01"
                           title="Min altitude">
                    <span style="color: #666;">-</span>
                    <input type="number" value="${item.maxAltitude}" 
                           onchange="updateMaterialMax(${item.id}, this.value)" 
                           min="0" max="1" step="0.01"
                           title="Max altitude">
                    <span style="color: #666;">=</span>
                    <input type="number" value="${item.materialNumber}" 
                           onchange="updateMaterialNumber(${item.id}, this.value)" 
                           min="0" max="255"
                           title="Material number">
                    <span class="depth-label">D:</span>
                    <input type="number" value="${item.depth}" 
                           onchange="updateMaterialDepth(${item.id}, this.value)" 
                           min="0" max="999"
                           class="depth-input"
                           title="Depth (render order: lower = below)">
                    <button class="delete-btn small danger" onclick="deleteMaterialDefinition(${item.id})" title="Delete">🗑️</button>
                </div>`;
        } else if (item.type === 'sidewalk') {
            return `
                <div class="material-item special-material" draggable="true" data-material-id="sidewalk" data-item-type="sidewalk">
                    <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
                    <input type="color" value="${item.color}" 
                           onchange="updateSidewalkColor(this.value)" 
                           title="Sidewalk color">
                    <span class="special-name">🚶 Sidewalk</span>
                    <span style="color: #666; margin-left: auto;">=</span>
                    <input type="number" value="${item.materialNumber}" 
                           onchange="updateSidewalkMaterialNumber(this.value)" 
                           min="0" max="255"
                           style="width: 50px;"
                           title="Material number">
                    <span class="depth-label">D:</span>
                    <input type="number" value="${item.depth}" 
                           onchange="updateSidewalkMaterialDepth(this.value)" 
                           min="0" max="999"
                           class="depth-input"
                           title="Depth (render order: lower = below)">
                    <span style="width: 28px;"></span>
                </div>`;
        } else if (item.type === 'road') {
            return `
                <div class="material-item special-material" draggable="true" data-material-id="road" data-item-type="road">
                    <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
                    <input type="color" value="${item.color}" 
                           onchange="updateAllRoadColors(this.value)" 
                           title="Road color">
                    <span class="special-name">🛣️ Road</span>
                    <span style="color: #666; margin-left: auto;">=</span>
                    <input type="number" value="${item.materialNumber}" 
                           onchange="updateRoadMaterialNumber(this.value)" 
                           min="0" max="255"
                           style="width: 50px;"
                           title="Material number">
                    <span class="depth-label">D:</span>
                    <input type="number" value="${item.depth}" 
                           onchange="updateRoadMaterialDepth(this.value)" 
                           min="0" max="999"
                           class="depth-input"
                           title="Depth (render order: lower = below)">
                    <span style="width: 28px;"></span>
                </div>`;
        }
    }).join('');

    // Setup drag and drop handlers
    setupMaterialDragAndDrop();
}

function updateSidewalkColor(color) {
    sidewalkColor = color;
    markPreviewDirty();
}

function updateSidewalkMaterialNumber(value) {
    sidewalkMaterialNumber = parseInt(value) || 98;
    const input = document.getElementById('sidewalkMaterialNumber');
    if (input) input.value = sidewalkMaterialNumber;
}

function updateSidewalkMaterialDepth(value) {
    sidewalkMaterialDepth = parseInt(value) || 99;
    const input = document.getElementById('sidewalkMaterialDepth');
    if (input) input.value = sidewalkMaterialDepth;
    updateMaterialsList();
}

function updateRoadMaterialNumber(value) {
    roadMaterialNumber = parseInt(value) || 99;
    const input = document.getElementById('roadMaterialNumber');
    if (input) input.value = roadMaterialNumber;
}

function updateRoadMaterialDepth(value) {
    roadMaterialDepth = parseInt(value) || 100;
    const input = document.getElementById('roadMaterialDepth');
    if (input) input.value = roadMaterialDepth;
    updateMaterialsList();
}



function updateMaterialName(id, value) {
    const mat = materialDefinitions.find(m => m.id === id);
    if (mat) {
        mat.name = value;
        
    }
}

function updateMaterialMin(id, value) {
    const mat = materialDefinitions.find(m => m.id === id);
    if (mat) {
        mat.minAltitude = parseFloat(value);
        invalidateMaterialsCache();
        markPreviewDirty();
    }
}

function updateMaterialMax(id, value) {
    const mat = materialDefinitions.find(m => m.id === id);
    if (mat) {
        mat.maxAltitude = parseFloat(value);
        invalidateMaterialsCache();
        markPreviewDirty();
    }
}

function updateMaterialNumber(id, value) {
    const mat = materialDefinitions.find(m => m.id === id);
    if (mat) mat.materialNumber = parseInt(value);
}

function updateMaterialColor(id, value) {
    const mat = materialDefinitions.find(m => m.id === id);
    if (mat) {
        mat.color = value;
        invalidateMaterialsCache();
        markPreviewDirty();
    }
}

function updateMaterialDepth(id, value) {
    const mat = materialDefinitions.find(m => m.id === id);
    if (mat) {
        mat.depth = parseInt(value) || 0;
        invalidateMaterialsCache();
        updateMaterialsList();
        markPreviewDirty();
    }
}

// Drag and drop functionality for materials
let draggedItemId = null;
let draggedItemType = null;

function setupMaterialDragAndDrop() {
    const container = document.getElementById('materialsList');
    const items = container.querySelectorAll('.material-item');
    
    items.forEach(item => {
        item.addEventListener('dragstart', handleMaterialDragStart);
        item.addEventListener('dragend', handleMaterialDragEnd);
        item.addEventListener('dragover', handleMaterialDragOver);
        item.addEventListener('dragenter', handleMaterialDragEnter);
        item.addEventListener('dragleave', handleMaterialDragLeave);
        item.addEventListener('drop', handleMaterialDrop);
    });
}

function handleMaterialDragStart(e) {
    draggedItemId = this.dataset.materialId;
    draggedItemType = this.dataset.itemType;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedItemId);
}

function handleMaterialDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.material-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    draggedItemId = null;
    draggedItemType = null;
}

function handleMaterialDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleMaterialDragEnter(e) {
    e.preventDefault();
    const targetId = this.dataset.materialId;
    if (targetId !== draggedItemId) {
        this.classList.add('drag-over');
    }
}

function handleMaterialDragLeave(e) {
    this.classList.remove('drag-over');
}

function getItemDepth(itemId, itemType) {
    if (itemType === 'road') return roadMaterialDepth;
    if (itemType === 'sidewalk') return sidewalkMaterialDepth;
    const mat = materialDefinitions.find(m => m.id === parseInt(itemId));
    return mat ? mat.depth : 0;
}

function setItemDepth(itemId, itemType, depth) {
    if (itemType === 'road') {
        roadMaterialDepth = depth;
    } else if (itemType === 'sidewalk') {
        sidewalkMaterialDepth = depth;
    } else {
        const mat = materialDefinitions.find(m => m.id === parseInt(itemId));
        if (mat) mat.depth = depth;
    }
}

function handleMaterialDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    const targetId = this.dataset.materialId;
    const targetType = this.dataset.itemType;
    
    if (targetId === draggedItemId && targetType === draggedItemType) return;
    
    // Get depths
    const draggedDepth = getItemDepth(draggedItemId, draggedItemType);
    const targetDepth = getItemDepth(targetId, targetType);
    
    // Swap depths
    setItemDepth(draggedItemId, draggedItemType, targetDepth);
    setItemDepth(targetId, targetType, draggedDepth);
    
    invalidateMaterialsCache();
    updateMaterialsList();
    markPreviewDirty();
}

function toggleRoadMaterial() {
    // No longer needed - roads are always materials
}

function toggleSidewalkMaterial() {
    // No longer needed - sidewalks are always materials
}

function initializeDefaultMaterials() {
    materialDefinitions = [];
    materialIdCounter = 1;
    // Initialize road/sidewalk depths
    roadMaterialDepth = 100;
    sidewalkMaterialDepth = 99;
    roadMaterialNumber = 99;
    sidewalkMaterialNumber = 98;
    // Default terrain materials
    addMaterialDefinition(0, 1, 10, 'bg', '#ffffff', 0);
    addMaterialDefinition(0.1, 0.3, 1, 'dry_grass', '#c4a44a', 1);
    addMaterialDefinition(0.25, 0.5, 2, 'green_grass', '#4a8c4a', 2);
    addMaterialDefinition(0.45, 0.6, 3, 'dark_grass', '#2d5c2d', 3);
    addMaterialDefinition(0.7, 0.8, 4, 'sidewalk', '#8c8c8c', 4);
    addMaterialDefinition(0.75, 1.0, 5, 'house_area', '#6b4423', 5);
    invalidateMaterialsCache();
}

function generateMaterialsArray() {
    if (!grid || grid.length === 0) return [];

    const materialsArray = [];

    for (let y = 0; y < grid.length; y++) {
        const row = [];
        for (let x = 0; x < grid[y].length; x++) {
            const cell = grid[y][x];

            // Roads and sidewalks are always materials
            if (cell.roadIds.length > 0) {
                row.push(roadMaterialNumber);
            } else if (cell.sidewalkRoadIds.length > 0) {
                row.push(sidewalkMaterialNumber);
            } else {
                const altitude = cell.noise;
                let materialNum = 0;

                for (const mat of materialDefinitions) {
                    if (altitude >= mat.minAltitude && altitude < mat.maxAltitude) {
                        materialNum = mat.materialNumber;
                        break;
                    }
                }

                row.push(materialNum);
            }
        }
        materialsArray.push(row);
    }

    return materialsArray;
}

function generateLayeredMaterialsArray() {
    if (!grid || grid.length === 0) return [];

    const roadDestroyMaterials = document.getElementById('roadDestroyMaterials').checked;

    const layers = [];

    // Sort by depth for layer order (lower depth = first in array)
    const sortedMaterials = [...materialDefinitions].sort((a, b) => a.depth - b.depth);

    // Create a layer for each material definition
    for (const mat of sortedMaterials) {
        const layerData = [];

        for (let y = 0; y < grid.length; y++) {
            const row = [];
            for (let x = 0; x < grid[y].length; x++) {
                const cell = grid[y][x];
                const altitude = cell.noise;

                if (altitude >= mat.minAltitude && altitude < mat.maxAltitude) {
                    if (roadDestroyMaterials && cell.roadIds.length > 0) {
                        row.push(0);
                    } else if (roadDestroyMaterials && cell.sidewalkRoadIds.length > 0) {
                        row.push(0);
                    } else {
                        row.push(1);
                    }
                } else {
                    row.push(0);
                }
            }
            layerData.push(row);
        }

        layers.push({
            name: mat.name,
            materialNumber: mat.materialNumber,
            depth: mat.depth,
            data: layerData
        });
    }

    // Add sidewalk layer (always present)
    const sidewalkLayerData = [];
    for (let y = 0; y < grid.length; y++) {
        const row = [];
        for (let x = 0; x < grid[y].length; x++) {
            const cell = grid[y][x];
            row.push(cell.sidewalkRoadIds.length > 0 ? 1 : 0);
        }
        sidewalkLayerData.push(row);
    }
    layers.push({
        name: 'Sidewalk',
        materialNumber: sidewalkMaterialNumber,
        depth: sidewalkMaterialDepth,
        data: sidewalkLayerData
    });

    // Add road layer (always present)
    const roadLayerData = [];
    for (let y = 0; y < grid.length; y++) {
        const row = [];
        for (let x = 0; x < grid[y].length; x++) {
            const cell = grid[y][x];
            row.push(cell.roadIds.length > 0 ? 1 : 0);
        }
        roadLayerData.push(row);
    }
    layers.push({
        name: 'Road',
        materialNumber: roadMaterialNumber,
        depth: roadMaterialDepth,
        data: roadLayerData
    });

    // Sort all layers by depth before returning
    layers.sort((a, b) => a.depth - b.depth);

    return layers;
}
