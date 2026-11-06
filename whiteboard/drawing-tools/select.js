window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules.select = {
    kind: 'operation',
    begin(drawer, x, y, event) {
        drawer.handleSelectDown(x, y, event.ctrlKey);
    }
};


