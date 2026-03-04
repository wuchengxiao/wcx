/**
 * 在指定位置插入字符
 * @param {number} position - 插入位置
 * @param {string} char - 要插入的字符
 * @param {string} originalString - 原始字符串
 * @returns {string} 插入字符后的新字符串
 */
function insertCharAtPosition(position, char, originalString) {
    if (position < 0 || position > originalString.length) {
        throw new Error('位置参数超出字符串范围');
    }
    return originalString.slice(0, position) + char + originalString.slice(position);
}

/**
 * 对固定加密字符串进行N次解密
 * @param {number} decryptTimes - 解密次数
 * @returns {string} 解密后的字符串
 */
function decryptStringNTimes(decryptTimes, encryptedString) {
    if (!encryptedString) {
        return null;
    }
    // 简单的解密算法（示例：字符位置交换）
    for (let i = 0; i < decryptTimes; i++) {
        encryptedString = atob(encryptedString);
    }
    return encryptedString;
}

/**
 * 从浏览器获取参数
 * @returns {Object} 包含位置、字符、解密次数的对象
 */
function getBrowserParameters() {
    // 从URL参数获取
    const urlParams = new URLSearchParams(window.location.search);

    return {
        position: parseInt(urlParams.get('position')) || 0,
        char: urlParams.get('char') || '',
        decryptTimes: parseInt(urlParams.get('decryptTimes')) || 1
    };
}

async function callAPIStream(messages, model, url, token, onDelta) {
    var body = {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 1.0,
            stream: true
        })
    };
    const response = await fetch(url, body);

    if (!response.ok) {
        throw new Error(`API 调用失败: ${response.status}`);
    }

    if (!response.body) {
        const jsonResult = await response.json();
        return jsonResult;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break;
        }
        buffer += decoder.decode(value, { stream: true });

        let lineBreakIndex = buffer.indexOf('\n');
        while (lineBreakIndex !== -1) {
            const line = buffer.slice(0, lineBreakIndex).trim();
            buffer = buffer.slice(lineBreakIndex + 1);
            if (line.startsWith('data:')) {
                const payload = line.slice(5).trim();
                if (payload === '[DONE]') {
                    return null;
                }
                if (!payload) {
                    lineBreakIndex = buffer.indexOf('\n');
                    continue;
                }
                try {
                    const parsed = JSON.parse(payload);
                    const delta = (
                        parsed &&
                        parsed.choices &&
                        parsed.choices[0] &&
                        parsed.choices[0].delta &&
                        parsed.choices[0].delta.content
                    ) || (
                        parsed &&
                        parsed.choices &&
                        parsed.choices[0] &&
                        parsed.choices[0].message &&
                        parsed.choices[0].message.content
                    ) || '';
                    if (delta) {
                        onDelta(delta);
                    }
                } catch (e) {
                    // ignore malformed chunk
                }
            }
            lineBreakIndex = buffer.indexOf('\n');
        }
    }

    return null;
}

function getInputs() {
    var inputVar = _util.id('token').value;
    return inputVar.split('-');
}

async function callWebSearchAPI(query, searchEngine, token) {
    const searchUrl = processinput.processedUrl.replace('/v4/chat/completions', '/v4/web_search');
    const body = {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            search_query: query,
            search_engine: searchEngine || 'search_std',
            search_intent: false,
            count: 10,
            search_recency_filter: 'noLimit',
            content_size: 'medium'
        })
    };
    const response = await fetch(searchUrl, body);

    if (!response.ok) {
        throw new Error(`搜索API调用失败: ${response.status}`);
    }

    return await response.json();
}

function showError(msg) {
    _util.text('loginMsg', msg);
}
function processinputVars(inputVars, sourceUrl, sourceApiKey){
    let isSuccess = false;
    if (inputVars.length < 6) {
        return {
            isSuccess
        };
    }
    let processedUrl = '';
    let processedApiKey = '';
    try {
        processedUrl = decryptStringNTimes(inputVars[2], insertCharAtPosition(inputVars[0], inputVars[1], sourceUrl));
        processedApiKey = decryptStringNTimes(inputVars[5], insertCharAtPosition(inputVars[3], inputVars[4], sourceApiKey));
    } catch (e) {
        return {
            isSuccess
        };
    }
    isSuccess = true;
    return {
        processedUrl,
        processedApiKey,
        isSuccess
    };
}
//输入正确token后，保存url,和apikey的内容。
var processinput = null;
let conversation = messages ? messages.slice() : [];
let isSending = false;
let hasInitChat = false;

function appendMessage(role, content, sources) {
    const container = _util.id('chatMessages');
    if (!container) {
        return null;
    }
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = content;

    messageEl.appendChild(bubble);
    
    if (sources && sources.length > 0) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'search-sources';
        sourcesDiv.innerHTML = '搜索来源：';
        sources.forEach(function(src, idx) {
            if (idx > 0) {
                sourcesDiv.appendChild(document.createTextNode(' | '));
            }
            const link = document.createElement('a');
            link.href = src.link;
            link.target = '_blank';
            link.textContent = src.title || src.media || ('来源' + (idx + 1));
            sourcesDiv.appendChild(link);
        });
        messageEl.appendChild(sourcesDiv);
    }
    
    container.appendChild(messageEl);
    container.scrollTop = container.scrollHeight;
    return bubble;
}

function updateMessageBubble(bubble, content) {
    if (!bubble) {
        return;
    }
    bubble.textContent = content;
    const container = _util.id('chatMessages');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function setSendingState(sending) {
    isSending = sending;
    const sendBtn = _util.id('sendBtn');
    const input = _util.id('userInput');
    if (sendBtn) {
        sendBtn.disabled = sending;
    }
    if (input) {
        input.disabled = sending;
    }
}

function extractAssistantReply(result) {
    return (
        result &&
        result.choices &&
        result.choices[0] &&
        result.choices[0].message &&
        result.choices[0].message.content
    ) || (
        result &&
        result.data &&
        result.data.choices &&
        result.data.choices[0] &&
        result.data.choices[0].message &&
        result.data.choices[0].message.content
    ) || '';
}

async function sendMessage() {
    if (isSending) {
        return;
    }
    const input = _util.id('userInput');
    if (!input) {
        return;
    }
    const text = input.value.trim();
    if (!text) {
        return;
    }
    input.value = '';
    appendMessage('user', text);
    
    const enableWebSearch = _util.id('enableWebSearch');
    const searchEngine = _util.id('searchEngine');
    const useWebSearch = enableWebSearch && enableWebSearch.checked;
    const selectedEngine = searchEngine ? searchEngine.value : 'search_std';

    let searchSources = [];
    let userMessage = { role: 'user', content: text };

    if (useWebSearch) {
        setSendingState(true);
        try {
            const searchResult = await callWebSearchAPI(text, selectedEngine, processinput.processedApiKey);
            if (searchResult && searchResult.search_result && searchResult.search_result.length > 0) {
                searchSources = searchResult.search_result.slice(0, 5);
                let searchContext = '以下是网络搜索结果，请基于这些信息回答问题：\n\n';
                searchSources.forEach(function(item, idx) {
                    searchContext += `[${idx + 1}] ${item.title}\n${item.content}\n来源: ${item.link}\n\n`;
                });
                searchContext += `\n用户问题：${text}`;
                userMessage.content = searchContext;
            }
        } catch (e) {
            console.error('搜索失败:', e);
        }
    }

    conversation.push({ role: 'user', content: text });

    setSendingState(true);
    const assistantBubble = appendMessage('assistant', '', searchSources.length > 0 ? searchSources : null);
    let assistantText = '';
    try {
        const result = await callAPIStream(
            [...conversation.slice(0, -1), userMessage],
            model,
            processinput.processedUrl,
            processinput.processedApiKey,
            function(delta) {
                assistantText += delta;
                updateMessageBubble(assistantBubble, assistantText);
            }
        );

        if (!assistantText && result) {
            assistantText = extractAssistantReply(result) || '';
            updateMessageBubble(assistantBubble, assistantText || '未获取到有效回复。');
        } else if (!assistantText) {
            updateMessageBubble(assistantBubble, '未获取到有效回复。');
        }

        conversation.push({ role: 'assistant', content: assistantText || '未获取到有效回复。' });
    } catch (e) {
        updateMessageBubble(assistantBubble, '请求失败，请稍后再试。');
        showError("chat error");
    } finally {
        setSendingState(false);
    }
}

function initChatUI() {
    if (hasInitChat) {
        return;
    }
    hasInitChat = true;

    const sendBtn = _util.id('sendBtn');
    const input = _util.id('userInput');
    const enableWebSearch = _util.id('enableWebSearch');
    const searchEngine = _util.id('searchEngine');
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    if (input) {
        input.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });
    }
    
    if (enableWebSearch && searchEngine) {
        enableWebSearch.addEventListener('change', function() {
            searchEngine.style.display = this.checked ? 'block' : 'none';
        });
    }

    if (conversation && conversation.length) {
        conversation.forEach(function(msg) {
            appendMessage(msg.role, msg.content);
        });
    }
}

async function runTest() {
    var inputVars = getInputs();
    processinput = processinputVars(inputVars, url, apikey);
    if(!processinput.isSuccess){
        showError("token error");
        return;
    }
    _util.hide('login');

    //开始聊天
    _util.show('chat-content');
    initChatUI();
}
