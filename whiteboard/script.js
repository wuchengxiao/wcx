// 定义元素数组和画布状态
const elements = [];
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const container = document.querySelector('.canvas-container');

let isDrawing = false;
let currentTool = 'pen';
let startX, startY;
let scale = 1;
let offsetX = 0
  , offsetY = 0;
let objects = [];
let selectedObject = null;
// 新增状态变量
let isSelecting = false;
let selectionStart = {
    x: 0,
    y: 0
};
let selectedElements = [];
let tempSelectionRect = null;
// 模式状态管理 'select' 或 'move'
let currentMode = 'select';

let isPanning = false;
let lastPanX, lastPanY;

// 模式切换函数
function setMode(mode) {
    currentMode = mode;
    canvas.style.cursor = mode === 'move' ? 'grab' : 'crosshair';
    currentTool = mode;
    document.querySelectorAll('.mode-btn').forEach(btn=>{
        btn.classList.toggle('active', btn.dataset.mode === mode);
    }
    );
}

// 初始化时禁用所有浏览器手势
document.addEventListener('gesturestart', e=>e.preventDefault(), {
    passive: false
});
document.addEventListener('gesturechange', e=>e.preventDefault(), {
    passive: false
});
document.addEventListener('gestureend', e=>e.preventDefault(), {
    passive: false
});

// 初始化画布大小
function initCanvas() {
    canvas.width = window.innerWidth * 3;
    canvas.height = window.innerHeight * 3;
    offsetX = canvas.width / 3;
    offsetY = canvas.height / 3;

    // 设置半透明背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    redraw();
}

// 重绘所有对象
function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    
    objects.forEach(obj => {
        drawObject(obj);
    });
    
    ctx.restore();
}

// 绘制单个对象
function drawObject(obj) {
    ctx.strokeStyle = obj.color;
    ctx.lineWidth = obj.size;
    ctx.fillStyle = obj.color;

    switch (obj.type) {
    case 'pen':
        ctx.beginPath();
        ctx.moveTo(obj.points[0].x, obj.points[0].y);
        for (let i = 1; i < obj.points.length; i++) {
            ctx.lineTo(obj.points[i].x, obj.points[i].y);
        }
        ctx.stroke();
        break;
    case 'rect':
        ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
        break;
    case 'circle':
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
    case 'arrow':
        drawArrow(obj.x, obj.y, obj.x2, obj.y2);
        break;
    }
    if (obj === selectedObject) {
        ctx.save();
        ctx.strokeStyle = '#4285f4';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        switch (obj.type) {
        case 'rect':
            ctx.strokeRect(obj.x - 2, obj.y - 2, obj.width + 4, obj.height + 4);
            break;
        case 'circle':
            ctx.beginPath();
            ctx.arc(obj.x, obj.y, obj.radius + 2, 0, Math.PI * 2);
            ctx.stroke();
            break;
        case 'arrow':
            // 箭头选中框简化处理
            const midX = (obj.x + obj.x2) / 2;
            const midY = (obj.y + obj.y2) / 2;
            const length = Math.sqrt(Math.pow(obj.x2 - obj.x, 2) + Math.pow(obj.y2 - obj.y, 2));
            ctx.beginPath();
            ctx.arc(midX, midY, length / 2 + 5, 0, Math.PI * 2);
            ctx.stroke();
            break;
        case 'pen':
            // 画笔选中框简化处理
            let minX = Infinity
              , minY = Infinity
              , maxX = -Infinity
              , maxY = -Infinity;
            obj.points.forEach(p=>{
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }
            );
            ctx.strokeRect(minX - 2, minY - 2, maxX - minX + 4, maxY - minY + 4);
            break;
        }
        ctx.restore();
    }
}

// 绘制箭头
function drawArrow(x1, y1, x2, y2) {
    const headLength = 15;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

function setCurrentTool(toolName){
    currentTool = toolName;
    currentMode = 'select';
}

// 工具按钮事件
document.getElementById('pen').addEventListener('click', ()=>setCurrentTool('pen'));
document.getElementById('rect').addEventListener('click', ()=>setCurrentTool('rect'));
document.getElementById('circle').addEventListener('click', ()=>setCurrentTool('circle'));
document.getElementById('arrow').addEventListener('click', ()=>setCurrentTool('arrow'));
document.getElementById('delete').addEventListener('click', ()=>{
    if (selectedObject) {
        objects = objects.filter(obj=>obj !== selectedObject);
        selectedObject = null;
        redraw();
    }
}
);
document.getElementById('clear').addEventListener('click', ()=>{
    objects = [];
    redraw();
}
);

// 鼠标事件
canvas.addEventListener('mousedown', (e)=>{
    if (currentMode === 'move' || e.button === 2) {
        e.preventDefault();
        isPanning = true;
        lastPanX = e.clientX;
        lastPanY = e.clientY;
        canvas.style.cursor = 'grabbing';
    } else {

        const x = (e.clientX - offsetX) / scale;
        const y = (e.clientY - offsetY - 50) / scale;

        if (currentTool === 'select') {
            if (isPanning) {
                const dx = e.clientX - lastPanX;
                const dy = e.clientY - lastPanY;
                offsetX += dx;
                offsetY += dy;
                lastPanX = e.clientX;
                lastPanY = e.clientY;
                redraw();
                return;
            }
            selectedObject = getObjectAtPosition(x, y);
            if (selectedObject) {
                startX = x;
                startY = y;
                isDrawing = true;
            }
        } else {
            startX = x;
            startY = y;
            isDrawing = true;

            if (currentTool === 'pen') {
                objects.push({
                    type: 'pen',
                    points: [{
                        x,
                        y
                    }],
                    color: document.getElementById('color').value,
                    size: document.getElementById('size').value
                });
            }
        }
    }
}
);

canvas.addEventListener('mousemove', e=>{
    if (isPanning) {
        e.preventDefault();
        const dx = e.clientX - lastPanX;
        const dy = e.clientY - lastPanY;
        offsetX += dx;
        offsetY += dy;
        lastPanX = e.clientX;
        lastPanY = e.clientY;
        redraw();
    }
}
);

canvas.addEventListener('mousemove', (e)=>{
    if (!isDrawing)
        return;

    const x = (e.clientX - offsetX) / scale;
    const y = (e.clientY - offsetY - 50) / scale;

    if (currentTool === 'select' && selectedObject) {
        const dx = x - startX;
        const dy = y - startY;

        if (selectedObject.type === 'pen') {
            selectedObject.points.forEach(point=>{
                point.x += dx;
                point.y += dy;
            }
            );
        } else {
            selectedObject.x += dx;
            selectedObject.y += dy;
            if (selectedObject.type === 'arrow') {
                selectedObject.x2 += dx;
                selectedObject.y2 += dy;
            }
        }

        startX = x;
        startY = y;
        redraw();
    } else if (currentTool === 'pen') {
        const lastObj = objects[objects.length - 1];
        lastObj.points.push({
            x,
            y
        });
        redraw();
    }
}
);

// 添加鼠标抬起事件
canvas.addEventListener('mouseup', ()=>{
    isPanning = false;
    canvas.style.cursor = currentMode === 'move' ? 'grab' : 'crosshair';
}
);

canvas.addEventListener('mouseup', (e)=>{
    if (!isDrawing)
        return;

    const x = (e.clientX - offsetX) / scale;
    const y = (e.clientY - offsetY - 50) / scale;
    if (e.button === 2) {
        isPanning = false;
        canvas.style.cursor = 'crosshair';
    }
    if (currentTool === 'rect') {
        objects.push({
            type: 'rect',
            x: startX,
            y: startY,
            width: x - startX,
            height: y - startY,
            color: document.getElementById('color').value,
            size: document.getElementById('size').value
        });
    } else if (currentTool === 'circle') {
        const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
        objects.push({
            type: 'circle',
            x: startX,
            y: startY,
            radius,
            color: document.getElementById('color').value,
            size: document.getElementById('size').value
        });
    } else if (currentTool === 'arrow') {
        objects.push({
            type: 'arrow',
            x: startX,
            y: startY,
            x2: x,
            y2: y,
            color: document.getElementById('color').value,
            size: document.getElementById('size').value
        });
    }

    isDrawing = false;
    redraw();
}
);

// 触摸事件处理（同样禁用手势）
canvas.addEventListener('touchstart', e=>{
    if (currentMode === 'select') {
        e.preventDefault();
        if (e.touches.length === 1) {
            isPanning = true;
            lastPanX = e.touches[0].clientX;
            lastPanY = e.touches[0].clientY;
        }
    }
}
, {
    passive: false
});

canvas.addEventListener('touchmove', e=>{
    if (isPanning && e.touches.length === 1) {
        e.preventDefault();
        const dx = e.touches[0].clientX - lastPanX;
        const dy = e.touches[0].clientY - lastPanY;
        offsetX += dx;
        offsetY += dy;
        lastPanX = e.touches[0].clientX;
        lastPanY = e.touches[0].clientY;
        redraw();
    }
}
, {
    passive: false
});

// 获取指定位置的对象
function getObjectAtPosition(x, y) {
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];

        switch (obj.type) {
        case 'rect':
            if (x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height) {
                return obj;
            }
            break;
        case 'circle':
            const distance = Math.sqrt(Math.pow(x - obj.x, 2) + Math.pow(y - obj.y, 2));
            if (distance <= obj.radius) {
                return obj;
            }
            break;
        case 'arrow':
            // 简化的碰撞检测
            const lineLength = Math.sqrt(Math.pow(obj.x2 - obj.x, 2) + Math.pow(obj.y2 - obj.y, 2));
            const distanceToLine = Math.abs((obj.y2 - obj.y) * x - (obj.x2 - obj.x) * y + obj.x2 * obj.y - obj.y2 * obj.x) / lineLength;
            if (distanceToLine < 5) {
                return obj;
            }
            break;
        case 'pen':
            // 简化的碰撞检测
            for (let j = 0; j < obj.points.length; j++) {
                const point = obj.points[j];
                if (Math.abs(point.x - x) < 5 && Math.abs(point.y - y) < 5) {
                    return obj;
                }
            }
            break;
        }
    }
    return null;
}

// 缩放功能
container.addEventListener('wheel', (e)=>{
    e.preventDefault();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const oldScale = scale;
    scale = Math.max(0.1, Math.min(5, scale * delta));

    const mouseX = e.clientX;
    const mouseY = e.clientY - 50;

    offsetX = mouseX - (mouseX - offsetX) * (scale / oldScale);
    offsetY = mouseY - (mouseY - offsetY) * (scale / oldScale);

    redraw();
}
);

// 阻止右键菜单
canvas.addEventListener('contextmenu', (e)=>{
    e.preventDefault();
}
);

// 修改鼠标事件处理
canvas.addEventListener('mousedown', e=>{
    if (currentMode === 'select' && e.button === 0) {
        isSelecting = true;
        selectionStart = {
            x: e.clientX - offsetX,
            y: e.clientY - offsetY
        };

        // 如果没按Ctrl键则清空已选
        if (!e.ctrlKey) {
            selectedElements.forEach(el=>el.selected = false);
            selectedElements = [];
        }
    }
}
);

canvas.addEventListener('mousemove', e=>{
    if (isSelecting) {
        const currentPos = {
            x: e.clientX - offsetX,
            y: e.clientY - offsetY
        };

        tempSelectionRect = {
            x: Math.min(selectionStart.x, currentPos.x),
            y: Math.min(selectionStart.y, currentPos.y),
            width: Math.abs(currentPos.x - selectionStart.x),
            height: Math.abs(currentPos.y - selectionStart.y)
        };

        // 传递当前选择框参数
        detectSelectedElements(tempSelectionRect);
        redraw();
    }
}
);

canvas.addEventListener('mouseup', e=>{
    if (isSelecting && e.button === 0) {
        isSelecting = false;
        tempSelectionRect = null;
        redraw();
    }
}
);

// 检测框选元素
function detectSelectedElements(selectionRect) {
    elements.forEach(el=>{
        const isInSelection = checkCollision(el, selectionRect);
        el.selected = isInSelection;
        if (isInSelection && !selectedElements.includes(el)) {
            selectedElements.push(el);
        }
    }
    );
}

// 碰撞检测
function checkCollision(element, rect) {
    return element.x < rect.x + rect.width && element.x + element.width > rect.x && element.y < rect.y + rect.height && element.y + element.height > rect.y;
}

// 初始化
window.addEventListener('load', initCanvas);
window.addEventListener('resize', initCanvas);
