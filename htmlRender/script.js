(() => {
  const toolbar = document.getElementById('toolbar');
  const workspace = document.getElementById('workspace');
  const previewFrame = document.getElementById('preview-frame');
  const fab = document.getElementById('toolbar-fab');

  const dropModal = document.getElementById('drop-modal');
  const modalConfirm = document.getElementById('modal-confirm');
  const modalCancel = document.getElementById('modal-cancel');

  const btnHorizontal = document.getElementById('btn-horizontal');
  const btnVertical = document.getElementById('btn-vertical');
  const btnMaxEditor = document.getElementById('btn-max-editor');
  const btnMaxPreview = document.getElementById('btn-max-preview');
  const btnHideToolbar = document.getElementById('btn-hide-toolbar');

  let editor = null;
  let activeBlobUrl = null;
  let pendingHtmlFile = null;

  // 初始化示例 HTML，方便打开页面后立即看到效果
  const initialCode = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>预览示例</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; }
    .card { padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
    h1 { color: #2563eb; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Hello Monaco</h1>
    <p>在左侧编辑 HTML，这里会实时更新。</p>
  </div>
</body>
</html>`;

  // 防抖：在输入停止约 300ms 后再渲染，避免高频更新卡顿
  function debounce(fn, wait = 300) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  // 使用 Blob URL + iframe.src 渲染 HTML，避免 document.write 和全局污染
  function renderPreview(code) {
    const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
    const nextUrl = URL.createObjectURL(blob);

    previewFrame.src = nextUrl;

    // 释放旧 URL，防止内存泄漏
    if (activeBlobUrl) {
      URL.revokeObjectURL(activeBlobUrl);
    }
    activeBlobUrl = nextUrl;
  }

  const renderPreviewDebounced = debounce(renderPreview, 300);

  // 更新按钮高亮
  function setActiveButton(activeButton, group) {
    group.forEach((btn) => btn.classList.remove('is-active'));
    activeButton.classList.add('is-active');
  }

  function clearMaxMode() {
    workspace.classList.remove('max-editor', 'max-preview');
    btnMaxEditor.classList.remove('is-active');
    btnMaxPreview.classList.remove('is-active');
  }

  // 左右布局
  btnHorizontal.addEventListener('click', () => {
    clearMaxMode();
    workspace.classList.remove('layout-vertical');
    workspace.classList.add('layout-horizontal');
    setActiveButton(btnHorizontal, [btnHorizontal, btnVertical]);
  });

  // 上下布局
  btnVertical.addEventListener('click', () => {
    clearMaxMode();
    workspace.classList.remove('layout-horizontal');
    workspace.classList.add('layout-vertical');
    setActiveButton(btnVertical, [btnHorizontal, btnVertical]);
  });

  // 最大化编辑区
  btnMaxEditor.addEventListener('click', () => {
    workspace.classList.remove('max-preview');
    workspace.classList.add('max-editor');
    btnMaxPreview.classList.remove('is-active');
    btnMaxEditor.classList.add('is-active');
  });

  // 最大化预览区
  btnMaxPreview.addEventListener('click', () => {
    workspace.classList.remove('max-editor');
    workspace.classList.add('max-preview');
    btnMaxEditor.classList.remove('is-active');
    btnMaxPreview.classList.add('is-active');
  });

  // 隐藏工具栏，显示可拖拽 FAB
  btnHideToolbar.addEventListener('click', () => {
    document.body.classList.add('toolbar-hidden');
  });

  // 点击 FAB 重新显示工具栏
  fab.addEventListener('click', () => {
    if (fab.dataset.dragged === 'true') {
      return;
    }
    document.body.classList.remove('toolbar-hidden');
  });

  // FAB 拖拽逻辑：支持在视窗内自由移动
  (() => {
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;

    fab.style.left = `${window.innerWidth - 70}px`;
    fab.style.top = `${window.innerHeight - 70}px`;
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';

    fab.addEventListener('pointerdown', (event) => {
      dragging = true;
      moved = false;
      fab.classList.add('dragging');
      fab.setPointerCapture(event.pointerId);

      startX = event.clientX;
      startY = event.clientY;
      const rect = fab.getBoundingClientRect();
      originLeft = rect.left;
      originTop = rect.top;
      fab.dataset.dragged = 'false';
    });

    fab.addEventListener('pointermove', (event) => {
      if (!dragging) {
        return;
      }

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        moved = true;
      }

      const maxLeft = window.innerWidth - fab.offsetWidth;
      const maxTop = window.innerHeight - fab.offsetHeight;
      const nextLeft = Math.min(Math.max(originLeft + dx, 0), maxLeft);
      const nextTop = Math.min(Math.max(originTop + dy, 0), maxTop);

      fab.style.left = `${nextLeft}px`;
      fab.style.top = `${nextTop}px`;
    });

    fab.addEventListener('pointerup', (event) => {
      if (!dragging) {
        return;
      }
      dragging = false;
      fab.classList.remove('dragging');
      fab.releasePointerCapture(event.pointerId);

      fab.dataset.dragged = moved ? 'true' : 'false';
      setTimeout(() => {
        fab.dataset.dragged = 'false';
      }, 80);
    });
  })();

  // 拖拽上传：全页面监听 dragover/drop
  window.addEventListener('dragover', (event) => {
    event.preventDefault();
    document.body.classList.add('drag-over');
  });

  window.addEventListener('dragleave', (event) => {
    if (event.clientX <= 0 || event.clientY <= 0 || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight) {
      document.body.classList.remove('drag-over');
    }
  });

  window.addEventListener('drop', (event) => {
    event.preventDefault();
    document.body.classList.remove('drag-over');

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
      return;
    }

    // 仅处理第一个 .html 文件
    const htmlFile = Array.from(files).find((file) => /\.html?$/i.test(file.name));
    if (!htmlFile) {
      return;
    }

    pendingHtmlFile = htmlFile;
    showDropModal();
  });

  function showDropModal() {
    dropModal.classList.add('show');
    dropModal.setAttribute('aria-hidden', 'false');
  }

  function hideDropModal() {
    dropModal.classList.remove('show');
    dropModal.setAttribute('aria-hidden', 'true');
  }

  modalCancel.addEventListener('click', () => {
    pendingHtmlFile = null;
    hideDropModal();
  });

  modalConfirm.addEventListener('click', async () => {
    if (!pendingHtmlFile) {
      hideDropModal();
      return;
    }

    try {
      const content = await pendingHtmlFile.text();
      editor.setValue(content);
      renderPreview(content);
    } catch (error) {
      console.error('读取文件失败:', error);
      alert('读取 HTML 文件失败，请重试。');
    } finally {
      pendingHtmlFile = null;
      hideDropModal();
    }
  });

  dropModal.addEventListener('click', (event) => {
    if (event.target === dropModal) {
      pendingHtmlFile = null;
      hideDropModal();
    }
  });

  // 初始化 Monaco
  function initMonaco() {
    window.require.config({
      paths: {
        vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs'
      }
    });

    window.require(['vs/editor/editor.main'], () => {
      editor = window.monaco.editor.create(document.getElementById('editor'), {
        value: initialCode,
        language: 'html',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        tabSize: 2,
        quickSuggestions: true,
        wordWrap: 'on'
      });

      editor.onDidChangeModelContent(() => {
        renderPreviewDebounced(editor.getValue());
      });

      renderPreview(initialCode);
    });
  }

  initMonaco();

  // 页面关闭时释放 Blob URL，避免内存泄漏
  window.addEventListener('beforeunload', () => {
    if (activeBlobUrl) {
      URL.revokeObjectURL(activeBlobUrl);
      activeBlobUrl = null;
    }
  });
})();
