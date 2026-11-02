const leftTextEl = document.getElementById('leftText');
const rightTextEl = document.getElementById('rightText');
const compareBtn = document.getElementById('compareBtn');
const clearBtn = document.getElementById('clearBtn');
const swapBtn = document.getElementById('swapBtn');
const sampleBtn = document.getElementById('sampleBtn');
const copyBtn = document.getElementById('copyBtn');
const exportBtn = document.getElementById('exportBtn');
const ignoreWhitespaceEl = document.getElementById('ignoreWhitespace');
const ignoreCaseEl = document.getElementById('ignoreCase');
const lineModeEl = document.getElementById('lineMode');
const summaryBoxEl = document.getElementById('summaryBox');
const diffOutputEl = document.getElementById('diffOutput');
const dropZones = document.querySelectorAll('.dropzone');

const sampleLeft = `项目计划：
- 完成登录模块
- 优化首页加载速度
- 修复搜索结果分页问题
- 补充测试用例`;

const sampleRight = `项目计划：
- 完成登录模块
- 优化首页加载速度
- 修复搜索结果分页问题
- 增加接口监控
- 补充测试用例
- 完成用户反馈回收`;

function normalizeText(text, options) {
    let value = text ?? '';

    if (options.ignoreCase) {
        value = value.toLowerCase();
    }

    if (options.ignoreWhitespace) {
        if (options.lineMode) {
            value = value
                .split(/\r?\n/)
                .map(line => line.replace(/\s+/g, ' ').trim())
                .join('\n');
        } else {
            value = value.replace(/\s+/g, ' ').trim();
        }
    }

    return value;
}

function splitLines(text) {
    return (text ?? '').split(/\r?\n/);
}

function buildInlineDiff(leftText, rightText) {
    const left = leftText ?? '';
    const right = rightText ?? '';
    const n = left.length;
    const m = right.length;
    const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

    for (let i = n - 1; i >= 0; i -= 1) {
        for (let j = m - 1; j >= 0; j -= 1) {
            if (left[i] === right[j]) {
                dp[i][j] = dp[i + 1][j + 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }
    }

    const result = [];
    let i = 0;
    let j = 0;

    while (i < n && j < m) {
        if (left[i] === right[j]) {
            result.push({ type: 'equal', text: left[i] });
            i += 1;
            j += 1;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            result.push({ type: 'removed', text: left[i] });
            i += 1;
        } else {
            result.push({ type: 'added', text: right[j] });
            j += 1;
        }
    }

    while (i < n) {
        result.push({ type: 'removed', text: left[i] });
        i += 1;
    }

    while (j < m) {
        result.push({ type: 'added', text: right[j] });
        j += 1;
    }

    return result;
}

function renderDiff(rows) {
    diffOutputEl.innerHTML = '';

    if (!rows || rows.length === 0) {
        diffOutputEl.innerHTML = '<div class="diff-empty">暂无内容</div>';
        return;
    }

    rows.forEach((row) => {
        const lineEl = document.createElement('div');
        lineEl.className = 'diff-line';

        const lineText = document.createElement('div');
        lineText.className = 'diff-line-text';

        const segments = buildInlineDiff(row.left, row.right);

        if (segments.length === 0) {
            lineText.textContent = row.left || row.right || ' ';
            lineEl.appendChild(lineText);
            diffOutputEl.appendChild(lineEl);
            return;
        }

        segments.forEach((segment) => {
            const span = document.createElement('span');
            span.className = `diff-segment ${segment.type}`;
            span.textContent = segment.text || ' ';
            lineText.appendChild(span);
        });

        lineEl.appendChild(lineText);
        diffOutputEl.appendChild(lineEl);
    });
}

function computeSummary(rows) {
    let added = 0;
    let removed = 0;
    let unchanged = 0;

    rows.forEach((row) => {
        const segments = buildInlineDiff(row.left, row.right);
        segments.forEach((segment) => {
            if (segment.type === 'added') {
                added += 1;
            } else if (segment.type === 'removed') {
                removed += 1;
            } else {
                unchanged += 1;
            }
        });
    });

    return { added, removed, unchanged };
}

function compareText() {
    const leftText = leftTextEl.value;
    const rightText = rightTextEl.value;

    if (!leftText && !rightText) {
        summaryBoxEl.textContent = '请输入两段文本后再进行比较。';
        diffOutputEl.innerHTML = '<div class="diff-empty">暂无内容</div>';
        return;
    }

    const options = {
        ignoreWhitespace: ignoreWhitespaceEl.checked,
        ignoreCase: ignoreCaseEl.checked,
        lineMode: lineModeEl.checked,
    };

    const normalizedLeft = normalizeText(leftText, options);
    const normalizedRight = normalizeText(rightText, options);
    const leftLines = splitLines(normalizedLeft);
    const rightLines = splitLines(normalizedRight);
    const maxLength = Math.max(leftLines.length, rightLines.length);

    const rows = [];
    for (let index = 0; index < maxLength; index += 1) {
        const leftLine = leftLines[index] ?? '';
        const rightLine = rightLines[index] ?? '';
        rows.push({
            left: leftLine,
            right: rightLine,
            type: leftLine === rightLine ? 'equal' : 'changed'
        });
    }

    const summary = computeSummary(rows);
    summaryBoxEl.textContent = `新增 ${summary.added} • 删除 ${summary.removed} • 保持 ${summary.unchanged}`;
    renderDiff(rows);
}

function loadSample() {
    leftTextEl.value = sampleLeft;
    rightTextEl.value = sampleRight;
    compareText();
}

function clearText() {
    leftTextEl.value = '';
    rightTextEl.value = '';
    summaryBoxEl.textContent = '已清空输入内容。';
    diffOutputEl.innerHTML = '<div class="diff-empty">暂无内容</div>';
}

function swapText() {
    const temp = leftTextEl.value;
    leftTextEl.value = rightTextEl.value;
    rightTextEl.value = temp;
    compareText();
}

async function copyResult() {
    const text = diffOutputEl.innerText || diffOutputEl.textContent || '';
    if (!text.trim()) {
        alert('当前没有可复制的比较结果。');
        return;
    }

    try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = '已复制';
        setTimeout(() => {
            copyBtn.textContent = '复制结果';
        }, 1200);
    } catch (error) {
        alert('复制失败，请手动选择文本复制。');
    }
}

function exportMergedResult() {
    const mergedText = rightTextEl.value || leftTextEl.value || '';
    const blob = new Blob([mergedText], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    const now = new Date();
    const fileName = `merged-result-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.txt`;

    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = () => reject(new Error('读取文件失败'));
        reader.readAsText(file);
    });
}

function bindDropZone(zone) {
    const side = zone.dataset.side;

    const handleDrop = async (event) => {
        event.preventDefault();
        zone.classList.remove('is-dragover');

        const file = event.dataTransfer?.files?.[0];
        if (!file) return;

        try {
            const text = await readFileAsText(file);
            if (side === 'left') {
                leftTextEl.value = text;
            } else {
                rightTextEl.value = text;
            }
            compareText();
        } catch (error) {
            alert('文件读取失败，请重试。');
        }
    };

    zone.addEventListener('dragover', (event) => {
        event.preventDefault();
        zone.classList.add('is-dragover');
    });

    zone.addEventListener('dragenter', (event) => {
        event.preventDefault();
        zone.classList.add('is-dragover');
    });

    zone.addEventListener('dragleave', (event) => {
        if (!zone.contains(event.relatedTarget)) {
            zone.classList.remove('is-dragover');
        }
    });

    zone.addEventListener('drop', handleDrop);
}

compareBtn.addEventListener('click', compareText);
clearBtn.addEventListener('click', clearText);
swapBtn.addEventListener('click', swapText);
sampleBtn.addEventListener('click', loadSample);
copyBtn.addEventListener('click', copyResult);
exportBtn.addEventListener('click', exportMergedResult);

leftTextEl.addEventListener('input', compareText);
rightTextEl.addEventListener('input', compareText);
ignoreWhitespaceEl.addEventListener('change', compareText);
ignoreCaseEl.addEventListener('change', compareText);
lineModeEl.addEventListener('change', compareText);

dropZones.forEach(bindDropZone);

window.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        compareText();
    }
});

loadSample();
