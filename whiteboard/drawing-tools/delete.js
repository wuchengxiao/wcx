window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules.delete = {
    kind: 'operation',
    begin(drawer, x, y) {
        drawer.deleteElement(x, y);
    }
};

