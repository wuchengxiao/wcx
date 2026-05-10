// 2026-05-10
// --- 1. 配置与状态管理 ---
const CONFIG = {
    API_URL: 'https://agentapi.baidu.com/assistant/conversation',
    APP_ID: '',
    SECRET_KEY: ''
};

const AUTH_STORAGE_KEY = 'baidu_agent_auth_v1';
const AUTH_EXPIRE_MS = 2 * 60 * 60 * 1000; // 2小时
const CHAT_STORAGE_KEY = 'baidu_agent_chat_v1';

const FIXED_ENCODED = 'VjFaaQyUXhTbFZTYTNSUFlUTkNUbHBWVlRWbFZscFlaRVJLYUZaV1NucFZhazVUV1ZVeFIxTnNhRk5UUmtsNVZURmtiMkZ0VWxkU2FtaHFVbXRLTVZsVVFqUlVWazVaVjJ0S1dGSnRVbUZaYlRGR1RURmtSV0ZJU2xWTlIyZDZXVmR3YTJWc2JGVlZia0pzWWxVMWFGWkZWbEpRVVQwOQ==';

const state = {
    threadId: '',
    isLoading: false,
    isAuthed: false,
    messageFullscreen: {
        visible: false,
        text: '',
        useMarkdown: false
    }
};

function saveChatCache() {
    const messages = [];
    const rows = elements.messageList.querySelectorAll('.msg-row');
    rows.forEach(row => {
        const sender = row.classList.contains('user') ? 'user' : 'bot';
        const bubble = row.querySelector('.bubble');
        if (!bubble) return;
        const answerText = bubble.querySelector('.answer-text');
        const text = answerText ? answerText.textContent : '';
        const images = [];
        if (sender === 'bot') {
            const imgList = bubble.querySelector('.bot-images');
            if (imgList) {
                imgList.querySelectorAll('img').forEach(img => {
                    if (img.src) {
                        images.push(img.src);
                    }
                });
            }
        }
        if (text.trim() || images.length > 0) {
            messages.push({ sender, text, images });
        }
    });
    try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
        console.warn('聊天缓存保存失败:', e);
    }
}

function loadChatCache() {
    try {
        const raw = localStorage.getItem(CHAT_STORAGE_KEY);
        if (!raw) return;
        const messages = JSON.parse(raw);
        if (!Array.isArray(messages)) return;
        elements.messageList.innerHTML = '';
        messages.forEach(msg => {
            if (msg.sender === 'bot' && Array.isArray(msg.images) && msg.images.length > 0) {
                appendBotMessageWithImages(msg.text, msg.images, true);
            } else {
                appendMessage(msg.text, msg.sender, true);
            }
        });
    } catch (e) {
        console.warn('聊天缓存加载失败:', e);
    }
}

function appendBotMessageWithImages(text, imageUrls, skipCache) {
    const row = document.createElement('div');
    row.className = 'msg-row bot';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    let answerText = null;
    if (text && text.trim()) {
        answerText = document.createElement('div');
        answerText.className = 'answer-text is-plain';
        answerText.textContent = text;
    }

    const imageList = document.createElement('div');
    imageList.className = 'bot-images';

    imageUrls.forEach(url => {
        if (url && url.trim()) {
            const img = document.createElement('img');
            img.src = url.trim();
            img.alt = '图片';
            img.loading = 'lazy';
            imageList.appendChild(img);
        }
    });

    const actions = createActionButtons(row);

    if (answerText) {
        bubble.appendChild(answerText);
    }
    bubble.appendChild(imageList);

    row.appendChild(bubble);
    row.appendChild(actions);
    elements.messageList.appendChild(row);
    elements.messageList.scrollTop = elements.messageList.scrollHeight;

    if (!skipCache) {
        saveChatCache();
    }
}

function clearChatContext() {
    elements.messageList.innerHTML = '';
    state.threadId = '';
    localStorage.removeItem(CHAT_STORAGE_KEY);
    appendMessage('你好！我是你的智能助手，有什么可以帮你的吗？', 'bot');
}

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
    moreOptionsBtn: null,
    moreOptionsDropdown: null,
    clearContextBtn: null
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
    loadChatCache();
    elements.inputBox.focus();
}

function initAuth() {
    lockUI();

    const savedToken = readAuthToken();
    if (savedToken) {
        try {
            activateByToken(savedToken, false);
            loadChatCache();
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

function createActionButtons(row) {
    const actions = document.createElement('div');
    actions.className = 'bubble-actions';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'bubble-action-btn copy-btn';
    copyBtn.setAttribute('aria-label', '复制内容');
    copyBtn.title = '复制内容';
    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyMessageContent(row);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'bubble-action-btn delete-btn';
    deleteBtn.setAttribute('aria-label', '删除消息');
    deleteBtn.title = '删除消息';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteMessage(row);
    });

    const expandBtn = document.createElement('button');
    expandBtn.type = 'button';
    expandBtn.className = 'bubble-action-btn expand-btn';
    expandBtn.setAttribute('aria-label', '全屏查看');
    expandBtn.title = '全屏查看';
    expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMessageFullscreen(row);
    });

    actions.appendChild(copyBtn);
    actions.appendChild(deleteBtn);
    actions.appendChild(expandBtn);

    return actions;
}

function deleteMessage(rowElement) {
    if (!rowElement || !confirm('确定要删除这条消息吗？')) return;
    
    rowElement.remove();
    saveChatCache();
    
    const remainingRows = elements.messageList.querySelectorAll('.msg-row');
    if (remainingRows.length === 0) {
        appendMessage('你好！我是你的智能助手，有什么可以帮你的吗？', 'bot');
    }
}

function copyMessageContent(rowElement) {
    if (!rowElement) return;

    const bubble = rowElement.querySelector('.bubble');
    if (!bubble) return;

    let content = '';
    
    const textContent = bubble.querySelector('.answer-text');
    if (textContent) {
        content = textContent.textContent || '';
    }

    const images = bubble.querySelectorAll('.bot-images img');
    if (images.length > 0) {
        const imageUrls = Array.from(images).map(img => img.src).join('\n');
        if (content) content += '\n\n';
        content += imageUrls;
    }

    if (!content.trim()) {
        content = bubble.textContent || '';
    }

    navigator.clipboard.writeText(content.trim()).then(() => {
        showCopyToast();
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = content.trim();
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showCopyToast();
    });
}

function showCopyToast() {
    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.textContent = '已复制到剪贴板';
    toast.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.75);
        color: #fff;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 9999;
        animation: fadeInUp 0.3s ease;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOutDown 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 1500);
}

function appendMessage(text, sender, skipCache) {
    const row = document.createElement('div');
    row.className = `msg-row ${sender}`;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    const content = document.createElement('div');
    content.className = 'answer-text is-plain';
    content.textContent = text;

    const actions = createActionButtons(row);

    bubble.appendChild(content);
    row.appendChild(bubble);
    row.appendChild(actions);
    elements.messageList.appendChild(row);
    elements.messageList.scrollTop = elements.messageList.scrollHeight;

    if (!skipCache) {
        saveChatCache();
    }
}

function createBotRichMessage() {
    const row = document.createElement('div');
    row.className = 'msg-row bot';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    const answerText = document.createElement('div');
    answerText.className = 'answer-text';

    const thinkingPanel = document.createElement('div');
    thinkingPanel.className = 'thinking-panel';
    thinkingPanel.innerHTML = '<div class="thinking-title">思考过程</div><div class="thinking-body"></div>';

    const imageList = document.createElement('div');
    imageList.className = 'bot-images';

    const actions = createActionButtons(row);

    bubble.appendChild(answerText);
    bubble.appendChild(thinkingPanel);
    bubble.appendChild(imageList);
    row.appendChild(bubble);
    row.appendChild(actions);
    elements.messageList.appendChild(row);
    elements.messageList.scrollTop = elements.messageList.scrollHeight;

    return {
        row,
        bubble,
        answerText,
        thinkingPanel,
        thinkingBody: thinkingPanel.querySelector('.thinking-body'),
        imageList
    };
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
    document.body.style.overflow = '';
}

function initMessageFullscreen() {
    const mask = document.createElement('section');
    mask.className = 'msg-fullscreen-mask';
    mask.innerHTML = `
        <div class="msg-fullscreen-card">
            <div class="msg-fullscreen-header">
                <span class="msg-fullscreen-title">消息详情</span>
                <button type="button" class="msg-fullscreen-close" aria-label="关闭">×</button>
            </div>
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
                                    botView.imageList.appendChild(img);
                                });
                            }
                        });

                        renderAnswerContent(botView.answerText, botResponseText, false);

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
    saveChatCache();
    elements.inputBox.focus();
}

// --- 5. 事件绑定与初始化 ---
function initDropdownMenu() {
    elements.moreOptionsBtn = document.getElementById('moreOptionsBtn');
    elements.moreOptionsDropdown = document.getElementById('moreOptionsDropdown');
    elements.clearContextBtn = document.getElementById('clearContextBtn');

    if (!elements.moreOptionsBtn || !elements.moreOptionsDropdown || !elements.clearContextBtn) return;

    elements.moreOptionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.moreOptionsDropdown.classList.toggle('show');
    });

    elements.clearContextBtn.addEventListener('click', () => {
        clearChatContext();
        elements.moreOptionsDropdown.classList.remove('show');
    });

    document.addEventListener('click', (e) => {
        if (!elements.moreOptionsDropdown.contains(e.target)) {
            elements.moreOptionsDropdown.classList.remove('show');
        }
    });
}

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
initDropdownMenu();
initAuth();
