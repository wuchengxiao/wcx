window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules.arrow = {
    kind: 'line',
    create(x, y) { return window.DrawingToolShared.createLine('arrow', x, y); },
    contains(x, y, element, drawer) { return window.DrawingToolShared.lineContains(x, y, element, drawer); },
    bounds(element) { return window.DrawingToolShared.lineBounds(element); },
    draw(ctx, element, drawer) {
        ctx.strokeStyle = element.stroke; ctx.lineWidth = element.strokeWidth;
        ctx.beginPath(); ctx.moveTo(element.x1, element.y1); ctx.lineTo(element.x2, element.y2); ctx.stroke();
        const angle = Math.atan2(element.y2 - element.y1, element.x2 - element.x1);
        const length = 10;
        ctx.beginPath();
        ctx.moveTo(element.x2, element.y2); ctx.lineTo(element.x2 - length * Math.cos(angle - Math.PI / 6), element.y2 - length * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(element.x2, element.y2); ctx.lineTo(element.x2 - length * Math.cos(angle + Math.PI / 6), element.y2 - length * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
        if (element.text) drawer.drawElementText(ctx, element);
    }
};




