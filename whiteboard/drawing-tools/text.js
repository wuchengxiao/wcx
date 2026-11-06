window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules.text = {
    kind: 'text',
    create(x, y) {
        return { type: 'text', x, y, text: '', fill: '#333', fontSize: 14, fontFamily: 'Arial' };
    },
    contains(x, y, element, drawer) {
        const bounds = drawer.getElementTextLayoutBounds(element);
        return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
    },
    bounds(element, drawer) { return drawer.getElementTextLayoutBounds(element); },
    draw(ctx, element) {
        ctx.fillStyle = element.fill;
        ctx.font = `${element.fontSize || 14}px ${element.fontFamily || 'Arial'}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        String(element.text || '').split('\n').forEach((line, index) => {
            ctx.fillText(line, element.x, element.y + index * (element.fontSize || 14) * 1.2);
        });
    }
};



