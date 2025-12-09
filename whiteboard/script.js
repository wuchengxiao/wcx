// 定义元素数组和画布状态
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const container = document.querySelector('.canvas-container');
const selectionFeedback = document.getElementById('selectionFeedback');

// 计算两点之间的距离
function calculateDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

// 图层类定义
class Layer {
    constructor(name = '新图层', visible = true, locked = false) {
        this.id = Date.now() + Math.random().toString(36).substr(2, 9);
        this.name = name;
        this.visible = visible;
        this.locked = locked;
        this.objects = [];
        this.zIndex = 0;
    }
    
    // 添加元素到图层
    addObject(obj) {
        this.objects.push(obj);
    }
    
    // 从图层中删除元素
    removeObject(objId) {
        this.objects = this.objects.filter(obj => obj.id !== objId);
    }
    
    // 清空图层中的所有元素
    clearObjects() {
        this.objects = [];
    }
    
    // 设置图层可见性
    setVisible(visible) {
        this.visible = visible;
    }
    
    // 设置图层锁定状态
    setLocked(locked) {
        this.locked = locked;
    }
    
    // 设置图层名称
    setName(name) {
        this.name = name;
    }
    
    // 设置图层Z轴索引
    setZIndex(zIndex) {
        this.zIndex = zIndex;
    }
}

// 多点触控缩放相关变量
let initialDistance = 0;
let initialScale = 1;
let initialOffsetX = 0;
let initialOffsetY = 0;
let initialCenterX = 0;
let initialCenterY = 0;

// 确保DOM元素加载完成后再执行
document.addEventListener('DOMContentLoaded', function() {
    // 工具按钮事件 - 放在DOM加载完成后执行
    if (document.getElementById('pen')) document.getElementById('pen').addEventListener('click', ()=>setCurrentTool('pen'));
    if (document.getElementById('rect')) document.getElementById('rect').addEventListener('click', ()=>setCurrentTool('rect'));
    if (document.getElementById('circle')) document.getElementById('circle').addEventListener('click', ()=>setCurrentTool('circle'));
    if (document.getElementById('arrow')) document.getElementById('arrow').addEventListener('click', ()=>setCurrentTool('arrow'));
    if (document.getElementById('text')) document.getElementById('text').addEventListener('click', ()=>{
        setCurrentTool('text');
        
        // 创建文字输入对话框
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            font-family: Arial, sans-serif;
        `;
        
        dialog.innerHTML = `
            <h3 style="margin-top: 0;">输入文字</h3>
            <div style="margin-bottom: 15px;">
                <label for="text-content">文字内容:</label><br>
                <input type="text" id="text-content" style="width: 250px; padding: 8px; margin-top: 5px;" placeholder="请输入文字">
            </div>
            <div style="margin-bottom: 15px;">
                <label for="text-size">文字大小:</label><br>
                <input type="number" id="text-size" min="8" max="72" value="16" style="width: 250px; padding: 8px; margin-top: 5px;">
            </div>
            <div style="text-align: right;">
                <button id="text-cancel" style="padding: 8px 16px; margin-right: 10px; cursor: pointer;">取消</button>
                <button id="text-confirm" style="padding: 8px 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;">确定</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // 确认按钮事件
        const confirmBtn = dialog.querySelector('#text-confirm');
        const cancelBtn = dialog.querySelector('#text-cancel');
        const contentInput = dialog.querySelector('#text-content');
        const sizeInput = dialog.querySelector('#text-size');
        
        // 自动聚焦到内容输入框
        contentInput.focus();
        
        confirmBtn.addEventListener('click', () => {
            const text = contentInput.value.trim();
            if (text) {
                tempObject = {
                    type: 'text',
                    content: text,
                    x: 0,
                    y: 0,
                    color: document.getElementById('color') ? document.getElementById('color').value : '#000000',
                    size: parseInt(sizeInput.value) || 16
                };
            }
            document.body.removeChild(dialog);
        });
        
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
        
        // 按Enter键确认，按Esc键取消
        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                confirmBtn.click();
            } else if (e.key === 'Escape') {
                cancelBtn.click();
            }
        });
    });
    if (document.getElementById('delete')) document.getElementById('delete').addEventListener('click', ()=>{
        if (selectedElements.length > 0) {
            // 添加确认对话框
            if (!confirm('确定要删除选中的元素吗？')) {
                return;
            }
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
        // 添加确认对话框
        if (!confirm('确定要清空画布上的所有元素吗？')) {
            return;
        }
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
    
    // 撤销按钮事件
    if (document.getElementById('undo')) document.getElementById('undo').addEventListener('click', ()=>{
        if (undoStack.length > 0) {
            const cmd = undoStack.pop();
            cmd.undo();
            redoStack.push(cmd);
            redraw();
        }
    });
    
    // 前进按钮事件
    if (document.getElementById('redo')) document.getElementById('redo').addEventListener('click', ()=>{
        if (redoStack.length > 0) {
            const cmd = redoStack.pop();
            cmd.execute();
            undoStack.push(cmd);
            redraw();
        }
    });
    
    // 放大按钮事件
    if (document.getElementById('zoom-in')) document.getElementById('zoom-in').addEventListener('click', ()=>{
        const oldScale = scale;
        scale = Math.min(5, scale * 1.1); // 放大10%
        
        // 调整偏移量，使缩放中心在画布中心
        const centerX = container.clientWidth / 2;
        const centerY = container.clientHeight / 2;
        
        offsetX = centerX - (centerX - offsetX) * (scale / oldScale);
        offsetY = centerY - (centerY - offsetY) * (scale / oldScale);
        
        redraw();
    });
    
    // 缩小按钮事件
    if (document.getElementById('zoom-out')) document.getElementById('zoom-out').addEventListener('click', ()=>{
        const oldScale = scale;
        scale = Math.max(0.1, scale * 0.9); // 缩小10%
        
        // 调整偏移量，使缩放中心在画布中心
        const centerX = container.clientWidth / 2;
        const centerY = container.clientHeight / 2;
        
        offsetX = centerX - (centerX - offsetX) * (scale / oldScale);
        offsetY = centerY - (centerY - offsetY) * (scale / oldScale);
        
        redraw();
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
// 触摸和鼠标事件协调标志
let isTouchEvent = false;
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
let isScalingSelected = false; // 新增：是否正在缩放选中元素
let scaleStartX, scaleStartY;
let scaleStartWidth, scaleStartHeight;
let scaleAnchor = 'se'; // 缩放锚点：n, ne, e, se, s, sw, w, nw

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
        
        // 获取对象边界框
        const objectBounds = getObjectBounds(obj);
        
        // 绘制选中边框
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
            ctx.strokeRect(objectBounds.x - 2, objectBounds.y - 2, objectBounds.width + 4, objectBounds.height + 4);
            break;
        case 'text':
            // 文本选中框
            const textMetrics = ctx.measureText(obj.content);
            ctx.strokeRect(obj.x - 2, obj.y - obj.size + 2, textMetrics.width + 4, obj.size + 4);
            break;
        }
        
        // 绘制缩放控制点
        if (selectedElements.length === 1) { // 只在选中单个元素时显示缩放控制点
            const handleSize = 8;
            
            // 定义8个缩放控制点位置
            const handles = {
                'n': {x: objectBounds.x + objectBounds.width / 2, y: objectBounds.y},        // 北
                'ne': {x: objectBounds.x + objectBounds.width, y: objectBounds.y},  // 东北
                'e': {x: objectBounds.x + objectBounds.width, y: objectBounds.y + objectBounds.height / 2},  // 东
                'se': {x: objectBounds.x + objectBounds.width, y: objectBounds.y + objectBounds.height},  // 东南
                's': {x: objectBounds.x + objectBounds.width / 2, y: objectBounds.y + objectBounds.height},  // 南
                'sw': {x: objectBounds.x, y: objectBounds.y + objectBounds.height},  // 西南
                'w': {x: objectBounds.x, y: objectBounds.y + objectBounds.height / 2},  // 西
                'nw': {x: objectBounds.x, y: objectBounds.y}  // 西北
            };
            
            // 绘制所有控制点
            ctx.fillStyle = '#4285f4';
            for (const [anchor, handle] of Object.entries(handles)) {
                ctx.fillRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
            }
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
    // 如果是触摸事件触发的鼠标事件，跳过处理
    if (isTouchEvent) return;
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
    
    // 检查是否点击在缩放控制点上
    let clickedScaleHandle = false;
    if (selectedElements.length > 0) {
        const selectedObject = selectedElements[0]; // 目前只支持单个元素缩放
        const objectBounds = getObjectBounds(selectedObject);
        
        // 检查是否点击在缩放控制点上
        const handleSize = 8 / scale; // 缩放控制点大小，根据画布缩放比例调整
        
        // 定义8个缩放控制点
        const handles = {
            'n': {x: objectBounds.x + objectBounds.width / 2, y: objectBounds.y - handleSize/2},        // 北
            'ne': {x: objectBounds.x + objectBounds.width + handleSize/2, y: objectBounds.y - handleSize/2},  // 东北
            'e': {x: objectBounds.x + objectBounds.width + handleSize/2, y: objectBounds.y + objectBounds.height / 2},  // 东
            'se': {x: objectBounds.x + objectBounds.width + handleSize/2, y: objectBounds.y + objectBounds.height + handleSize/2},  // 东南
            's': {x: objectBounds.x + objectBounds.width / 2, y: objectBounds.y + objectBounds.height + handleSize/2},  // 南
            'sw': {x: objectBounds.x - handleSize/2, y: objectBounds.y + objectBounds.height + handleSize/2},  // 西南
            'w': {x: objectBounds.x - handleSize/2, y: objectBounds.y + objectBounds.height / 2},  // 西
            'nw': {x: objectBounds.x - handleSize/2, y: objectBounds.y - handleSize/2}  // 西北
        };
        
        // 检查是否点击在某个控制点上
        for (const [anchor, handle] of Object.entries(handles)) {
            const distance = Math.sqrt(Math.pow(x - handle.x, 2) + Math.pow(y - handle.y, 2));
            if (distance <= handleSize) {
                isScalingSelected = true;
                scaleStartX = x;
                scaleStartY = y;
                scaleStartWidth = objectBounds.width;
                scaleStartHeight = objectBounds.height;
                scaleAnchor = anchor;
                clickedScaleHandle = true;
                
                // 设置相应的鼠标样式
                if (canvas) {
                    switch(anchor) {
                        case 'n': case 's':
                            canvas.style.cursor = 'ns-resize';
                            break;
                        case 'e': case 'w':
                            canvas.style.cursor = 'ew-resize';
                            break;
                        case 'ne': case 'sw':
                            canvas.style.cursor = 'nesw-resize';
                            break;
                        case 'nw': case 'se':
                            canvas.style.cursor = 'nwse-resize';
                            break;
                    }
                }
                return;
            }
        }
    }
    
    // 检查是否点击在元素上
    const clickedObject = getObjectAtPosition(x, y);
    
    // 无论当前是什么工具，点击空白区域都取消选中状态
    if (!clickedObject && selectedElements.length > 0) {
        selectedElements = [];
        selectedObject = null;
        hideSelectionFeedback();
        redraw();
        return;
    }
    
    // 如果点击在元素上且该元素是选中元素，则进入移动模式
    if (clickedObject && selectedElements.length > 0 && selectedElements.includes(clickedObject)) {
        isMovingSelected = true;
        startX = x;
        startY = y;
        return;
    }
    
    if (currentTool === 'select') {
        
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
    // 如果是触摸事件触发的鼠标事件，跳过处理
    if (isTouchEvent) return;
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
    } else if (isScalingSelected && selectedElements.length > 0) {
        e.preventDefault();
        
        const x = (e.clientX - offsetX) / scale;
        const y = (e.clientY - offsetY - 50) / scale;
        
        // 只支持单个元素缩放
        const obj = selectedElements[0];
        const objectBounds = getObjectBounds(obj);
        
        // 计算缩放比例
        let scaleX = 1;
        let scaleY = 1;
        let newX = obj.x;
        let newY = obj.y;
        let newWidth = scaleStartWidth;
        let newHeight = scaleStartHeight;
        
        // 根据不同的锚点计算新的尺寸和位置
        switch(scaleAnchor) {
            case 'n':
                newHeight = scaleStartHeight - (y - scaleStartY);
                newY = obj.y + (scaleStartHeight - newHeight);
                break;
            case 'ne':
                newWidth = scaleStartWidth + (x - scaleStartX);
                newHeight = scaleStartHeight - (y - scaleStartY);
                newY = obj.y + (scaleStartHeight - newHeight);
                break;
            case 'e':
                newWidth = scaleStartWidth + (x - scaleStartX);
                break;
            case 'se':
                newWidth = scaleStartWidth + (x - scaleStartX);
                newHeight = scaleStartHeight + (y - scaleStartY);
                break;
            case 's':
                newHeight = scaleStartHeight + (y - scaleStartY);
                break;
            case 'sw':
                newWidth = scaleStartWidth - (x - scaleStartX);
                newHeight = scaleStartHeight + (y - scaleStartY);
                newX = obj.x + (scaleStartWidth - newWidth);
                break;
            case 'w':
                newWidth = scaleStartWidth - (x - scaleStartX);
                newX = obj.x + (scaleStartWidth - newWidth);
                break;
            case 'nw':
                newWidth = scaleStartWidth - (x - scaleStartX);
                newHeight = scaleStartHeight - (y - scaleStartY);
                newX = obj.x + (scaleStartWidth - newWidth);
                newY = obj.y + (scaleStartHeight - newHeight);
                break;
        }
        
        // 防止元素太小
        newWidth = Math.max(newWidth, 10);
        newHeight = Math.max(newHeight, 10);
        
        // 计算缩放比例
        scaleX = newWidth / scaleStartWidth;
        scaleY = newHeight / scaleStartHeight;
        
        // 应用缩放
        if (obj.type === 'rect') {
            obj.x = newX;
            obj.y = newY;
            obj.width = newWidth;
            obj.height = newHeight;
        } else if (obj.type === 'circle') {
            // 圆形按比例缩放
            const newRadius = Math.max(newWidth, newHeight) / 2;
            obj.radius = newRadius;
        } else if (obj.type === 'text') {
            // 文本按比例缩放字体大小
            obj.size *= scaleY;
            obj.size = Math.max(obj.size, 8);
        } else if (obj.type === 'pen') {
            // 画笔路径按比例缩放
            const centerX = objectBounds.x + objectBounds.width / 2;
            const centerY = objectBounds.y + objectBounds.height / 2;
            
            obj.points.forEach(point => {
                point.x = centerX + (point.x - centerX) * scaleX;
                point.y = centerY + (point.y - centerY) * scaleY;
            });
        } else if (obj.type === 'arrow') {
            // 箭头按比例缩放
            const centerX = (obj.x + obj.x2) / 2;
            const centerY = (obj.y + obj.y2) / 2;
            
            obj.x = centerX + (obj.x - centerX) * scaleX;
            obj.y = centerY + (obj.y - centerY) * scaleY;
            obj.x2 = centerX + (obj.x2 - centerX) * scaleX;
            obj.y2 = centerY + (obj.y2 - centerY) * scaleY;
        }
        
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
    // 如果是触摸事件触发的鼠标事件，跳过处理
    if (isTouchEvent) return;
    isPanning = false;
    isMovingSelected = false;
    isScalingSelected = false;
    // 松开鼠标退出选中状态
    if (selectedElements.length > 0 && currentTool === 'select') {
        selectedElements = [];
        selectedObject = null;
    }
    if (canvas) canvas.style.cursor = currentMode === 'move' ? 'grab' : 'crosshair';
    
    if (isSelecting) {        // 完成选区，选择元素
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
    // 触摸开始事件
    canvas.addEventListener('touchstart', e=>{
            // 只在事件可取消时调用preventDefault，避免报错
            if (e.cancelable) {
                e.preventDefault();
            }
            isTouchEvent = true; // 标记为触摸事件
            
            if (e.touches.length === 2) {
                // 双指触摸 - 缩放开始
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                
                // 计算初始距离和中心点
                initialDistance = getDistance(touch1, touch2);
                initialScale = scale;
                
                // 计算双指中心点
                const centerX = (touch1.clientX + touch2.clientX) / 2;
                const centerY = (touch1.clientY + touch2.clientY) / 2;
                
                // 保存初始偏移量和中心点
                initialOffsetX = offsetX;
                initialOffsetY = offsetY;
                initialCenterX = centerX;
                initialCenterY = centerY;
                
                // 重置单点触摸状态
                isPanning = false;
                isDrawing = false;
                isSelecting = false;
                isMovingSelected = false;
                return;
            } else if (e.touches.length === 1) {
            const touch = e.touches[0];
            const x = (touch.clientX - offsetX) / scale;
            const y = (touch.clientY - offsetY - 70) / scale;
            
            if (currentMode === 'move') {
                // 平移模式
                isPanning = true;
                lastPanX = touch.clientX;
                lastPanY = touch.clientY;
                if (canvas) canvas.style.cursor = 'grabbing';
                tempObject = null;
                hideSelectionFeedback();
                return;
            }
            
            // 检查是否点击在元素上
            const clickedObject = getObjectAtPosition(x, y);
            
            // 无论当前是什么工具，点击空白区域都取消选中状态
            if (!clickedObject && selectedElements.length > 0) {
                selectedElements = [];
                selectedObject = null;
                hideSelectionFeedback();
                redraw();
                return;
            }
            
            // 如果点击在元素上且该元素是选中元素，则进入移动模式
            if (clickedObject && selectedElements.length > 0 && selectedElements.includes(clickedObject)) {
                isMovingSelected = true;
                startX = x;
                startY = y;
                return;
            }
            
            if (currentTool === 'select') {
                // 如果点击了元素
                if (clickedObject) {
                    selectedElements = [clickedObject];
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
                    x: touch.clientX,
                    y: touch.clientY - 70 // 修复选框位置偏移，减去工具栏高度
                };
            } else {
                // 绘图工具逻辑
                startX = x;
                startY = y;
                isDrawing = true;
                
                if (currentTool === 'pen') {
                    // 初始化画笔对象
                    currentPenObject = {
                        type: 'pen',
                        points: [{x: x, y: y}],
                        color: document.getElementById('color') ? document.getElementById('color').value : '#000000',
                        size: parseInt(document.getElementById('size').value) || 2
                    };
                    penPreviewPoints = [{x: x, y: y}];
                } else {
                    // 其他图形工具的临时预览
                    const color = document.getElementById('color') ? document.getElementById('color').value : '#000000';
                    const size = parseInt(document.getElementById('size').value) || 2;
                    
                    switch (currentTool) {
                        case 'rect':
                            tempObject = {
                                type: 'rect',
                                x: x,
                                y: y,
                                width: 0,
                                height: 0,
                                color: color,
                                size: size
                            };
                            break;
                        case 'circle':
                            tempObject = {
                                type: 'circle',
                                x: x,
                                y: y,
                                radius: 0,
                                color: color,
                                size: size
                            };
                            break;
                        case 'arrow':
                            tempObject = {
                                type: 'arrow',
                                x: x,
                                y: y,
                                x2: x,
                                y2: y,
                                color: color,
                                size: size
                            };
                            break;
                        case 'text':
                            // 更新文字对象的位置为当前触摸位置
                            if (tempObject) {
                                tempObject.x = x;
                                tempObject.y = y;
                            }
                            isDrawing = true;
                            break;
                    }
                }
            }
        }
    }, {
        passive: false
    });

    // 触摸移动事件
    canvas.addEventListener('touchmove', e=>{
        // 只在事件可取消时调用preventDefault，避免报错
        if (e.cancelable) {
            e.preventDefault();
        }
        
        if (e.touches.length === 2) {
            // 双指触摸 - 缩放和移动
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            
            // 计算当前距离
            const currentDistance = getDistance(touch1, touch2);
            
            // 计算缩放因子
            const scaleFactor = currentDistance / initialDistance;
            
            // 计算新的缩放比例
            const oldScale = scale;
            scale = Math.max(0.1, Math.min(5, initialScale * scaleFactor));
            
            // 计算双指中心点
            const centerX = (touch1.clientX + touch2.clientX) / 2;
            const centerY = (touch1.clientY + touch2.clientY) / 2;
            
            // 计算偏移量调整，使缩放围绕双指中心进行
            const scaleRatio = scale / oldScale;
            offsetX = centerX - (centerX - initialOffsetX) * scaleRatio;
            offsetY = centerY - (centerY - initialOffsetY) * scaleRatio;
            
            redraw();
            return;
        } else if (e.touches.length === 1) {
            const touch = e.touches[0];
            const x = (touch.clientX - offsetX) / scale;
            const y = (touch.clientY - offsetY - 70) / scale;
            
            if (isPanning) {
                // 平移模式
                const dx = touch.clientX - lastPanX;
                const dy = touch.clientY - lastPanY;
                offsetX += dx;
                offsetY += dy;
                lastPanX = touch.clientX;
                lastPanY = touch.clientY;
                redraw();
                return;
            }
            
            if (isMovingSelected) {
                // 移动选中元素
                const dx = x - startX;
                const dy = y - startY;
                
                selectedElements.forEach(obj => {
                    if (obj.type === 'pen') {
                        // 移动画笔的所有点
                        obj.points.forEach(point => {
                            point.x += dx;
                            point.y += dy;
                        });
                    } else {
                        // 移动其他形状
                        obj.x += dx;
                        obj.y += dy;
                        if (obj.x2 !== undefined) obj.x2 += dx;
                        if (obj.y2 !== undefined) obj.y2 += dy;
                    }
                });
                
                startX = x;
                startY = y;
                redraw();
                return;
            }
            
            if (isSelecting) {
                // 框选模式
                const selectionRect = {
                    x: Math.min(selectionStart.x, touch.clientX),
                    y: Math.min(selectionStart.y, touch.clientY - 70),
                    width: Math.abs(touch.clientX - selectionStart.x),
                    height: Math.abs((touch.clientY - 70) - selectionStart.y)
                };
                showSelectionFeedback(selectionRect);
                return;
            }
            
            if (isDrawing) {
                // 绘制模式
                if (currentTool === 'pen') {
                    // 更新画笔预览点
                    penPreviewPoints.push({x: x, y: y});
                    if (currentPenObject) {
                        currentPenObject.points.push({x: x, y: y});
                    }
                } else if (tempObject) {
                    // 更新其他图形的临时预览
                    switch (currentTool) {
                        case 'rect':
                            tempObject.width = x - startX;
                            tempObject.height = y - startY;
                            break;
                        case 'circle':
                            const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
                            tempObject.radius = radius;
                            break;
                        case 'arrow':
                            tempObject.x2 = x;
                            tempObject.y2 = y;
                            break;
                    }
                }
                redraw();
            }
        }
    }, {
        passive: false
    });

    // 触摸结束事件
    canvas.addEventListener('touchend', e=>{
        // 只在事件可取消时调用preventDefault，避免报错
        if (e.cancelable) {
            e.preventDefault();
        }
        
        isPanning = false;
        isDrawing = false;
        isSelecting = false;
        isMovingSelected = false;
        
        if (canvas) canvas.style.cursor = currentMode === 'move' ? 'grab' : 'crosshair';
        
        if (currentPenObject && currentPenObject.points.length > 1) {
            // 完成画笔绘制
            const command = new AddCommand(currentPenObject);
            executeCommand(command);
            currentPenObject = null;
        }
        
        if (tempObject) {
            if (tempObject.type === 'text') {
                // 确保文字对象有正确的位置
                if (e.changedTouches.length > 0) {
                    const touch = e.changedTouches[0];
                    tempObject.x = (touch.clientX - offsetX) / scale;
                    tempObject.y = (touch.clientY - offsetY - 70) / scale;
                }
                // 文字工具在触摸结束时放置文字
                const command = new AddCommand(tempObject);
                executeCommand(command);
                tempObject = null;
            } else {
                // 完成其他图形绘制
                let isValid = false;
                
                switch (currentTool) {
                    case 'rect':
                        isValid = Math.abs(tempObject.width) > 1 && Math.abs(tempObject.height) > 1;
                        break;
                    case 'circle':
                        isValid = tempObject.radius > 1;
                        break;
                    case 'arrow':
                        isValid = Math.abs(tempObject.x2 - tempObject.x) > 1 || Math.abs(tempObject.y2 - tempObject.y) > 1;
                        break;
                }
                
                if (isValid) {
                    const command = new AddCommand(tempObject);
                    executeCommand(command);
                }
                tempObject = null;
            }
        }
        
        if (isSelecting) {
            // 完成框选
            const touch = e.changedTouches[0];
            const selectionRect = {
                x: Math.min(selectionStart.x, touch.clientX),
                y: Math.min(selectionStart.y, touch.clientY - 70),
                width: Math.abs(touch.clientX - selectionStart.x),
                height: Math.abs((touch.clientY - 70) - selectionStart.y)
            };
            
            // 检测选中元素
            detectSelectedElements({
                x: (selectionRect.x - offsetX) / scale,
                y: (selectionRect.y - offsetY) / scale,
                width: selectionRect.width / scale,
                height: selectionRect.height / scale
            });
            
            hideSelectionFeedback();
            redraw();
        }
        
        penPreviewPoints = [];
            // 延迟重置，确保后续的鼠标事件也能被检测到
            setTimeout(() => {
                isTouchEvent = false;
            }, 100);
        }, {
            passive: false
        });

    // 触摸取消事件
    canvas.addEventListener('touchcancel', e=>{
        e.preventDefault();
        isPanning = false;
        isDrawing = false;
        isSelecting = false;
        isMovingSelected = false;
        currentPenObject = null;
        tempObject = null;
        penPreviewPoints = [];
        hideSelectionFeedback();
        if (canvas) canvas.style.cursor = currentMode === 'move' ? 'grab' : 'crosshair';
            // 延迟重置，确保后续的鼠标事件也能被检测到
            setTimeout(() => {
                isTouchEvent = false;
            }, 100);
        }, {
            passive: false
        });

    // 阻止右键菜单
    canvas.addEventListener('contextmenu', (e)=>{
        e.preventDefault();
    });
}

// 获取对象的边界框
function getObjectBounds(obj) {
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
            ctx.font = `${obj.size}px Arial`;
            const textMetrics = ctx.measureText(obj.content);
            objBounds = {
                x: obj.x,
                y: obj.y - obj.size,
                width: textMetrics.width,
                height: obj.size
            };
            break;
    }
    
    return objBounds;
}

// 获取指定位置的对象 - 优化触摸选择区域
function getObjectAtPosition(x, y) {
    // 触摸选择的边距，根据缩放比例动态调整
    const touchMargin = 8 / scale;
    const circleTouchMargin = 10 / scale;
    const arrowTouchMargin = 10 / scale;
    const penTouchMargin = 8 / scale;
    
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];

        switch (obj.type) {
        case 'rect':
            // 增大矩形的选择区域
            if (x >= obj.x - touchMargin && x <= obj.x + obj.width + touchMargin && 
                y >= obj.y - touchMargin && y <= obj.y + obj.height + touchMargin) {
                return obj;
            }
            break;
        case 'circle':
            // 增大圆形的选择区域
            const distance = Math.sqrt(Math.pow(x - obj.x, 2) + Math.pow(y - obj.y, 2));
            if (distance <= obj.radius + circleTouchMargin) {
                return obj;
            }
            break;
        case 'arrow':
            // 改进箭头的碰撞检测
            const lineLength = Math.sqrt(Math.pow(obj.x2 - obj.x, 2) + Math.pow(obj.y2 - obj.y, 2));
            const distanceToLine = Math.abs((obj.y2 - obj.y) * x - (obj.x2 - obj.x) * y + obj.x2 * obj.y - obj.y2 * obj.x) / lineLength;
            
            // 检查点是否在线段范围内
            const dotProduct = (x - obj.x) * (obj.x2 - obj.x) + (y - obj.y) * (obj.y2 - obj.y);
            if (distanceToLine < arrowTouchMargin && dotProduct >= 0 && dotProduct <= lineLength * lineLength) {
                return obj;
            }
            break;
        case 'pen':
            // 改进画笔轨迹的碰撞检测
            for (let j = 0; j < obj.points.length; j++) {
                const point = obj.points[j];
                
                // 检查点附近
                if (Math.abs(point.x - x) < penTouchMargin && Math.abs(point.y - y) < penTouchMargin) {
                    return obj;
                }
                
                // 检查线段附近
                if (j > 0) {
                    const prevPoint = obj.points[j - 1];
                    const segmentLength = Math.sqrt(Math.pow(prevPoint.x - point.x, 2) + Math.pow(prevPoint.y - point.y, 2));
                    const distanceToSegment = Math.abs((point.y - prevPoint.y) * x - (point.x - prevPoint.x) * y + point.x * prevPoint.y - point.y * prevPoint.x) / segmentLength;
                    
                    // 检查点是否在线段范围内
                    const dotProduct = (x - prevPoint.x) * (point.x - prevPoint.x) + (y - prevPoint.y) * (point.y - prevPoint.y);
                    if (distanceToSegment < penTouchMargin && dotProduct >= 0 && dotProduct <= segmentLength * segmentLength) {
                        return obj;
                    }
                }
            }
            break;
        case 'text':
            // 增大文本的选择区域
            const textMetrics = ctx.measureText(obj.content);
            if (x >= obj.x - 10 && x <= obj.x + textMetrics.width + 10 && 
                y >= obj.y - obj.size - 5 && y <= obj.y + 10) {
                return obj;
            }
            break;
        }
    }
    return null;
}

// 缩放功能 - 鼠标滚轮
if (container) {
    container.addEventListener('wheel', (e)=>{
        e.preventDefault();

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const oldScale = scale;
        scale = Math.max(0.1, Math.min(5, scale * delta));

        const mouseX = e.clientX;
        const mouseY = e.clientY - 70;

        offsetX = mouseX - (mouseX - offsetX) * (scale / oldScale);
        offsetY = mouseY - (mouseY - offsetY) * (scale / oldScale);

        redraw();
    });
}

// 计算两点之间的距离
function getDistance(touch1, touch2) {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
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