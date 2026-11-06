window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules.package = {
    kind: 'shape',
    create(x, y) { return window.DrawingToolShared.createBox('package', x, y); },
    contains(x, y, element) { return window.DrawingToolShared.boxContains(x, y, element); },
    bounds(element) { return window.DrawingToolShared.boxBounds(element); },
    draw(ctx, element, drawer) {
        window.DrawingToolShared.applyShapeStyle(ctx, element);
        ctx.fillRect(element.x, element.y, element.width, element.height);
        ctx.strokeRect(element.x, element.y, element.width, element.height);
        const tabHeight = 20;
        ctx.fillRect(element.x, element.y - tabHeight, element.width / 3, tabHeight);
        ctx.strokeRect(element.x, element.y - tabHeight, element.width / 3, tabHeight);
        if (element.text) drawer.drawElementText(ctx, element);
    }
};




