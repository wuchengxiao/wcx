window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules.sticky = {
    kind: 'shape',
    create(x, y) { return window.DrawingToolShared.createBox('sticky', x, y); },
    contains(x, y, element) { return window.DrawingToolShared.boxContains(x, y, element); },
    bounds(element) { return window.DrawingToolShared.boxBounds(element); },
    draw(ctx, element, drawer) {
        window.DrawingToolShared.applyShapeStyle(ctx, element);
        const fold = Math.min(element.width, element.height) * 0.15;
        ctx.beginPath();
        ctx.moveTo(element.x, element.y); ctx.lineTo(element.x + element.width - fold, element.y);
        ctx.lineTo(element.x + element.width, element.y + fold); ctx.lineTo(element.x + element.width, element.y + element.height);
        ctx.lineTo(element.x, element.y + element.height); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(element.x + element.width - fold, element.y);
        ctx.lineTo(element.x + element.width - fold, element.y + fold); ctx.lineTo(element.x + element.width, element.y + fold);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        if (element.text) drawer.drawElementText(ctx, element);
    }
};




