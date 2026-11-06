window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules.group = {
    kind: 'shape',
    contains(x, y, element) {
        return x >= element.x && x <= element.x + element.width && y >= element.y && y <= element.y + element.height;
    },
    bounds(element) { return { x: element.x, y: element.y, width: element.width, height: element.height }; },
    draw(ctx, element, drawer) {
        ctx.fillStyle = element.fill;
        ctx.strokeStyle = element.stroke;
        ctx.lineWidth = element.strokeWidth;
        ctx.setLineDash([5, 5]);
        ctx.fillRect(element.x, element.y, element.width, element.height);
        ctx.strokeRect(element.x, element.y, element.width, element.height);
        ctx.setLineDash([]);
        element.elements.forEach(child => drawer.drawElement(ctx, child));
        if (element.text) drawer.drawElementText(ctx, element);
    }
};


