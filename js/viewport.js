// ============== ZOOM AND PAN ==============
function getMinZoom() {
    if (!grid || grid.length === 0 || !grid[0]) return 0.1;

    const container = document.getElementById('canvasContainer');
    const containerRect = container.getBoundingClientRect();

    const fullWidth = grid[0].length * cellSize;
    const fullHeight = grid.length * cellSize;

    const padding = 20;
    const zoomX = (containerRect.width - padding * 2) / fullWidth;
    const zoomY = (containerRect.height - padding * 2) / fullHeight;

    return Math.min(zoomX, zoomY);
}

function updateZoomUI() {
    const zoomPercent = Math.round(zoom * 100);
    document.getElementById('zoomLevel').textContent = `${zoomPercent}%`;
    document.getElementById('zoomSlider').value = zoomPercent;
}

function setZoom(percent) {
    const minZoom = getMinZoom();
    zoom = Math.max(minZoom, percent / 100);
    updateZoomUI();
    applyTransform();
}

function zoomIn() {
    zoom = Math.min(3, zoom + 0.1);
    updateZoomUI();
    applyTransform();
}

function zoomOut() {
    const minZoom = getMinZoom();
    zoom = Math.max(minZoom, zoom - 0.1);
    updateZoomUI();
    applyTransform();
}

function resetView() {
    zoom = 1;
    panX = 0;
    panY = 0;
    updateZoomUI();
    applyTransform();
}

function fitToView() {
    if (!grid || grid.length === 0 || !grid[0]) return;

    const container = document.getElementById('canvasContainer');
    const containerRect = container.getBoundingClientRect();

    const fullWidth = grid[0].length * cellSize;
    const fullHeight = grid.length * cellSize;

    zoom = Math.min(getMinZoom(), 1);

    const scaledWidth = fullWidth * zoom;
    const scaledHeight = fullHeight * zoom;
    panX = (containerRect.width - scaledWidth) / 2;
    panY = (containerRect.height - scaledHeight) / 2;

    updateZoomUI();
    applyTransform();
}

function applyTransform() {
    const canvas = document.getElementById('gridCanvas');
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
}

function setRenderScale(value) {
    renderScale = parseFloat(value);
    drawGrid();
}

function handleWheel(event) {
    event.preventDefault();

    const container = document.getElementById('canvasContainer');
    const rect = container.getBoundingClientRect();

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const oldZoom = zoom;

    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    const minZoom = getMinZoom();
    zoom = Math.max(minZoom, Math.min(3, zoom + delta));

    const zoomRatio = zoom / oldZoom;
    panX = mouseX - (mouseX - panX) * zoomRatio;
    panY = mouseY - (mouseY - panY) * zoomRatio;

    updateZoomUI();
    applyTransform();
}

function handlePanStart(event) {
    if (roadMode || event.button !== 0) return;

    isPanning = true;
    lastPanX = event.clientX;
    lastPanY = event.clientY;
    event.preventDefault();
}

function handlePanMove(event) {
    if (!isPanning) return;

    const deltaX = event.clientX - lastPanX;
    const deltaY = event.clientY - lastPanY;

    panX += deltaX;
    panY += deltaY;

    lastPanX = event.clientX;
    lastPanY = event.clientY;

    applyTransform();
}

function handlePanEnd() {
    isPanning = false;
}
