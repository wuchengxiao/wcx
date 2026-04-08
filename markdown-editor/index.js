// 获取DOM元素
const preview = utils._id('preview');
const editorBox = utils._query('.editor-box');
const previewBox = utils._query('.preview-box');
const container = utils._query('.container');
const paneSplitter = utils._id('paneSplitter');
const toc = utils._id('toc');
const layoutBtn = utils._id('layoutBtn');
const maximizeEditorBtn = utils._id('maximizeEditorBtn');
const maximizePreviewBtn = utils._id('maximizePreviewBtn');
const tocSideBtn = utils._id('tocSideBtn');
const tocToggleBtn = utils._id('tocToggleBtn');
const resetViewBtn = utils._id('resetViewBtn');
const toolbarCollapseBtn = utils._id('toolbarCollapseBtn');
const toolbarExpandBtn = utils._id('toolbarExpandBtn');

const viewState = {
    layout: 'horizontal',
    maximize: 'none',
    tocSide: 'right',
    tocVisible: true,
    paneRatio: 0.5,
    toolbarVisible: true
};

const SPLITTER_SIZE = 8;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function applyPaneRatio() {
    if (viewState.maximize !== 'none') {
        editorBox.style.flex = '';
        previewBox.style.flex = '';
        return;
    }

    const ratio = clamp(viewState.paneRatio, 0.15, 0.85);
    const offset = SPLITTER_SIZE / 2;

    editorBox.style.flex = `0 0 calc(${ratio * 100}% - ${offset}px)`;
    previewBox.style.flex = `0 0 calc(${(1 - ratio) * 100}% - ${offset}px)`;
}

function updateViewControls() {
    const setButtonText = (button, text) => {
        const textNode = button.querySelector('.btn-text');
        if (textNode) {
            textNode.textContent = text;
        }
    };

    setButtonText(layoutBtn, `布局：${viewState.layout === 'horizontal' ? '左右' : '上下'}`);
    setButtonText(tocSideBtn, `目录：${viewState.tocSide === 'right' ? '右侧' : '左侧'}`);
    setButtonText(tocToggleBtn, viewState.tocVisible ? '隐藏目录' : '显示目录');

    layoutBtn.classList.toggle('active', viewState.layout === 'vertical');
    tocSideBtn.classList.toggle('active', viewState.tocSide === 'left');
    tocToggleBtn.classList.toggle('active', !viewState.tocVisible);
    maximizeEditorBtn.classList.toggle('active', viewState.maximize === 'editor');
    maximizePreviewBtn.classList.toggle('active', viewState.maximize === 'preview');

    const tocIcon = tocToggleBtn.querySelector('.btn-icon');
    if (tocIcon) {
        tocIcon.className = `fa-solid ${viewState.tocVisible ? 'fa-eye-slash' : 'fa-eye'} btn-icon`;
    }
}

function applyViewState() {
    container.classList.toggle('layout-vertical', viewState.layout === 'vertical');
    previewBox.classList.toggle('toc-left', viewState.tocSide === 'left');
    previewBox.classList.toggle('toc-right', viewState.tocSide === 'right');
    previewBox.classList.toggle('toc-hidden', !viewState.tocVisible);

    paneSplitter.setAttribute('aria-orientation', viewState.layout === 'vertical' ? 'horizontal' : 'vertical');

    document.body.classList.toggle('maximize-editor', viewState.maximize === 'editor');
    document.body.classList.toggle('maximize-preview', viewState.maximize === 'preview');
    document.body.classList.toggle('toolbar-hidden', !viewState.toolbarVisible);

    applyPaneRatio();
    updateViewControls();
}

function initPaneSplitter() {
    paneSplitter.addEventListener('pointerdown', (event) => {
        if (viewState.maximize !== 'none') {
            return;
        }

        event.preventDefault();
        paneSplitter.setPointerCapture(event.pointerId);
        document.body.classList.add('is-resizing');

        const onPointerMove = (moveEvent) => {
            const rect = container.getBoundingClientRect();
            const isVerticalLayout = viewState.layout === 'vertical';
            const position = isVerticalLayout
                ? moveEvent.clientY - rect.top
                : moveEvent.clientX - rect.left;
            const total = isVerticalLayout ? rect.height : rect.width;

            if (total <= 0) {
                return;
            }

            viewState.paneRatio = clamp(position / total, 0.15, 0.85);
            applyPaneRatio();
        };

        const onPointerUp = (upEvent) => {
            paneSplitter.releasePointerCapture(upEvent.pointerId);
            document.body.classList.remove('is-resizing');
            paneSplitter.removeEventListener('pointermove', onPointerMove);
            paneSplitter.removeEventListener('pointerup', onPointerUp);
            paneSplitter.removeEventListener('pointercancel', onPointerUp);
        };

        paneSplitter.addEventListener('pointermove', onPointerMove);
        paneSplitter.addEventListener('pointerup', onPointerUp);
        paneSplitter.addEventListener('pointercancel', onPointerUp);
    });
}

function slugify(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[\s\W-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'section';
}

function createTocTree(headings) {
    const roots = [];
    const stack = [];

    headings.forEach((item) => {
        while (stack.length && stack[stack.length - 1].level >= item.level) {
            stack.pop();
        }

        if (stack.length) {
            stack[stack.length - 1].children.push(item);
        } else {
            roots.push(item);
        }

        stack.push(item);
    });

    return roots;
}

function renderTocNodes(nodes) {
    const ul = document.createElement('ul');

    nodes.forEach((node) => {
        const li = document.createElement('li');
        li.className = 'toc-item';

        const row = document.createElement('div');
        row.className = 'toc-row';

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'toc-toggle';

        const hasChildren = node.children.length > 0;
        if (hasChildren) {
            toggleBtn.textContent = '▾';
            toggleBtn.addEventListener('click', () => {
                const isCollapsed = li.classList.toggle('is-collapsed');
                toggleBtn.textContent = isCollapsed ? '▸' : '▾';
            });
        } else {
            toggleBtn.textContent = '•';
            toggleBtn.classList.add('placeholder');
        }

        const link = document.createElement('a');
        link.className = 'toc-link';
        link.href = `#${node.id}`;
        link.textContent = node.text;
        link.title = node.text;
        link.addEventListener('click', (event) => {
            event.preventDefault();
            node.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        row.appendChild(toggleBtn);
        row.appendChild(link);
        li.appendChild(row);

        if (hasChildren) {
            const childrenUl = renderTocNodes(node.children);
            childrenUl.classList.add('toc-children');
            li.appendChild(childrenUl);
        }

        ul.appendChild(li);
    });

    return ul;
}

function buildToc() {
    const headingElements = Array.from(preview.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    if (!headingElements.length) {
        toc.innerHTML = '<div class="toc-empty">暂无章节</div>';
        return;
    }

    const idMap = new Map();
    const headingData = headingElements.map((heading) => {
        const baseId = slugify(heading.textContent || 'section');
        const currentCount = idMap.get(baseId) || 0;
        const nextCount = currentCount + 1;
        idMap.set(baseId, nextCount);

        const uniqueId = currentCount ? `${baseId}-${nextCount}` : baseId;
        heading.id = uniqueId;

        return {
            id: uniqueId,
            text: (heading.textContent || uniqueId).trim(),
            level: Number(heading.tagName.slice(1)),
            element: heading,
            children: []
        };
    });

    const tree = createTocTree(headingData);
    toc.innerHTML = '';
    toc.appendChild(renderTocNodes(tree));
}

// 实时渲染函数
function renderPreview(editorInstance) {
    const markdownStr = editorInstance.value();
    const html = easyMDE.markdown(markdownStr);
    preview.innerHTML = html;
    buildToc();

    // 高亮代码
    hljs.highlightAll();
}

const easyMDE = new EasyMDE({
    element: utils._id('editor'),
    autoDownloadFontAwesome: false,
    spellChecker: false,
    minHeight: '0px',
    toolbar: [
        {
            name: 'bold',
            action: EasyMDE.toggleBold,
            className: 'fa fa-bold',
            title: 'Bold'
        },
        {
            name: 'italic',
            action: EasyMDE.toggleItalic,
            className: 'fa fa-italic',
            title: 'Italic'
        },
        {
            name: 'heading',
            action: EasyMDE.toggleHeadingSmaller,
            className: 'fa fa-header',
            title: 'Heading'
        },
        '|',
        'quote',
        'unordered-list',
        'ordered-list',
        '|',
        'link',
        'image',
        '|',
        {
            name: 'preview',
            className: 'fa fa-eye no-disable',
            title: '刷新预览',
            action: (editor) => {
                renderPreview(editor);
            }
        },
        {
            name: 'fullscreen',
            action: EasyMDE.toggleFullScreen,
            className: 'fa fa-arrows-alt no-disable no-mobile',
            title: 'Toggle Fullscreen'
        },
        '|',
        'guide',
        {
            name: 'undo',
            action: EasyMDE.undo,
            className: 'fa fa-undo',
            title: 'Undo'
        },
        {
            name: 'redo',
            action: EasyMDE.redo,
            className: 'fa fa-redo',
            title: 'Redo'
        }
    ]
});

easyMDE.value(`# Markdown 示例

## 代码块
\`\`\`javascript
function hello() {
    console.log("Hello, World!");
}
\`\`\`

## 列表
- 项目1
- 项目2
  - 子项目
  - 子项目

## 强调
*斜体* 和 &zwnj;**粗体**&zwnj;

## 引用
> 这是引用内容

## 链接
[GitHub](https://github.com)

## 表格
| 标题1 | 标题2 |
|-------|-------|
| 内容1 | 内容2 |
`);

easyMDE.codemirror.on('change', () => {
    renderPreview(easyMDE);
});

layoutBtn.addEventListener('click', () => {
    viewState.layout = viewState.layout === 'horizontal' ? 'vertical' : 'horizontal';
    applyViewState();
});

maximizeEditorBtn.addEventListener('click', () => {
    viewState.maximize = viewState.maximize === 'editor' ? 'none' : 'editor';
    applyViewState();
});

maximizePreviewBtn.addEventListener('click', () => {
    viewState.maximize = viewState.maximize === 'preview' ? 'none' : 'preview';
    applyViewState();
});

tocSideBtn.addEventListener('click', () => {
    viewState.tocSide = viewState.tocSide === 'right' ? 'left' : 'right';
    applyViewState();
});

tocToggleBtn.addEventListener('click', () => {
    viewState.tocVisible = !viewState.tocVisible;
    applyViewState();
});

resetViewBtn.addEventListener('click', () => {
    viewState.maximize = 'none';
    applyViewState();
});

toolbarCollapseBtn.addEventListener('click', () => {
    viewState.toolbarVisible = false;
    applyViewState();
});

toolbarExpandBtn.addEventListener('click', () => {
    viewState.toolbarVisible = true;
    applyViewState();
});

initPaneSplitter();
applyViewState();
renderPreview(easyMDE);
