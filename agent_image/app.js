// --- 1. 配置与状态管理 ---
const CONFIG = {
    API_URL: 'https://agentapi.baidu.com/assistant/conversation',
    APP_ID: '',
    SECRET_KEY: ''
};

const AUTH_STORAGE_KEY = 'baidu_agent_auth_v1';
const AUTH_EXPIRE_MS = 2 * 60 * 60 * 1000; // 2小时

// 固定字符串：4次 btoa 后的密文
const FIXED_ENCODED = 'VjFaaQyUXhTbFZTYTNSUFlUTkNUbHBWVlRWbFZscFlaRVJLYUZaV1NucFZhazVUV1ZVeFIxTnNhRk5UUmtsNVZURmtiMkZ0VWxkU2FtaHFVbXRLTVZsVVFqUlVWazVaVjJ0S1dGSnRVbUZaYlRGR1RURmtSV0ZJU2xWTlIyZDZXVmR3YTJWc2JGVlZia0pzWWxVMWFGWkZWbEpRVVQwOQ==';

const state = {
    threadId: '',
    isLoading: false,
    isAuthed: false,
    messageFullscreen: {
        visible: false,
        text: '',
        useMarkdown: false
    },
    preview: {
        visible: false,
        urls: [],
        index: 0,
        scale: 1,
        minScale: 0.2,
        maxScale: 5,
        scaleStep: 0.2
    }
};

// --- 2. DOM 元素引用 ---
const elements = {
    chatWrapper: document.querySelector('.chat-wrapper'),
    messageList: document.getElementById('messageList'),
    inputBox: document.getElementById('inputBox'),
    sendBtn: document.getElementById('sendBtn'),
    authMask: document.getElementById('authMask'),
    tokenInput: document.getElementById('tokenInput'),
    tokenSubmitBtn: document.getElementById('tokenSubmitBtn'),
    authError: document.getElementById('authError'),
    messageFullscreenMask: null,
    messageFullscreenBody: null,
    messageFullscreenCloseBtn: null,
    previewMask: null,
    previewStage: null,
    previewImage: null,
    previewCounter: null,
    previewPrevBtn: null,
    previewNextBtn: null,
    previewCloseBtn: null,
    previewZoomInBtn: null,
    previewZoomOutBtn: null,
    previewZoomResetBtn: null
};

// --- 3. 鉴权逻辑 ---
function lockUI() {
    elements.chatWrapper.classList.add('locked');
    elements.inputBox.disabled = true;
    elements.sendBtn.disabled = true;
}

function unlockUI() {
    elements.chatWrapper.classList.remove('locked');
    elements.inputBox.disabled = false;
    elements.sendBtn.disabled = false;
}

function showAuthMask(message = '') {
    elements.authMask.classList.add('show');
    elements.authError.textContent = message;
    elements.tokenInput.value = '';
    setTimeout(() => elements.tokenInput.focus(), 20);
}

function hideAuthMask() {
    elements.authMask.classList.remove('show');
    elements.authError.textContent = '';
}

function saveAuthToken(token) {
    const payload = {
        token,
        expiresAt: Date.now() + AUTH_EXPIRE_MS
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
}

function clearAuthToken() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
}

function readAuthToken() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        if (!parsed?.token || !parsed?.expiresAt) {
            clearAuthToken();
            return null;
        }

        if (Date.now() > parsed.expiresAt) {
            clearAuthToken();
            return null;
        }

        return parsed.token;
    } catch (err) {
        clearAuthToken();
        return null;
    }
}

function insertAt(str, index, char) {
    const i = Math.max(0, Math.min(index, str.length));
    return str.slice(0, i) + char + str.slice(i);
}

function decodeBase64NTimes(base64Text, count) {
    let result = base64Text;
    for (let i = 0; i < count; i += 1) {
        result = atob(result);
    }
    return result;
}

function resolveCredentialsByToken(token) {
    if (!token || token.length < 3) {
        throw new Error('token格式无效');
    }

    const insertChar = token[0];
    const position = Number(token[1]);
    const decodeTimes = Number(token[2]);

    if (Number.isNaN(position) || Number.isNaN(decodeTimes) || position < 1 || decodeTimes < 1) {
        throw new Error('token格式无效');
    }

    // 按要求：token 字符加入固定字符串
    const withToken = insertAt(FIXED_ENCODED, position - 1, insertChar);

    // 还原出可解密串（将插入位移除），再进行 atob 解密
    //const normalized = withToken.slice(0, position - 1) + withToken.slice(position);
    //const plaintext = decodeBase64NTimes(normalized, decodeTimes);
    const plaintext = decodeBase64NTimes(withToken, decodeTimes);

    const parts = plaintext.split('|');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error('token不正确');
    }

    return {
        appId: parts[0],
        secretKey: parts[1]
    };
}

function activateByToken(token, shouldPersist) {
    const creds = resolveCredentialsByToken(token);
    CONFIG.APP_ID = creds.appId;
    CONFIG.SECRET_KEY = creds.secretKey;
    state.isAuthed = true;

    if (shouldPersist) {
        saveAuthToken(token);
    }

    hideAuthMask();
    unlockUI();
    elements.inputBox.focus();
}

function initAuth() {
    lockUI();

    const savedToken = readAuthToken();
    if (savedToken) {
        try {
            activateByToken(savedToken, false);
            return;
        } catch (err) {
            clearAuthToken();
        }
    }

    showAuthMask();
}

function handleTokenSubmit() {
    const token = elements.tokenInput.value.trim() || 'm64';
    try {
        activateByToken(token, true);
    } catch (err) {
        elements.authError.textContent = '口令无效，请重新输入。';
    }
}

// --- 4. 聊天功能 ---

function appendMessage(text, sender) {
    const row = document.createElement('div');
    row.className = `msg-row ${sender}`;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    const actionBar = createBubbleActionBar();
    const content = document.createElement('div');
    content.className = 'answer-text is-plain';
    content.textContent = text;

    actionBar.expandBtn.addEventListener('click', () => {
        openMessageFullscreen(row);
    });

    bubble.appendChild(actionBar.container);
    bubble.appendChild(content);

    row.appendChild(bubble);
    elements.messageList.appendChild(row);
    elements.messageList.scrollTop = elements.messageList.scrollHeight;
}

function createBotRichMessage() {
    const row = document.createElement('div');
    row.className = 'msg-row bot';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    const actionBar = createBubbleActionBar();

    const answerText = document.createElement('div');
    answerText.className = 'answer-text';

    const thinkingPanel = document.createElement('div');
    thinkingPanel.className = 'thinking-panel';
    thinkingPanel.innerHTML = '<div class="thinking-title">思考过程</div><div class="thinking-body"></div>';

    const imageList = document.createElement('div');
    imageList.className = 'bot-images';

    bubble.appendChild(actionBar.container);
    bubble.appendChild(answerText);
    bubble.appendChild(thinkingPanel);
    bubble.appendChild(imageList);
    row.appendChild(bubble);
    elements.messageList.appendChild(row);
    elements.messageList.scrollTop = elements.messageList.scrollHeight;

    return {
        row,
        bubble,
        answerText,
        thinkingPanel,
        thinkingBody: thinkingPanel.querySelector('.thinking-body'),
        imageList,
        expandBtn: actionBar.expandBtn
    };
}

function createBubbleActionBar() {
    const container = document.createElement('div');
    container.className = 'bubble-actions';

    const expandBtn = document.createElement('button');
    expandBtn.type = 'button';
    expandBtn.className = 'bubble-expand-btn';
    expandBtn.setAttribute('aria-label', '全屏查看');
    expandBtn.title = '全屏查看';
    expandBtn.textContent = '⤢';

    container.appendChild(expandBtn);

    return { container, expandBtn };
}

function renderThinking(thinkingBody, toolsStatus = []) {
    thinkingBody.innerHTML = '';
    toolsStatus.forEach(item => {
        const line = document.createElement('div');
        line.className = 'thinking-item';

        const status = document.createElement('span');
        status.className = 'thinking-status';
        const statusMap = { ing: '进行中', finish: '完成', error: '失败' };
        status.textContent = statusMap[item.status] || (item.status || '状态');

        const text = document.createElement('span');
        const title = item.title || item.toolName || '处理中';
        const desc = item.description ? `：${item.description}` : '';
        text.textContent = `${title}${desc}`;

        line.appendChild(status);
        line.appendChild(text);
        thinkingBody.appendChild(line);
    });
}

function toggleLoading(show) {
    if (show) {
        const row = document.createElement('div');
        row.id = 'loadingMsg';
        row.className = 'msg-row bot';
        row.innerHTML = '<div class="bubble typing-indicator"></div>';
        elements.messageList.appendChild(row);
        elements.messageList.scrollTop = elements.messageList.scrollHeight;
    } else {
        const loadingMsg = document.getElementById('loadingMsg');
        if (loadingMsg) loadingMsg.remove();
    }
}

function collectUiImageUrls(uiData) {
    const urls = [];
    if (!uiData || typeof uiData !== 'object') return urls;

    if (typeof uiData.image_url === 'string' && uiData.image_url.trim()) {
        urls.push(uiData.image_url.trim());
    }

    if (Array.isArray(uiData.img)) {
        uiData.img.forEach(item => {
            if (typeof item === 'string' && item.trim()) {
                urls.push(item.trim());
            }
        });
    }

    return urls;
}

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderAnswerContent(container, contentText, useMarkdown) {
    if (!container) return;

    const text = String(contentText || '');
    if (!text.trim()) {
        container.classList.remove('is-markdown');
        container.classList.remove('is-plain');
        container.innerHTML = '';
        return;
    }

    if (!useMarkdown) {
        container.classList.remove('is-markdown');
        container.classList.add('is-plain');
        container.textContent = text;
        return;
    }

    try {
        if (window.marked && typeof window.marked.parse === 'function') {
            const rawHtml = window.marked.parse(text, { breaks: true, gfm: true });
            container.classList.remove('is-plain');
            container.classList.add('is-markdown');
            if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
                container.innerHTML = `<article class="md-renderer">${window.DOMPurify.sanitize(rawHtml)}</article>`;
            } else {
                container.innerHTML = `<article class="md-renderer">${rawHtml}</article>`;
            }
            return;
        }
    } catch (err) {
        console.warn('Markdown 渲染失败，已降级为纯文本:', err);
    }

    container.classList.remove('is-markdown');
    container.classList.add('is-plain');
    container.innerHTML = `<pre style="white-space:pre-wrap;margin:0;">${escapeHtml(text)}</pre>`;
}

function injectPreviewStyles() {
    // 样式已迁移到 index.html，保留空函数以兼容现有调用。
}

function openMessageFullscreen(rowElement) {
    if (!rowElement) return;

    state.messageFullscreen.visible = true;
    elements.messageFullscreenBody.innerHTML = '';

    const clonedRow = rowElement.cloneNode(true);
    const actionBars = clonedRow.querySelectorAll('.bubble-actions');
    actionBars.forEach(node => node.remove());

    elements.messageFullscreenBody.appendChild(clonedRow);
    elements.messageFullscreenMask.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeMessageFullscreen() {
    state.messageFullscreen.visible = false;
    elements.messageFullscreenMask.classList.remove('show');
    elements.messageFullscreenBody.innerHTML = '';
    document.body.style.overflow = state.preview.visible ? 'hidden' : '';
}

function initMessageFullscreen() {
    const mask = document.createElement('section');
    mask.className = 'msg-fullscreen-mask';
    mask.innerHTML = `
        <div class="msg-fullscreen-card">
            <button type="button" class="msg-fullscreen-close" aria-label="关闭">×</button>
            <div class="msg-fullscreen-body"></div>
        </div>
    `;
    document.body.appendChild(mask);

    elements.messageFullscreenMask = mask;
    elements.messageFullscreenBody = mask.querySelector('.msg-fullscreen-body');
    elements.messageFullscreenCloseBtn = mask.querySelector('.msg-fullscreen-close');

    elements.messageFullscreenCloseBtn.addEventListener('click', closeMessageFullscreen);
    elements.messageFullscreenMask.addEventListener('click', (e) => {
        if (e.target === elements.messageFullscreenMask) {
            closeMessageFullscreen();
        }
    });
}

function normalizePreviewIndex(index, length) {
    if (length <= 0) return 0;
    return (index + length) % length;
}

function clampPreviewScale(scale) {
    return Math.min(state.preview.maxScale, Math.max(state.preview.minScale, scale));
}

function centerPreviewStage() {
    if (!elements.previewStage) return;
    const stage = elements.previewStage;
    stage.scrollLeft = Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2);
    stage.scrollTop = Math.max(0, (stage.scrollHeight - stage.clientHeight) / 2);
}

function updatePreviewCounter() {
    const total = state.preview.urls.length;
    const current = total > 0 ? state.preview.index + 1 : 0;
    const scalePercent = Math.round(state.preview.scale * 100);
    elements.previewCounter.textContent = `${current} / ${total} · ${scalePercent}%`;
}

function updatePreviewNavState() {
    const single = state.preview.urls.length <= 1;
    elements.previewPrevBtn.style.display = single ? 'none' : 'inline-flex';
    elements.previewNextBtn.style.display = single ? 'none' : 'inline-flex';
}

function applyPreviewScale(scale, shouldCenter = false) {
    if (!elements.previewImage || !elements.previewImage.naturalWidth || !elements.previewImage.naturalHeight) {
        return;
    }

    state.preview.scale = clampPreviewScale(scale);
    const width = elements.previewImage.naturalWidth * state.preview.scale;
    const height = elements.previewImage.naturalHeight * state.preview.scale;
    elements.previewImage.style.width = `${width}px`;
    elements.previewImage.style.height = `${height}px`;

    if (shouldCenter) {
        centerPreviewStage();
    }
    updatePreviewCounter();
}

function zoomPreviewBy(step) {
    if (!state.preview.visible) return;
    applyPreviewScale(state.preview.scale + step);
}

function fitPreviewScale(shouldCenter = true) {
    if (!elements.previewImage || !elements.previewStage || !elements.previewImage.naturalWidth || !elements.previewImage.naturalHeight) {
        return;
    }

    const stageWidth = Math.max(1, elements.previewStage.clientWidth - 16);
    const stageHeight = Math.max(1, elements.previewStage.clientHeight - 16);
    const widthScale = stageWidth / elements.previewImage.naturalWidth;
    const heightScale = stageHeight / elements.previewImage.naturalHeight;
    const fitScale = Math.min(widthScale, heightScale);

    applyPreviewScale(fitScale, shouldCenter);
}

function resetPreviewScale(shouldCenter = true) {
    state.preview.scale = 1;
    if (elements.previewImage.naturalWidth) {
        applyPreviewScale(1, shouldCenter);
    } else {
        updatePreviewCounter();
    }
}

function renderPreviewImage() {
    if (!state.preview.visible || state.preview.urls.length === 0) return;

    const idx = normalizePreviewIndex(state.preview.index, state.preview.urls.length);
    state.preview.index = idx;
    state.preview.scale = 1;
    elements.previewImage.style.width = 'auto';
    elements.previewImage.style.height = 'auto';
    elements.previewImage.src = state.preview.urls[idx];
    updatePreviewNavState();
    updatePreviewCounter();
}

function closeImagePreview() {
    state.preview.visible = false;
    elements.previewMask.classList.remove('show');
    elements.previewImage.src = '';
    state.preview.urls = [];
    state.preview.index = 0;
    state.preview.scale = 1;
    document.body.style.overflow = '';
}

function switchPreviewImage(step) {
    if (!state.preview.visible || state.preview.urls.length <= 1) return;
    state.preview.index = normalizePreviewIndex(state.preview.index + step, state.preview.urls.length);
    renderPreviewImage();
}

function openImagePreview(urls, startIndex = 0) {
    if (!Array.isArray(urls) || urls.length === 0) return;

    state.preview.urls = urls.slice();
    state.preview.index = normalizePreviewIndex(startIndex, state.preview.urls.length);
    state.preview.scale = 1;
    state.preview.visible = true;

    renderPreviewImage();
    elements.previewMask.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function initImagePreview() {
    injectPreviewStyles();

    const mask = document.createElement('section');
    mask.className = 'img-preview-mask';
    mask.innerHTML = `
        <div class="img-preview-main">
            <div class="img-preview-zoom">
                <button class="img-preview-zoom-out" aria-label="缩小">−</button>
                <button class="img-preview-zoom-reset" aria-label="还原">1:1</button>
                <button class="img-preview-zoom-in" aria-label="放大">+</button>
            </div>
            <button class="img-preview-close" aria-label="关闭预览">×</button>
            <div class="img-preview-stage">
                <button class="img-preview-btn img-preview-prev" aria-label="上一张">‹</button>
                <img class="img-preview-image" alt="图片预览" />
                <button class="img-preview-btn img-preview-next" aria-label="下一张">›</button>
            </div>
            <div class="img-preview-counter">1 / 1</div>
        </div>
    `;
    document.body.appendChild(mask);

    elements.previewMask = mask;
    elements.previewStage = mask.querySelector('.img-preview-stage');
    elements.previewImage = mask.querySelector('.img-preview-image');
    elements.previewCounter = mask.querySelector('.img-preview-counter');
    elements.previewPrevBtn = mask.querySelector('.img-preview-prev');
    elements.previewNextBtn = mask.querySelector('.img-preview-next');
    elements.previewCloseBtn = mask.querySelector('.img-preview-close');
    elements.previewZoomInBtn = mask.querySelector('.img-preview-zoom-in');
    elements.previewZoomOutBtn = mask.querySelector('.img-preview-zoom-out');
    elements.previewZoomResetBtn = mask.querySelector('.img-preview-zoom-reset');

    elements.previewCloseBtn.addEventListener('click', closeImagePreview);
    elements.previewPrevBtn.addEventListener('click', () => switchPreviewImage(-1));
    elements.previewNextBtn.addEventListener('click', () => switchPreviewImage(1));
    elements.previewZoomInBtn.addEventListener('click', () => zoomPreviewBy(state.preview.scaleStep));
    elements.previewZoomOutBtn.addEventListener('click', () => zoomPreviewBy(-state.preview.scaleStep));
    elements.previewZoomResetBtn.addEventListener('click', () => resetPreviewScale(true));

    elements.previewImage.addEventListener('load', () => {
        fitPreviewScale(true);
    });

    elements.previewStage.addEventListener('wheel', (e) => {
        if (!state.preview.visible) return;
        e.preventDefault();
        zoomPreviewBy(e.deltaY < 0 ? state.preview.scaleStep : -state.preview.scaleStep);
    }, { passive: false });

    elements.previewMask.addEventListener('click', (e) => {
        if (e.target === elements.previewMask) {
            closeImagePreview();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!state.preview.visible) return;
        if (e.key === 'Escape') {
            closeImagePreview();
            return;
        }
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            switchPreviewImage(-1);
            return;
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            switchPreviewImage(1);
            return;
        }
        if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            zoomPreviewBy(state.preview.scaleStep);
            return;
        }
        if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            zoomPreviewBy(-state.preview.scaleStep);
            return;
        }
        if (e.key === '0') {
            e.preventDefault();
            resetPreviewScale(true);
        }
    });
}

async function callAgentAPI(userText) {
    try {
        if (!CONFIG.APP_ID || !CONFIG.SECRET_KEY) {
            throw new Error('未完成鉴权');
        }

        const url = `${CONFIG.API_URL}?appId=${CONFIG.APP_ID}&secretKey=${CONFIG.SECRET_KEY}`;

        const payload = {
            threadId: state.threadId,
            message: {
                content: {
                    type: 'text',
                    value: { showText: userText }
                }
            },
            source: CONFIG.APP_ID,
            from: 'openapi',
            openId: 'wcx'
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('网络响应错误');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let botResponseText = '';
        let hasMarkdownContent = false;
        let fullDataBuffer = '';
        let latestToolsStatus = [];
        let hasImage = false;

        const botView = createBotRichMessage();
        const renderedImages = new Set();
        const renderedImageUrls = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullDataBuffer += chunk;

            const lines = fullDataBuffer.split(/\r?\n/);
            fullDataBuffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data:')) continue;

                try {
                    const jsonStr = line.substring(5).trim();
                    if (!jsonStr) continue;

                    const data = JSON.parse(jsonStr);

                    if (data?.data?.message?.threadId) {
                        state.threadId = data.data.message.threadId;
                    }

                    if (data.status === 0 && data?.data?.message?.content) {
                        const contentArr = data.data.message.content;

                        contentArr.forEach(item => {
                            if (item?.dataType === 'markdown') {
                                hasMarkdownContent = true;
                                botResponseText += item?.data?.text || '';
                            } else if (item?.dataType === 'text') {
                                botResponseText += item?.data?.text || '';
                            }

                            const toolsStatus = item?.progress?.toolsStatus;
                            if (Array.isArray(toolsStatus) && toolsStatus.length > 0) {
                                latestToolsStatus = toolsStatus;
                            }

                            if (item?.dataType === 'uiData') {
                                const imageUrls = collectUiImageUrls(item?.data);
                                imageUrls.forEach(imageUrl => {
                                    if (renderedImages.has(imageUrl)) return;
                                    renderedImages.add(imageUrl);
                                    renderedImageUrls.push(imageUrl);
                                    hasImage = true;

                                    const img = document.createElement('img');
                                    img.src = imageUrl;
                                    img.alt = item?.data?.description || item?.data?.tag || '智能体生成图片';
                                    img.loading = 'lazy';
                                    img.addEventListener('click', () => {
                                        const startIndex = renderedImageUrls.indexOf(imageUrl);
                                        openImagePreview(renderedImageUrls, startIndex < 0 ? 0 : startIndex);
                                    });
                                    botView.imageList.appendChild(img);
                                });
                            }
                        });

                        renderAnswerContent(botView.answerText, botResponseText, false);
                        botView.expandBtn.onclick = () => {
                            openMessageFullscreen(botView.row);
                        };

                        if (latestToolsStatus.length > 0) {
                            botView.thinkingPanel.classList.add('show');
                            renderThinking(botView.thinkingBody, latestToolsStatus);
                        }

                        elements.messageList.scrollTop = elements.messageList.scrollHeight;
                    }
                } catch (e) {
                    console.error('JSON解析错误', e);
                }
            }
        }

        if (botResponseText.trim()) {
            renderAnswerContent(botView.answerText, botResponseText, hasMarkdownContent);
        }

        if (!botResponseText.trim() && !hasImage) {
            botView.answerText.textContent = '（未获取到有效回复内容）';
        }
    } catch (error) {
        console.error('API调用失败:', error);
        appendMessage('抱歉，系统出错了，请稍后再试。', 'bot');
    }
}

async function handleSend() {
    if (!state.isAuthed) {
        showAuthMask('请先输入访问口令');
        return;
    }

    const text = elements.inputBox.value.trim();
    if (!text || state.isLoading) return;

    appendMessage(text, 'user');
    elements.inputBox.value = '';

    state.isLoading = true;
    elements.sendBtn.disabled = true;
    toggleLoading(true);

    await callAgentAPI(text);

    state.isLoading = false;
    elements.sendBtn.disabled = false;
    toggleLoading(false);
    elements.inputBox.focus();
}

// --- 5. 事件绑定与初始化 ---
elements.sendBtn.addEventListener('click', handleSend);

elements.inputBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
});

elements.tokenSubmitBtn.addEventListener('click', handleTokenSubmit);

elements.tokenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleTokenSubmit();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.messageFullscreen.visible) {
        closeMessageFullscreen();
    }
});

initMessageFullscreen();
initImagePreview();
initAuth();
