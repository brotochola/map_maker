// ============== GLOBAL STATE ==============
let grid = [];
let roads = [];
let houses = [];
let simplex;
let roadMode = false;
let selectedCells = [];
let roadIdCounter = 1;
let houseGroupIdCounter = 1;
let rocks = [];
let trees = [];
let rockGroupIdCounter = 1;
let treeGroupIdCounter = 1;

// Material definitions
let materialDefinitions = [];
let materialIdCounter = 1;

let cellSize = 48;
const MIN_PASSABLE = 0.25;
const MAX_PASSABLE = 0.75;
const WATER_THRESHOLD = 0.3;

// Zoom and pan state
let zoom = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let lastPanX = 0;
let lastPanY = 0;

// Render scale
let renderScale = 0.1;
const MAP_SIZE_WARNING_CELLS = 30000;
const MAP_SIZE_DANGER_CELLS = 50000;
const PREVIEW_PIXEL_WARNING = 4000000;
const PREVIEW_PIXEL_DANGER = 8000000;
let previewDirty = false;

function buildMapMetrics(widthPx, heightPx, cs, previewScale = renderScale) {
    const safeCellSize = Math.max(1, parseInt(cs, 10) || 1);
    const safeWidthPx = Math.max(0, parseInt(widthPx, 10) || 0);
    const safeHeightPx = Math.max(0, parseInt(heightPx, 10) || 0);
    const safePreviewScale = Math.max(0.01, parseFloat(previewScale) || 0.1);

    const tilesX = Math.floor(safeWidthPx / safeCellSize);
    const tilesY = Math.floor(safeHeightPx / safeCellSize);
    const totalCells = tilesX * tilesY;
    const effectiveWidthPx = tilesX * safeCellSize;
    const effectiveHeightPx = tilesY * safeCellSize;
    const previewWidth = Math.ceil(effectiveWidthPx * safePreviewScale);
    const previewHeight = Math.ceil(effectiveHeightPx * safePreviewScale);
    const previewPixels = previewWidth * previewHeight;

    return {
        widthPx: safeWidthPx,
        heightPx: safeHeightPx,
        cellSize: safeCellSize,
        previewScale: safePreviewScale,
        tilesX,
        tilesY,
        totalCells,
        effectiveWidthPx,
        effectiveHeightPx,
        previewWidth,
        previewHeight,
        previewPixels,
        isCellWarning: totalCells > MAP_SIZE_WARNING_CELLS,
        isCellDanger: totalCells > MAP_SIZE_DANGER_CELLS,
        isPreviewWarning: previewPixels > PREVIEW_PIXEL_WARNING,
        isPreviewDanger: previewPixels > PREVIEW_PIXEL_DANGER
    };
}

// Default road color (user can change via color picker)
let roadColor = '#FFD700';

// Sidewalk state
let sidewalkColor = '#8c8c8c';
let defaultSidewalkWidth = 2;
let sidewalkDestroyEntities = false;

// Road and sidewalk material settings (depth for layer ordering)
let roadMaterialDepth = 100;
let sidewalkMaterialDepth = 99;
let roadMaterialNumber = 99;
let sidewalkMaterialNumber = 98;

// Flowfield overlay
let flowfieldOverlay = null;
let sidewalkFlowfield = null;
let roadAttractionWidth = 3;
let sidewalkAttractionWidth = 2;
let showingFlowfieldType = 'none'; // 'none', 'roads', 'sidewalks'

// Altitude overlay
let showAltitudeOverlay = false;

// Performance caching
let terrainCacheDirty = true;
let terrainImageBitmap = null;
let sortedMaterialsCache = null;
let sortedMaterialsCacheDirty = true;

function invalidateTerrainCache() {
    terrainCacheDirty = true;
    terrainImageBitmap = null;
}

function invalidateMaterialsCache() {
    sortedMaterialsCacheDirty = true;
    sortedMaterialsCache = null;
    invalidateTerrainCache();
}

function getSortedMaterials() {
    if (sortedMaterialsCacheDirty || !sortedMaterialsCache) {
        sortedMaterialsCache = [...materialDefinitions].sort((a, b) => b.depth - a.depth);
        sortedMaterialsCacheDirty = false;
    }
    return sortedMaterialsCache;
}
