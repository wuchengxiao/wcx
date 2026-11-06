window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules['curved-arrow'] = {
    kind: 'line',
    create(x, y) { return window.DrawingToolShared.createLine('curved-arrow', x, y); },
    contains(x, y, element, drawer) { return window.DrawingToolShared.curvedArrowContains(x, y, element, drawer); },
    bounds(element, drawer) { return window.DrawingToolShared.curvedArrowBounds(element, drawer); },
    draw(ctx, element, drawer) {
        ctx.strokeStyle = element.stroke; ctx.lineWidth = element.strokeWidth;
        const control = drawer.getCurvedArrowControlPoint(element);
        ctx.beginPath(); ctx.moveTo(element.x1, element.y1); ctx.quadraticCurveTo(control.x, control.y, element.x2, element.y2); ctx.stroke();
        const tangent = drawer.getQuadraticBezierDerivative(1, { x: element.x1, y: element.y1 }, control, { x: element.x2, y: element.y2 });
        const angle = Math.atan2(tangent.y, tangent.x);
        const length = 10;
        ctx.beginPath();
        ctx.moveTo(element.x2, element.y2); ctx.lineTo(element.x2 - length * Math.cos(angle - Math.PI / 6), element.y2 - length * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(element.x2, element.y2); ctx.lineTo(element.x2 - length * Math.cos(angle + Math.PI / 6), element.y2 - length * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
        if (element.text) drawer.drawElementText(ctx, element);
    }
};




