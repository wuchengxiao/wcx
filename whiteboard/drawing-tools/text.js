window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules.text = {
    kind: 'text',
    properties: 'text',
    create(x, y) {
        return { type: 'text', x, y, width: 120, height: 40, text: '', backgroundColor: null, textColor: '#333333', fontSize: 14, fontFamily: 'Arial', textPosition: 'left' };
    },
    contains(x, y, element, drawer) {
        const bounds = drawer.getElementTextLayoutBounds(element);
        return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
    },
    bounds(element, drawer) { return drawer.getElementTextLayoutBounds(element); },
    draw(ctx, element, drawer) {
        if (element.backgroundColor) {
            const bounds = drawer.getElementTextLayoutBounds(element);
            ctx.fillStyle = element.backgroundColor;
            ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
        }
        drawer.drawElementText(ctx, element);
    }
};



