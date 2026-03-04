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

// Default road color (user can change via color picker)
let roadColor = '#FFD700';

// Sidewalk state
let sidewalkColor = '#8c8c8c';
let defaultSidewalkWidth = 2;
let sidewalkDestroyEntities = false;

// Flowfield overlay
let flowfieldOverlay = null;
