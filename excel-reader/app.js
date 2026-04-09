/* =====================================================
   在线 Excel 读取器  —  app.js
   依赖：SheetJS (xlsx.full.min.js)
   ===================================================== */

'use strict';

// ─── DOM 引用 ─────────────────────────────────────────
const dropzone      = document.getElementById('dropzone');
const fileInput     = document.getElementById('fileInput');
const fileInfoBar   = document.getElementById('fileInfoBar');
const fileNameEl    = document.getElementById('fileName');
const fileSizeEl    = document.getElementById('fileSize');
const rowCountEl    = document.getElementById('rowCount');
const colCountEl    = document.getElementById('colCount');
const sheetTabsEl   = document.getElementById('sheetTabs');
const toolbar       = document.getElementById('toolbar');
const tableWrap     = document.getElementById('tableWrap');
const tableContainer= document.getElementById('tableContainer');
const loadingEl     = document.getElementById('loading');
const emptyStateEl  = document.getElementById('emptyState');
const statusBar     = document.getElementById('statusBar');
const statusText    = document.getElementById('statusText');
const filterInfoEl  = document.getElementById('filterInfo');
const searchInput   = document.getElementById('searchInput');
const headerToggle  = document.getElementById('headerToggle');
const graphicsPanel = document.getElementById('graphicsPanel');
const graphicsSummary = document.getElementById('graphicsSummary');
const graphicsList  = document.getElementById('graphicsList');
const btnExport     = document.getElementById('btnExport');
const btnClear      = document.getElementById('btnClear');

// ─── 应用状态 ─────────────────────────────────────────
let workbook        = null;   // SheetJS workbook
let activeSheet     = '';     // 当前 Sheet 名
let allRows         = [];     // 当前 Sheet 全部行: [{ cells: [], srcRow: number }]
let headers         = [];     // 表头
let sortState       = { col: -1, asc: true };
let searchKeyword   = '';
let originalFileName= '';
let currentMerges   = [];     // 当前 Sheet 合并信息
let bodyStartRow    = 0;      // 表体在原始 sheet 中起始行（0-based）
let drawingObjectsBySheet = new Map(); // 当前工作簿图形对象
let currentFileExt = '';
let cellStylesBySheet = new Map(); // 单元格样式（背景色/字体/对齐等）

// ─── 初始化事件 ──────────────────────────────────────

// 拖拽
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
dropzone.addEventListener('click', () => fileInput.click());

// 文件选择
fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) handleFile(file);
  fileInput.value = '';
});

// 搜索
searchInput.addEventListener('input', () => {
  searchKeyword = searchInput.value.trim().toLowerCase();
  renderTable();
});

// 首行为表头 切换
headerToggle.addEventListener('change', () => {
  if (!workbook) return;
  loadSheet(activeSheet);
});

// 导出 CSV
btnExport.addEventListener('click', exportCSV);

// 清除
btnClear.addEventListener('click', clearAll);

// 窗口变化时重绘（保证图形叠加坐标准确）
let resizeTimer = null;
window.addEventListener('resize', () => {
  if (!workbook || !activeSheet || tableWrap.style.display === 'none') return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    renderTable();
  }, 80);
});

// ─── 主流程 ──────────────────────────────────────────

function handleFile(file) {
  const validExts = ['.xlsx', '.xls', '.csv'];
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!validExts.includes(ext)) {
    alert(`不支持的文件格式：${ext}\n请选择 .xlsx / .xls / .csv 文件`);
    return;
  }

  originalFileName = file.name;
  currentFileExt = ext;
  showLoading(true);

  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const arrayBuffer = e.target.result;
      const data = new Uint8Array(arrayBuffer);
      workbook = XLSX.read(data, { type: 'array', cellDates: true });

      drawingObjectsBySheet = new Map();
      cellStylesBySheet = new Map();
      if (currentFileExt === '.xlsx' && typeof JSZip !== 'undefined') {
        try {
          drawingObjectsBySheet = await extractDrawingObjectsFromXlsx(arrayBuffer);
          if (typeof ExcelJS !== 'undefined') {
            const imageMap = await extractImagesByExcelJS(arrayBuffer);
            drawingObjectsBySheet = mergeDrawingObjects(drawingObjectsBySheet, imageMap);
            cellStylesBySheet = await extractCellStylesByExcelJS(arrayBuffer);
          }
        } catch (shapeErr) {
          console.warn('图形解析失败:', shapeErr);
        }
      }

      // 显示文件信息
      fileNameEl.textContent = file.name;
      fileSizeEl.textContent = `(${formatSize(file.size)})`;
      dropzone.style.display = 'none';
      fileInfoBar.style.display = 'flex';
      btnExport.style.display = 'inline-flex';
      btnClear.style.display  = 'inline-flex';
      statusBar.style.display = 'flex';

      // 渲染 sheet tabs
      renderSheetTabs();

      // 加载第一个 Sheet
      loadSheet(workbook.SheetNames[0]);
    } catch (err) {
      showLoading(false);
      alert('文件解析失败：' + err.message);
    }
  };
  reader.onerror = () => { showLoading(false); alert('文件读取失败'); };
  reader.readAsArrayBuffer(file);
}

function renderSheetTabs() {
  sheetTabsEl.innerHTML = '';
  workbook.SheetNames.forEach(name => {
    const tab = document.createElement('button');
    tab.className = 'sheet-tab';
    tab.textContent = name;
    tab.addEventListener('click', () => loadSheet(name));
    sheetTabsEl.appendChild(tab);
  });
  sheetTabsEl.style.display = workbook.SheetNames.length > 1 ? 'flex' : 'none';
}

function loadSheet(sheetName) {
  activeSheet = sheetName;
  sortState = { col: -1, asc: true };
  searchKeyword = '';
  searchInput.value = '';

  // 高亮 tab
  document.querySelectorAll('.sheet-tab').forEach(t => {
    t.classList.toggle('active', t.textContent === sheetName);
  });

  const ws = workbook.Sheets[sheetName];
  // 转为二维数组，保留原始值
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: true });
  const refRange = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
  const maxCols = refRange ? (refRange.e.c - refRange.s.c + 1) : Math.max(...raw.map(r => r.length), 0);
  const normalizedRaw = raw.map(r => {
    const row = [...r];
    while (row.length < maxCols) row.push('');
    return row;
  });

  currentMerges = (ws['!merges'] || []).map(m => ({
    s: { r: m.s.r, c: m.s.c },
    e: { r: m.e.r, c: m.e.c }
  }));

  if (!normalizedRaw || normalizedRaw.length === 0) {
    allRows = [];
    headers = [];
    currentMerges = [];
    showEmpty(true);
    toolbar.style.display = 'none';
    tableWrap.style.display = 'none';
    showLoading(false);
    statusText.textContent = `Sheet: ${sheetName} — 无数据`;
    renderGraphicsPanel();
    return;
  }

  if (headerToggle.checked) {
    bodyStartRow = 1;
    headers = (normalizedRaw[0] || []).map((h, i) => (h !== '' ? String(h) : `列${i + 1}`));
    allRows  = normalizedRaw.slice(1).map((cells, idx) => ({
      cells,
      srcRow: idx + 1
    }));
  } else {
    bodyStartRow = 0;
    headers = Array.from({ length: maxCols }, (_, i) => `列${i + 1}`);
    allRows  = normalizedRaw.map((cells, idx) => ({
      cells,
      srcRow: idx
    }));
  }

  // 更新徽章
  rowCountEl.textContent = `${allRows.length} 行`;
  colCountEl.textContent = `${headers.length} 列`;

  showLoading(false);
  showEmpty(false);
  toolbar.style.display = 'flex';
  tableWrap.style.display = 'block';
  statusText.textContent = `Sheet: ${sheetName}`;

  renderTable();
  renderGraphicsPanel();
}

// ─── 渲染表格 ─────────────────────────────────────────

function renderTable() {
  // 过滤
  let rows = allRows;
  if (searchKeyword) {
    rows = allRows.filter(row =>
      row.cells.some(cell => String(cell).toLowerCase().includes(searchKeyword))
    );
  }

  // 排序
  if (sortState.col >= 0) {
    const col = sortState.col;
    const asc = sortState.asc;
    rows = [...rows].sort((a, b) => {
      const va = a.cells[col] ?? '';
      const vb = b.cells[col] ?? '';
      // 数字排序
      const na = parseFloat(va), nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb)) return asc ? na - nb : nb - na;
      return asc
        ? String(va).localeCompare(String(vb), 'zh-CN')
        : String(vb).localeCompare(String(va), 'zh-CN');
    });
  }

  // 更新状态栏
  if (searchKeyword) {
    filterInfoEl.textContent = `找到 ${rows.length} / ${allRows.length} 行`;
  } else {
    filterInfoEl.textContent = '';
  }

  // 构建 HTML（使用 DocumentFragment 提升性能）
  const table = document.createElement('table');
  table.className = 'excel-table';
  const enableMergeRender = !searchKeyword && sortState.col < 0;
  const mergeMeta = buildMergeMeta(enableMergeRender);

  // 表头
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');

  // 行号列
  const thNum = document.createElement('th');
  thNum.className = 'row-num';
  thNum.textContent = '#';
  headRow.appendChild(thNum);

  headers.forEach((h, i) => {
    const th = document.createElement('th');
    th.textContent = h;
    if (sortState.col === i) th.classList.add(sortState.asc ? 'sort-asc' : 'sort-desc');
    th.addEventListener('click', () => {
      if (sortState.col === i) {
        sortState.asc = !sortState.asc;
      } else {
        sortState.col = i;
        sortState.asc = true;
      }
      renderTable();
    });

    if (headerToggle.checked) {
      const headerStyle = getCellStyle(activeSheet, 0, i);
      applyExcelStyleToElement(th, headerStyle);
    }

    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  // 表体
  const tbody = document.createElement('tbody');
  rows.forEach((row, rowIdx) => {
    const tr = document.createElement('tr');

    // 行号
    const tdNum = document.createElement('td');
    tdNum.className = 'row-num';
    tdNum.textContent = rowIdx + 1;
    tr.appendChild(tdNum);

    headers.forEach((_, colIdx) => {
      const cellKey = `${row.srcRow}:${colIdx}`;
      if (enableMergeRender && mergeMeta.coveredSet.has(cellKey)) return;

      const td = document.createElement('td');
      td.dataset.srcRow = String(row.srcRow);
      td.dataset.srcCol = String(colIdx);
      const rawVal = row.cells[colIdx] ?? '';
      const cellText = String(rawVal);

      const cellStyle = getCellStyle(activeSheet, row.srcRow, colIdx);
      applyExcelStyleToElement(td, cellStyle);

      if (enableMergeRender && mergeMeta.startMap.has(cellKey)) {
        const span = mergeMeta.startMap.get(cellKey);
        if (span.rowspan > 1) td.rowSpan = span.rowspan;
        if (span.colspan > 1) td.colSpan = span.colspan;
      }

      if (searchKeyword && cellText.toLowerCase().includes(searchKeyword)) {
        td.innerHTML = highlightText(cellText, searchKeyword);
      } else {
        td.textContent = cellText;
      }
      td.title = cellText; // tooltip 显示完整内容
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  tableContainer.innerHTML = '';
  tableContainer.appendChild(table);
  renderGraphicsOverlay(table);
}

function renderGraphicsOverlay(table) {
  if (!tableContainer) return;

  const oldOverlay = tableContainer.querySelector('.graphics-overlay');
  if (oldOverlay) oldOverlay.remove();

  if (!workbook || !activeSheet || currentFileExt !== '.xlsx') return;
  if (searchKeyword || sortState.col >= 0) return;

  const objects = drawingObjectsBySheet.get(activeSheet) || [];
  if (!objects.length) return;

  const overlay = document.createElement('div');
  overlay.className = 'graphics-overlay';
  overlay.style.width = `${table.scrollWidth}px`;
  overlay.style.height = `${table.scrollHeight}px`;

  const cellIndex = buildRenderedCellIndex(table);

  objects.forEach((obj, idx) => {
    const fromA1 = parseA1(obj.from);
    const toA1 = parseA1(obj.to) || fromA1;
    if (!fromA1) return;

    const fromRect = findCellRect(cellIndex, fromA1.row, fromA1.col);
    const toRect = findCellRect(cellIndex, toA1.row, toA1.col) || fromRect;
    if (!fromRect || !toRect) return;

    const left = fromRect.left;
    const top = fromRect.top;
    const width = Math.max(24, toRect.right - fromRect.left);
    const height = Math.max(22, toRect.bottom - fromRect.top);

    const shape = document.createElement('div');
    shape.className = `graphics-draw graphics-draw-${obj.type || 'unknown'}`;
    shape.style.left = `${left}px`;
    shape.style.top = `${top}px`;
    shape.style.width = `${width}px`;
    shape.style.height = `${height}px`;
    shape.title = `${typeLabel(obj.type)}${obj.name ? `: ${obj.name}` : ''}`;

    if (obj.type === 'picture' && obj.dataUrl) {
      const img = document.createElement('img');
      img.className = 'graphics-draw-image';
      img.src = obj.dataUrl;
      img.alt = obj.name || 'Excel 图片';
      shape.appendChild(img);
    }

    if (obj.type === 'chart' && obj.previewDataUrl) {
      const img = document.createElement('img');
      img.className = 'graphics-draw-image graphics-draw-chart-preview';
      img.src = obj.previewDataUrl;
      img.alt = obj.name || 'Excel 图表预览';
      shape.appendChild(img);
    }

    const label = document.createElement('span');
    label.className = 'graphics-draw-label';
    label.textContent = obj.name || `${typeLabel(obj.type)} ${idx + 1}`;
    shape.appendChild(label);

    overlay.appendChild(shape);
  });

  tableContainer.appendChild(overlay);
}

function buildRenderedCellIndex(table) {
  const containerRect = tableContainer.getBoundingClientRect();
  const bodyCells = table.querySelectorAll('tbody td[data-src-row][data-src-col]');
  const headerCells = table.querySelectorAll('thead th:not(.row-num)');

  const ranges = [];
  const direct = new Map();

  bodyCells.forEach(td => {
    const srcRow = Number(td.dataset.srcRow);
    const srcCol = Number(td.dataset.srcCol);
    const rowSpan = Number(td.rowSpan || 1);
    const colSpan = Number(td.colSpan || 1);
    if (!Number.isFinite(srcRow) || !Number.isFinite(srcCol)) return;

    const rect = td.getBoundingClientRect();
    const relative = {
      left: rect.left - containerRect.left + tableContainer.scrollLeft,
      top: rect.top - containerRect.top + tableContainer.scrollTop,
      right: rect.right - containerRect.left + tableContainer.scrollLeft,
      bottom: rect.bottom - containerRect.top + tableContainer.scrollTop
    };

    const key = `${srcRow}:${srcCol}`;
    direct.set(key, relative);
    ranges.push({
      sRow: srcRow,
      eRow: srcRow + rowSpan - 1,
      sCol: srcCol,
      eCol: srcCol + colSpan - 1,
      rect: relative
    });
  });

  // 表头开启时，Excel 第 1 行映射到 thead
  if (headerToggle.checked && bodyStartRow > 0) {
    headerCells.forEach((th, idx) => {
      const rect = th.getBoundingClientRect();
      const relative = {
        left: rect.left - containerRect.left + tableContainer.scrollLeft,
        top: rect.top - containerRect.top + tableContainer.scrollTop,
        right: rect.right - containerRect.left + tableContainer.scrollLeft,
        bottom: rect.bottom - containerRect.top + tableContainer.scrollTop
      };
      const key = `0:${idx}`;
      if (!direct.has(key)) {
        direct.set(key, relative);
        ranges.push({ sRow: 0, eRow: 0, sCol: idx, eCol: idx, rect: relative });
      }
    });
  }

  return { direct, ranges };
}

function findCellRect(cellIndex, row, col) {
  const key = `${row}:${col}`;
  if (cellIndex.direct.has(key)) return cellIndex.direct.get(key);

  for (let i = 0; i < cellIndex.ranges.length; i++) {
    const r = cellIndex.ranges[i];
    if (row >= r.sRow && row <= r.eRow && col >= r.sCol && col <= r.eCol) {
      return r.rect;
    }
  }

  return null;
}

function parseA1(a1) {
  if (!a1) return null;
  const m = String(a1).toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  const col = lettersToCol(m[1]);
  const row = Number(m[2]) - 1;
  if (!Number.isFinite(col) || !Number.isFinite(row)) return null;
  return { row, col };
}

function lettersToCol(letters) {
  let out = 0;
  for (let i = 0; i < letters.length; i++) {
    out = out * 26 + (letters.charCodeAt(i) - 64);
  }
  return out - 1;
}

function buildMergeMeta(enableMergeRender) {
  const startMap = new Map();
  const coveredSet = new Set();

  if (!enableMergeRender || !currentMerges.length) {
    return { startMap, coveredSet };
  }

  currentMerges.forEach(m => {
    // 表头被隐藏时，跳过从表头开始的合并，避免错位
    if (m.s.r < bodyStartRow) return;
    if (m.s.c >= headers.length) return;

    const startRow = m.s.r;
    const endRow = m.e.r;
    const startCol = m.s.c;
    const endCol = Math.min(m.e.c, headers.length - 1);
    if (endCol < startCol) return;

    const rowspan = endRow - startRow + 1;
    const colspan = endCol - startCol + 1;

    startMap.set(`${startRow}:${startCol}`, { rowspan, colspan });

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (r === startRow && c === startCol) continue;
        coveredSet.add(`${r}:${c}`);
      }
    }
  });

  return { startMap, coveredSet };
}

function renderGraphicsPanel() {
  // 已按需求关闭页面上的“图形识别”面板展示。
  if (graphicsPanel) {
    graphicsPanel.style.display = 'none';
  }
}

function typeLabel(type) {
  const labels = {
    shape: '形状',
    picture: '图片',
    chart: '图表',
    connector: '连接符',
    group: '组合',
    unknown: '其他'
  };
  return labels[type] || labels.unknown;
}

async function extractDrawingObjectsFromXlsx(arrayBuffer) {
  const result = new Map();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const workbookXml = await readZipText(zip, 'xl/workbook.xml');
  const workbookRelsXml = await readZipText(zip, 'xl/_rels/workbook.xml.rels');
  const wbDoc = parseXmlSafe(workbookXml);
  const relDoc = parseXmlSafe(workbookRelsXml);

  const wbRelMap = buildRelationshipMap(relDoc);
  const sheetNodes = getElementsByLocalName(wbDoc, 'sheet');

  for (const sheetNode of sheetNodes) {
    const sheetName = sheetNode.getAttribute('name') || 'Sheet';
    const sheetRid = getAttributeByLocalName(sheetNode, 'id');
    const wsTarget = wbRelMap.get(sheetRid);
    if (!wsTarget) {
      result.set(sheetName, []);
      continue;
    }

    const worksheetPath = resolveZipPath('xl/workbook.xml', wsTarget);
    const worksheetXml = await readZipText(zip, worksheetPath);
    const wsDoc = parseXmlSafe(worksheetXml);

    const wsRelsPath = buildRelsPath(worksheetPath);
    const wsRelsXml = await readZipText(zip, wsRelsPath, true);
    const wsRelMap = wsRelsXml ? buildRelationshipMap(parseXmlSafe(wsRelsXml)) : new Map();

    const drawingNodes = getElementsByLocalName(wsDoc, 'drawing');
    const shapeList = [];

    for (const drawingNode of drawingNodes) {
      const drawingRid = getAttributeByLocalName(drawingNode, 'id');
      const drawingTarget = wsRelMap.get(drawingRid);
      if (!drawingTarget) continue;

      const drawingPath = resolveZipPath(worksheetPath, drawingTarget);
      const drawingXml = await readZipText(zip, drawingPath, true);
      if (!drawingXml) continue;
      const drawingDoc = parseXmlSafe(drawingXml);

      const drawingRelsPath = buildRelsPath(drawingPath);
      const drawingRelsXml = await readZipText(zip, drawingRelsPath, true);
      const drawingRelMap = drawingRelsXml ? buildRelationshipMap(parseXmlSafe(drawingRelsXml)) : new Map();

      const nodes = parseDrawingNodes(drawingDoc, drawingRelMap);
      for (const node of nodes) {
        if (node.type === 'chart' && node.chartRid) {
          try {
            const chartTarget = drawingRelMap.get(node.chartRid);
            if (chartTarget) {
              const chartPath = resolveZipPath(drawingPath, chartTarget);
              const chartXml = await readZipText(zip, chartPath, true);
              if (chartXml) {
                const chartDoc = parseXmlSafe(chartXml);
                const chartMeta = parseChartMeta(chartDoc);
                node.previewDataUrl = generateChartPreviewDataUrl(chartMeta);
                node.name = node.name || chartMeta.title || '图表';
                node.chartKind = chartMeta.kind;
              }
            }
          } catch (chartErr) {
            console.warn('图表预览生成失败:', chartErr);
          }
        }
        shapeList.push(node);
      }
    }

    result.set(sheetName, shapeList);
  }

  return result;
}

async function extractImagesByExcelJS(arrayBuffer) {
  const bySheet = new Map();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);

  wb.worksheets.forEach(ws => {
    const images = typeof ws.getImages === 'function' ? ws.getImages() : [];
    const list = [];

    images.forEach((imgRef, index) => {
      const imageId = imgRef.imageId;
      const image = wb.getImage(imageId);
      if (!image || !image.buffer) return;

      const ext = String(image.extension || 'png').toLowerCase();
      const mime = extToMime(ext);
      const base64 = arrayBufferToBase64(image.buffer);
      const dataUrl = `data:${mime};base64,${base64}`;

      const tl = imgRef.range?.tl || null;
      const br = imgRef.range?.br || null;

      const from = tl ? `${colToLetters(Math.floor(tl.col))}${Math.floor(tl.row) + 1}` : '';
      const to = br ? `${colToLetters(Math.ceil(br.col) - 1)}${Math.ceil(br.row)}` : '';

      list.push({
        type: 'picture',
        name: image.name || `图片 ${index + 1}`,
        from,
        to,
        dataUrl,
        source: 'exceljs'
      });
    });

    bySheet.set(ws.name, list);
  });

  return bySheet;
}

function mergeDrawingObjects(baseMap, imageMap) {
  const merged = new Map();
  const allSheets = new Set([...baseMap.keys(), ...imageMap.keys()]);

  allSheets.forEach(sheetName => {
    const base = [...(baseMap.get(sheetName) || [])];
    const imgs = imageMap.get(sheetName) || [];

    const baseNoPictures = base.filter(item => item.type !== 'picture');
    const mergedList = [...baseNoPictures, ...imgs];
    merged.set(sheetName, mergedList);
  });

  return merged;
}

async function extractCellStylesByExcelJS(arrayBuffer) {
  const bySheet = new Map();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);

  wb.worksheets.forEach(ws => {
    const styleMap = new Map();

    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const css = excelStyleToCss(cell.style || {});
        if (Object.keys(css).length) {
          styleMap.set(`${rowNumber - 1}:${colNumber - 1}`, css);
        }
      });
    });

    bySheet.set(ws.name, styleMap);
  });

  return bySheet;
}

function excelStyleToCss(style) {
  const css = {};

  const fill = style.fill;
  if (fill && fill.type === 'pattern') {
    const bg = excelColorToCss(fill.fgColor) || excelColorToCss(fill.bgColor);
    if (bg) css.backgroundColor = bg;
  }

  const font = style.font;
  if (font) {
    if (font.bold) css.fontWeight = '700';
    if (font.italic) css.fontStyle = 'italic';
    if (font.underline) css.textDecoration = 'underline';
    if (font.size) css.fontSize = `${font.size}px`;
    const color = excelColorToCss(font.color);
    if (color) css.color = color;
  }

  const alignment = style.alignment;
  if (alignment) {
    if (alignment.horizontal) css.textAlign = normalizeTextAlign(alignment.horizontal);
    if (alignment.vertical) css.verticalAlign = normalizeVerticalAlign(alignment.vertical);
    if (alignment.wrapText) css.whiteSpace = 'pre-wrap';
  }

  const border = style.border;
  if (border) {
    const borderCss = excelBorderToCss(border);
    Object.assign(css, borderCss);
  }

  return css;
}

function excelBorderToCss(border) {
  const css = {};
  const mapping = {
    top: 'borderTop',
    right: 'borderRight',
    bottom: 'borderBottom',
    left: 'borderLeft'
  };

  Object.keys(mapping).forEach(side => {
    const edge = border[side];
    if (!edge || !edge.style) return;
    const color = excelColorToCss(edge.color) || '#94a3b8';
    const width = /medium|thick|double/i.test(edge.style) ? '2px' : '1px';
    const line = /dashed/i.test(edge.style) ? 'dashed' : 'solid';
    css[mapping[side]] = `${width} ${line} ${color}`;
  });

  return css;
}

function excelColorToCss(colorObj) {
  if (!colorObj) return '';
  const argb = colorObj.argb || '';
  if (typeof argb !== 'string') return '';

  if (argb.length === 8) {
    const alpha = parseInt(argb.slice(0, 2), 16) / 255;
    const r = parseInt(argb.slice(2, 4), 16);
    const g = parseInt(argb.slice(4, 6), 16);
    const b = parseInt(argb.slice(6, 8), 16);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return '';
    if (alpha < 1) return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
    return `rgb(${r}, ${g}, ${b})`;
  }

  if (argb.length === 6) {
    const r = parseInt(argb.slice(0, 2), 16);
    const g = parseInt(argb.slice(2, 4), 16);
    const b = parseInt(argb.slice(4, 6), 16);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return '';
    return `rgb(${r}, ${g}, ${b})`;
  }

  return '';
}

function normalizeTextAlign(v) {
  const map = {
    center: 'center',
    left: 'left',
    right: 'right',
    justify: 'justify',
    fill: 'left',
    distributed: 'justify'
  };
  return map[v] || '';
}

function normalizeVerticalAlign(v) {
  const map = {
    top: 'top',
    middle: 'middle',
    center: 'middle',
    bottom: 'bottom',
    distributed: 'middle',
    justify: 'middle'
  };
  return map[v] || '';
}

function getCellStyle(sheetName, rowIdx, colIdx) {
  const map = cellStylesBySheet.get(sheetName);
  if (!map) return null;
  return map.get(`${rowIdx}:${colIdx}`) || null;
}

function applyExcelStyleToElement(el, styleObj) {
  if (!el || !styleObj) return;
  Object.keys(styleObj).forEach(k => {
    el.style[k] = styleObj[k];
  });
  el.classList.add('has-cell-style');
}

function extToMime(ext) {
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'bmp') return 'image/bmp';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'svg') return 'image/svg+xml';
  return 'image/png';
}

function arrayBufferToBase64(bufferLike) {
  const bytes = new Uint8Array(bufferLike);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, sub);
  }
  return btoa(binary);
}

function parseDrawingNodes(drawingDoc, drawingRelMap = new Map()) {
  const anchors = [
    ...getElementsByLocalName(drawingDoc, 'twoCellAnchor'),
    ...getElementsByLocalName(drawingDoc, 'oneCellAnchor'),
    ...getElementsByLocalName(drawingDoc, 'absoluteAnchor')
  ];

  const list = [];
  for (const anchor of anchors) {
    const shapeNode = firstChildByLocalName(anchor, ['sp', 'pic', 'graphicFrame', 'cxnSp', 'grpSp']);
    if (!shapeNode) continue;

    let type = 'unknown';
    if (shapeNode.localName === 'sp') type = 'shape';
    if (shapeNode.localName === 'pic') type = 'picture';
    if (shapeNode.localName === 'graphicFrame') type = 'chart';
    if (shapeNode.localName === 'cxnSp') type = 'connector';
    if (shapeNode.localName === 'grpSp') type = 'group';

    const cNvPr = firstDescendantByLocalName(shapeNode, 'cNvPr');
    const name = cNvPr?.getAttribute('name') || cNvPr?.getAttribute('descr') || '';

    const fromNode = firstChildByLocalName(anchor, ['from']);
    const toNode = firstChildByLocalName(anchor, ['to']);
    const from = fromNode ? anchorNodeToA1(fromNode) : '';
    const to = toNode ? anchorNodeToA1(toNode) : '';

    let chartRid = '';
    if (type === 'chart') {
      const chartNode = firstDescendantByLocalName(shapeNode, 'chart');
      chartRid = getAttributeByLocalName(chartNode, 'id');
      if (!chartRid) {
        // 兼容部分文档结构：graphicData 下第一个子节点即 chart
        const chartLike = firstDescendantByLocalName(shapeNode, 'graphicData');
        const maybeChart = chartLike ? firstDescendantByLocalName(chartLike, 'chart') : null;
        chartRid = getAttributeByLocalName(maybeChart, 'id');
      }
      if (!chartRid) {
        // 兜底：如果绘图关系中只有一个 chart，也尝试取该关系
        const relCandidates = [...drawingRelMap.entries()].filter(([, t]) => /\/charts\//i.test(t));
        if (relCandidates.length === 1) chartRid = relCandidates[0][0];
      }
    }

    list.push({ type, name, from, to, chartRid });
  }

  return list;
}

function parseChartMeta(chartDoc) {
  const titleNode = firstDescendantByLocalName(chartDoc, 'tx');
  const title = collectNodeTexts(titleNode).join('').trim();

  const kind = detectChartKind(chartDoc);
  const series = parseChartSeries(chartDoc);
  return { kind, title, series };
}

function detectChartKind(chartDoc) {
  const kinds = ['barChart', 'lineChart', 'pieChart', 'doughnutChart', 'areaChart', 'scatterChart', 'radarChart'];
  for (const k of kinds) {
    if (getElementsByLocalName(chartDoc, k).length) return k;
  }
  return 'unknown';
}

function parseChartSeries(chartDoc) {
  const serNodes = getElementsByLocalName(chartDoc, 'ser');
  const list = [];

  serNodes.forEach((serNode, idx) => {
    const nameNode = firstDescendantByLocalName(serNode, 'tx');
    const name = collectNodeTexts(nameNode).join('').trim() || `系列${idx + 1}`;

    const values = extractValuesFromSeriesNode(serNode);
    const categories = extractCategoriesFromSeriesNode(serNode, values.length);

    if (values.length) {
      list.push({ name, values, categories });
    }
  });

  return list;
}

function extractValuesFromSeriesNode(serNode) {
  const out = [];
  const valNode = firstDescendantByLocalName(serNode, 'val') || firstDescendantByLocalName(serNode, 'yVal');
  if (!valNode) return out;

  const numCache = firstDescendantByLocalName(valNode, 'numCache');
  const strCache = firstDescendantByLocalName(valNode, 'strCache');
  const cacheNode = numCache || strCache;
  if (!cacheNode) return out;

  const ptNodes = getElementsByLocalName(cacheNode, 'pt');
  ptNodes.forEach(pt => {
    const vNode = firstDescendantByLocalName(pt, 'v');
    const raw = (vNode?.textContent || '').trim();
    const n = Number(raw);
    out.push(Number.isFinite(n) ? n : 0);
  });
  return out;
}

function extractCategoriesFromSeriesNode(serNode, fallbackLen) {
  const out = [];
  const catNode = firstDescendantByLocalName(serNode, 'cat') || firstDescendantByLocalName(serNode, 'xVal');
  if (!catNode) {
    return Array.from({ length: fallbackLen }, (_, i) => `P${i + 1}`);
  }

  const cacheNode = firstDescendantByLocalName(catNode, 'strCache')
    || firstDescendantByLocalName(catNode, 'numCache');

  if (!cacheNode) {
    return Array.from({ length: fallbackLen }, (_, i) => `P${i + 1}`);
  }

  const ptNodes = getElementsByLocalName(cacheNode, 'pt');
  ptNodes.forEach(pt => {
    const vNode = firstDescendantByLocalName(pt, 'v');
    out.push((vNode?.textContent || '').trim());
  });

  if (!out.length) {
    return Array.from({ length: fallbackLen }, (_, i) => `P${i + 1}`);
  }
  return out;
}

function generateChartPreviewDataUrl(chartMeta) {
  const width = 280;
  const height = 170;
  const bg = '#ffffff';
  const border = '#e2e8f0';

  const title = sanitizeText(chartMeta.title || '图表预览');
  const kind = chartMeta.kind || 'unknown';
  const firstSeries = chartMeta.series[0] || { values: [], categories: [] };
  const values = (firstSeries.values || []).slice(0, 12);
  const cats = (firstSeries.categories || []).slice(0, values.length);

  let chartBody = '';
  if (!values.length) {
    chartBody = '<text x="140" y="94" text-anchor="middle" font-size="12" fill="#64748b">无可用图表数据</text>';
  } else if (kind === 'pieChart' || kind === 'doughnutChart') {
    chartBody = drawPieSvg(values, kind === 'doughnutChart');
  } else if (kind === 'lineChart' || kind === 'scatterChart' || kind === 'radarChart') {
    chartBody = drawLineSvg(values, cats);
  } else {
    chartBody = drawBarSvg(values, cats);
  }

  const kindLabel = sanitizeText(chartKindToLabel(kind));
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="${bg}" stroke="${border}"/>
  <text x="10" y="18" font-size="12" font-weight="600" fill="#0f172a">${title}</text>
  <text x="10" y="34" font-size="11" fill="#64748b">${kindLabel}（近似预览）</text>
  ${chartBody}
</svg>`.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function drawBarSvg(values, cats) {
  const x0 = 22;
  const y0 = 145;
  const w = 236;
  const h = 95;
  const max = Math.max(...values, 1);
  const barW = Math.max(8, Math.floor((w - values.length * 6) / values.length));
  const gap = Math.max(4, Math.floor((w - barW * values.length) / Math.max(1, values.length - 1)));
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

  let g = `<line x1="${x0}" y1="${y0}" x2="${x0 + w}" y2="${y0}" stroke="#94a3b8" stroke-width="1"/>`;
  values.forEach((v, i) => {
    const bh = Math.max(2, (v / max) * h);
    const x = x0 + i * (barW + gap);
    const y = y0 - bh;
    const c = colors[i % colors.length];
    const label = sanitizeText(String(cats[i] || `P${i + 1}`)).slice(0, 4);
    g += `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="2" fill="${c}" opacity="0.85"/>`;
    g += `<text x="${x + barW / 2}" y="${y0 + 13}" text-anchor="middle" font-size="9" fill="#64748b">${label}</text>`;
  });
  return g;
}

function drawLineSvg(values, cats) {
  const x0 = 22;
  const y0 = 145;
  const w = 236;
  const h = 95;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const step = values.length > 1 ? w / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = x0 + i * step;
    const y = y0 - ((v - min) / range) * h;
    return { x, y };
  });

  const poly = points.map(p => `${p.x},${p.y}`).join(' ');
  let g = `<line x1="${x0}" y1="${y0}" x2="${x0 + w}" y2="${y0}" stroke="#94a3b8" stroke-width="1"/>`;
  g += `<polyline points="${poly}" fill="none" stroke="#3b82f6" stroke-width="2"/>`;
  points.forEach((p, i) => {
    const label = sanitizeText(String(cats[i] || `P${i + 1}`)).slice(0, 4);
    g += `<circle cx="${p.x}" cy="${p.y}" r="2.6" fill="#1d4ed8"/>`;
    g += `<text x="${p.x}" y="${y0 + 13}" text-anchor="middle" font-size="9" fill="#64748b">${label}</text>`;
  });
  return g;
}

function drawPieSvg(values, doughnut = false) {
  const total = values.reduce((s, n) => s + Math.max(0, n), 0) || 1;
  const cx = 140;
  const cy = 98;
  const r = 54;
  const innerR = doughnut ? 26 : 0;
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#14b8a6'];

  let a0 = -Math.PI / 2;
  let g = '';
  values.forEach((v, i) => {
    const ratio = Math.max(0, v) / total;
    const a1 = a0 + ratio * Math.PI * 2;
    g += pieSlicePath(cx, cy, r, a0, a1, colors[i % colors.length], innerR);
    a0 = a1;
  });
  return g;
}

function pieSlicePath(cx, cy, r, start, end, color, innerR = 0) {
  const x1 = cx + Math.cos(start) * r;
  const y1 = cy + Math.sin(start) * r;
  const x2 = cx + Math.cos(end) * r;
  const y2 = cy + Math.sin(end) * r;
  const large = end - start > Math.PI ? 1 : 0;

  if (!innerR) {
    return `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${color}" opacity="0.9"/>`;
  }

  const ix1 = cx + Math.cos(end) * innerR;
  const iy1 = cy + Math.sin(end) * innerR;
  const ix2 = cx + Math.cos(start) * innerR;
  const iy2 = cy + Math.sin(start) * innerR;
  return `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2} Z" fill="${color}" opacity="0.9"/>`;
}

function chartKindToLabel(kind) {
  const map = {
    barChart: '柱状图',
    lineChart: '折线图',
    pieChart: '饼图',
    doughnutChart: '环形图',
    areaChart: '面积图',
    scatterChart: '散点图',
    radarChart: '雷达图',
    unknown: '图表'
  };
  return map[kind] || map.unknown;
}

function sanitizeText(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function collectNodeTexts(node) {
  if (!node) return [];
  const out = [];
  const all = node.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === 't') {
      out.push(all[i].textContent || '');
    }
  }
  return out;
}

function anchorNodeToA1(node) {
  const colNode = firstChildByLocalName(node, ['col']);
  const rowNode = firstChildByLocalName(node, ['row']);
  const col = Number(colNode?.textContent ?? '0');
  const row = Number(rowNode?.textContent ?? '0');
  if (!Number.isFinite(col) || !Number.isFinite(row)) return '';
  return `${colToLetters(col)}${row + 1}`;
}

function colToLetters(colIndex) {
  let n = colIndex + 1;
  let out = '';
  while (n > 0) {
    const mod = (n - 1) % 26;
    out = String.fromCharCode(65 + mod) + out;
    n = Math.floor((n - mod) / 26);
  }
  return out || 'A';
}

function getElementsByLocalName(root, localName) {
  const out = [];
  const all = root.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === localName) out.push(all[i]);
  }
  return out;
}

function firstChildByLocalName(node, names) {
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 1 && names.includes(child.localName)) {
      return child;
    }
  }
  return null;
}

function firstDescendantByLocalName(node, localName) {
  const all = node.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === localName) return all[i];
  }
  return null;
}

function getAttributeByLocalName(node, localName) {
  if (!node || !node.attributes) return '';
  for (let i = 0; i < node.attributes.length; i++) {
    const attr = node.attributes[i];
    if (attr.localName === localName) return attr.value;
  }
  return '';
}

function parseXmlSafe(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  const parseErrors = doc.getElementsByTagName('parsererror');
  if (parseErrors.length) {
    throw new Error('XML 解析失败');
  }
  return doc;
}

function buildRelationshipMap(relDoc) {
  const map = new Map();
  const relNodes = getElementsByLocalName(relDoc, 'Relationship');
  relNodes.forEach(rel => {
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) map.set(id, target);
  });
  return map;
}

function buildRelsPath(filePath) {
  const parts = filePath.split('/');
  const fileName = parts.pop();
  const dir = parts.join('/');
  return `${dir}/_rels/${fileName}.rels`;
}

function resolveZipPath(basePath, targetPath) {
  if (!targetPath) return '';
  if (/^\w+:/.test(targetPath)) return targetPath;

  const normalizedBase = basePath.replace(/\\/g, '/');
  const baseDir = normalizedBase.includes('/')
    ? normalizedBase.slice(0, normalizedBase.lastIndexOf('/'))
    : '';

  const joined = targetPath.startsWith('/')
    ? targetPath.slice(1)
    : `${baseDir}/${targetPath}`;

  const stack = [];
  joined.split('/').forEach(p => {
    if (!p || p === '.') return;
    if (p === '..') {
      stack.pop();
      return;
    }
    stack.push(p);
  });

  return stack.join('/');
}

async function readZipText(zip, path, optional = false) {
  const file = zip.file(path);
  if (!file) {
    if (optional) return '';
    throw new Error(`缺少文件: ${path}`);
  }
  return file.async('string');
}

// ─── 工具函数 ─────────────────────────────────────────

function highlightText(text, keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function showLoading(show) {
  loadingEl.style.display = show ? 'flex' : 'none';
}

function showEmpty(show) {
  emptyStateEl.style.display = show ? 'block' : 'none';
}

function clearAll() {
  workbook = null;
  activeSheet = '';
  allRows = [];
  headers = [];
  currentMerges = [];
  bodyStartRow = 0;
  drawingObjectsBySheet = new Map();
  cellStylesBySheet = new Map();
  currentFileExt = '';
  sortState = { col: -1, asc: true };
  searchKeyword = '';

  dropzone.style.display = 'block';
  fileInfoBar.style.display = 'none';
  sheetTabsEl.style.display = 'none';
  toolbar.style.display = 'none';
  tableWrap.style.display = 'none';
  if (graphicsPanel) graphicsPanel.style.display = 'none';
  statusBar.style.display = 'none';
  emptyStateEl.style.display = 'none';
  btnExport.style.display = 'none';
  btnClear.style.display = 'none';
  tableContainer.innerHTML = '';
  searchInput.value = '';
}

// ─── 导出 CSV ─────────────────────────────────────────

function exportCSV() {
  if (!workbook || !activeSheet) return;

  const ws = workbook.Sheets[activeSheet];
  const csvStr = XLSX.utils.sheet_to_csv(ws);

  const blob = new Blob(['\uFEFF' + csvStr], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const baseName = originalFileName.replace(/\.[^.]+$/, '');
  a.href     = url;
  a.download = `${baseName}_${activeSheet}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
