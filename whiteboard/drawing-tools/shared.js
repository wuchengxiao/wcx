window.DrawingToolShared = {
    createBox(type, x, y) {
        const sticky = type === 'sticky';
        return {
            type, x, y, width: 0, height: 0,
            fill: sticky ? '#FFEB3B' : 'white',
            stroke: sticky ? '#F9A825' : '#333',
            strokeWidth: 2,
            text: sticky ? '便签内容' : '',
            fontSize: 14,
            textColor: '#5D4037',
            textPosition: 'top'
        };
    },
    createLine(type, x, y) {
        const line = { type, x1: x, y1: y, x2: x, y2: y, stroke: '#333', strokeWidth: 2 };
        if (type !== 'line') {
            line.sourceAttachment = null;
            line.targetAttachment = null;
        }
        return line;
    },
    applyShapeStyle(ctx, element) {
        ctx.fillStyle = element.fill;
        ctx.strokeStyle = element.stroke;
        ctx.lineWidth = element.strokeWidth;
    },
    updateShape(element, x, y) {
        element.width = x - element.x;
        element.height = y - element.y;
    },
    finishShape(drawer, element) {
        if (element.width < 0) {
            element.x += element.width;
            element.width = Math.abs(element.width);
        }
        if (element.height < 0) {
            element.y += element.height;
            element.height = Math.abs(element.height);
        }
        if (element.width <= 10 || element.height <= 10) return;
        const created = drawer.addElementToDiagram(drawer.diagrams[drawer.currentDiagram], element);
        drawer.diagrams[drawer.currentDiagram].selectedElements = [created];
    },
    updateLine(element, x, y) {
        element.x2 = x;
        element.y2 = y;
    },
    finishLine(drawer, element, x, y) {
        element.x2 = x;
        element.y2 = y;
        drawer.snapLineEndpoint(element, 'start');
        drawer.snapLineEndpoint(element, 'end');
        if (Math.hypot(element.x2 - element.x1, element.y2 - element.y1) <= 10) return;
        const created = drawer.addElementToDiagram(drawer.diagrams[drawer.currentDiagram], element);
        drawer.diagrams[drawer.currentDiagram].selectedElements = [created];
    },
    boxContains(x, y, element) {
        return x >= element.x && x <= element.x + element.width &&
            y >= element.y && y <= element.y + element.height;
    },
    boxBounds(element) {
        return { x: element.x, y: element.y, width: element.width, height: element.height };
    },
    ellipseContains(x, y, element) {
        const rx = element.width / 2;
        const ry = element.height / 2;
        const cx = element.x + rx;
        const cy = element.y + ry;
        return Math.pow((x - cx) / rx, 2) + Math.pow((y - cy) / ry, 2) <= 1;
    },
    actorContains(x, y, element) {
        const headRadius = Math.min(element.width, element.height) / 4;
        const headCenterX = element.x + element.width / 2;
        const headCenterY = element.y + headRadius;
        const bodyTop = element.y + headRadius * 2;
        const bodyBottom = element.y + element.height;
        const bodyLeft = element.x + element.width * 0.3;
        const bodyRight = element.x + element.width * 0.7;
        const inHead = Math.pow(x - headCenterX, 2) + Math.pow(y - headCenterY, 2) <= Math.pow(headRadius, 2);
        const inBody = x >= bodyLeft && x <= bodyRight && y >= bodyTop && y <= bodyBottom;
        return inHead || inBody;
    },
    polygonContains(x, y, element, drawer) {
        const bounds = this.boxBounds(element);
        const points = element.type === 'triangle'
            ? [{ x: bounds.x + bounds.width / 2, y: bounds.y }, { x: bounds.x + bounds.width, y: bounds.y + bounds.height }, { x: bounds.x, y: bounds.y + bounds.height }]
            : [{ x: bounds.x + bounds.width / 2, y: bounds.y }, { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height }, { x: bounds.x, y: bounds.y + bounds.height / 2 }];
        return drawer.pointInPolygon(x, y, points);
    },
    lineContains(x, y, element, drawer) {
        return drawer.getDistanceToLine(x, y, element.x1, element.y1, element.x2, element.y2) <= 5;
    },
    orthogonalArrowContains(x, y, element, drawer) {
        const points = drawer.getOrthogonalArrowPathPoints(element);
        let minDistance = Infinity;
        for (let i = 0; i < points.length - 1; i++) {
            minDistance = Math.min(minDistance, drawer.getDistanceToLine(x, y, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y));
        }
        return minDistance <= 5;
    },
    curvedArrowContains(x, y, element, drawer) {
        const control = drawer.getCurvedArrowControlPoint(element);
        let minDistance = Infinity;
        let previous = { x: element.x1, y: element.y1 };
        for (let i = 1; i <= 24; i++) {
            const next = drawer.getQuadraticBezierPoint(i / 24, { x: element.x1, y: element.y1 }, control, { x: element.x2, y: element.y2 });
            minDistance = Math.min(minDistance, drawer.getDistanceToLine(x, y, previous.x, previous.y, next.x, next.y));
            previous = next;
        }
        return minDistance <= 6;
    },
    lineBounds(element) {
        return {
            x: Math.min(element.x1, element.x2),
            y: Math.min(element.y1, element.y2),
            width: Math.abs(element.x2 - element.x1),
            height: Math.abs(element.y2 - element.y1)
        };
    },
    curvedArrowBounds(element, drawer) {
        const control = drawer.getCurvedArrowControlPoint(element);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i <= 20; i++) {
            const point = drawer.getQuadraticBezierPoint(i / 20, { x: element.x1, y: element.y1 }, control, { x: element.x2, y: element.y2 });
            minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    },
    orthogonalArrowBounds(element, drawer) {
        const points = drawer.getOrthogonalArrowPathPoints(element);
        const xs = points.map(point => point.x);
        const ys = points.map(point => point.y);
        return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    },
    penContains(x, y, element, drawer) {
        for (let i = 0; i < element.path.length - 1; i++) {
            const start = element.path[i];
            const end = element.path[i + 1];
            if (drawer.getDistanceToLine(x, y, start.x, start.y, end.x, end.y) <= 5) return true;
        }
        return false;
    },
    penBounds(element) {
        if (element.path.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        element.path.forEach(point => {
            minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
        });
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
};



