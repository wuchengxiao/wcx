window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules.line = {
    kind: 'line',
    create(x, y) { return window.DrawingToolShared.createLine('line', x, y); },
    contains(x, y, element, drawer) { return window.DrawingToolShared.lineContains(x, y, element, drawer); },
    bounds(element) { return window.DrawingToolShared.lineBounds(element); },
    draw(ctx, element, drawer) {
        ctx.strokeStyle = element.stroke; ctx.lineWidth = element.strokeWidth;
        ctx.beginPath(); ctx.moveTo(element.x1, element.y1); ctx.lineTo(element.x2, element.y2); ctx.stroke();
        if (element.text) drawer.drawElementText(ctx, element);
    }
};




