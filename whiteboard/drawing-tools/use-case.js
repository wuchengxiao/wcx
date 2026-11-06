window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules['use-case'] = {
    kind: 'shape',
    create(x, y) { return window.DrawingToolShared.createBox('use-case', x, y); },
    contains(x, y, element) { return window.DrawingToolShared.ellipseContains(x, y, element); },
    bounds(element) { return window.DrawingToolShared.boxBounds(element); },
    draw(ctx, element, drawer) {
        window.DrawingToolShared.applyShapeStyle(ctx, element);
        ctx.beginPath();
        ctx.ellipse(element.x + element.width / 2, element.y + element.height / 2, Math.abs(element.width / 2), Math.abs(element.height / 2), 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        if (element.text) drawer.drawElementText(ctx, element);
    }
};




