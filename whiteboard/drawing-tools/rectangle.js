window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules.rectangle = {
    kind: 'shape',
    create(x, y) {
        return window.DrawingToolShared.createBox('rectangle', x, y);
    },
    contains(x, y, element) { return window.DrawingToolShared.boxContains(x, y, element); },
    bounds(element) { return window.DrawingToolShared.boxBounds(element); },
    draw(ctx, element, drawer) {
        window.DrawingToolShared.applyShapeStyle(ctx, element);
        ctx.fillRect(element.x, element.y, element.width, element.height);
        ctx.strokeRect(element.x, element.y, element.width, element.height);
        if (element.text) drawer.drawElementText(ctx, element);
    }
};





