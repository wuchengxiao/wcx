// UML Drawer 主程序
class UMLDrawer {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentTool = 'select';
        this.currentDiagram = 1;
        this.diagrams = {
            1: {
                elements: [],
                selectedElements: [],
                groups: []
            }
        };
        this.isDrawing = false;
        this.isResizing = false;
        this.resizeHandle = null;
        this.startX = 0;
        this.startY = 0;
        this.tempElement = null;
        this.offsetX = 0;
        this.offsetY = 0;
        this.clipboard = [];
        this.selectionBox = null;
        this.ctrlPressed = false;
        this.isDrawingPen = false;
        this.currentPenPath = [];
        this.penColor = '#333333';
        this.penWidth = 2;
        this.canvasScale = 1;
        this.canvasOffsetX = 0;
        this.canvasOffsetY = 0;
        this.baseWidth = 1200;
        this.baseHeight = 800;
        this.canvasSizeSet = false;
        this.lastTap = 0;
        
        this.init();
    }
    
    init() {
        this.resizeCanvas();
        this.setupEventListeners();
        this.setupToolListeners();
        this.setupDiagramListeners();
        this.render();
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        // 获取可视区域大小，减去padding
        const containerWidth = container.clientWidth - 40;
        const containerHeight = container.clientHeight - 40;
        
        // 如果还没有设置过画布大小，设置为占满可视区域
        if (!this.canvasSizeSet) {
            this.baseWidth = Math.max(containerWidth, 400);
            this.baseHeight = Math.max(containerHeight, 300);
            this.canvasSizeSet = true;
        }
        
        // 计算缩放比例，使画布适应容器
        const scaleX = containerWidth / this.baseWidth;
        const scaleY = containerHeight / this.baseHeight;
        this.canvasScale = Math.min(scaleX, scaleY, 1); // 最大缩放为1（原始大小）
        
        this.canvas.width = this.baseWidth;
        this.canvas.height = this.baseHeight;
        this.canvas.style.width = `${this.baseWidth * this.canvasScale}px`;
        this.canvas.style.height = `${this.baseHeight * this.canvasScale}px`;
    }
    
    setCanvasSize(width, height) {
        this.baseWidth = width;
        this.baseHeight = height;
        this.canvasSizeSet = true;
        this.resizeCanvas();
        this.render();
    }
    
    resizeCanvasByRatio(ratio) {
        // 按比例调整画布大小
        const newWidth = Math.round(this.baseWidth * ratio);
        const newHeight = Math.round(this.baseHeight * ratio);
        
        // 限制最小和最大尺寸
        const minWidth = 400, minHeight = 300;
        const maxWidth = 5000, maxHeight = 5000;
        
        const finalWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        const finalHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
        
        this.setCanvasSize(finalWidth, finalHeight);
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));
        
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        this.canvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });
        
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        document.addEventListener('copy', this.handleCopy.bind(this));
        document.addEventListener('paste', this.handlePaste.bind(this));
        
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    handleDoubleClick(e) {
        const coords = this.getCanvasCoordinates(e.clientX, e.clientY);
        const x = coords.x;
        const y = coords.y;
        
        const diagram = this.diagrams[this.currentDiagram];
        const elements = diagram.elements;
        
        // 查找双击的元素
        let clickedElement = null;
        for (let i = elements.length - 1; i >= 0; i--) {
            const element = elements[i];
            if (this.isPointInElement(x, y, element)) {
                clickedElement = element;
                break;
            }
        }
        
        if (clickedElement) {
            this.showPropertyDialog(clickedElement);
        }
    }
    
    showPropertyDialog(element) {
        this.currentEditingElement = element;
        
        // 填充当前值
        document.getElementById('prop-width').value = Math.abs(element.width);
        document.getElementById('prop-height').value = Math.abs(element.height);
        document.getElementById('prop-stroke-width').value = element.strokeWidth || 2;
        document.getElementById('prop-stroke-color').value = element.stroke || '#333333';
        document.getElementById('prop-fill-color').value = element.fill || '#ffffff';
        document.getElementById('prop-text').value = element.text || '';
        document.getElementById('prop-font-size').value = element.fontSize || 14;
        document.getElementById('prop-text-color').value = element.textColor || '#333333';
        document.getElementById('prop-text-position').value = element.textPosition || 'center';
        
        document.getElementById('property-dialog').classList.add('show');
    }
    
    hidePropertyDialog() {
        document.getElementById('property-dialog').classList.remove('show');
        this.currentEditingElement = null;
    }
    
    applyPropertyChanges() {
        if (!this.currentEditingElement) return;
        
        const element = this.currentEditingElement;
        
        // 应用尺寸
        const newWidth = parseInt(document.getElementById('prop-width').value);
        const newHeight = parseInt(document.getElementById('prop-height').value);
        if (newWidth > 0) element.width = newWidth;
        if (newHeight > 0) element.height = newHeight;
        
        // 应用样式
        element.strokeWidth = parseInt(document.getElementById('prop-stroke-width').value) || 2;
        element.stroke = document.getElementById('prop-stroke-color').value;
        element.fill = document.getElementById('prop-fill-color').value;
        
        // 应用文本
        element.text = document.getElementById('prop-text').value;
        element.fontSize = parseInt(document.getElementById('prop-font-size').value) || 14;
        element.textColor = document.getElementById('prop-text-color').value;
        element.textPosition = document.getElementById('prop-text-position').value;
        
        this.hidePropertyDialog();
        this.render();
    }
    
    handleResize() {
        this.resizeCanvas();
        this.render();
    }
    
    getCanvasCoordinates(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (clientX - rect.left) / this.canvasScale;
        const y = (clientY - rect.top) / this.canvasScale;
        return { x, y };
    }
    
    setupToolListeners() {
        // 工具按钮点击事件
        const tools = document.querySelectorAll('.tool');
        tools.forEach(tool => {
            tool.addEventListener('click', () => {
                // 移除所有工具的active类
                tools.forEach(t => t.classList.remove('active'));
                // 添加当前工具的active类
                tool.classList.add('active');
                // 设置当前工具
                this.currentTool = tool.dataset.tool;
                
                // 移动端：关闭工具栏弹窗
                if (window.innerWidth <= 768) {
                    const sidebar = document.querySelector('.sidebar');
                    sidebar.classList.remove('show');
                    document.getElementById('btn-tools').classList.remove('active');
                    
                    // 更新选择按钮状态
                    const selectBtn = document.getElementById('btn-select');
                    if (this.currentTool === 'select') {
                        selectBtn.classList.add('active');
                    } else {
                        selectBtn.classList.remove('active');
                    }
                }
            });
        });
        
        // 默认选择选择工具
        document.querySelector('[data-tool="select"]').classList.add('active');
    }
    
    setupDiagramListeners() {
        const elements = {
            'new-diagram': this.createNewDiagram.bind(this),
            'download-diagram': this.downloadDiagram.bind(this),
            'clear-diagram': this.clearDiagram.bind(this),
            'help': this.showHelp.bind(this),
            'close-help': this.hideHelp.bind(this),
            'canvas-size': this.showCanvasSizeDialog.bind(this),
            'close-canvas-size': this.hideCanvasSizeDialog.bind(this),
            'apply-canvas-size': this.applyCanvasSize.bind(this),
            'close-property': this.hidePropertyDialog.bind(this),
            'apply-property': this.applyPropertyChanges.bind(this),
            'btn-delete': this.deleteSelectedElements.bind(this),
            'btn-tools': this.toggleToolsPanel.bind(this),
            'btn-select': this.setSelectTool.bind(this),
            'btn-property': this.showPropertyForSelected.bind(this)
        };
        
        for (const [id, handler] of Object.entries(elements)) {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', handler);
            } else {
                console.warn(`Element with id '${id}' not found`);
            }
        }
    }
    
    toggleToolsPanel() {
        const sidebar = document.querySelector('.sidebar');
        const btn = document.getElementById('btn-tools');
        sidebar.classList.toggle('show');
        btn.classList.toggle('active');
    }
    
    setSelectTool() {
        this.currentTool = 'select';
        const tools = document.querySelectorAll('.tool');
        tools.forEach(t => t.classList.remove('active'));
        document.querySelector('[data-tool="select"]').classList.add('active');
        
        const btn = document.getElementById('btn-select');
        btn.classList.add('active');
    }
    
    showPropertyForSelected() {
        const diagram = this.diagrams[this.currentDiagram];
        if (diagram.selectedElements.length === 1) {
            this.showPropertyDialog(diagram.selectedElements[0]);
        }
    }
    
    updateBottomToolbar() {
        const diagram = this.diagrams[this.currentDiagram];
        const bottomToolbar = document.getElementById('bottom-toolbar');
        const hasSelection = diagram.selectedElements.length > 0;
        
        if (window.innerWidth <= 768) {
            bottomToolbar.style.display = hasSelection ? 'flex' : 'none';
        } else {
            bottomToolbar.style.display = 'none';
        }
    }
    
    showCanvasSizeDialog() {
        document.getElementById('canvas-width').value = this.baseWidth;
        document.getElementById('canvas-height').value = this.baseHeight;
        document.getElementById('canvas-size-dialog').classList.add('show');
    }
    
    hideCanvasSizeDialog() {
        document.getElementById('canvas-size-dialog').classList.remove('show');
    }
    
    applyCanvasSize() {
        const width = parseInt(document.getElementById('canvas-width').value);
        const height = parseInt(document.getElementById('canvas-height').value);
        
        if (width >= 400 && width <= 5000 && height >= 300 && height <= 5000) {
            this.setCanvasSize(width, height);
            this.hideCanvasSizeDialog();
        } else {
            alert('画布宽度必须在400-5000之间，高度必须在300-5000之间');
        }
    }
    
    showHelp() {
        document.getElementById('help-dialog').classList.add('show');
    }
    
    hideHelp() {
        document.getElementById('help-dialog').classList.remove('show');
    }
    
    handleKeyDown(e) {
        if (e.key === 'Control') {
            this.ctrlPressed = true;
        }
        
        if (e.key === 'Delete' || e.key === 'Backspace') {
            this.deleteSelectedElements();
        }
        
        if (e.key === 'g' && this.ctrlPressed) {
            this.groupSelectedElements();
            e.preventDefault();
        }
        
        if (e.key === 'u' && this.ctrlPressed) {
            this.ungroupSelectedElements();
            e.preventDefault();
        }
    }
    
    handleKeyUp(e) {
        if (e.key === 'Control') {
            this.ctrlPressed = false;
        }
    }
    
    handleCopy(e) {
        const selected = this.diagrams[this.currentDiagram].selectedElements;
        if (selected.length > 0) {
            this.clipboard = selected.map(el => JSON.parse(JSON.stringify(el)));
            e.preventDefault();
        }
    }
    
    handlePaste(e) {
        if (this.clipboard.length > 0) {
            const diagram = this.diagrams[this.currentDiagram];
            const offsetX = 20;
            const offsetY = 20;
            
            this.clipboard.forEach(el => {
                const newElement = JSON.parse(JSON.stringify(el));
                if (newElement.x !== undefined) newElement.x += offsetX;
                if (newElement.y !== undefined) newElement.y += offsetY;
                if (newElement.x1 !== undefined) newElement.x1 += offsetX;
                if (newElement.y1 !== undefined) newElement.y1 += offsetY;
                if (newElement.x2 !== undefined) newElement.x2 += offsetX;
                if (newElement.y2 !== undefined) newElement.y2 += offsetY;
                if (newElement.path && newElement.path.length > 0) {
                    newElement.path = newElement.path.map(p => ({
                        x: p.x + offsetX,
                        y: p.y + offsetY
                    }));
                }
                diagram.elements.push(newElement);
            });
            
            diagram.selectedElements = [];
            const startIndex = diagram.elements.length - this.clipboard.length;
            for (let i = 0; i < this.clipboard.length; i++) {
                diagram.selectedElements.push(diagram.elements[startIndex + i]);
            }
            
            this.render();
            e.preventDefault();
        }
    }
    
    handleMouseDown(e) {
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.sidebar');
            sidebar.classList.remove('show');
            document.getElementById('btn-tools').classList.remove('active');
        }
        
        const coords = this.getCanvasCoordinates(e.clientX, e.clientY);
        const x = coords.x;
        const y = coords.y;
        
        this.startX = x;
        this.startY = y;
        
        switch (this.currentTool) {
            case 'select':
                this.handleSelectDown(x, y, e.ctrlKey);
                break;
            case 'rectangle':
            case 'ellipse':
            case 'class':
            case 'use-case':
            case 'actor':
            case 'package':
                this.startDrawingShape(x, y);
                break;
            case 'line':
            case 'arrow':
                this.startDrawingLine(x, y);
                break;
            case 'text':
                this.addText(x, y);
                break;
            case 'delete':
                this.deleteElement(x, y);
                break;
            case 'pen':
                this.startPenDrawing(x, y);
                break;
        }
    }
    
    handleMouseMove(e) {
        const coords = this.getCanvasCoordinates(e.clientX, e.clientY);
        const x = coords.x;
        const y = coords.y;
        
        if (this.isDrawingPen) {
            this.continuePenDrawing(x, y);
            return;
        }
        
        if (!this.isDrawing && !this.isResizing) return;
        
        if (this.isResizing && this.resizeHandle) {
            this.handleResize(x, y);
            this.render();
        } else if (this.tempElement) {
            this.updateTempElement(x, y);
            this.render();
        } else if (this.selectionBox) {
            this.updateSelectionBox(x, y);
            this.render();
        }
    }
    
    handleMouseUp(e) {
        const coords = this.getCanvasCoordinates(e.clientX, e.clientY);
        const x = coords.x;
        const y = coords.y;
        
        if (this.isDrawingPen) {
            this.finishPenDrawing();
            return;
        }
        
        if (!this.isDrawing && !this.isResizing) return;
        
        this.finishDrawing(x, y);
        this.isDrawing = false;
        this.isResizing = false;
        this.tempElement = null;
        this.resizeHandle = null;
        
        if (this.selectionBox) {
            this.finishSelectionBox();
            this.selectionBox = null;
        }
    }
    
    handleSelectDown(x, y, ctrlKey) {
        const diagram = this.diagrams[this.currentDiagram];
        const elements = diagram.elements;
        
        // 检查是否点击了调整大小的控制点
        const selectedElements = diagram.selectedElements;
        if (selectedElements.length === 1) {
            const handle = this.getResizeHandle(x, y, selectedElements[0]);
            if (handle) {
                this.isResizing = true;
                this.resizeHandle = handle;
                this.tempElement = selectedElements[0];
                return;
            }
        }
        
        // 查找点击的元素
        let clickedElement = null;
        for (let i = elements.length - 1; i >= 0; i--) {
            const element = elements[i];
            if (this.isPointInElement(x, y, element)) {
                clickedElement = element;
                break;
            }
        }
        
        if (clickedElement) {
            if (ctrlKey) {
                // Ctrl+点击：切换选择状态
                const index = diagram.selectedElements.indexOf(clickedElement);
                if (index === -1) {
                    diagram.selectedElements.push(clickedElement);
                } else {
                    diagram.selectedElements.splice(index, 1);
                }
            } else {
                // 普通点击：选择当前元素
                diagram.selectedElements = [clickedElement];
            }
            
            this.isDrawing = true;
            this.tempElement = { type: 'select' };
            this.startX = x;
            this.startY = y;
        } else {
            // 点击空白处：开始框选
            if (!ctrlKey) {
                diagram.selectedElements = [];
            }
            this.isDrawing = true;
            this.selectionBox = {
                x: x,
                y: y,
                width: 0,
                height: 0
            };
        }
        
        this.render();
    }
    
    getResizeHandle(x, y, element) {
        if (['line', 'arrow'].includes(element.type)) {
            return null;
        }
        
        const handles = this.getResizeHandles(element);
        const handleSize = 8;
        
        for (const [key, handle] of Object.entries(handles)) {
            if (x >= handle.x - handleSize && x <= handle.x + handleSize &&
                y >= handle.y - handleSize && y <= handle.y + handleSize) {
                return key;
            }
        }
        
        return null;
    }
    
    getResizeHandles(element) {
        const handles = {};
        const handleSize = 6;
        
        if (element.x !== undefined && element.y !== undefined) {
            const x = element.x;
            const y = element.y;
            const width = element.width;
            const height = element.height;
            
            handles.nw = { x: x, y: y };
            handles.n = { x: x + width / 2, y: y };
            handles.ne = { x: x + width, y: y };
            handles.e = { x: x + width, y: y + height / 2 };
            handles.se = { x: x + width, y: y + height };
            handles.s = { x: x + width / 2, y: y + height };
            handles.sw = { x: x, y: y + height };
            handles.w = { x: x, y: y + height / 2 };
        }
        
        return handles;
    }
    
    handleResize(x, y) {
        const element = this.tempElement;
        const handle = this.resizeHandle;
        
        if (!element || !handle) return;
        
        switch (handle) {
            case 'se':
                element.width = x - element.x;
                element.height = y - element.y;
                break;
            case 'e':
                element.width = x - element.x;
                break;
            case 's':
                element.height = y - element.y;
                break;
            case 'nw':
                const newWidthNW = element.x + element.width - x;
                const newHeightNW = element.y + element.height - y;
                if (newWidthNW > 10) {
                    element.x = x;
                    element.width = newWidthNW;
                }
                if (newHeightNW > 10) {
                    element.y = y;
                    element.height = newHeightNW;
                }
                break;
            case 'n':
                const newHeightN = element.y + element.height - y;
                if (newHeightN > 10) {
                    element.y = y;
                    element.height = newHeightN;
                }
                break;
            case 'ne':
                element.width = x - element.x;
                const newHeightNE = element.y + element.height - y;
                if (newHeightNE > 10) {
                    element.y = y;
                    element.height = newHeightNE;
                }
                break;
            case 'w':
                const newWidthW = element.x + element.width - x;
                if (newWidthW > 10) {
                    element.x = x;
                    element.width = newWidthW;
                }
                break;
            case 'sw':
                const newWidthSW = element.x + element.width - x;
                if (newWidthSW > 10) {
                    element.x = x;
                    element.width = newWidthSW;
                }
                element.height = y - element.y;
                break;
        }
    }
    
    updateSelectionBox(x, y) {
        this.selectionBox.width = x - this.selectionBox.x;
        this.selectionBox.height = y - this.selectionBox.y;
    }
    
    finishSelectionBox() {
        const box = this.selectionBox;
        const diagram = this.diagrams[this.currentDiagram];
        
        // 规范化选择框
        const minX = Math.min(box.x, box.x + box.width);
        const maxX = Math.max(box.x, box.x + box.width);
        const minY = Math.min(box.y, box.y + box.height);
        const maxY = Math.max(box.y, box.y + box.height);
        
        // 查找选择框内的所有元素
        diagram.elements.forEach(element => {
            if (this.isElementInBox(element, minX, minY, maxX, maxY)) {
                if (!diagram.selectedElements.includes(element)) {
                    diagram.selectedElements.push(element);
                }
            }
        });
        
        this.render();
    }
    
    isElementInBox(element, minX, minY, maxX, maxY) {
        const bounds = this.getElementBounds(element);
        return bounds.x >= minX && bounds.x + bounds.width <= maxX &&
               bounds.y >= minY && bounds.y + bounds.height <= maxY;
    }
    
    getElementBounds(element) {
        switch (element.type) {
            case 'line':
            case 'arrow':
                return {
                    x: Math.min(element.x1, element.x2),
                    y: Math.min(element.y1, element.y2),
                    width: Math.abs(element.x2 - element.x1),
                    height: Math.abs(element.y2 - element.y1)
                };
            case 'text':
                this.ctx.font = `${element.fontSize}px ${element.fontFamily}`;
                const textWidth = this.ctx.measureText(element.text).width;
                return {
                    x: element.x,
                    y: element.y - element.fontSize,
                    width: textWidth,
                    height: element.fontSize
                };
            case 'pen':
                if (element.path.length === 0) {
                    return { x: 0, y: 0, width: 0, height: 0 };
                }
                let minX = Infinity, minY = Infinity;
                let maxX = -Infinity, maxY = -Infinity;
                element.path.forEach(p => {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                });
                return {
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY
                };
            default:
                return {
                    x: element.x,
                    y: element.y,
                    width: element.width,
                    height: element.height
                };
        }
    }
    
    startDrawingShape(x, y) {
        this.isDrawing = true;
        this.tempElement = {
            type: this.currentTool,
            x: x,
            y: y,
            width: 0,
            height: 0,
            fill: 'white',
            stroke: '#333',
            strokeWidth: 2
        };
    }
    
    startDrawingLine(x, y) {
        this.isDrawing = true;
        this.tempElement = {
            type: this.currentTool,
            x1: x,
            y1: y,
            x2: x,
            y2: y,
            stroke: '#333',
            strokeWidth: 2
        };
    }
    
    addText(x, y) {
        const text = prompt('请输入文本:');
        if (text) {
            const element = {
                type: 'text',
                x: x,
                y: y,
                text: text,
                fill: '#333',
                fontSize: 14,
                fontFamily: 'Arial'
            };
            this.diagrams[this.currentDiagram].elements.push(element);
            this.render();
        }
    }
    
    deleteElement(x, y) {
        const elements = this.diagrams[this.currentDiagram].elements;
        const index = elements.findIndex(element => this.isPointInElement(x, y, element));
        
        if (index !== -1) {
            elements.splice(index, 1);
            this.diagrams[this.currentDiagram].selectedElements = [];
            this.render();
        }
    }
    
    deleteSelectedElements() {
        const diagram = this.diagrams[this.currentDiagram];
        if (diagram.selectedElements.length === 0) return;
        
        diagram.selectedElements.forEach(element => {
            const index = diagram.elements.indexOf(element);
            if (index !== -1) {
                diagram.elements.splice(index, 1);
            }
        });
        
        diagram.selectedElements = [];
        this.render();
    }
    
    groupSelectedElements() {
        const diagram = this.diagrams[this.currentDiagram];
        const selected = diagram.selectedElements;
        
        if (selected.length < 2) return;
        
        // 计算组合的边界
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        selected.forEach(element => {
            const bounds = this.getElementBounds(element);
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });
        
        // 创建组合元素
        const group = {
            type: 'group',
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            elements: selected.map(el => ({...el, originalX: el.x, originalY: el.y})),
            fill: 'rgba(76, 175, 80, 0.1)',
            stroke: '#4CAF50',
            strokeWidth: 2
        };
        
        // 从主元素列表中移除选中的元素
        selected.forEach(element => {
            const index = diagram.elements.indexOf(element);
            if (index !== -1) {
                diagram.elements.splice(index, 1);
            }
        });
        
        diagram.elements.push(group);
        diagram.selectedElements = [group];
        diagram.groups.push(group);
        
        this.render();
    }
    
    ungroupSelectedElements() {
        const diagram = this.diagrams[this.currentDiagram];
        const selected = diagram.selectedElements;
        
        selected.forEach(group => {
            if (group.type === 'group') {
                const index = diagram.elements.indexOf(group);
                if (index !== -1) {
                    diagram.elements.splice(index, 1);
                    
                    // 释放组合中的元素
                    group.elements.forEach(element => {
                        element.x = group.x + (element.originalX - group.x);
                        element.y = group.y + (element.originalY - group.y);
                        diagram.elements.push(element);
                    });
                    
                    // 从组合列表中移除
                    const groupIndex = diagram.groups.indexOf(group);
                    if (groupIndex !== -1) {
                        diagram.groups.splice(groupIndex, 1);
                    }
                }
            }
        });
        
        diagram.selectedElements = [];
        this.render();
    }
    
    updateTempElement(x, y) {
        if (this.tempElement.type === 'select') {
            const dx = x - this.startX;
            const dy = y - this.startY;
            
            const selected = this.diagrams[this.currentDiagram].selectedElements;
            selected.forEach(element => {
                if (element.type === 'group') {
                    element.x += dx;
                    element.y += dy;
                    element.elements.forEach(subElement => {
                        if (subElement.x !== undefined) subElement.x += dx;
                        if (subElement.y !== undefined) subElement.y += dy;
                        if (subElement.x1 !== undefined) subElement.x1 += dx;
                        if (subElement.y1 !== undefined) subElement.y1 += dy;
                        if (subElement.x2 !== undefined) subElement.x2 += dx;
                        if (subElement.y2 !== undefined) subElement.y2 += dy;
                        if (subElement.path && subElement.path.length > 0) {
                            subElement.path.forEach(p => {
                                p.x += dx;
                                p.y += dy;
                            });
                        }
                    });
                } else {
                    if (element.x !== undefined) element.x += dx;
                    if (element.y !== undefined) element.y += dy;
                    if (element.x1 !== undefined) element.x1 += dx;
                    if (element.y1 !== undefined) element.y1 += dy;
                    if (element.x2 !== undefined) element.x2 += dx;
                    if (element.y2 !== undefined) element.y2 += dy;
                    if (element.path && element.path.length > 0) {
                        element.path.forEach(p => {
                            p.x += dx;
                            p.y += dy;
                        });
                    }
                }
            });
            
            this.startX = x;
            this.startY = y;
        } else if (['rectangle', 'ellipse', 'class', 'use-case', 'actor', 'package'].includes(this.tempElement.type)) {
            this.tempElement.width = x - this.tempElement.x;
            this.tempElement.height = y - this.tempElement.y;
        } else if (['line', 'arrow'].includes(this.tempElement.type)) {
            this.tempElement.x2 = x;
            this.tempElement.y2 = y;
        }
    }
    
    finishDrawing(x, y) {
        if (this.tempElement) {
            if (['rectangle', 'ellipse', 'class', 'use-case', 'actor', 'package'].includes(this.tempElement.type)) {
                if (this.tempElement.width < 0) {
                    this.tempElement.x += this.tempElement.width;
                    this.tempElement.width = Math.abs(this.tempElement.width);
                }
                if (this.tempElement.height < 0) {
                    this.tempElement.y += this.tempElement.height;
                    this.tempElement.height = Math.abs(this.tempElement.height);
                }
                
                if (this.tempElement.width > 10 && this.tempElement.height > 10) {
                    this.diagrams[this.currentDiagram].elements.push(this.tempElement);
                }
            } else if (['line', 'arrow'].includes(this.tempElement.type)) {
                const distance = Math.sqrt(
                    Math.pow(this.tempElement.x2 - this.tempElement.x1, 2) +
                    Math.pow(this.tempElement.y2 - this.tempElement.y1, 2)
                );
                if (distance > 10) {
                    this.diagrams[this.currentDiagram].elements.push(this.tempElement);
                }
            }
        }
    }
    
    isPointInElement(x, y, element) {
        switch (element.type) {
            case 'rectangle':
            case 'class':
            case 'package':
            case 'group':
                return x >= element.x && x <= element.x + element.width &&
                       y >= element.y && y <= element.y + element.height;
            case 'ellipse':
            case 'use-case':
                const rx = element.width / 2;
                const ry = element.height / 2;
                const cx = element.x + rx;
                const cy = element.y + ry;
                return Math.pow((x - cx) / rx, 2) + Math.pow((y - cy) / ry, 2) <= 1;
            case 'actor':
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
            case 'text':
                this.ctx.font = `${element.fontSize}px ${element.fontFamily}`;
                const textWidth = this.ctx.measureText(element.text).width;
                return x >= element.x && x <= element.x + textWidth &&
                       y >= element.y - element.fontSize && y <= element.y;
            case 'line':
            case 'arrow':
                const distance = this.getDistanceToLine(
                    x, y, 
                    element.x1, element.y1, 
                    element.x2, element.y2
                );
                return distance <= 5;
            case 'pen':
                if (element.path.length < 2) return false;
                for (let i = 0; i < element.path.length - 1; i++) {
                    const p1 = element.path[i];
                    const p2 = element.path[i + 1];
                    const dist = this.getDistanceToLine(x, y, p1.x, p1.y, p2.x, p2.y);
                    if (dist <= 5) return true;
                }
                return false;
            default:
                return false;
        }
    }
    
    getDistanceToLine(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    createNewDiagram() {
        const diagramId = Object.keys(this.diagrams).length + 1;
        this.diagrams[diagramId] = {
            elements: [],
            selectedElements: [],
            groups: []
        };
        
        const tabContainer = document.querySelector('.diagram-tabs');
        const tab = document.createElement('div');
        tab.className = 'tab active';
        tab.dataset.diagram = diagramId;
        tab.innerHTML = `
            图 ${diagramId}
            <button class="close-tab">×</button>
        `;
        
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tabContainer.appendChild(tab);
        
        tab.addEventListener('click', (e) => {
            if (!e.target.classList.contains('close-tab')) {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentDiagram = diagramId;
                this.render();
            }
        });
        
        tab.querySelector('.close-tab').addEventListener('click', (e) => {
            e.stopPropagation();
            if (Object.keys(this.diagrams).length > 1) {
                delete this.diagrams[diagramId];
                tab.remove();
                
                const firstTab = document.querySelector('.tab');
                if (firstTab) {
                    firstTab.click();
                }
            }
        });
        
        this.currentDiagram = diagramId;
        this.render();
    }
    
    downloadDiagram() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        const elements = this.diagrams[this.currentDiagram].elements;
        elements.forEach(element => {
            if (element.type === 'pen') {
                this.drawPen(tempCtx, element);
            } else {
                this.drawElement(tempCtx, element);
            }
        });
        
        tempCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `uml-diagram-${this.currentDiagram}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
    
    clearDiagram() {
        if (confirm('确定要清空当前图表吗？')) {
            this.diagrams[this.currentDiagram].elements = [];
            this.diagrams[this.currentDiagram].selectedElements = [];
            this.diagrams[this.currentDiagram].groups = [];
            this.render();
        }
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawGrid();
        
        const diagram = this.diagrams[this.currentDiagram];
        const elements = diagram.elements;
        
        elements.forEach(element => {
            this.drawElement(this.ctx, element);
        });
        
        if (this.tempElement) {
            this.drawElement(this.ctx, this.tempElement);
        }
        
        if (this.isDrawingPen && this.currentPenPath.length > 0) {
            this.ctx.save();
            this.ctx.strokeStyle = this.penColor;
            this.ctx.lineWidth = this.penWidth;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.setLineDash([]);
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.currentPenPath[0].x, this.currentPenPath[0].y);
            for (let i = 1; i < this.currentPenPath.length; i++) {
                this.ctx.lineTo(this.currentPenPath[i].x, this.currentPenPath[i].y);
            }
            this.ctx.stroke();
            
            this.ctx.restore();
        }
        
        if (this.selectionBox) {
            this.drawSelectionBox(this.ctx, this.selectionBox);
        }
        
        diagram.selectedElements.forEach(element => {
            this.drawSelection(this.ctx, element);
        });
        
        this.updateBottomToolbar();
    }
    
    drawGrid() {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.lineWidth = 1;
        
        const gridSize = 20;
        
        for (let x = 0; x <= this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }
    
    drawElementText(ctx, element) {
        if (!element.text) return;
        
        ctx.fillStyle = element.textColor || '#333333';
        ctx.font = `${element.fontSize || 14}px ${element.fontFamily || 'Arial'}`;
        
        const textPosition = element.textPosition || 'center';
        const padding = 5;
        
        let startX, startY, textAlign, textBaseline;
        
        switch (textPosition) {
            case 'top':
                startX = element.x + element.width / 2;
                startY = element.y + padding + (element.fontSize || 14);
                textAlign = 'center';
                textBaseline = 'top';
                break;
            case 'bottom':
                startX = element.x + element.width / 2;
                startY = element.y + element.height - padding;
                textAlign = 'center';
                textBaseline = 'bottom';
                break;
            case 'left':
                startX = element.x + padding;
                startY = element.y + element.height / 2;
                textAlign = 'left';
                textBaseline = 'middle';
                break;
            case 'right':
                startX = element.x + element.width - padding;
                startY = element.y + element.height / 2;
                textAlign = 'right';
                textBaseline = 'middle';
                break;
            case 'center':
            default:
                startX = element.x + element.width / 2;
                startY = element.y + element.height / 2;
                textAlign = 'center';
                textBaseline = 'middle';
                break;
        }
        
        ctx.textAlign = textAlign;
        ctx.textBaseline = textBaseline;
        
        // 处理多行文本
        const lines = element.text.split('\n');
        const lineHeight = (element.fontSize || 14) * 1.2;
        
        let drawY;
        if (textPosition === 'top') {
            drawY = startY;
        } else if (textPosition === 'bottom') {
            drawY = startY - (lines.length - 1) * lineHeight;
        } else {
            const totalHeight = lines.length * lineHeight;
            drawY = startY - totalHeight / 2 + lineHeight / 2;
        }
        
        lines.forEach((line, index) => {
            ctx.fillText(line, startX, drawY + index * lineHeight);
        });
    }
    
    drawElement(ctx, element) {
        ctx.save();
        
        switch (element.type) {
            case 'rectangle':
                ctx.fillStyle = element.fill;
                ctx.strokeStyle = element.stroke;
                ctx.lineWidth = element.strokeWidth;
                ctx.fillRect(element.x, element.y, element.width, element.height);
                ctx.strokeRect(element.x, element.y, element.width, element.height);
                // 绘制文本
                if (element.text) {
                    this.drawElementText(ctx, element);
                }
                break;
                
            case 'ellipse':
                ctx.fillStyle = element.fill;
                ctx.strokeStyle = element.stroke;
                ctx.lineWidth = element.strokeWidth;
                ctx.beginPath();
                const rx = Math.abs(element.width / 2);
                const ry = Math.abs(element.height / 2);
                ctx.ellipse(
                    element.x + element.width / 2,
                    element.y + element.height / 2,
                    rx,
                    ry,
                    0,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
                ctx.stroke();
                // 绘制文本
                if (element.text) {
                    this.drawElementText(ctx, element);
                }
                break;
                
            case 'class':
                ctx.fillStyle = element.fill;
                ctx.strokeStyle = element.stroke;
                ctx.lineWidth = element.strokeWidth;
                
                ctx.fillRect(element.x, element.y, element.width, element.height);
                ctx.strokeRect(element.x, element.y, element.width, element.height);
                
                const sectionHeight = element.height / 3;
                ctx.beginPath();
                ctx.moveTo(element.x, element.y + sectionHeight);
                ctx.lineTo(element.x + element.width, element.y + sectionHeight);
                ctx.moveTo(element.x, element.y + sectionHeight * 2);
                ctx.lineTo(element.x + element.width, element.y + sectionHeight * 2);
                ctx.stroke();
                break;
                
            case 'use-case':
                ctx.fillStyle = element.fill;
                ctx.strokeStyle = element.stroke;
                ctx.lineWidth = element.strokeWidth;
                ctx.beginPath();
                const useCaseRx = Math.abs(element.width / 2);
                const useCaseRy = Math.abs(element.height / 2);
                ctx.ellipse(
                    element.x + element.width / 2,
                    element.y + element.height / 2,
                    useCaseRx,
                    useCaseRy,
                    0,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
                ctx.stroke();
                break;
                
            case 'actor':
                ctx.fillStyle = element.fill;
                ctx.strokeStyle = element.stroke;
                ctx.lineWidth = element.strokeWidth;
                
                const headRadius = Math.min(element.width, element.height) / 4;
                const headCenterX = element.x + element.width / 2;
                const headCenterY = element.y + headRadius;
                ctx.beginPath();
                ctx.arc(headCenterX, headCenterY, headRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                const bodyTop = element.y + headRadius * 2;
                const bodyBottom = element.y + element.height;
                const bodyLeft = element.x + element.width * 0.3;
                const bodyRight = element.x + element.width * 0.7;
                ctx.fillRect(bodyLeft, bodyTop, bodyRight - bodyLeft, bodyBottom - bodyTop);
                ctx.strokeRect(bodyLeft, bodyTop, bodyRight - bodyLeft, bodyBottom - bodyTop);
                break;
                
            case 'package':
                ctx.fillStyle = element.fill;
                ctx.strokeStyle = element.stroke;
                ctx.lineWidth = element.strokeWidth;
                
                ctx.fillRect(element.x, element.y, element.width, element.height);
                ctx.strokeRect(element.x, element.y, element.width, element.height);
                
                const tabHeight = 20;
                ctx.fillRect(element.x, element.y - tabHeight, element.width / 3, tabHeight);
                ctx.strokeRect(element.x, element.y - tabHeight, element.width / 3, tabHeight);
                break;
                
            case 'line':
                ctx.strokeStyle = element.stroke;
                ctx.lineWidth = element.strokeWidth;
                ctx.beginPath();
                ctx.moveTo(element.x1, element.y1);
                ctx.lineTo(element.x2, element.y2);
                ctx.stroke();
                break;
                
            case 'arrow':
                ctx.strokeStyle = element.stroke;
                ctx.lineWidth = element.strokeWidth;
                ctx.beginPath();
                ctx.moveTo(element.x1, element.y1);
                ctx.lineTo(element.x2, element.y2);
                ctx.stroke();
                
                const angle = Math.atan2(element.y2 - element.y1, element.x2 - element.x1);
                const arrowLength = 10;
                ctx.beginPath();
                ctx.moveTo(element.x2, element.y2);
                ctx.lineTo(
                    element.x2 - arrowLength * Math.cos(angle - Math.PI / 6),
                    element.y2 - arrowLength * Math.sin(angle - Math.PI / 6)
                );
                ctx.moveTo(element.x2, element.y2);
                ctx.lineTo(
                    element.x2 - arrowLength * Math.cos(angle + Math.PI / 6),
                    element.y2 - arrowLength * Math.sin(angle + Math.PI / 6)
                );
                ctx.stroke();
                break;
                
            case 'text':
                ctx.fillStyle = element.fill;
                ctx.font = `${element.fontSize}px ${element.fontFamily}`;
                ctx.fillText(element.text, element.x, element.y);
                break;
                
            case 'group':
                ctx.fillStyle = element.fill;
                ctx.strokeStyle = element.stroke;
                ctx.lineWidth = element.strokeWidth;
                ctx.setLineDash([5, 5]);
                ctx.fillRect(element.x, element.y, element.width, element.height);
                ctx.strokeRect(element.x, element.y, element.width, element.height);
                ctx.setLineDash([]);
                
                element.elements.forEach(subElement => {
                    this.drawElement(ctx, subElement);
                });
                break;
                
            case 'pen':
                this.drawPen(ctx, element);
                break;
        }
        
        ctx.restore();
    }
    
    drawSelection(ctx, element) {
        ctx.save();
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        const bounds = this.getElementBounds(element);
        ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.width + 4, bounds.height + 4);
        
        // 绘制调整大小的控制点
        if (element.type !== 'line' && element.type !== 'arrow' && element.type !== 'group') {
            const handles = this.getResizeHandles(element);
            ctx.fillStyle = '#4CAF50';
            ctx.setLineDash([]);
            
            Object.values(handles).forEach(handle => {
                ctx.beginPath();
                ctx.arc(handle.x, handle.y, 4, 0, Math.PI * 2);
                ctx.fill();
            });
        }
        
        ctx.restore();
    }
    
    drawSelectionBox(ctx, box) {
        ctx.save();
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.fillStyle = 'rgba(76, 175, 80, 0.1)';
        
        ctx.fillRect(box.x, box.y, box.width, box.height);
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        
        ctx.restore();
    }
    
    startPenDrawing(x, y) {
        this.isDrawingPen = true;
        this.currentPenPath = [{ x, y }];
        this.render();
    }
    
    continuePenDrawing(x, y) {
        this.currentPenPath.push({ x, y });
        this.render();
    }
    
    finishPenDrawing() {
        if (this.currentPenPath.length > 1) {
            const diagram = this.diagrams[this.currentDiagram];
            const penElement = {
                type: 'pen',
                path: [...this.currentPenPath],
                stroke: this.penColor,
                strokeWidth: this.penWidth
            };
            diagram.elements.push(penElement);
        }
        this.isDrawingPen = false;
        this.currentPenPath = [];
        this.render();
    }
    
    drawPen(ctx, element) {
        if (element.path.length < 2) return;
        
        ctx.save();
        ctx.strokeStyle = element.stroke || '#333333';
        ctx.lineWidth = element.strokeWidth || 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        
        ctx.beginPath();
        ctx.moveTo(element.path[0].x, element.path[0].y);
        for (let i = 1; i < element.path.length; i++) {
            ctx.lineTo(element.path[i].x, element.path[i].y);
        }
        ctx.stroke();
        
        ctx.restore();
    }
    
    handleTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const now = Date.now();
            const DOUBLE_TAP_DELAY = 300;
            
            if (now - this.lastTap < DOUBLE_TAP_DELAY) {
                // 双击
                const mouseEvent = {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                };
                this.handleDoubleClick(mouseEvent);
                this.lastTap = 0;
            } else {
                // 单击
                const mouseEvent = {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    ctrlKey: false,
                    preventDefault: () => {}
                };
                this.handleMouseDown(mouseEvent);
                this.lastTap = now;
            }
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const mouseEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY
            };
            
            this.handleMouseMove(mouseEvent);
        }
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        const mouseEvent = {
            preventDefault: () => {}
        };
        
        this.handleMouseUp(mouseEvent);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new UMLDrawer();
});
