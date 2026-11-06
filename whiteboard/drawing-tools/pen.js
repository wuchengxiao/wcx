window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules.pen = {
    kind: 'pen',
    start(drawer, x, y) {
        drawer.isDrawingPen = true;
        drawer.currentPenPath = [{ x, y }];
        drawer.render();
    },
    move(drawer, x, y) {
        drawer.currentPenPath.push({ x, y });
        drawer.render();
    },
    finish(drawer) {
        if (drawer.currentPenPath.length > 1) {
            const diagram = drawer.diagrams[drawer.currentDiagram];
            const element = {
                type: 'pen', path: [...drawer.currentPenPath],
                stroke: drawer.penColor, strokeWidth: drawer.penWidth
            };
            const created = drawer.addElementToDiagram(diagram, element);
            diagram.selectedElements = [created];
        }
        drawer.isDrawingPen = false;
        drawer.currentPenPath = [];
        drawer.render();
    },
    contains(x, y, element, drawer) {
        if (element.path.length < 2) return false;
        return window.DrawingToolShared.penContains(x, y, element, drawer);
    },
    bounds(element) { return window.DrawingToolShared.penBounds(element); },
    draw(ctx, element) {
        if (element.path.length < 2) return;
        ctx.save();
        ctx.strokeStyle = element.stroke || '#333333';
        ctx.lineWidth = element.strokeWidth || 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(element.path[0].x, element.path[0].y);
        for (let i = 1; i < element.path.length; i++) ctx.lineTo(element.path[i].x, element.path[i].y);
        ctx.stroke();
        ctx.restore();
    },
    drawPreview(ctx, path, color, width) {
        if (!path.length) return;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
        ctx.stroke();
        ctx.restore();
    }
};




