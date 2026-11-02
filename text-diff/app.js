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

function buildLineDiff(leftLines, rightLines) {
    const rows = leftLines.length + 1;
    const cols = rightLines.length + 1;
    const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

    for (let i = leftLines.length - 1; i >= 0; i--) {
        for (let j = rightLines.length - 1; j >= 0; j--) {
            if (leftLines[i] === rightLines[j]) {
                dp[i][j] = dp[i + 1][j + 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }
    }

    const blocks = [];
    let i = 0;
    let j = 0;
    let leftLine = 1;
    let rightLine = 1;

    while (i < leftLines.length && j < rightLines.length) {
        if (leftLines[i] === rightLines[j]) {
            blocks.push({
                type: 'equal',
                left: leftLines[i],
                right: rightLines[j],
                leftLine,
                rightLine
            });
            i += 1;
            j += 1;
            leftLine += 1;
            rightLine += 1;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            blocks.push({
                type: 'remove',
                left: leftLines[i],
                right: '',
                leftLine,
                rightLine: null
            });
            i += 1;
            leftLine += 1;
        } else {
            blocks.push({
                type: 'add',
                left: '',
                right: rightLines[j],
                leftLine: null,
                rightLine
            });
            j += 1;
            rightLine += 1;
        }
    }

    while (i < leftLines.length) {
        blocks.push({
            type: 'remove',
            left: leftLines[i],
            right: '',
            leftLine,
            rightLine: null
        });
        i += 1;
        leftLine += 1;
    }

    while (j < rightLines.length) {
        blocks.push({
            type: 'add',
            left: '',
            right: rightLines[j],
            leftLine: null,
            rightLine
        });
        j += 1;
        rightLine += 1;
    }

    return blocks;
}

function buildUnifiedDiff(leftText, rightText, options) {
    const leftLines = splitLines(leftText);
    const rightLines = splitLines(rightText);

    if (options.lineMode) {
        return buildLineDiff(leftLines, rightLines);
    }

    const blocks = [];
    const maxLength = Math.max(leftLines.length, rightLines.length);

    for (let index = 0; index < maxLength; index += 1) {
        const leftValue = leftLines[index] ?? '';
        const rightValue = rightLines[index] ?? '';

        if (leftValue === rightValue) {
            blocks.push({
                type: 'equal',
                left: leftValue,
                right: rightValue,
                leftLine: index + 1,
                rightLine: index + 1
            });
            continue;
        }

        if (leftValue && rightValue) {
            blocks.push({
                type: 'remove',
                left: leftValue,
                right: rightValue,
                leftLine: index + 1,
                rightLine: index + 1
            });
            blocks.push({
                type: 'add',
                left: leftValue,
                right: rightValue,
                leftLine: index + 1,
                rightLine: index + 1
            });
            continue;
        }

        if (!leftValue) {
            blocks.push({
                type: 'add',
                left: '',
                right: rightValue,
                leftLine: null,
                rightLine: index + 1
            });
        }

        if (!rightValue) {
            blocks.push({
                type: 'remove',
                left: leftValue,
                right: '',
                leftLine: index + 1,
                rightLine: null
            });
        }
    }

    return blocks;
}

function renderDiff(blocks) {
    diffOutputEl.innerHTML = '';

    if (!blocks || blocks.length === 0) {
        diffOutputEl.innerHTML = `
            <div class="diff-row empty">
                <div class="diff-line-no"> </div>
                <div class="diff-content">暂无内容</div>
            </div>
        `;
        return;
    }

    blocks.forEach((block) => {
        const row = document.createElement('div');
        row.className = `diff-row ${block.type}`;

        const lineNo = document.createElement('div');
        lineNo.className = 'diff-line-no';
        lineNo.textContent = block.type === 'remove' ? (block.leftLine ?? ' ') : (block.rightLine ?? block.leftLine ?? ' ');

        const content = document.createElement('div');
        content.className = 'diff-content';

        const badge = document.createElement('span');
        badge.className = 'diff-badge';
        badge.textContent = block.type === 'add' ? '+' : block.type === 'remove' ? '−' : ' ';

        const text = document.createElement('span');
        text.className = 'diff-text';
        if (block.type === 'add') {
            text.textContent = `+ ${block.right ?? ''}`;
        } else if (block.type === 'remove') {
            text.textContent = `- ${block.left ?? ''}`;
        } else {
            text.textContent = `  ${block.left ?? block.right ?? ''}`;
        }

        content.appendChild(badge);
        content.appendChild(text);

        row.appendChild(lineNo);
        row.appendChild(content);
        diffOutputEl.appendChild(row);
    });
}

function computeSummary(blocks) {
    let added = 0;
    let removed = 0;
    let unchanged = 0;

    blocks.forEach((block) => {
        if (block.type === 'add') {
            added += 1;
        } else if (block.type === 'remove') {
            removed += 1;
        } else {
            unchanged += 1;
        }
    });

    return { added, removed, unchanged };
}

function compareText() {
    const leftText = leftTextEl.value;
    const rightText = rightTextEl.value;

    if (!leftText && !rightText) {
        summaryBoxEl.textContent = '请输入两段文本后再进行比较。';
        diffOutputEl.innerHTML = `
            <div class="diff-row empty">
                <div class="diff-line-no"> </div>
                <div class="diff-content">暂无内容</div>
            </div>
        `;
        return;
    }

    const options = {
        ignoreWhitespace: ignoreWhitespaceEl.checked,
        ignoreCase: ignoreCaseEl.checked,
        lineMode: lineModeEl.checked,
    };

    const leftValue = normalizeText(leftText, options);
    const rightValue = normalizeText(rightText, options);
    const blocks = buildUnifiedDiff(leftValue, rightValue, options);

    const summary = computeSummary(blocks);
    summaryBoxEl.textContent = `新增 ${summary.added} • 删除 ${summary.removed} • 保持 ${summary.unchanged}`;
    renderDiff(blocks);
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
    diffOutputEl.innerHTML = `
        <div class="diff-row empty">
            <div class="diff-line-no"> </div>
            <div class="diff-content">暂无内容</div>
        </div>
    `;
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
