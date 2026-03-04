// ============== INITIALIZATION ==============
window.addEventListener('load', function () {
    initializeDefaultMaterials();
    
    updateTileCountLabels();
    
    // Sync colors from color pickers
    roadColor = document.getElementById('roadColor').value;
    sidewalkColor = document.getElementById('sidewalkColor').value;
    defaultSidewalkWidth = parseInt(document.getElementById('defaultSidewalkWidth').value) || 2;

    generateGrid();

    const canvas = document.getElementById('gridCanvas');
    const container = document.getElementById('canvasContainer');

    canvas.addEventListener('click', handleCanvasClick);
    container.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handlePanStart);
    window.addEventListener('mousemove', handlePanMove);
    window.addEventListener('mouseup', handlePanEnd);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Add input listeners for tile count updates
    document.getElementById('widthPx').addEventListener('input', updateTileCountLabels);
    document.getElementById('heightPx').addEventListener('input', updateTileCountLabels);
    document.getElementById('cellSizeInput').addEventListener('input', updateTileCountLabels);
});
