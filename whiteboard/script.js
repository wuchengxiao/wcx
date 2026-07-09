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
        this.isDraggingCanvas = false;
        this.canvasDragStartX = 0;
        this.canvasDragStartY = 0;
        this.resizeSnapshot = null;
        this.viewZoom = 1;
        this.minViewZoom = 0.25;
        this.maxViewZoom = 4;
        this.customShapes = [];
        this.currentCustomShapeId = null;
        this.customShapesStorageKey = 'uml_drawer_custom_shapes_v1';
        this.customShapeCounterStorageKey = 'uml_drawer_custom_shapes_counter_v1';
        this.customShapeNameCounter = 1;
        this.elementIdCounter = 1;
        this.snapThreshold = 18;
        this.newElementSelectDelayMs = 2000;
        this.recentlyCreatedElements = new Map();
        
        this.init();
    }
    
    init() {
        this.resizeCanvas();
        this.loadCustomShapes();
        this.setupEventListeners();
        this.setupToolListeners();
        this.setupDiagramListeners();
        this.renderCustomShapeList();
        this.currentTool = 'select';
        // Load autosave if present and start periodic autosave
        this.loadAutoBackup();
        this.autosaveInterval = setInterval(this.saveAutoBackup.bind(this), 5000);
        window.addEventListener('beforeunload', this.saveAutoBackup.bind(this));
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
        
        // 计算缩放比例，使画布适应容器，无最大限制
        const scaleX = containerWidth / this.baseWidth;
        const scaleY = containerHeight / this.baseHeight;
        this.canvasScale = Math.min(scaleX, scaleY);
        
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
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        this.canvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });
        
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    handleDoubleClick(e) {
        const coords = this.getCanvasCoordinates(e.clientX, e.clientY);
        const x = coords.x;
        const y = coords.y;
        
        const diagram = this.diagrams[this.currentDiagram];
        this.ensureDiagramElementLayers(diagram);
        const elements = this.getElementsSortedByLayer(diagram);
        
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
        this.ensureDiagramElementLayers(this.diagrams[this.currentDiagram]);
        
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
        document.getElementById('prop-layer').value = this.getElementLayer(element);
        
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

        // 应用共通属性：层级
        const newLayer = parseInt(document.getElementById('prop-layer').value, 10);
        if (Number.isFinite(newLayer) && newLayer >= 1) {
            this.setElementLayer(element, newLayer);
        }

        if (element.id) {
            this.syncAttachedArrowsForElementIds(new Set([element.id]));
        }
        
        this.hidePropertyDialog();
        this.render();
    }
    
    handleResize() {
        this.resizeCanvas();
        this.render();
    }
    
    getCanvasCoordinates(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (clientX - rect.left) / (this.canvasScale * this.viewZoom) - this.canvasOffsetX;
        const y = (clientY - rect.top) / (this.canvasScale * this.viewZoom) - this.canvasOffsetY;
        return { x, y };
    }

    markElementAsRecentlyCreated(element) {
        if (!element || !element.id) return;
        this.recentlyCreatedElements.set(element.id, Date.now());
    }

    pruneRecentlyCreatedElements() {
        const now = Date.now();
        this.recentlyCreatedElements.forEach((createdAt, id) => {
            if (now - createdAt > this.newElementSelectDelayMs) {
                this.recentlyCreatedElements.delete(id);
            }
        });
    }

    removeRecentCreatedMarker(element) {
        if (!element || !element.id) return;
        this.recentlyCreatedElements.delete(element.id);
    }

    findRecentlyCreatedElementAt(x, y) {
        this.pruneRecentlyCreatedElements();
        if (this.recentlyCreatedElements.size === 0) return null;

        const diagram = this.diagrams[this.currentDiagram];
        this.ensureDiagramElementLayers(diagram);
        const ordered = this.getElementsSortedByLayer(diagram);

        for (let i = ordered.length - 1; i >= 0; i--) {
            const element = ordered[i];
            if (!this.recentlyCreatedElements.has(element.id)) continue;
            if (this.isPointInElement(x, y, element)) {
                return element;
            }
        }

        return null;
    }
    
    setupToolListeners() {
        // 工具按钮点击事件
        const tools = document.querySelectorAll('.tool');
        tools.forEach(tool => {
            tool.addEventListener('click', () => {
                this.setCurrentTool(tool.dataset.tool);

                // 移动端：关闭工具栏弹窗
                if (window.innerWidth <= 768) {
                    const sidebar = document.querySelector('.sidebar');
                    sidebar.classList.remove('show');
                    document.getElementById('btn-tools').classList.remove('active');
                }
            });
        });
        
        // 默认选择选择工具
        this.setCurrentTool('select');
    }
    
    setupDiagramListeners() {
        const elements = {
            'new-diagram': this.createNewDiagram.bind(this),
            'download-diagram': this.downloadDiagram.bind(this),
            'clear-diagram': this.clearDiagram.bind(this),
            'help': this.showHelp.bind(this),
            'close-help': this.hideHelp.bind(this),
            'close-property': this.hidePropertyDialog.bind(this),
            'apply-property': this.applyPropertyChanges.bind(this),
            'prop-layer-up': this.moveEditingElementLayerUp.bind(this),
            'prop-layer-down': this.moveEditingElementLayerDown.bind(this),
            'prop-layer-top': this.moveEditingElementLayerToTop.bind(this),
            'prop-layer-bottom': this.moveEditingElementLayerToBottom.bind(this),
            'btn-delete': this.deleteSelectedElements.bind(this),
            'btn-tools': this.toggleToolsPanel.bind(this),
            'btn-property': this.showPropertyForSelected.bind(this),
            'btn-copy': this.copySelectedElements.bind(this),
            'quick-paste': this.pasteClipboardElements.bind(this),
            'download-shapes': this.downloadCustomShapes.bind(this),
            'import-shapes': this.openImportCustomShapesDialog.bind(this),
            'create-custom-shape': this.createCustomShapeFromSelection.bind(this),
            'ungroup-shape': this.ungroupSelectedForEdit.bind(this),
            'quick-select': this.quickSelectTool.bind(this),
            'quick-pan': this.quickPanTool.bind(this),
            'quick-delete': this.quickDeleteTool.bind(this),
            'zoom-in': this.zoomIn.bind(this),
            'zoom-out': this.zoomOut.bind(this),
            'zoom-reset': this.resetZoom.bind(this)
        };
        
        for (const [id, handler] of Object.entries(elements)) {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', handler);
            } else {
                console.warn(`Element with id '${id}' not found`);
            }
        }

        const customShapesList = document.getElementById('custom-shapes-list');
        if (customShapesList) {
            customShapesList.addEventListener('click', this.handleCustomShapeListClick.bind(this));
        }
    }
    
    toggleToolsPanel() {
        const sidebar = document.querySelector('.sidebar');
        const btn = document.getElementById('btn-tools');
        sidebar.classList.toggle('show');
        btn.classList.toggle('active');
    }
    
    setSelectTool() {
        this.setCurrentTool('select');
        
        const btn = document.getElementById('btn-select');
        if (btn) {
            btn.classList.add('active');
        }
    }

    quickSelectTool() {
        this.setCurrentTool('select');
    }

    quickPanTool() {
        this.setCurrentTool('pan');
    }

    quickDeleteTool() {
        this.setCurrentTool('delete');
    }

    setCurrentTool(toolName) {
        this.currentTool = toolName;
        if (toolName !== 'custom-shape') {
            this.currentCustomShapeId = null;
        }

        const tools = document.querySelectorAll('.tool');
        tools.forEach(t => t.classList.remove('active'));
        const targetTool = document.querySelector(`[data-tool="${toolName}"]`);
        if (targetTool) {
            targetTool.classList.add('active');
        }

        this.renderCustomShapeList();

        const canvas = document.getElementById('canvas');
        if (this.currentTool === 'pan') {
            canvas.classList.add('pan-mode');
        } else {
            canvas.classList.remove('pan-mode');
        }

        const selectBtn = document.getElementById('btn-select');
        if (selectBtn) {
            if (this.currentTool === 'select') {
                selectBtn.classList.add('active');
            } else {
                selectBtn.classList.remove('active');
            }
        }

        this.syncQuickToolButtons();
    }

    syncQuickToolButtons() {
        const quickButtons = {
            select: document.getElementById('quick-select'),
            pan: document.getElementById('quick-pan'),
            delete: document.getElementById('quick-delete')
        };

        Object.values(quickButtons).forEach(btn => {
            if (btn) btn.classList.remove('active');
        });

        if (quickButtons[this.currentTool]) {
            quickButtons[this.currentTool].classList.add('active');
        }
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

        bottomToolbar.style.display = hasSelection ? 'flex' : 'none';
    }

    handleWheel(e) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 0.88;
        this.zoomAtClientPoint(e.clientX, e.clientY, factor);
    }

    zoomAtClientPoint(clientX, clientY, factor) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;

        const oldZoom = this.viewZoom;
        const newZoom = Math.max(this.minViewZoom, Math.min(this.maxViewZoom, oldZoom * factor));
        if (Math.abs(newZoom - oldZoom) < 0.0001) return;

        const worldX = screenX / (this.canvasScale * oldZoom) - this.canvasOffsetX;
        const worldY = screenY / (this.canvasScale * oldZoom) - this.canvasOffsetY;

        this.viewZoom = newZoom;
        this.canvasOffsetX = screenX / (this.canvasScale * newZoom) - worldX;
        this.canvasOffsetY = screenY / (this.canvasScale * newZoom) - worldY;

        this.updateZoomRateDisplay();
        this.render();
    }

    zoomIn() {
        const rect = this.canvas.getBoundingClientRect();
        this.zoomAtClientPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.2);
    }

    zoomOut() {
        const rect = this.canvas.getBoundingClientRect();
        this.zoomAtClientPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.8);
    }

    resetZoom() {
        this.viewZoom = 1;
        this.canvasOffsetX = 0;
        this.canvasOffsetY = 0;
        this.updateZoomRateDisplay();
        this.render();
    }

    updateZoomRateDisplay() {
        const zoomBtn = document.getElementById('zoom-reset');
        if (!zoomBtn) return;
        zoomBtn.textContent = `${Math.round(this.viewZoom * 100)}%`;
    }

    loadCustomShapes() {
        try {
            const raw = localStorage.getItem(this.customShapesStorageKey);
            if (!raw) {
                this.customShapes = [];
            } else {
                const parsed = JSON.parse(raw);
                this.customShapes = Array.isArray(parsed) ? parsed : [];
            }

            const counterRaw = localStorage.getItem(this.customShapeCounterStorageKey);
            const parsedCounter = parseInt(counterRaw, 10);

            if (!Number.isNaN(parsedCounter) && parsedCounter >= 1) {
                this.customShapeNameCounter = parsedCounter;
            } else {
                this.customShapeNameCounter = this.customShapes.length + 1;
            }
        } catch (error) {
            console.warn('加载自定义图形失败:', error);
            this.customShapes = [];
            this.customShapeNameCounter = 1;
        }
    }

    saveCustomShapes() {
        try {
            localStorage.setItem(this.customShapesStorageKey, JSON.stringify(this.customShapes));
            localStorage.setItem(this.customShapeCounterStorageKey, String(this.customShapeNameCounter));
        } catch (error) {
            console.warn('保存自定义图形失败:', error);
        }
    }

    getNextCustomShapeName() {
        const name = `自定义组件_${this.customShapeNameCounter}`;
        this.customShapeNameCounter += 1;
        return name;
    }

    renderCustomShapeList() {
        const list = document.getElementById('custom-shapes-list');
        if (!list) return;

        if (this.customShapes.length === 0) {
            list.innerHTML = '<div class="custom-shape-name" style="color:#999;padding:4px 2px;">暂无自定义图形</div>';
            return;
        }

        list.innerHTML = this.customShapes.map(shape => {
            const activeClass = this.currentTool === 'custom-shape' && this.currentCustomShapeId === shape.id ? 'active' : '';
            return `
                <button class="custom-shape-item ${activeClass}" data-shape-id="${shape.id}" title="点击放置该图形">
                    <span class="custom-shape-name">${shape.name || '自定义图形'} (${Math.round(shape.width)}×${Math.round(shape.height)})</span>
                    <span class="custom-shape-actions">
                        <span class="custom-shape-rename" data-action="rename-shape" data-shape-id="${shape.id}" title="重命名">✎</span>
                        <span class="custom-shape-delete" data-action="delete-shape" data-shape-id="${shape.id}" title="删除">×</span>
                    </span>
                </button>
            `;
        }).join('');
    }

    downloadCustomShapes() {
        try {
            // Require a selection: user must choose a custom shape from the list
            if (!this.currentCustomShapeId) {
                alert('请先在自定义图形列表中选择要下载的图形。');
                return;
            }

            const shape = this.customShapes.find(s => s.id === this.currentCustomShapeId);
            if (!shape) {
                alert('未找到所选自定义图形。');
                return;
            }

            const data = JSON.stringify(shape, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(shape.name || 'custom_shape').replace(/[^a-z0-9_-]/gi, '_')}_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.warn('导出自定义图形失败', err);
            alert('导出自定义图形失败，请检查控制台。');
        }
    }

    openImportCustomShapesDialog() {
        const input = document.getElementById('import-shapes-input');
        if (!input) return;
        input.value = '';
        input.onchange = this.handleImportCustomShapesFile.bind(this);
        input.click();
    }

    handleImportCustomShapesFile(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const text = evt.target.result;
                const parsed = JSON.parse(text);
                let incoming = [];
                if (Array.isArray(parsed)) incoming = parsed;
                else if (parsed && typeof parsed === 'object') incoming = [parsed];

                // Validate basic shape structure
                const normalized = incoming.map(item => {
                    const clone = Object.assign({}, item);
                    // ensure id unique
                    clone.id = `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                    clone.name = clone.name || this.getNextCustomShapeName();
                    clone.width = clone.width || 100;
                    clone.height = clone.height || 80;
                    clone.elements = Array.isArray(clone.elements) ? clone.elements : [];
                    return clone;
                });

                // Merge into existing customShapes
                this.customShapes = this.customShapes.concat(normalized);
                this.saveCustomShapes();
                this.renderCustomShapeList();
                alert(`成功导入 ${normalized.length} 个自定义图形。`);
            } catch (err) {
                console.warn('导入自定义图形失败', err);
                alert('导入失败：文件格式错误。');
            }
        };
        reader.readAsText(file);
    }

    handleCustomShapeListClick(e) {
        const deleteBtn = e.target.closest('[data-action="delete-shape"]');
        if (deleteBtn) {
            const shapeId = deleteBtn.dataset.shapeId;
            this.deleteCustomShape(shapeId);
            return;
        }

        const renameBtn = e.target.closest('[data-action="rename-shape"]');
        if (renameBtn) {
            const shapeId = renameBtn.dataset.shapeId;
            this.renameCustomShape(shapeId);
            return;
        }

        const item = e.target.closest('.custom-shape-item');
        if (!item) return;

        this.setCurrentTool('custom-shape');
        this.currentCustomShapeId = item.dataset.shapeId;

        this.renderCustomShapeList();
    }

    saveAutoBackup() {
        try {
            const diagram = this.diagrams[this.currentDiagram] || { elements: [], groups: [] };
            const payload = {
                timestamp: Date.now(),
                diagramId: this.currentDiagram,
                diagram: {
                    elements: diagram.elements || [],
                    groups: diagram.groups || [],
                    // do not persist selection
                },
                viewZoom: this.viewZoom,
                canvasOffsetX: this.canvasOffsetX,
                canvasOffsetY: this.canvasOffsetY
            };
            localStorage.setItem('uml_drawer_autosave_v1', JSON.stringify(payload));
        } catch (err) {
            console.warn('自动保存失败', err);
        }
    }

    loadAutoBackup() {
        try {
            const raw = localStorage.getItem('uml_drawer_autosave_v1');
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.diagram) return;

            const current = this.diagrams[this.currentDiagram] || { elements: [] };
            const hasCurrentData = Array.isArray(current.elements) && current.elements.length > 0;

            // Ask the user whether to restore only if current canvas is empty or they agree to overwrite
            const message = hasCurrentData ? '检测到浏览器中的未保存编辑记录，是否覆盖当前画布并恢复上次编辑？' : '检测到未保存的编辑记录，是否恢复上次编辑？';
            if (confirm(message)) {
                this.diagrams[parsed.diagramId] = this.diagrams[parsed.diagramId] || { elements: [], selectedElements: [], groups: [] };
                this.diagrams[parsed.diagramId].elements = parsed.diagram.elements || [];
                this.diagrams[parsed.diagramId].groups = parsed.diagram.groups || [];
                this.viewZoom = parsed.viewZoom || 1;
                this.canvasOffsetX = parsed.canvasOffsetX || 0;
                this.canvasOffsetY = parsed.canvasOffsetY || 0;
                this.render();
                alert('已从缓存恢复编辑内容。');
            }
        } catch (err) {
            console.warn('恢复自动保存失败', err);
        }
    }

    deleteCustomShape(shapeId) {
        this.customShapes = this.customShapes.filter(shape => shape.id !== shapeId);
        if (this.currentCustomShapeId === shapeId) {
            this.currentCustomShapeId = null;
            this.setCurrentTool('select');
            const selectTool = document.querySelector('[data-tool="select"]');
            if (selectTool) {
                document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
                selectTool.classList.add('active');
            }
        }
        this.saveCustomShapes();
        this.renderCustomShapeList();
    }

    renameCustomShape(shapeId) {
        const target = this.customShapes.find(shape => shape.id === shapeId);
        if (!target) return;

        const nextName = prompt('请输入新的组件名称：', target.name || '');
        if (nextName === null) return;

        const finalName = nextName.trim();
        if (!finalName) {
            alert('名称不能为空。');
            return;
        }

        target.name = finalName;
        this.saveCustomShapes();
        this.renderCustomShapeList();
    }

    createCustomShapeFromSelection() {
        const diagram = this.diagrams[this.currentDiagram];
        const selected = diagram.selectedElements;

        if (selected.length < 2) {
            alert('请先使用选择工具选中至少2个元素，再进行组合。');
            return;
        }

        const groupedElement = this.groupSelectedElements();
        if (!groupedElement) return;

        const shape = this.createCustomShapeFromGroup(groupedElement);
        this.customShapes.push(shape);
        this.saveCustomShapes();
        this.currentCustomShapeId = shape.id;
        this.setCurrentTool('custom-shape');
        this.renderCustomShapeList();
    }

    ungroupSelectedForEdit() {
        const diagram = this.diagrams[this.currentDiagram];
        const hasGroupSelected = diagram.selectedElements.some(el => el.type === 'group');
        if (!hasGroupSelected) {
            alert('请先选中一个组合图形，再执行拆分。');
            return;
        }
        this.ungroupSelectedElements();
    }

    createCustomShapeFromGroup(group) {
        const normalizedElements = group.elements.map(element => {
            const clone = this.cloneElement(element);
            this.translateElement(clone, -group.x, -group.y);
            return clone;
        });

        return {
            id: `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: this.getNextCustomShapeName(),
            width: group.width,
            height: group.height,
            elements: normalizedElements
        };
    }

    placeCustomShape(x, y) {
        const shape = this.customShapes.find(item => item.id === this.currentCustomShapeId);
        if (!shape) return;

        const startX = x - shape.width / 2;
        const startY = y - shape.height / 2;
        const elements = shape.elements.map(element => {
            const clone = this.cloneElement(element);
            this.translateElement(clone, startX, startY);
            return clone;
        });

        const group = {
            type: 'group',
            x: startX,
            y: startY,
            width: shape.width,
            height: shape.height,
            elements,
            fill: 'rgba(76, 175, 80, 0.1)',
            stroke: '#4CAF50',
            strokeWidth: 2,
            name: shape.name
        };

        const diagram = this.diagrams[this.currentDiagram];
        this.addElementToDiagram(diagram, group);
        diagram.selectedElements = [group];
        this.render();
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

        // 禁用复制/粘贴键盘快捷键（除非在输入框内）
        if (this.ctrlPressed && (e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V')) {
            const tagName = (e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '');
            const isEditable = tagName === 'input' || tagName === 'textarea' || (e.target && e.target.isContentEditable);
            if (!isEditable) {
                e.preventDefault();
                return;
            }
        }

        // 为安全起见：不允许通过键盘删除图形，只能使用删除工具
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const tagName = (e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '');
            const isEditable =
                tagName === 'input' ||
                tagName === 'textarea' ||
                (e.target && e.target.isContentEditable);

            // 非输入状态下阻止默认行为（避免浏览器后退等）
            if (!isEditable) {
                e.preventDefault();
            }
            return;
        }
        
        if (e.key === 'g' && this.ctrlPressed) {
            this.createCustomShapeFromSelection();
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
                this.addElementToDiagram(diagram, newElement);
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
    

    copySelectedElements() {
        const selected = this.diagrams[this.currentDiagram].selectedElements;
        if (selected.length > 0) {
            this.clipboard = selected.map(el => JSON.parse(JSON.stringify(el)));
        }
    }

    pasteClipboardElements() {
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
                    newElement.path = newElement.path.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }));
                }
                this.addElementToDiagram(diagram, newElement);
            });

            diagram.selectedElements = [];
            const startIndex = diagram.elements.length - this.clipboard.length;
            for (let i = 0; i < this.clipboard.length; i++) {
                diagram.selectedElements.push(diagram.elements[startIndex + i]);
            }

            this.render();
        }
    }
    handleMouseDown(e) {
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.sidebar');
            sidebar.classList.remove('show');
            document.getElementById('btn-tools').classList.remove('active');
        }
        
        // 如果是拖拽工具，直接开始拖拽
        if (this.currentTool === 'pan') {
            this.isDraggingCanvas = true;
            this.canvasDragStartX = e.clientX;
            this.canvasDragStartY = e.clientY;
            e.preventDefault();
            return;
        }
        
        // 中键或空格键+左键拖动画布
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            this.isDraggingCanvas = true;
            this.canvasDragStartX = e.clientX;
            this.canvasDragStartY = e.clientY;
            e.preventDefault();
            return;
        }
        
        const coords = this.getCanvasCoordinates(e.clientX, e.clientY);
        const x = coords.x;
        const y = coords.y;

        const recentElement = this.findRecentlyCreatedElementAt(x, y);
        const shouldAutoSelectRecentElement =
            recentElement &&
            this.currentTool !== 'select' &&
            this.currentTool !== 'pan' &&
            this.currentTool !== 'delete';

        if (shouldAutoSelectRecentElement) {
            this.setCurrentTool('select');
            this.handleSelectDown(x, y, e.ctrlKey);
            return;
        }
        
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
            case 'sticky':
                this.startDrawingShape(x, y);
                break;
            case 'line':
            case 'arrow':
                this.startDrawingLine(x, y);
                break;
            case 'text':
                this.addText(x, y);
                break;
            case 'custom-shape':
                this.placeCustomShape(x, y);
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
        if (this.isDraggingCanvas) {
            const dx = (e.clientX - this.canvasDragStartX) / (this.canvasScale * this.viewZoom);
            const dy = (e.clientY - this.canvasDragStartY) / (this.canvasScale * this.viewZoom);
            this.canvasOffsetX += dx;
            this.canvasOffsetY += dy;
            this.canvasDragStartX = e.clientX;
            this.canvasDragStartY = e.clientY;
            this.render();
            return;
        }
        
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
        if (this.isDraggingCanvas) {
            this.isDraggingCanvas = false;
            return;
        }
        
        const coords = this.getCanvasCoordinates(e.clientX, e.clientY);
        const x = coords.x;
        const y = coords.y;
        
        if (this.isDrawingPen) {
            this.finishPenDrawing();
            return;
        }
        
        if (!this.isDrawing && !this.isResizing) return;

        if (this.isDrawing) {
            this.finishDrawing(x, y);
        }
        this.isDrawing = false;
        this.isResizing = false;
        this.tempElement = null;
        this.resizeHandle = null;
        this.resizeSnapshot = null;
        
        if (this.selectionBox) {
            this.finishSelectionBox();
            this.selectionBox = null;
        }
    }
    
    handleSelectDown(x, y, ctrlKey) {
        const diagram = this.diagrams[this.currentDiagram];
        this.ensureDiagramElementLayers(diagram);
        const elements = this.getElementsSortedByLayer(diagram);
        
        // 检查是否点击了调整大小的控制点
        const selectedElements = diagram.selectedElements;
        if (selectedElements.length === 1) {
            const handle = this.getResizeHandle(x, y, selectedElements[0]);
            if (handle) {
                this.isResizing = true;
                this.resizeHandle = handle;
                this.tempElement = selectedElements[0];
                this.resizeSnapshot = {
                    element: this.cloneElement(selectedElements[0])
                };
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

        if (element.x1 !== undefined && element.y1 !== undefined && element.x2 !== undefined && element.y2 !== undefined) {
            handles.start = { x: element.x1, y: element.y1 };
            handles.end = { x: element.x2, y: element.y2 };
            return handles;
        }
        
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

        if ((element.type === 'line' || element.type === 'arrow') && (handle === 'start' || handle === 'end')) {
            const xKey = handle === 'start' ? 'x1' : 'x2';
            const yKey = handle === 'start' ? 'y1' : 'y2';

            if (element.type === 'arrow') {
                const snap = this.getNearestSnapTarget(x, y);
                if (snap) {
                    this.applyAttachmentToArrowEnd(element, handle, snap);
                } else {
                    element[xKey] = x;
                    element[yKey] = y;
                    if (handle === 'start') {
                        element.sourceAttachment = null;
                    } else {
                        element.targetAttachment = null;
                    }
                }
            } else {
                element[xKey] = x;
                element[yKey] = y;
            }
            return;
        }

        if (element.type === 'group') {
            this.handleGroupResize(element, handle, x, y);
            if (element.id) {
                this.syncAttachedArrowsForElementIds(new Set([element.id]));
            }
            return;
        }
        
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

        if (element.id) {
            this.syncAttachedArrowsForElementIds(new Set([element.id]));
        }
    }

    handleGroupResize(group, handle, x, y) {
        const snapshot = this.resizeSnapshot?.element;
        if (!snapshot) return;

        const oldX = snapshot.x;
        const oldY = snapshot.y;
        const oldW = snapshot.width;
        const oldH = snapshot.height;

        let newX = oldX;
        let newY = oldY;
        let newW = oldW;
        let newH = oldH;

        switch (handle) {
            case 'se':
                newW = x - oldX;
                newH = y - oldY;
                break;
            case 'e':
                newW = x - oldX;
                break;
            case 's':
                newH = y - oldY;
                break;
            case 'nw':
                newX = x;
                newY = y;
                newW = oldX + oldW - x;
                newH = oldY + oldH - y;
                break;
            case 'n':
                newY = y;
                newH = oldY + oldH - y;
                break;
            case 'ne':
                newY = y;
                newW = x - oldX;
                newH = oldY + oldH - y;
                break;
            case 'w':
                newX = x;
                newW = oldX + oldW - x;
                break;
            case 'sw':
                newX = x;
                newW = oldX + oldW - x;
                newH = y - oldY;
                break;
        }

        const minSize = 20;
        if (newW < minSize || newH < minSize) {
            return;
        }

        const oldBounds = { x: oldX, y: oldY, width: oldW, height: oldH };
        const newBounds = { x: newX, y: newY, width: newW, height: newH };
        const transformed = this.transformElementGeometry(snapshot, oldBounds, newBounds);

        group.x = transformed.x;
        group.y = transformed.y;
        group.width = transformed.width;
        group.height = transformed.height;
        group.elements = transformed.elements;
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

    ensureElementId(element) {
        if (!element.id) {
            element.id = `el-${this.elementIdCounter++}`;
        }
        return element.id;
    }

    assignNewElementId(element) {
        element.id = `el-${this.elementIdCounter++}`;
        return element.id;
    }

    ensureDiagramElementIds(diagram) {
        diagram.elements.forEach(element => this.ensureElementId(element));
    }

    // ===== 共通属性：层级（独立管理） =====
    getElementLayer(element) {
        if (!element) return 1;
        const layer = Number(element.layer);
        return Number.isFinite(layer) ? Math.max(1, Math.round(layer)) : 1;
    }

    getElementsSortedByLayer(diagram) {
        return diagram.elements
            .map((element, index) => ({ element, index }))
            .sort((a, b) => {
                const layerDiff = this.getElementLayer(a.element) - this.getElementLayer(b.element);
                if (layerDiff !== 0) return layerDiff;
                return a.index - b.index;
            })
            .map(item => item.element);
    }

    normalizeDiagramLayers(diagram) {
        const ordered = this.getElementsSortedByLayer(diagram);
        ordered.forEach((element, index) => {
            element.layer = index + 1;
        });
    }

    ensureDiagramElementLayers(diagram) {
        diagram.elements.forEach((element, index) => {
            if (!Number.isFinite(Number(element.layer))) {
                element.layer = index + 1;
            }
        });
        this.normalizeDiagramLayers(diagram);
    }

    setElementLayer(element, targetLayer) {
        const diagram = this.diagrams[this.currentDiagram];
        this.ensureDiagramElementLayers(diagram);

        const ordered = this.getElementsSortedByLayer(diagram);
        const currentIndex = ordered.indexOf(element);
        if (currentIndex === -1) return;

        const clampedLayer = Math.max(1, Math.min(ordered.length, Math.round(targetLayer)));
        ordered.splice(currentIndex, 1);
        ordered.splice(clampedLayer - 1, 0, element);

        ordered.forEach((item, index) => {
            item.layer = index + 1;
        });
    }

    moveEditingElementLayerUp() {
        if (!this.currentEditingElement) return;
        const current = this.getElementLayer(this.currentEditingElement);
        this.setElementLayer(this.currentEditingElement, current + 1);
        document.getElementById('prop-layer').value = this.getElementLayer(this.currentEditingElement);
        this.render();
    }

    moveEditingElementLayerDown() {
        if (!this.currentEditingElement) return;
        const current = this.getElementLayer(this.currentEditingElement);
        this.setElementLayer(this.currentEditingElement, current - 1);
        document.getElementById('prop-layer').value = this.getElementLayer(this.currentEditingElement);
        this.render();
    }

    moveEditingElementLayerToTop() {
        if (!this.currentEditingElement) return;
        const diagram = this.diagrams[this.currentDiagram];
        this.setElementLayer(this.currentEditingElement, diagram.elements.length);
        document.getElementById('prop-layer').value = this.getElementLayer(this.currentEditingElement);
        this.render();
    }

    moveEditingElementLayerToBottom() {
        if (!this.currentEditingElement) return;
        this.setElementLayer(this.currentEditingElement, 1);
        document.getElementById('prop-layer').value = this.getElementLayer(this.currentEditingElement);
        this.render();
    }

    addElementToDiagram(diagram, element) {
        this.assignNewElementId(element);
        if (!Number.isFinite(Number(element.layer))) {
            element.layer = diagram.elements.length + 1;
        }
        diagram.elements.push(element);
        this.normalizeDiagramLayers(diagram);
        this.markElementAsRecentlyCreated(element);
        return element;
    }

    findElementById(diagram, elementId) {
        return diagram.elements.find(el => el.id === elementId) || null;
    }

    getElementAnchorPoints(element) {
        const bounds = this.getElementBounds(element);
        const x = bounds.x;
        const y = bounds.y;
        const w = bounds.width;
        const h = bounds.height;

        return {
            tl: { x, y },
            t: { x: x + w / 2, y },
            tr: { x: x + w, y },
            r: { x: x + w, y: y + h / 2 },
            br: { x: x + w, y: y + h },
            b: { x: x + w / 2, y: y + h },
            bl: { x, y: y + h },
            l: { x, y: y + h / 2 }
        };
    }

    getNearestSnapTarget(x, y) {
        const diagram = this.diagrams[this.currentDiagram];
        this.ensureDiagramElementIds(diagram);

        let best = null;

        diagram.elements.forEach(element => {
            if (['line', 'arrow', 'pen'].includes(element.type)) return;

            const anchors = this.getElementAnchorPoints(element);
            Object.entries(anchors).forEach(([anchorKey, point]) => {
                const dx = point.x - x;
                const dy = point.y - y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance <= this.snapThreshold && (!best || distance < best.distance)) {
                    best = {
                        elementId: element.id,
                        anchorKey,
                        x: point.x,
                        y: point.y,
                        distance
                    };
                }
            });
        });

        return best;
    }

    applyAttachmentToArrowEnd(arrow, endpoint, attachment) {
        if (!attachment) return;
        const key = endpoint === 'start' ? 'sourceAttachment' : 'targetAttachment';
        const xKey = endpoint === 'start' ? 'x1' : 'x2';
        const yKey = endpoint === 'start' ? 'y1' : 'y2';

        arrow[key] = {
            elementId: attachment.elementId,
            anchorKey: attachment.anchorKey
        };
        arrow[xKey] = attachment.x;
        arrow[yKey] = attachment.y;
    }

    updateArrowEndpointFromAttachment(arrow, endpoint, diagram) {
        const key = endpoint === 'start' ? 'sourceAttachment' : 'targetAttachment';
        const xKey = endpoint === 'start' ? 'x1' : 'x2';
        const yKey = endpoint === 'start' ? 'y1' : 'y2';
        const attachment = arrow[key];

        if (!attachment) return;
        const targetElement = this.findElementById(diagram, attachment.elementId);
        if (!targetElement) {
            arrow[key] = null;
            return;
        }

        const anchors = this.getElementAnchorPoints(targetElement);
        const point = anchors[attachment.anchorKey];
        if (!point) {
            arrow[key] = null;
            return;
        }

        arrow[xKey] = point.x;
        arrow[yKey] = point.y;
    }

    syncAttachedArrowsForElementIds(elementIds) {
        if (!elementIds || elementIds.size === 0) return;

        const diagram = this.diagrams[this.currentDiagram];
        this.ensureDiagramElementIds(diagram);

        diagram.elements.forEach(element => {
            if (element.type !== 'arrow') return;

            if (element.sourceAttachment && elementIds.has(element.sourceAttachment.elementId)) {
                this.updateArrowEndpointFromAttachment(element, 'start', diagram);
            }
            if (element.targetAttachment && elementIds.has(element.targetAttachment.elementId)) {
                this.updateArrowEndpointFromAttachment(element, 'end', diagram);
            }
        });
    }

    cloneElement(element) {
        return JSON.parse(JSON.stringify(element));
    }

    translateElement(element, dx, dy) {
        if (element.x !== undefined) element.x += dx;
        if (element.y !== undefined) element.y += dy;
        if (element.x1 !== undefined) element.x1 += dx;
        if (element.y1 !== undefined) element.y1 += dy;
        if (element.x2 !== undefined) element.x2 += dx;
        if (element.y2 !== undefined) element.y2 += dy;

        if (Array.isArray(element.path)) {
            element.path.forEach(point => {
                point.x += dx;
                point.y += dy;
            });
        }

        if (Array.isArray(element.elements)) {
            element.elements.forEach(subElement => this.translateElement(subElement, dx, dy));
        }
    }

    transformElementGeometry(element, oldBounds, newBounds) {
        const sx = oldBounds.width === 0 ? 1 : newBounds.width / oldBounds.width;
        const sy = oldBounds.height === 0 ? 1 : newBounds.height / oldBounds.height;
        const scaleText = (sx + sy) / 2;

        const result = this.cloneElement(element);

        if (element.x !== undefined) {
            result.x = newBounds.x + (element.x - oldBounds.x) * sx;
        }
        if (element.y !== undefined) {
            result.y = newBounds.y + (element.y - oldBounds.y) * sy;
        }
        if (element.width !== undefined) {
            result.width = element.width * sx;
        }
        if (element.height !== undefined) {
            result.height = element.height * sy;
        }

        if (element.x1 !== undefined) {
            result.x1 = newBounds.x + (element.x1 - oldBounds.x) * sx;
        }
        if (element.y1 !== undefined) {
            result.y1 = newBounds.y + (element.y1 - oldBounds.y) * sy;
        }
        if (element.x2 !== undefined) {
            result.x2 = newBounds.x + (element.x2 - oldBounds.x) * sx;
        }
        if (element.y2 !== undefined) {
            result.y2 = newBounds.y + (element.y2 - oldBounds.y) * sy;
        }

        if (Array.isArray(element.path)) {
            result.path = element.path.map(point => ({
                x: newBounds.x + (point.x - oldBounds.x) * sx,
                y: newBounds.y + (point.y - oldBounds.y) * sy
            }));
        }

        if (element.type === 'text' && element.fontSize) {
            result.fontSize = Math.max(8, Math.round(element.fontSize * scaleText));
        }

        if (Array.isArray(element.elements)) {
            result.elements = element.elements.map(subElement =>
                this.transformElementGeometry(subElement, oldBounds, newBounds)
            );
        }

        return result;
    }
    
    startDrawingShape(x, y) {
        this.isDrawing = true;
        const isSticky = this.currentTool === 'sticky';
        this.tempElement = {
            type: this.currentTool,
            x: x,
            y: y,
            width: 0,
            height: 0,
            fill: isSticky ? '#FFEB3B' : 'white',
            stroke: isSticky ? '#F9A825' : '#333',
            strokeWidth: 2,
            text: isSticky ? '便签内容' : '',
            fontSize: 14,
            textColor: '#5D4037',
            textPosition: 'top'
        };
    }
    
    startDrawingLine(x, y) {
        this.isDrawing = true;
        if (this.currentTool === 'arrow') {
            const startSnap = this.getNearestSnapTarget(x, y);
            this.tempElement = {
                type: this.currentTool,
                x1: startSnap ? startSnap.x : x,
                y1: startSnap ? startSnap.y : y,
                x2: startSnap ? startSnap.x : x,
                y2: startSnap ? startSnap.y : y,
                stroke: '#333',
                strokeWidth: 2,
                sourceAttachment: startSnap ? { elementId: startSnap.elementId, anchorKey: startSnap.anchorKey } : null,
                targetAttachment: null
            };
            return;
        }

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
            this.addElementToDiagram(this.diagrams[this.currentDiagram], element);
            this.render();
        }
    }
    
    deleteElement(x, y) {
        const diagram = this.diagrams[this.currentDiagram];
        this.ensureDiagramElementLayers(diagram);
        const ordered = this.getElementsSortedByLayer(diagram);

        let targetElement = null;
        for (let i = ordered.length - 1; i >= 0; i--) {
            const element = ordered[i];
            if (this.isPointInElement(x, y, element)) {
                targetElement = element;
                break;
            }
        }

        const index = targetElement ? diagram.elements.indexOf(targetElement) : -1;
        
        if (index !== -1) {
            this.removeRecentCreatedMarker(diagram.elements[index]);
            diagram.elements.splice(index, 1);
            this.normalizeDiagramLayers(diagram);
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
                this.removeRecentCreatedMarker(diagram.elements[index]);
                diagram.elements.splice(index, 1);
            }
        });

        this.normalizeDiagramLayers(diagram);
        
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
            elements: selected.map(el => this.cloneElement(el)),
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
        
        this.addElementToDiagram(diagram, group);
        diagram.selectedElements = [group];
        diagram.groups.push(group);
        
        this.render();
        return group;
    }
    
    ungroupSelectedElements() {
        const diagram = this.diagrams[this.currentDiagram];
        const selected = diagram.selectedElements;
        const releasedElements = [];
        
        selected.forEach(group => {
            if (group.type === 'group') {
                const index = diagram.elements.indexOf(group);
                if (index !== -1) {
                    diagram.elements.splice(index, 1);
                    
                    // 释放组合中的元素
                    group.elements.forEach(element => {
                        const released = this.cloneElement(element);
                        this.addElementToDiagram(diagram, released);
                        releasedElements.push(released);
                    });
                    
                    // 从组合列表中移除
                    const groupIndex = diagram.groups.indexOf(group);
                    if (groupIndex !== -1) {
                        diagram.groups.splice(groupIndex, 1);
                    }
                }
            }
        });
        
        diagram.selectedElements = releasedElements;
        this.render();
    }
    
    updateTempElement(x, y) {
        if (this.tempElement.type === 'select') {
            const dx = x - this.startX;
            const dy = y - this.startY;
            
            const selected = this.diagrams[this.currentDiagram].selectedElements;
            const movedElementIds = new Set();
            selected.forEach(element => {
                if (element.id) movedElementIds.add(element.id);
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

            this.syncAttachedArrowsForElementIds(movedElementIds);
            
            this.startX = x;
            this.startY = y;
        } else if (['rectangle', 'ellipse', 'class', 'use-case', 'actor', 'package', 'sticky', 'triangle', 'diamond'].includes(this.tempElement.type)) {
            this.tempElement.width = x - this.tempElement.x;
            this.tempElement.height = y - this.tempElement.y;
        } else if (this.tempElement.type === 'line') {
            this.tempElement.x2 = x;
            this.tempElement.y2 = y;
        } else if (this.tempElement.type === 'arrow') {
            const snap = this.getNearestSnapTarget(x, y);
            if (snap) {
                this.applyAttachmentToArrowEnd(this.tempElement, 'end', snap);
            } else {
                this.tempElement.x2 = x;
                this.tempElement.y2 = y;
                this.tempElement.targetAttachment = null;
            }
        }
    }
    
    finishDrawing(x, y) {
        if (this.tempElement) {
            if (['rectangle', 'ellipse', 'class', 'use-case', 'actor', 'package', 'sticky', 'triangle', 'diamond'].includes(this.tempElement.type)) {
                if (this.tempElement.width < 0) {
                    this.tempElement.x += this.tempElement.width;
                    this.tempElement.width = Math.abs(this.tempElement.width);
                }
                if (this.tempElement.height < 0) {
                    this.tempElement.y += this.tempElement.height;
                    this.tempElement.height = Math.abs(this.tempElement.height);
                }
                
                if (this.tempElement.width > 10 && this.tempElement.height > 10) {
                    this.addElementToDiagram(this.diagrams[this.currentDiagram], this.tempElement);
                }
            } else if (['line', 'arrow'].includes(this.tempElement.type)) {
                const distance = Math.sqrt(
                    Math.pow(this.tempElement.x2 - this.tempElement.x1, 2) +
                    Math.pow(this.tempElement.y2 - this.tempElement.y1, 2)
                );
                if (distance > 10) {
                    this.addElementToDiagram(this.diagrams[this.currentDiagram], this.tempElement);
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
            case 'sticky':
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
            case 'triangle':
            case 'diamond':
                // compute polygon points based on bounds
                const b = this.getElementBounds(element);
                const pts = [];
                if (element.type === 'triangle') {
                    pts.push({ x: b.x + b.width / 2, y: b.y });
                    pts.push({ x: b.x + b.width, y: b.y + b.height });
                    pts.push({ x: b.x, y: b.y + b.height });
                } else {
                    pts.push({ x: b.x + b.width / 2, y: b.y });
                    pts.push({ x: b.x + b.width, y: b.y + b.height / 2 });
                    pts.push({ x: b.x + b.width / 2, y: b.y + b.height });
                    pts.push({ x: b.x, y: b.y + b.height / 2 });
                }
                return this.pointInPolygon(x, y, pts);
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

    pointInPolygon(px, py, points) {
        // ray-casting algorithm
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i].x, yi = points[i].y;
            const xj = points[j].x, yj = points[j].y;

            const intersect = ((yi > py) !== (yj > py)) &&
                (px < (xj - xi) * (py - yi) / (yj - yi + 0.0) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
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
        const exportBounds = this.getExportBounds();
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = exportBounds.width;
        tempCanvas.height = exportBounds.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        tempCtx.save();
        tempCtx.translate(-exportBounds.minX, -exportBounds.minY);
        
        const diagram = this.diagrams[this.currentDiagram];
        this.ensureDiagramElementLayers(diagram);
        const elements = this.getElementsSortedByLayer(diagram);
        elements.forEach(element => {
            if (element.type === 'pen') {
                this.drawPen(tempCtx, element);
            } else {
                this.drawElement(tempCtx, element);
            }
        });
        tempCtx.restore();
        
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

    getExportBounds() {
        const diagram = this.diagrams[this.currentDiagram];
        const elements = diagram.elements || [];

        // 最小导出尺寸：当前可见画布尺寸
        const minWidth = this.canvas.width;
        const minHeight = this.canvas.height;

        // 如果没有元素，直接按可见区域导出
        if (elements.length === 0) {
            return {
                minX: 0,
                minY: 0,
                width: minWidth,
                height: minHeight
            };
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        elements.forEach(element => {
            const bounds = this.getElementBounds(element);
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });

        // 为线条端点、箭头、选择描边预留少量边距
        const padding = 20;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        const contentWidth = Math.max(1, Math.ceil(maxX - minX));
        const contentHeight = Math.max(1, Math.ceil(maxY - minY));

        const width = Math.max(minWidth, contentWidth);
        const height = Math.max(minHeight, contentHeight);

        return {
            minX,
            minY,
            width,
            height
        };
    }
    
    clearDiagram() {
        if (confirm('确定要清空当前图表吗？')) {
            const diagram = this.diagrams[this.currentDiagram];
            diagram.elements.forEach(element => this.removeRecentCreatedMarker(element));
            this.diagrams[this.currentDiagram].elements = [];
            this.diagrams[this.currentDiagram].selectedElements = [];
            this.diagrams[this.currentDiagram].groups = [];
            this.render();
        }
    }
    
    render() {
        this.ensureDiagramElementIds(this.diagrams[this.currentDiagram]);
        this.ensureDiagramElementLayers(this.diagrams[this.currentDiagram]);
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.scale(this.viewZoom, this.viewZoom);
        this.ctx.translate(this.canvasOffsetX, this.canvasOffsetY);
        
        this.drawGrid();
        
        const diagram = this.diagrams[this.currentDiagram];
        const elements = this.getElementsSortedByLayer(diagram);
        
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
        
        this.ctx.restore();
        
        this.updateBottomToolbar();
        this.updateZoomRateDisplay();
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

            case 'triangle':
                ctx.fillStyle = element.fill;
                ctx.strokeStyle = element.stroke;
                ctx.lineWidth = element.strokeWidth;
                ctx.beginPath();
                ctx.moveTo(element.x + element.width / 2, element.y);
                ctx.lineTo(element.x + element.width, element.y + element.height);
                ctx.lineTo(element.x, element.y + element.height);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                if (element.text) this.drawElementText(ctx, element);
                break;

            case 'diamond':
                ctx.fillStyle = element.fill;
                ctx.strokeStyle = element.stroke;
                ctx.lineWidth = element.strokeWidth;
                ctx.beginPath();
                ctx.moveTo(element.x + element.width / 2, element.y);
                ctx.lineTo(element.x + element.width, element.y + element.height / 2);
                ctx.lineTo(element.x + element.width / 2, element.y + element.height);
                ctx.lineTo(element.x, element.y + element.height / 2);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                if (element.text) this.drawElementText(ctx, element);
                break;
                
            case 'sticky':
                ctx.fillStyle = element.fill;
                ctx.strokeStyle = element.stroke;
                ctx.lineWidth = element.strokeWidth;
                
                const triangleSize = Math.min(element.width, element.height) * 0.15;
                
                ctx.beginPath();
                ctx.moveTo(element.x, element.y);
                ctx.lineTo(element.x + element.width - triangleSize, element.y);
                ctx.lineTo(element.x + element.width, element.y + triangleSize);
                ctx.lineTo(element.x + element.width, element.y + element.height);
                ctx.lineTo(element.x, element.y + element.height);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(element.x + element.width - triangleSize, element.y);
                ctx.lineTo(element.x + element.width - triangleSize, element.y + triangleSize);
                ctx.lineTo(element.x + element.width, element.y + triangleSize);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
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
        const handles = this.getResizeHandles(element);
        ctx.fillStyle = '#4CAF50';
        ctx.setLineDash([]);

        Object.values(handles).forEach(handle => {
            ctx.beginPath();
            ctx.arc(handle.x, handle.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
        
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
            this.addElementToDiagram(diagram, penElement);
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
