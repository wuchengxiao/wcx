window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules.actor = {
    kind: 'shape',
    create(x, y) { return window.DrawingToolShared.createBox('actor', x, y); },
    contains(x, y, element) { return window.DrawingToolShared.actorContains(x, y, element); },
    bounds(element) { return window.DrawingToolShared.boxBounds(element); },
    draw(ctx, element, drawer) {
        window.DrawingToolShared.applyShapeStyle(ctx, element);
        const headRadius = Math.min(element.width, element.height) / 4;
        const centerX = element.x + element.width / 2;
        const centerY = element.y + headRadius;
        ctx.beginPath(); ctx.arc(centerX, centerY, headRadius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        const bodyTop = element.y + headRadius * 2;
        const bodyLeft = element.x + element.width * 0.3;
        const bodyRight = element.x + element.width * 0.7;
        ctx.fillRect(bodyLeft, bodyTop, bodyRight - bodyLeft, element.y + element.height - bodyTop);
        ctx.strokeRect(bodyLeft, bodyTop, bodyRight - bodyLeft, element.y + element.height - bodyTop);
        if (element.text) drawer.drawElementText(ctx, element);
    }
};




