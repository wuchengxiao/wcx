window.DrawingToolModules = window.DrawingToolModules || {};
window.DrawingToolModules.class = {
    kind: 'shape',
    create(x, y) { return window.DrawingToolShared.createBox('class', x, y); },
    contains(x, y, element) { return window.DrawingToolShared.boxContains(x, y, element); },
    bounds(element) { return window.DrawingToolShared.boxBounds(element); },
    draw(ctx, element, drawer) {
        window.DrawingToolShared.applyShapeStyle(ctx, element);
        ctx.fillRect(element.x, element.y, element.width, element.height);
        ctx.strokeRect(element.x, element.y, element.width, element.height);
        const sectionHeight = element.height / 3;
        ctx.beginPath();
        ctx.moveTo(element.x, element.y + sectionHeight); ctx.lineTo(element.x + element.width, element.y + sectionHeight);
        ctx.moveTo(element.x, element.y + sectionHeight * 2); ctx.lineTo(element.x + element.width, element.y + sectionHeight * 2);
        ctx.stroke();
        if (element.text) drawer.drawElementText(ctx, element);
    }
};




