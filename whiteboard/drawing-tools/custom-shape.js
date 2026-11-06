window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules['custom-shape'] = {
    kind: 'operation',
    begin(drawer, x, y) {
        drawer.placeCustomShape(x, y);
    }
};

