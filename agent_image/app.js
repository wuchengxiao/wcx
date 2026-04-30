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
    isAuthed: false
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
    authError: document.getElementById('authError')
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
    bubble.textContent = text;

    row.appendChild(bubble);
    elements.messageList.appendChild(row);
    elements.messageList.scrollTop = elements.messageList.scrollHeight;
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

    bubble.appendChild(answerText);
    bubble.appendChild(thinkingPanel);
    bubble.appendChild(imageList);
    row.appendChild(bubble);
    elements.messageList.appendChild(row);
    elements.messageList.scrollTop = elements.messageList.scrollHeight;

    return {
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
        let fullDataBuffer = '';
        let latestToolsStatus = [];
        let hasImage = false;

        const botView = createBotRichMessage();
        const renderedImages = new Set();

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
                            if (item?.dataType === 'markdown' || item?.dataType === 'text') {
                                botResponseText += item?.data?.text || '';
                            }

                            const toolsStatus = item?.progress?.toolsStatus;
                            if (Array.isArray(toolsStatus) && toolsStatus.length > 0) {
                                latestToolsStatus = toolsStatus;
                            }

                            if (item?.dataType === 'uiData') {
                                const imageUrl = item?.data?.image_url;
                                if (imageUrl && !renderedImages.has(imageUrl)) {
                                    renderedImages.add(imageUrl);
                                    hasImage = true;

                                    const img = document.createElement('img');
                                    img.src = imageUrl;
                                    img.alt = item?.data?.description || '智能体生成图片';
                                    img.loading = 'lazy';
                                    botView.imageList.appendChild(img);
                                }
                            }
                        });

                        botView.answerText.textContent = botResponseText;

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

initAuth();
