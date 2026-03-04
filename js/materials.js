// ============== MATERIAL DEFINITIONS ==============
function addMaterialDefinition(minAlt = 0, maxAlt = 0.1, materialNum = 1, name = '', color = '#ffffff', depth = null) {
    const id = materialIdCounter++;
    // Auto-assign depth based on current max depth + 1 if not provided
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
    updateMaterialsList();
}

function deleteMaterialDefinition(id) {
    materialDefinitions = materialDefinitions.filter(m => m.id !== id);
    updateMaterialsList();
    drawGrid();
}

function updateMaterialsList() {
    const container = document.getElementById('materialsList');
    if (materialDefinitions.length === 0) {
        container.innerHTML = '<div style="color: #666; font-size: 11px; text-align: center; padding: 8px;">No materials defined</div>';
        return;
    }

    // Sort by depth for rendering order (lower depth = rendered first = appears below)
    const sortedMaterials = [...materialDefinitions].sort((a, b) => a.depth - b.depth);

    container.innerHTML = sortedMaterials.map(mat => `
        <div class="material-item" draggable="true" data-material-id="${mat.id}">
            <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
            <input type="color" value="${mat.color}" 
                   onchange="updateMaterialColor(${mat.id}, this.value)" 
                   title="Material color">
            <input type="text" value="${mat.name}" 
                   onchange="updateMaterialName(${mat.id}, this.value)" 
                   placeholder="Name"
                   title="Material name">
            <input type="number" value="${mat.minAltitude}" 
                   onchange="updateMaterialMin(${mat.id}, this.value)" 
                   min="0" max="1" step="0.01"
                   title="Min altitude">
            <span style="color: #666;">-</span>
            <input type="number" value="${mat.maxAltitude}" 
                   onchange="updateMaterialMax(${mat.id}, this.value)" 
                   min="0" max="1" step="0.01"
                   title="Max altitude">
            <span style="color: #666;">=</span>
            <input type="number" value="${mat.materialNumber}" 
                   onchange="updateMaterialNumber(${mat.id}, this.value)" 
                   min="0" max="255"
                   title="Material number">
            <span class="depth-label">D:</span>
            <input type="number" value="${mat.depth}" 
                   onchange="updateMaterialDepth(${mat.id}, this.value)" 
                   min="0" max="99"
                   class="depth-input"
                   title="Depth (render order: lower = below)">
            <button class="delete-btn small danger" onclick="deleteMaterialDefinition(${mat.id})" title="Delete">🗑️</button>
        </div>
    `).join('');

    // Setup drag and drop handlers
    setupMaterialDragAndDrop();
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
        drawGrid();
    }
}

function updateMaterialMax(id, value) {
    const mat = materialDefinitions.find(m => m.id === id);
    if (mat) {
        mat.maxAltitude = parseFloat(value);
        drawGrid();
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
        drawGrid();
    }
}

function updateMaterialDepth(id, value) {
    const mat = materialDefinitions.find(m => m.id === id);
    if (mat) {
        mat.depth = parseInt(value) || 0;
        updateMaterialsList();
        drawGrid();
    }
}

// Drag and drop functionality for materials
let draggedMaterialId = null;

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
    draggedMaterialId = parseInt(this.dataset.materialId);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedMaterialId);
}

function handleMaterialDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.material-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    draggedMaterialId = null;
}

function handleMaterialDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleMaterialDragEnter(e) {
    e.preventDefault();
    const targetId = parseInt(this.dataset.materialId);
    if (targetId !== draggedMaterialId) {
        this.classList.add('drag-over');
    }
}

function handleMaterialDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleMaterialDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    const targetId = parseInt(this.dataset.materialId);
    if (targetId === draggedMaterialId) return;
    
    const draggedMat = materialDefinitions.find(m => m.id === draggedMaterialId);
    const targetMat = materialDefinitions.find(m => m.id === targetId);
    
    if (!draggedMat || !targetMat) return;
    
    // Swap depths
    const tempDepth = draggedMat.depth;
    draggedMat.depth = targetMat.depth;
    targetMat.depth = tempDepth;
    
    updateMaterialsList();
    drawGrid();
}

function toggleRoadMaterial() {
    const checkbox = document.getElementById('roadsAsMaterial');
    const input = document.getElementById('roadMaterialInput');
    input.style.display = checkbox.checked ? 'block' : 'none';
}

function toggleSidewalkMaterial() {
    const checkbox = document.getElementById('sidewalksAsMaterial');
    const input = document.getElementById('sidewalkMaterialInput');
    input.style.display = checkbox.checked ? 'block' : 'none';
}

function initializeDefaultMaterials() {
    materialDefinitions = [];
    materialIdCounter = 1;
    // depth parameter controls render order (lower = rendered first = appears below)
    addMaterialDefinition(0, 1, 10, 'bg', '#ffffff', 0);
    addMaterialDefinition(0.1, 0.3, 1, 'dry_grass', '#c4a44a', 1);
    addMaterialDefinition(0.25, 0.5, 2, 'green_grass', '#4a8c4a', 2);
    addMaterialDefinition(0.45, 0.6, 3, 'dark_grass', '#2d5c2d', 3);
    addMaterialDefinition(0.7, 0.8, 4, 'sidewalk', '#8c8c8c', 4);
    addMaterialDefinition(0.75, 1.0, 5, 'house_area', '#6b4423', 5);
}

function generateMaterialsArray() {
    if (!grid || grid.length === 0) return [];

    const roadsAsMaterial = document.getElementById('roadsAsMaterial').checked;
    const roadMaterialNum = parseInt(document.getElementById('roadMaterialNumber').value) || 99;
    const sidewalksAsMaterial = document.getElementById('sidewalksAsMaterial').checked;
    const sidewalkMaterialNum = parseInt(document.getElementById('sidewalkMaterialNumber').value) || 98;

    const materialsArray = [];

    for (let y = 0; y < grid.length; y++) {
        const row = [];
        for (let x = 0; x < grid[y].length; x++) {
            const cell = grid[y][x];

            if (roadsAsMaterial && cell.roadIds.length > 0) {
                row.push(roadMaterialNum);
            } else if (sidewalksAsMaterial && cell.sidewalkRoadIds.length > 0) {
                row.push(sidewalkMaterialNum);
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

    const roadsAsMaterial = document.getElementById('roadsAsMaterial').checked;
    const roadMaterialNum = parseInt(document.getElementById('roadMaterialNumber').value) || 99;
    const sidewalksAsMaterial = document.getElementById('sidewalksAsMaterial').checked;
    const sidewalkMaterialNum = parseInt(document.getElementById('sidewalkMaterialNumber').value) || 98;
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
                    if (roadDestroyMaterials && roadsAsMaterial && cell.roadIds.length > 0) {
                        row.push(0);
                    } else if (roadDestroyMaterials && sidewalksAsMaterial && cell.sidewalkRoadIds.length > 0) {
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

    let currentMaxDepth = sortedMaterials.length > 0 
        ? Math.max(...sortedMaterials.map(m => m.depth)) + 1 
        : 0;

    // Add sidewalk layer if sidewalks are treated as material
    if (sidewalksAsMaterial) {
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
            materialNumber: sidewalkMaterialNum,
            depth: currentMaxDepth,
            data: sidewalkLayerData
        });
        currentMaxDepth++;
    }

    // Add road layer if roads are treated as material
    if (roadsAsMaterial) {
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
            materialNumber: roadMaterialNum,
            depth: currentMaxDepth,
            data: roadLayerData
        });
    }

    return layers;
}
