(function () {
    const positionFields = [
        { key: 'x', label: 'X 坐标（左端）', type: 'number', step: '1' },
        { key: 'y', label: 'Y 坐标（顶端）', type: 'number', step: '1' },
        { key: 'layer', label: '层级', type: 'number', min: '1', step: '1', special: 'layer' }
    ];
    const textFields = [
        { key: 'textBackgroundColor', label: '文本背景颜色', type: 'color', defaultValue: '#ffffff' },
        { key: 'text', label: '文本内容', type: 'textarea', rows: 3, defaultValue: '' },
        { key: 'fontSize', label: '字体大小', type: 'number', min: '8', max: '72', defaultValue: 14 },
        { key: 'textColor', label: '文本颜色', type: 'color', defaultValue: '#333333' },
        { key: 'textPosition', label: '文本位置', type: 'select', defaultValue: 'center', options: [
            ['center', '居中'], ['top', '顶部'], ['bottom', '底部'], ['left', '左侧'], ['right', '右侧']
        ] }
    ];
    const shapeProfile = [
        { title: '尺寸', fields: [
            { key: 'width', label: '宽度', type: 'number', min: '1' },
            { key: 'height', label: '高度', type: 'number', min: '1' }
        ] },
        { title: '位置', fields: positionFields },
        { title: '边框', fields: [
            { key: 'strokeWidth', label: '线条大小', type: 'number', min: '1', max: '20', defaultValue: 2 },
            { key: 'stroke', label: '线条颜色', type: 'color', defaultValue: '#333333' },
            { key: 'fill', label: '填充颜色', type: 'color', defaultValue: '#ffffff' }
        ] },
        { title: '文本属性', fields: textFields }
    ];
    const textProfile = [
        { title: '尺寸', fields: [
            { key: 'width', label: '宽度', type: 'number', min: '1' },
            { key: 'height', label: '高度', type: 'number', min: '1' }
        ] },
        { title: '位置', fields: positionFields },
        { title: '文本属性', fields: [
            { key: 'backgroundColor', label: '背景颜色', type: 'color', defaultValue: '#ffffff' },
            { key: 'text', label: '文本内容', type: 'textarea', rows: 3, defaultValue: '' },
            { key: 'fontSize', label: '字体大小', type: 'number', min: '8', max: '72', defaultValue: 14 },
            { key: 'textColor', label: '文本颜色', type: 'color', defaultValue: '#333333' },
            { key: 'textPosition', label: '文本位置', type: 'select', defaultValue: 'left', options: [
                ['center', '居中'], ['top', '顶部'], ['bottom', '底部'], ['left', '左侧'], ['right', '右侧']
            ] }
        ] }
    ];
    const lineProfile = [
        { title: '起点与终点', fields: [
            { key: 'x1', label: '起点 X', type: 'number', step: '1' },
            { key: 'y1', label: '起点 Y', type: 'number', step: '1' },
            { key: 'x2', label: '终点 X', type: 'number', step: '1' },
            { key: 'y2', label: '终点 Y', type: 'number', step: '1' },
            { key: 'layer', label: '层级', type: 'number', min: '1', step: '1', special: 'layer' }
        ] },
        { title: '边框', fields: [
            { key: 'strokeWidth', label: '线条大小', type: 'number', min: '1', max: '20', defaultValue: 2 },
            { key: 'stroke', label: '线条颜色', type: 'color', defaultValue: '#333333' }
        ] },
        { title: '文本属性', fields: textFields }
    ];
    const penProfile = [
        { title: '位置', fields: [
            { key: 'layer', label: '层级', type: 'number', min: '1', step: '1', special: 'layer' }
        ] },
        { title: '边框', fields: [
            { key: 'strokeWidth', label: '线条大小', type: 'number', min: '1', max: '20', defaultValue: 2 },
            { key: 'stroke', label: '线条颜色', type: 'color', defaultValue: '#333333' }
        ] }
    ];

    const profiles = { shape: shapeProfile, text: textProfile, line: lineProfile, pen: penProfile };
    window.DrawingPropertyProfiles = profiles;

    function escapeAttribute(value) {
        return String(value).replace(/[&"<>']/g, character => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;', "'": '&#39;' }[character]));
    }

    function getValue(element, field, drawer) {
        if (field.special === 'layer') return drawer.getElementLayer(element);
        if (field.key === 'x' && element.x === undefined) return Math.min(element.x1 || 0, element.x2 || 0);
        if (field.key === 'y' && element.y === undefined) return Math.min(element.y1 || 0, element.y2 || 0);
        if (element.type === 'text' && field.key === 'y') return element.y - (Number(element.fontSize) || 14);
        return element[field.key] === undefined || element[field.key] === null
            ? (field.defaultValue === undefined ? '' : field.defaultValue)
            : element[field.key];
    }

    function renderField(field, element, drawer) {
        const id = `property-field-${field.key}`;
        const value = getValue(element, field, drawer);
        const common = `id="${id}" data-property-key="${escapeAttribute(field.key)}"`;
        let input;
        if (field.type === 'textarea') {
            input = `<textarea ${common} rows="${field.rows || 3}" style="width:100%;padding:5px;">${escapeAttribute(value)}</textarea>`;
        } else if (field.type === 'select') {
            const options = field.options.map(([optionValue, label]) => `<option value="${escapeAttribute(optionValue)}"${String(value) === String(optionValue) ? ' selected' : ''}>${escapeAttribute(label)}</option>`).join('');
            input = `<select ${common} style="width:100%;padding:5px;">${options}</select>`;
        } else {
            const attrs = ['min', 'max', 'step'].filter(key => field[key] !== undefined).map(key => `${key}="${escapeAttribute(field[key])}"`).join(' ');
            input = `<input type="${field.type}" ${common} value="${escapeAttribute(value)}" ${attrs} style="width:100%;padding:5px;">`;
        }
        return `<div style="margin-bottom:10px;"><label for="${id}">${escapeAttribute(field.label)}:</label>${input}</div>`;
    }

    function renderProfile(profile, element, drawer) {
        return profile.map(section => `<section class="help-section"><h3>${escapeAttribute(section.title)}</h3>${section.fields.map(field => renderField(field, element, drawer)).join('')}</section>`).join('');
    }

    function ensureDialog() {
        let dialog = document.getElementById('property-dialog');
        if (dialog) return dialog;
        dialog = document.createElement('div');
        dialog.id = 'property-dialog';
        dialog.className = 'help-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-labelledby', 'property-title');
        dialog.setAttribute('aria-modal', 'true');
        document.body.appendChild(dialog);
        return dialog;
    }

    function resolveProfile(element) {
        const tool = window.DrawingTools && window.DrawingTools.registry[element.type];
        if (tool && tool.properties) {
            return typeof tool.properties === 'string' ? profiles[tool.properties] : tool.properties;
        }
        return profiles.shape;
    }

    function show(drawer, element) {
        const dialog = ensureDialog();
        const profile = resolveProfile(element);
        drawer.currentEditingElement = element;
        drawer.ensureDiagramElementLayers(drawer.diagrams[drawer.currentDiagram]);
        dialog.innerHTML = `<div class="property-content"><div class="property-scroll"><h2 id="property-title">属性设置 - ${escapeAttribute(element.type)}</h2>${renderProfile(profile, element, drawer)}<section class="help-section"><h3>层级调整</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"><button id="prop-layer-up" type="button">上移一层</button><button id="prop-layer-down" type="button">下移一层</button><button id="prop-layer-top" type="button">置于顶层</button><button id="prop-layer-bottom" type="button">置于底层</button></div></section></div><div class="property-actions"><button id="close-property" type="button">取消</button><button id="apply-property" type="button">确认</button></div></div>`;
        dialog.classList.add('show');
        dialog.querySelector('#close-property').addEventListener('click', drawer.hidePropertyDialog.bind(drawer));
        dialog.querySelector('#apply-property').addEventListener('click', drawer.applyPropertyChanges.bind(drawer));
        dialog.querySelector('#prop-layer-up').addEventListener('click', drawer.moveEditingElementLayerUp.bind(drawer));
        dialog.querySelector('#prop-layer-down').addEventListener('click', drawer.moveEditingElementLayerDown.bind(drawer));
        dialog.querySelector('#prop-layer-top').addEventListener('click', drawer.moveEditingElementLayerToTop.bind(drawer));
        dialog.querySelector('#prop-layer-bottom').addEventListener('click', drawer.moveEditingElementLayerToBottom.bind(drawer));
    }

    function apply(drawer) {
        const element = drawer.currentEditingElement;
        const dialog = document.getElementById('property-dialog');
        if (!element || !dialog) return;
        let textTopY;
        dialog.querySelectorAll('[data-property-key]').forEach(input => {
            const key = input.dataset.propertyKey;
            const field = input.type === 'number' ? Number(input.value) : input.value;
            if (input.type === 'number' && !Number.isFinite(field)) return;
            if (key === 'layer') {
                if (field >= 1) drawer.setElementLayer(element, field);
                return;
            }
            if (['width', 'height', 'fontSize', 'strokeWidth'].includes(key) && field <= 0) return;
            if (key === 'textPosition' && element.type === 'text') {
                element.textPosition = field;
                return;
            }
            if (element.type === 'text' && key === 'y') {
                textTopY = field;
                return;
            }
            if ((key === 'x' || key === 'y') && element[key] === undefined) {
                const delta = field - Math.min(element[key === 'x' ? 'x1' : 'y1'] || 0, element[key === 'x' ? 'x2' : 'y2'] || 0);
                const first = key === 'x' ? 'x1' : 'y1';
                const second = key === 'x' ? 'x2' : 'y2';
                element[first] += delta;
                element[second] += delta;
                return;
            }
            element[key] = field;
        });
        if (textTopY !== undefined) element.y = textTopY + (Number(element.fontSize) || 14);
        if (element.id) drawer.syncAttachedArrowsForElementIds(new Set([element.id]));
        drawer.hidePropertyDialog();
        drawer.render();
    }

    window.DrawingPropertySettings = { show, apply, profiles };
})();



