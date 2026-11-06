window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules.pan = {
    kind: 'operation',
    begin(drawer, event) {
        drawer.isDraggingCanvas = true;
        drawer.canvasDragStartX = event.clientX;
        drawer.canvasDragStartY = event.clientY;
        event.preventDefault();
    }
};

