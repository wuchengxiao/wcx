window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules.diamond = {
    kind: 'shape',
    create(x, y) { return window.DrawingToolShared.createBox('diamond', x, y); },
    contains(x, y, element, drawer) { return window.DrawingToolShared.polygonContains(x, y, element, drawer); },
    bounds(element) { return window.DrawingToolShared.boxBounds(element); },
    draw(ctx, element, drawer) {
        window.DrawingToolShared.applyShapeStyle(ctx, element);
        ctx.beginPath();
        ctx.moveTo(element.x + element.width / 2, element.y);
        ctx.lineTo(element.x + element.width, element.y + element.height / 2);
        ctx.lineTo(element.x + element.width / 2, element.y + element.height);
        ctx.lineTo(element.x, element.y + element.height / 2);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        if (element.text) drawer.drawElementText(ctx, element);
    }
};





