// 定义元素数组和画布状态
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const container = document.querySelector('.canvas-container');
const selectionFeedback = document.getElementById('selectionFeedback');

// 确保DOM元素加载完成后再执行
document.addEventListener('DOMContentLoaded', function() {
    // 工具按钮事件 - 放在DOM加载完成后执行
    if (document.getElementById('pen')) document.getElementById('pen').addEventListener('click', ()=>setCurrentTool('pen'));
    if (document.getElementById('rect')) document.getElementById('rect').addEventListener('click', ()=>setCurrentTool('rect'));
    if (document.getElementById('circle')) document.getElementById('circle').addEventListener('click', ()=>setCurrentTool('circle'));
    if (document.getElementById('arrow')) document.getElementById('arrow').addEventListener('click', ()=>setCurrentTool('arrow'));
    if (document.getElementById('text')) document.getElementById('text').addEventListener('click', ()=>{
        setCurrentTool('text');
        // 文字工具需要输入文本
        const text = prompt('请输入文字内容:', '');
        if (text) {
            tempObject = {
                type: 'text',
                content: text,
                x: 0,
                y: 0,
                color: document.getElementById('color') ? document.getElementById('color').value : '#000000',
                size: parseInt(document.getElementById('size').value) || 16
            };
        }
    });
    if (document.getElementById('delete')) document.getElementById('delete').addEventListener('click', ()=>{
        if (selectedElements.length > 0) {
            // 创建删除多个元素的命令
            const deleteCommand = new Command();
            deleteCommand.objects = [...selectedElements];
            deleteCommand.indices = selectedElements.map(obj => objects.indexOf(obj));
            
            deleteCommand.execute = () => {
                // 按索引从大到小删除，避免索引变化问题
                deleteCommand.indices.sort((a, b) => b - a).forEach(index => {
                    if (index !== -1 && index < objects.length) {
                        objects.splice(index, 1);
                    }
                });
            };
            
            deleteCommand.undo = () => {
                // 按索引从小到大添加回来
                deleteCommand.indices.sort((a, b) => a - b).forEach((index, i) => {
                    if (index !== -1) {
                        objects.splice(index, 0, deleteCommand.objects[i]);
                    }
                });
            };
            
            executeCommand(deleteCommand);
            selectedElements = [];
            selectedObject = null;
            hideSelectionFeedback();
        }
    });
    if (document.getElementById('clear')) document.getElementById('clear').addEventListener('click', ()=>{
        const clearCommand = new Command();
        clearCommand.previousObjects = [...objects];
        clearCommand.execute = () => {
            objects.length = 0;
            selectedElements = [];
            selectedObject = null;
        };
        clearCommand.undo = () => {
            objects = clearCommand.previousObjects;
        };
        executeCommand(clearCommand);
        hideSelectionFeedback();
    });

    // 初始化画布
    initCanvas();
});

// 撤销/前进功能 - 命令模式实现
class Command {
    execute() {}
    undo() {}
}

class AddCommand extends Command {
    constructor(object) {
        super();
        this.object = object;
        this.index = -1;
    }
    
    execute() {
        this.index = objects.length;
        objects.push(this.object);
    }
    
    undo() {
        if (this.index !== -1) {
            objects.splice(this.index, 1);
        }
    }
}

class DeleteCommand extends Command {
    constructor(object, index) {
        super();
        this.object = object;
        this.index = index;
    }
    
    execute() {
        objects.splice(this.index, 1);
    }
    
    undo() {
        objects.splice(this.index, 0, this.object);
    }
}

// 历史记录管理
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 10;
let objects = [];

function executeCommand(command) {
    command.execute();
    undoStack.push(command);
    if (undoStack.length > MAX_HISTORY) {
        undoStack.shift(); // 移除最早记录，限制历史长度
    }
    redoStack.length = 0; // 执行新命令后清空重做栈
    redraw();
}

// 快捷键绑定
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
        if (undoStack.length > 0) {
            const cmd = undoStack.pop();
            cmd.undo();
            redoStack.push(cmd);
            redraw();
        }
    } else if (e.ctrlKey && e.key === 'y') {
        if (redoStack.length > 0) {
            const cmd = redoStack.pop();
            cmd.execute();
            undoStack.push(cmd);
            redraw();
        }
    }
});

let isDrawing = false;
let currentTool = 'pen';
let startX, startY;
let scale = 1;
let offsetX = 0
  , offsetY = 0;
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
let isMovingSelected = false; // 新增：是否正在移动选中元素

// 临时图形预览
let tempObject = null;
// 画笔当前绘制对象和临时预览点
let currentPenObject = null;
let penPreviewPoints = [];

// 模式切换函数
function setMode(mode) {
    currentMode = mode;
    canvas.style.cursor = mode === 'move' ? 'grab' : 'crosshair';
    currentTool = mode;
    const modeButtons = document.querySelectorAll('.mode-btn');
    if (modeButtons) {
        modeButtons.forEach(btn=>{
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }
    
    // 清除选区反馈
    hideSelectionFeedback();
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
    if (!canvas) return;
    
    canvas.width = window.innerWidth * 3;
    canvas.height = window.innerHeight * 3;
    offsetX = canvas.width / 3;
    offsetY = canvas.height / 3;

    // 设置半透明背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    redraw();
}

// 显示选区视觉反馈
function showSelectionFeedback(rect) {
    if (!selectionFeedback) return;
    
    selectionFeedback.style.display = 'block';
    selectionFeedback.style.left = rect.x + 'px';
    selectionFeedback.style.top = rect.y + 'px';
    selectionFeedback.style.width = rect.width + 'px';
    selectionFeedback.style.height = rect.height + 'px';
}

// 隐藏选区视觉反馈
function hideSelectionFeedback() {
    if (selectionFeedback) {
        selectionFeedback.style.display = 'none';
    }
}

// 重绘所有对象
function redraw() {
    if (!canvas || !ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    
    // 绘制已保存的对象
    objects.forEach(obj => {
        drawObject(obj);
    });
    
    // 绘制画笔实时预览
    if (currentTool === 'pen' && penPreviewPoints.length > 0) {
        ctx.save();
        ctx.strokeStyle = document.getElementById('color') ? document.getElementById('color').value : '#000000';
        ctx.lineWidth = document.getElementById('size') ? document.getElementById('size').value : 2;
        ctx.beginPath();
        ctx.moveTo(penPreviewPoints[0].x, penPreviewPoints[0].y);
        for (let i = 1; i < penPreviewPoints.length; i++) {
            ctx.lineTo(penPreviewPoints[i].x, penPreviewPoints[i].y);
        }
        ctx.stroke();
        ctx.restore();
    }
    
    // 绘制临时预览对象
    if (tempObject) {
        drawTempObject(tempObject);
    }
    
    ctx.restore();
}

// 绘制单个对象
function drawObject(obj) {
    if (!ctx) return;
    
    ctx.strokeStyle = obj.color;
    ctx.lineWidth = obj.size || 2;
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
    case 'text':
        ctx.font = `${obj.size}px Arial`;
        ctx.fillStyle = obj.color;
        ctx.fillText(obj.content, obj.x, obj.y);
        break;
    }
    
    // 如果是选中对象，绘制选中状态
    if (selectedElements.includes(obj)) {
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
            let penMinX = Infinity
              , penMinY = Infinity
              , penMaxX = -Infinity
              , penMaxY = -Infinity;
            obj.points.forEach(p=>{
                penMinX = Math.min(penMinX, p.x);
                penMinY = Math.min(penMinY, p.y);
                penMaxX = Math.max(penMaxX, p.x);
                penMaxY = Math.max(penMaxY, p.y);
            });
            ctx.strokeRect(penMinX - 2, penMinY - 2, penMaxX - penMinX + 4, penMaxY - penMinY + 4);
            break;
        case 'text':
            // 文本选中框
            const textMetrics = ctx.measureText(obj.content);
            ctx.strokeRect(obj.x - 2, obj.y - obj.size + 2, textMetrics.width + 4, obj.size + 4);
            break;
        }
        ctx.restore();
    }
}

// 绘制临时预览对象
function drawTempObject(obj) {
    if (!ctx) return;
    
    ctx.save();
    ctx.strokeStyle = obj.color;
    ctx.lineWidth = obj.size;
    ctx.fillStyle = obj.color;
    ctx.setLineDash([5, 5]); // 虚线预览
    
    switch (obj.type) {
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
    case 'text':
        ctx.font = `${obj.size}px Arial`;
        ctx.fillText(obj.content, obj.x, obj.y);
        break;
    }
    
    ctx.restore();
}

// 绘制箭头
function drawArrow(x1, y1, x2, y2) {
    if (!ctx) return;
    
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
    // 清除画笔预览点
    penPreviewPoints = [];
    // 更新工具栏激活状态
    const toolButtons = document.querySelectorAll('.toolbar button');
    if (toolButtons) {
        toolButtons.forEach(btn => {
            btn.classList.toggle('active', btn.id === toolName);
        });
    }
    
    // 清除选区反馈
    hideSelectionFeedback();
}

// 鼠标事件 - 开始绘制或选择
if (canvas) {
    canvas.addEventListener('mousedown', (e)=>{
        if (currentMode === 'move' || e.button === 2) {
            e.preventDefault();
            isPanning = true;
            lastPanX = e.clientX;
            lastPanY = e.clientY;
            if (canvas) canvas.style.cursor = 'grabbing';
            tempObject = null; // 清除预览
            hideSelectionFeedback();
            return;
        }

        const x = (e.clientX - offsetX) / scale;
        const y = (e.clientY - offsetY - 50) / scale;
        
        // 如果已有选中元素，直接进入移动模式
        if (selectedElements.length > 0) {
            isMovingSelected = true;
            startX = x;
            startY = y;
            return;
        }
        
        // 检查是否点击在元素上
        const clickedObject = getObjectAtPosition(x, y);
        
        if (currentTool === 'select') {
            // 点击空白区域取消选中
            if (!clickedObject && selectedElements.length > 0) {
                selectedElements = [];
                selectedObject = null;
                hideSelectionFeedback();
                redraw();
                return;
            }
            
            // 如果点击了元素
            if (clickedObject) {
                // 切换选中状态（按住Ctrl键可多选）
                if (!e.ctrlKey) {
                    selectedElements = [clickedObject];
                } else if (!selectedElements.includes(clickedObject)) {
                    selectedElements.push(clickedObject);
                }
                selectedObject = clickedObject;
                
                // 进入移动模式
                isMovingSelected = true;
                startX = x;
                startY = y;
                redraw();
                return;
            }
            
            // 否则开始框选
            isSelecting = true;
            selectionStart = {
                x: e.clientX,
                y: e.clientY - 50 // 修复选框位置偏移，减去工具栏高度
            };
            
            // 如果没按Ctrl键则清空已选
            if (!e.ctrlKey) {
                selectedElements = [];
            }
        } else {
            // 绘图工具逻辑
            startX = x;
            startY = y;
            isDrawing = true;

            if (currentTool === 'pen') {
                // 初始化画笔对象和预览点
                currentPenObject = {
                    type: 'pen',
                    points: [{x, y}],
                    color: document.getElementById('color') ? document.getElementById('color').value : '#000000',
                    size: document.getElementById('size') ? document.getElementById('size').value : 2
                };
                penPreviewPoints = [{x, y}];
            } else if (currentTool === 'text' && tempObject) {
                // 放置文字
                tempObject.x = x;
                tempObject.y = y;
                executeCommand(new AddCommand(tempObject));
                tempObject = null;
                isDrawing = false;
            } else {
                // 创建临时预览对象
                tempObject = {
                    type: currentTool,
                    x: startX,
                    y: startY,
                    x2: x,
                    y2: y,
                    width: 0,
                    height: 0,
                    radius: 0,
                    color: document.getElementById('color') ? document.getElementById('color').value : '#000000',
                    size: document.getElementById('size') ? document.getElementById('size').value : 2
                };
            }
        }
    });

    // 鼠标移动事件 - 处理拖拽和平移
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
        } else if (isMovingSelected && selectedElements.length > 0) {
            // 移动选中元素 - 任意位置拖动
            const x = (e.clientX - offsetX) / scale;
            const y = (e.clientY - offsetY - 50) / scale;

            const dx = x - startX;
            const dy = y - startY;

            // 创建移动命令
            const moveCommand = new Command();
            moveCommand.objects = [...selectedElements];
            moveCommand.dx = dx;
            moveCommand.dy = dy;
            
            moveCommand.execute = () => {
                moveCommand.objects.forEach(obj => {
                    if (obj.type === 'pen') {
                        obj.points.forEach(point=>{
                            point.x += dx;
                            point.y += dy;
                        });
                    } else {
                        obj.x += dx;
                        obj.y += dy;
                        if (obj.type === 'arrow') {
                            obj.x2 += dx;
                            obj.y2 += dy;
                        }
                    }
                });
            };
            
            moveCommand.undo = () => {
                moveCommand.objects.forEach(obj => {
                    if (obj.type === 'pen') {
                        obj.points.forEach(point=>{
                            point.x -= dx;
                            point.y -= dy;
                        });
                    } else {
                        obj.x -= dx;
                        obj.y -= dy;
                        if (obj.type === 'arrow') {
                            obj.x2 -= dx;
                            obj.y2 -= dy;
                        }
                    }
                });
            };
            
            executeCommand(moveCommand);

            startX = x;
            startY = y;
            redraw();
        } else if (isSelecting && currentTool === 'select') {
            // 处理选区框
            const currentPos = {
                x: e.clientX,
                y: e.clientY - 50 // 修复选框位置偏移，减去工具栏高度
            };

            const selectionRect = {
                x: Math.min(selectionStart.x, currentPos.x),
                y: Math.min(selectionStart.y, currentPos.y),
                width: Math.abs(currentPos.x - selectionStart.x),
                height: Math.abs(currentPos.y - selectionStart.y)
            };
            
            // 显示选区视觉反馈
            showSelectionFeedback(selectionRect);
        } else if (isDrawing && currentTool === 'pen' && currentPenObject) {
            // 画笔实时跟随显示
            const x = (e.clientX - offsetX) / scale;
            const y = (e.clientY - offsetY - 50) / scale;
            
            // 添加到预览点数组
            penPreviewPoints.push({x, y});
            // 同时添加到实际画笔对象
            currentPenObject.points.push({x, y});
            redraw();
        } else if (isDrawing && currentTool !== 'pen' && tempObject) {
            // 更新临时预览对象
            const x = (e.clientX - offsetX) / scale;
            const y = (e.clientY - offsetY - 50) / scale;

            switch (currentTool) {
                case 'rect':
                    tempObject.width = x - startX;
                    tempObject.height = y - startY;
                    break;
                case 'circle':
                    tempObject.radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
                    break;
                case 'arrow':
                    tempObject.x2 = x;
                    tempObject.y2 = y;
                    break;
            }
            redraw();
        }
    });

    // 鼠标抬起事件
    canvas.addEventListener('mouseup', (e)=>{
        isPanning = false;
        isMovingSelected = false;
        // 松开鼠标退出选中状态
        if (selectedElements.length > 0 && currentTool === 'select') {
            selectedElements = [];
            selectedObject = null;
        }
        if (canvas) canvas.style.cursor = currentMode === 'move' ? 'grab' : 'crosshair';
        
        if (isSelecting) {
            // 完成选区，选择元素
            const x = e.clientX;
            const y = e.clientY - 50; // 修复选框位置偏移，减去工具栏高度
            
            const selectionRect = {
                x: Math.min(selectionStart.x, x),
                y: Math.min(selectionStart.y, y),
                width: Math.abs(x - selectionStart.x),
                height: Math.abs(y - selectionStart.y)
            };
            
            // 转换为画布坐标进行计算
            const canvasRect = {
                x: (selectionRect.x - offsetX) / scale,
                y: (selectionRect.y - offsetY) / scale,
                width: selectionRect.width / scale,
                height: selectionRect.height / scale
            };
            
            detectSelectedElements(canvasRect);
            isSelecting = false;
            
            // 隐藏选区框
            hideSelectionFeedback();
            
            redraw();
            return;
        }

        if (!isDrawing) return;

        const x = (e.clientX - offsetX) / scale;
        const y = (e.clientY - offsetY - 50) / scale;
        
        // 处理图形绘制完成
        if (currentTool === 'pen' && currentPenObject) {
            executeCommand(new AddCommand(currentPenObject));
            currentPenObject = null;
            penPreviewPoints = []; // 清除预览点
        } else if ((currentTool === 'rect' || currentTool === 'circle' || currentTool === 'arrow') && tempObject) {
            executeCommand(new AddCommand({
                type: currentTool,
                x: startX,
                y: startY,
                width: tempObject.width,
                height: tempObject.height,
                radius: tempObject.radius,
                x2: tempObject.x2,
                y2: tempObject.y2,
                color: document.getElementById('color') ? document.getElementById('color').value : '#000000',
                size: document.getElementById('size') ? document.getElementById('size').value : 2
            }));
        }

        // 清除临时对象
        tempObject = null;
        isDrawing = false;
        redraw();
    });

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
    }, {
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
    }, {
        passive: false
    });

    // 阻止右键菜单
    canvas.addEventListener('contextmenu', (e)=>{
        e.preventDefault();
    });
}

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
        case 'text':
            // 文本碰撞检测
            const textMetrics = ctx.measureText(obj.content);
            if (x >= obj.x - 5 && x <= obj.x + textMetrics.width + 5 && 
                y >= obj.y - obj.size && y <= obj.y + 5) {
                return obj;
            }
            break;
        }
    }
    return null;
}

// 缩放功能
if (container) {
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
    });
}

// 检测框选元素 - 仅保留部分包含
function detectSelectedElements(selectionRect) {
    selectedElements = [];
    
    objects.forEach(obj => {
        let isInSelection = false;
        
        // 根据对象类型计算边界框
        let objBounds = null;
        
        switch (obj.type) {
            case 'rect':
                objBounds = {
                    x: obj.x,
                    y: obj.y,
                    width: obj.width,
                    height: obj.height
                };
                break;
            case 'circle':
                objBounds = {
                    x: obj.x - obj.radius,
                    y: obj.y - obj.radius,
                    width: obj.radius * 2,
                    height: obj.radius * 2
                };
                break;
            case 'arrow':
                const minX = Math.min(obj.x, obj.x2);
                const minY = Math.min(obj.y, obj.y2);
                const maxX = Math.max(obj.x, obj.x2);
                const maxY = Math.max(obj.y, obj.y2);
                objBounds = {
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY
                };
                break;
            case 'pen':
                let penMinX = Infinity, penMinY = Infinity, penMaxX = -Infinity, penMaxY = -Infinity;
                obj.points.forEach(p => {
                    penMinX = Math.min(penMinX, p.x);
                    penMinY = Math.min(penMinY, p.y);
                    penMaxX = Math.max(penMaxX, p.x);
                    penMaxY = Math.max(penMaxY, p.y);
                });
                objBounds = {
                    x: penMinX,
                    y: penMinY,
                    width: penMaxX - penMinX,
                    height: penMaxY - penMinY
                };
                break;
            case 'text':
                const textMetrics = ctx.measureText(obj.content);
                objBounds = {
                    x: obj.x,
                    y: obj.y - obj.size,
                    width: textMetrics.width,
                    height: obj.size
                };
                break;
        }
        
        if (objBounds) {
            // 部分包含逻辑
            isInSelection = objBounds.x < selectionRect.x + selectionRect.width && 
                           objBounds.x + objBounds.width > selectionRect.x && 
                           objBounds.y < selectionRect.y + selectionRect.height && 
                           objBounds.y + objBounds.height > selectionRect.y;
        }
        
        if (isInSelection) {
            selectedElements.push(obj);
        }
    });
    
    // 设置最后一个选中的对象为当前选中对象
    if (selectedElements.length > 0) {
        selectedObject = selectedElements[selectedElements.length - 1];
    } else {
        selectedObject = null;
    }
}

// 添加使用提示 - 更新文字工具说明
function showUsageTips() {
    const tips = document.createElement('div');
    tips.className = 'usage-tips';
    
    tips.innerHTML = `
        <h3 style="margin-top:0;">使用指南</h3>
        <p><strong>1. 画笔工具:</strong> 选择画笔后按住鼠标左键拖动绘制，支持实时预览</p>
        <p><strong>2. 文字工具:</strong> 点击文字按钮，输入内容后在画布上点击放置</p>
        <p><strong>3. 元素操作:</strong> 
            <br>- 选中: 点击元素或框选元素
            <br>- 移动: 选中后任意位置按住左键拖动
            <br>- 取消选中: 松开鼠标自动取消选中
            <br>- 多选: 按住Ctrl键点击或框选
        </p>
        <p><strong>4. 撤销/前进:</strong> Ctrl+Z / Ctrl+Y</p>
        <button onclick="this.parentElement.remove()" style="margin-top:10px;padding:5px 10px;">知道了</button>
    `;
    
    document.body.appendChild(tips);
}

// 页面加载完成后显示提示
window.addEventListener('load', showUsageTips);