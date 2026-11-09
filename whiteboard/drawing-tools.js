(function () {
    const toolScripts = [
        '../property-settings.js',
        'shared.js',
        'rectangle.js', 'ellipse.js', 'triangle.js', 'diamond.js', 'sticky.js',
        'class.js', 'use-case.js', 'actor.js', 'package.js',
        'line.js', 'arrow.js', 'curved-arrow.js', 'orthogonal-arrow.js',
        'text.js', 'pen.js', 'group.js', 'select.js', 'pan.js', 'delete.js', 'custom-shape.js'
    ];
    const loaderUrl = document.currentScript.src;
    const toolsDirectory = new URL('./drawing-tools/', loaderUrl);

    function loadScript(source) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = source;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`无法加载脚本：${source}`));
            document.head.appendChild(script);
        });
    }

    function registerDrawingTools() {
        const tools = window.DrawingToolModules;
        const shapeTypes = new Set(['rectangle', 'ellipse', 'triangle', 'diamond', 'sticky', 'class', 'use-case', 'actor', 'package']);
        const lineTypes = new Set(['line', 'arrow', 'curved-arrow', 'orthogonal-arrow']);

        Object.values(tools).forEach(tool => {
            if (tool.properties) return;
            if (tool.kind === 'shape') tool.properties = 'shape';
            else if (tool.kind === 'line') tool.properties = 'line';
            else if (tool.kind === 'text') tool.properties = 'text';
            else if (tool.kind === 'pen') tool.properties = 'pen';
        });

        window.DrawingTools = {
            registry: tools,
            beginDrawingTool(type, x, y, event) {
                const tool = tools[type];
                if (!tool) return;
                if (tool.kind === 'shape' || tool.kind === 'line') {
                    this.isDrawing = true;
                    this.tempElement = tool.create(x, y);
                } else if (tool.kind === 'text') {
                    const element = tool.create(x, y);
                    const diagram = this.diagrams[this.currentDiagram];
                    this.addElementToDiagram(diagram, element);
                    diagram.selectedElements = [element];
                    this.render();
                    this.startInlineTextEdit(element, { selectAll: true });
                } else if (tool.kind === 'pen') {
                    tool.start(this, x, y);
                } else if (tool.kind === 'operation') {
                    tool.begin(this, x, y, event);
                }
            },
            beginPanTool(event) { tools.pan.begin(this, event); },
            updateTempElement(x, y) {
                if (!this.tempElement) return;
                if (this.tempElement.type === 'select') {
                    const selected = this.diagrams[this.currentDiagram].selectedElements;
                    const dx = x - this.startX;
                    const dy = y - this.startY;
                    const movedElementIds = new Set();
                    selected.forEach(element => {
                        if (element.id) movedElementIds.add(element.id);
                        if (element.type === 'group') {
                            element.x += dx;
                            element.y += dy;
                            element.elements.forEach(child => {
                                if (child.x !== undefined) child.x += dx;
                                if (child.y !== undefined) child.y += dy;
                                if (child.x1 !== undefined) child.x1 += dx;
                                if (child.y1 !== undefined) child.y1 += dy;
                                if (child.x2 !== undefined) child.x2 += dx;
                                if (child.y2 !== undefined) child.y2 += dy;
                                if (child.path) child.path.forEach(point => { point.x += dx; point.y += dy; });
                            });
                        } else {
                            if (element.x !== undefined) element.x += dx;
                            if (element.y !== undefined) element.y += dy;
                            if (element.x1 !== undefined) element.x1 += dx;
                            if (element.y1 !== undefined) element.y1 += dy;
                            if (element.x2 !== undefined) element.x2 += dx;
                            if (element.y2 !== undefined) element.y2 += dy;
                            if (element.path) element.path.forEach(point => { point.x += dx; point.y += dy; });
                        }
                    });
                    this.syncAttachedArrowsForElementIds(movedElementIds);
                    this.startX = x;
                    this.startY = y;
                    return;
                }
                if (shapeTypes.has(this.tempElement.type)) window.DrawingToolShared.updateShape(this.tempElement, x, y);
                else if (lineTypes.has(this.tempElement.type)) window.DrawingToolShared.updateLine(this.tempElement, x, y);
            },
            finishDrawing(x, y) {
                if (!this.tempElement) return;
                if (shapeTypes.has(this.tempElement.type)) window.DrawingToolShared.finishShape(this, this.tempElement);
                else if (lineTypes.has(this.tempElement.type)) window.DrawingToolShared.finishLine(this, this.tempElement, x, y);
            },
            startPenDrawing(x, y) { tools.pen.start(this, x, y); },
            continuePenDrawing(x, y) { tools.pen.move(this, x, y); },
            finishPenDrawing() { tools.pen.finish(this); },
            drawPen(ctx, element) { tools.pen.draw(ctx, element); },
            drawElement(ctx, element) {
                const tool = tools[element.type];
                if (!tool || typeof tool.draw !== 'function') return;
                ctx.save();
                tool.draw(ctx, element, this);
                ctx.restore();
            }
        };
    }

    async function start() {
        try {
            window.DrawingToolModules = {};
            for (const file of toolScripts) {
                await loadScript(new URL(file, toolsDirectory).href);
            }
            registerDrawingTools();
            await loadScript(new URL('./script.js', loaderUrl).href);
        } catch (error) {
            console.error('白板工具加载失败：', error);
        }
    }

    start();
})();
