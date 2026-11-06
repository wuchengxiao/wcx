window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules['orthogonal-arrow'] = {
    kind: 'line',
    create(x, y) { return window.DrawingToolShared.createLine('orthogonal-arrow', x, y); },
    contains(x, y, element, drawer) { return window.DrawingToolShared.orthogonalArrowContains(x, y, element, drawer); },
    bounds(element, drawer) { return window.DrawingToolShared.orthogonalArrowBounds(element, drawer); },
    draw(ctx, element, drawer) {
        ctx.strokeStyle = element.stroke; ctx.lineWidth = element.strokeWidth;
        const points = drawer.getOrthogonalArrowPathPoints(element);
        ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
        const last = points[points.length - 1];
        const previous = points[points.length - 2] || points[0];
        const angle = Math.atan2(last.y - previous.y, last.x - previous.x);
        const length = 10;
        ctx.beginPath();
        ctx.moveTo(last.x, last.y); ctx.lineTo(last.x - length * Math.cos(angle - Math.PI / 6), last.y - length * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(last.x, last.y); ctx.lineTo(last.x - length * Math.cos(angle + Math.PI / 6), last.y - length * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
        if (element.text) drawer.drawElementText(ctx, element);
    }
};




