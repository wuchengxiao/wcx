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

// 消息内容映射（用于删除时通过关键值定位）
const messageContentStore = new Map();
let messageIdCounter = 0;

// 自动加载本地存储的对话
function loadConversationFromStorage() {
    try {
        const stored = localStorage.getItem('chatai_conversation');
        if (stored) {
            const arr = JSON.parse(stored);
            if (Array.isArray(arr)) {
                conversation = arr;
            }
        }
    } catch (e) {}
}

// 保存对话到本地
function saveConversationToStorage() {
    try {
        localStorage.setItem('chatai_conversation', JSON.stringify(conversation));
    } catch (e) {}
}

function generateMessageId() {
    messageIdCounter += 1;
    return `msg_${Date.now()}_${messageIdCounter}`;
}

async function streamRequest(url, option, onDelta) {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await fetch(url, option);
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    if (buffer.trim()) {
                        readFromStream(buffer, onDelta);
                    }
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                buffer = readFromStream(buffer, onDelta);
            }
            resolve();
        } catch (err) {
            reject(err);
        }
    });
}

function readFromStream(buffer, onDelta) {
    const lines = buffer.split(/\r?\n/);
    const rest = lines.pop() || '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line.startsWith('data:')) {
            continue;
        }
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
            return '';
        }
        if (!payload) {
            continue;
        }
        try {
            const parsed = JSON.parse(payload);
            // 提取思考
            const deltaReasoning = (
                parsed &&
                parsed.choices &&
                parsed.choices[0] &&
                parsed.choices[0].delta &&
                parsed.choices[0].delta.reasoning_content
            ) || '';
            if (deltaReasoning) {
                onDelta('[THOUGHT] ' + deltaReasoning);
            }
            // 提取回复内容
            const delta = (
                parsed &&
                parsed.choices &&
                parsed.choices[0] &&
                parsed.choices[0].delta &&
                parsed.choices[0].delta.content
            ) || '';
            if (delta) {
                onDelta(delta);
            }
        } catch (e) {
            // ignore malformed chunk
        }
    }

    return rest;
}

async function callAPIStream(messages, model, url, token, onDelta) {
    var option = {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 1.0,
            web_search: true,
            stream: true
        })
    };
    return streamRequest(url, option, onDelta);
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

function appendMessage(role, content, sources) {
    const container = _util.id('msg-container');
    if (!container) {
        return null;
    }
    
    const messageEl = _util.ce('div');
    messageEl.className = `message ${role === 'user' ? 'sent' : 'received'}`;
    const messageId = generateMessageId();
    messageEl.dataset.messageId = messageId;
    messageContentStore.set(messageId, content || '');

    const avatar = _util.ce('img');
    avatar.className = 'msg-avatar';
    avatar.src = role === 'user' 
        ? 'https://picsum.photos/seed/me/100/100' 
        : 'https://picsum.photos/seed/ai/100/100';
    avatar.alt = role === 'user' ? 'Me' : 'AI';

    const bubble = _util.ce('div');
    bubble.className = 'msg-bubble';
    if (role === 'assistant' && typeof marked !== 'undefined') {
        if (content) {
            bubble.innerHTML = marked.parse(content);
            addCopyButtonsToCodeBlocks(bubble);
        } else {
            // 初始为“思考中...”，等待流式更新
            bubble.innerHTML = '<span class="thinking-placeholder">思考中...</span>';
            bubble.setAttribute('data-is-streaming', 'true');
        }
    } else {
        bubble.textContent = content;
    }

    messageEl.appendChild(avatar);
    messageEl.appendChild(bubble);

    // 创建按钮容器
    const buttonsContainer = _util.ce('div');
    buttonsContainer.className = 'message-buttons';

    // 添加删除按钮
    const deleteBtn = _util.ce('button');
    deleteBtn.className = 'icon-btn delete-btn';
    deleteBtn.title = '删除消息';
    deleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
    deleteBtn.addEventListener('click', function () {
        deleteMessage(messageEl, role, content);
    });
    buttonsContainer.appendChild(deleteBtn);

    // 为用户发送的消息添加重发按钮
    if (role === 'user') {
        const resendBtn = _util.ce('button');
        resendBtn.className = 'icon-btn resend-btn';
        resendBtn.title = '重发消息';
        //resendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path><polyline points="15 12 9 12 9 21"></polyline></svg>';
        resendBtn.textContent = '重发';
        resendBtn.addEventListener('click', function () {
            const input = _util.id('msg-input');
            if (input) {
                input.value = content;
                input.focus();
            }
        });
        buttonsContainer.appendChild(resendBtn);
    }

    // 为AI回答添加全屏和复制按钮
    if (role === 'assistant') {
        // 创建省略号提示元素
        const ellipsisEl = _util.ce('div');
        ellipsisEl.className = 'msg-ellipsis';
        ellipsisEl.textContent = '...';

        // 收缩/展开按钮
        const toggleBtn = _util.ce('button');
        toggleBtn.className = 'icon-btn toggle-btn';
        toggleBtn.title = '展开/收起';
        toggleBtn.textContent = '收起';
        toggleBtn.addEventListener('click', function (event) {
            event.stopPropagation();
            const isCollapsed = bubble.classList.toggle('collapsed');
            toggleBtn.textContent = isCollapsed ? '展开' : '收起';
            isCollapsed ? messageEl.insertBefore(ellipsisEl, buttonsContainer) : messageEl.removeChild(ellipsisEl);
        });
        buttonsContainer.appendChild(toggleBtn);

        // 全屏按钮
        const fullscreenBtn = _util.ce('button');
        fullscreenBtn.className = 'icon-btn fullscreen-btn';
        fullscreenBtn.title = '全屏查看';
        fullscreenBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
        fullscreenBtn.addEventListener('click', function () {
            openFullscreen(bubble.innerHTML);
        });
        buttonsContainer.appendChild(fullscreenBtn);
        
        // 复制按钮
        const copyBtn = _util.ce('button');
        copyBtn.className = 'icon-btn copy-btn';
        copyBtn.title = '复制回答';
        copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        copyBtn.addEventListener('click', function () {
            copyToClipboard(bubble.textContent || bubble.innerText);
        });
        buttonsContainer.appendChild(copyBtn);
    }

    // 添加按钮容器到消息元素
    messageEl.appendChild(buttonsContainer);

    // 点击消息时显示/隐藏按钮（与 hover 效果一致）
    messageEl.addEventListener('click', function (event) {
        if (event.target.closest('.message-buttons')) {
            return;
        }
        _util.qa('.message.show-actions').forEach(function (el) {
            if (el !== messageEl) {
                el.classList.remove('show-actions');
            }
        });
        messageEl.classList.toggle('show-actions');
        event.stopPropagation();
    });

    if (role === 'assistant') {
        // 默认展开，不加collapsed类
        // 检测图片并添加预览区域
        if (window.createImagePreviewArea) {
            const imagePreview = window.createImagePreviewArea();
            if (imagePreview) {
                messageEl.appendChild(imagePreview);
            }
        }
    }

    if (sources && sources.length > 0) {
        const sourcesDiv = _util.ce('div');
        sourcesDiv.className = 'search-sources';

        const label = _util.ce('div');
        label.className = 'search-sources-label';
        label.textContent = '搜索来源：';
        sourcesDiv.appendChild(label);

        const linksContainer = _util.ce('div');
        linksContainer.className = 'search-sources-links-container';

        sources.forEach(function(src, idx) {
            const sourceItem = _util.ce('div');
            sourceItem.className = 'search-source-item';

            const numberSpan = _util.ce('span');
            numberSpan.className = 'search-source-number';
            numberSpan.textContent = (idx + 1) + '. ';

            const link = _util.ce('a');
            link.href = src.link;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = src.title || src.media || ('来源' + (idx + 1));

            sourceItem.appendChild(numberSpan);
            sourceItem.appendChild(link);
            linksContainer.appendChild(sourceItem);
        });

        sourcesDiv.appendChild(linksContainer);
        messageEl.appendChild(sourcesDiv);
    }
    
    const typing = _util.id('typing');
    if (typing) {
        container.insertBefore(messageEl, typing);
    } else {
        container.appendChild(messageEl);
    }
    container.scrollTop = container.scrollHeight;
    return bubble;
}

function deleteMessage(messageEl, role, content) {
    if (confirm('确定要删除这条消息吗？')) {
        const messageId = messageEl.dataset.messageId;
        const originalContent = messageContentStore.get(messageId) || content;
        messageEl.remove();
        const index = conversation.findIndex(msg => msg.role === role && msg.content === originalContent);
        if (index !== -1) {
            conversation.splice(index, 1);
            saveConversationToStorage();
        }
        if (messageId) {
            messageContentStore.delete(messageId);
        }
    }
}

function openFullscreen(content) {
    const fullscreenContainer = _util.ce('div');
    fullscreenContainer.id = 'fullscreen-container';
    fullscreenContainer.style.position = 'fixed';
    fullscreenContainer.style.top = '0';
    fullscreenContainer.style.left = '0';
    fullscreenContainer.style.width = '100vw';
    fullscreenContainer.style.height = '100vh';
    fullscreenContainer.style.backgroundColor = 'white';
    fullscreenContainer.style.zIndex = '10000';
    fullscreenContainer.style.padding = '20px';
    fullscreenContainer.style.overflowY = 'auto';

    const closeBtn = _util.ce('button');
    closeBtn.className = 'fullscreen-close-btn';
    closeBtn.style.position = 'fixed';
    closeBtn.style.top = '20px';
    closeBtn.style.right = '20px';
    closeBtn.style.zIndex = '10001';
    closeBtn.style.padding = '8px 16px';
    closeBtn.style.backgroundColor = '#007bff';
    closeBtn.style.color = 'white';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '4px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.textContent = '关闭';
    closeBtn.addEventListener('click', function () {
        _util.bodyRc(fullscreenContainer);
        _util.bodyRc(closeBtn);
    });

    const contentContainer = _util.ce('div');
    contentContainer.style.maxWidth = '800px';
    contentContainer.style.margin = '0 auto';
    contentContainer.style.paddingTop = '60px';
    contentContainer.className = 'msg-bubble';
    contentContainer.innerHTML = content;

    _util.ac(fullscreenContainer, contentContainer);
    _util.bodyAc(fullscreenContainer);
    _util.bodyAc(closeBtn);
}

function copyToClipboard(text) {
    const textarea = _util.ce('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    textarea.style.top = '-999999px';
    _util.bodyAc(textarea);
    textarea.select();
    document.execCommand('copy');
    _util.bodyRc(textarea);
    showCopySuccess();
}

function showCopySuccess() {
    const tooltip = _util.ce('div');
    tooltip.className = 'copy-tooltip';
    tooltip.textContent = '复制成功！';
    tooltip.style.position = 'fixed';
    tooltip.style.top = '20px';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translateX(-50%)';
    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '8px 16px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.zIndex = '10002';
    tooltip.style.fontSize = '14px';
    _util.bodyAc(tooltip);
    setTimeout(function () {
        _util.bodyRc(tooltip);
    }, 2000);
}

function updateMessageBubble(bubble, content) {
    if (!bubble) {
        return;
    }
    // 保留思考内容（reasoning-content）
    let reasoningDiv = bubble.querySelector('.reasoning-content');
    let reasoningParent = null;
    let reasoningNext = null;
    if (reasoningDiv) {
        reasoningParent = reasoningDiv.parentNode;
        reasoningNext = reasoningDiv.nextSibling;
        _util.rc(bubble, reasoningDiv);
    }
    const messageEl = bubble.parentElement;
    if (messageEl && messageEl.classList.contains('received') && typeof marked !== 'undefined') {
        // 流式阶段先按纯文本逐字显示，结束后再统一转为 Markdown
        if (bubble.hasAttribute('data-is-streaming')) {
            bubble.textContent = content;
        } else {
            bubble.innerHTML = marked.parse(content);
            if (!bubble.hasAttribute('data-code-buttons-added')) {
                addCopyButtonsToCodeBlocks(bubble);
                bubble.setAttribute('data-code-buttons-added', 'true');
            }
        }
    } else {
        bubble.textContent = content;
    }
    // 重新插入 reasoningDiv，保证其为 DOM 节点，不被 markdown 影响
    if (reasoningDiv) {
        if (
            reasoningNext &&
            reasoningParent === bubble &&
            reasoningNext.parentNode === bubble
        ) {
            bubble.insertBefore(reasoningDiv, reasoningNext);
        } else if (bubble.firstChild) {
            bubble.insertBefore(reasoningDiv, bubble.firstChild);
        } else {
            bubble.appendChild(reasoningDiv);
        }
    }
    const container = _util.id('msg-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function finishStreaming(bubble) {
    if (bubble && bubble.hasAttribute('data-is-streaming')) {
        bubble.removeAttribute('data-is-streaming');
        if (typeof marked !== 'undefined') {
            const finalText = bubble.textContent || '';
            bubble.innerHTML = marked.parse(finalText);
            addCopyButtonsToCodeBlocks(bubble);
            bubble.setAttribute('data-code-buttons-added', 'true');
            
            // 处理图片预览（流式收集到的图片URL）
            const messageEl = bubble.parentElement;
            // 收集图片URL
            if (window.extractImageUrls) {
                window.extractImageUrls(finalText);
            }
            if (messageEl && window.createImagePreviewArea) {
                const imagePreview = window.createImagePreviewArea();
                if (imagePreview) {
                  _util.ac(messageEl, imagePreview);
                }
            }
        }
    }
}

function addCopyButtonsToCodeBlocks(element) {
    const codeBlocks = element.querySelectorAll('pre');
    codeBlocks.forEach(pre => {
        if (pre.querySelector('.copy-code-btn')) {
            return;
        }
        const copyBtn = _util.ce('button');
        copyBtn.className = 'copy-code-btn';
        copyBtn.textContent = '复制';
        copyBtn.addEventListener('click', function () {
            const code = pre.querySelector('code') || pre;
            const text = code.textContent;
            copyToClipboard(text);
            copyBtn.textContent = '已复制';
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.textContent = '复制';
                copyBtn.classList.remove('copied');
            }, 2000);
        });
        pre.appendChild(copyBtn);
    });
}

function setSendingState(sending) {
    isSending = sending;
    const sendBtn = _util.id('send-btn');
    const input = _util.id('msg-input');
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
    const input = _util.id('msg-input');
    if (!input) {
        return;
    }
    const text = input.value.trim();
    if (!text) {
        return;
    }
    input.value = '';
    appendMessage('user', text);

    // 检查当前角色是否启用 imageApi
    if (window.currentRole && window.currentRole.enableImageApi) {
        setSendingState(true);
        const assistantBubble = appendMessage('assistant', '正在生成图片...');
        try {
            if (!window.requestImageByPrompt) {
                alert('图片生成功能未加载，请刷新页面或联系管理员。');
                updateMessageBubble(assistantBubble, '图片生成功能暂不可用，请稍后重试或联系管理员。');
                setSendingState(false);
                return;
            }
            const imgUrl = await window.requestImageByPrompt({
              prompt: text,
              token: processinput.processedApiKey,
              url: processinput.processedUrl
            });
            if (imgUrl) {
                const imgTag = `<img src=\"${imgUrl}\" alt=\"AI生成图片\" style=\"max-width:90%;border-radius:8px;box-shadow:0 2px 8px #ccc;\">`;
                updateMessageBubble(assistantBubble, imgTag);
                conversation.push({ role: 'assistant', content: imgTag });
                saveConversationToStorage();
            } else {
                updateMessageBubble(assistantBubble, '图片生成失败，请稍后再试。');
            }
        } catch (e) {
            updateMessageBubble(assistantBubble, '图片生成出现异常，请稍后再试。');
            console.error('AI生图异常:', e);
        }
        setSendingState(false);
        return;
    }

    // 其他角色原逻辑
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
    saveConversationToStorage();

    setSendingState(true);
    const assistantBubble = appendMessage('assistant', '', searchSources.length > 0 ? searchSources : null);
    let assistantText = '';
    let reasoningContent = '';
    let reasoningDiv = null;
    let reasoningCollapsed = false;
    let toggleReasoningBtn = null;
    // 状态显示元素
    let statusSpan = null;
    if (assistantBubble) {
        statusSpan = _util.ce('span');
        statusSpan.className = 'stream-status';
        statusSpan.textContent = '思考中...';
        assistantBubble.appendChild(statusSpan);
        // 创建思考内容div并插入
        reasoningDiv = _util.ce('div');
        reasoningDiv.className = 'reasoning-content';
        reasoningDiv.textContent = '';
        assistantBubble.insertBefore(reasoningDiv, assistantBubble.firstChild);
        // 展开/收起按钮，初始隐藏，等正式回答出现后显示
        toggleReasoningBtn = _util.ce('button');
        toggleReasoningBtn.className = 'toggle-reasoning-btn';
        toggleReasoningBtn.style.display = 'none';
        toggleReasoningBtn.textContent = '展开思考内容';
        toggleReasoningBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            reasoningCollapsed = !reasoningCollapsed;
            if (reasoningCollapsed) {
                reasoningDiv.classList.add('collapsed');
                toggleReasoningBtn.textContent = '展开思考内容';
            } else {
                reasoningDiv.classList.remove('collapsed');
                toggleReasoningBtn.textContent = '收起思考内容';
            }
        });
        assistantBubble.insertBefore(toggleReasoningBtn, reasoningDiv.nextSibling);
    }
    try {
        // 新：直接用window.requestTextByMessages（非流式，完整回复）
        if (!window.requestTextByMessages) {
            updateMessageBubble(assistantBubble, '文本生成功能未加载，请刷新页面或联系管理员。');
            setSendingState(false);
            return;
        }
        const result = await window.requestTextByMessages({
            messages: [...conversation.slice(0, -1), userMessage],
            token: processinput.processedApiKey,
            url: processinput.processedUrl
        });
        let assistantText = extractAssistantReply(result) || '';
        updateMessageBubble(assistantBubble, assistantText || '正在思考中...');
        if (statusSpan) statusSpan.textContent = '';
        const messageEl = assistantBubble.parentElement;
        if (messageEl) {
            const messageId = messageEl.dataset.messageId;
            if (messageId) {
                messageContentStore.set(messageId, assistantText || '');
            }
        }
        conversation.push({ role: 'assistant', content: assistantText || '' });
        saveConversationToStorage();
    } catch (e) {
        let errorMessage = '请求失败，请稍后再试。';
        if (e && (e.status === 429 || (e.message && e.message.includes('429')))) {
            errorMessage = '服务器请求超时，稍后再试';
        }
        updateMessageBubble(assistantBubble, errorMessage);
        if (statusSpan) statusSpan.textContent = '';
        const messageEl = assistantBubble.parentElement;
        if (messageEl) {
            const messageId = messageEl.dataset.messageId;
            if (messageId) {
                messageContentStore.set(messageId, errorMessage);
            }
        }
        console.error('聊天错误:', e);
    }
    finishStreaming(assistantBubble);
    setSendingState(false);
}

// 登录成功后自动初始化聊天UI
function onLoginSuccess() {
    if (typeof window.initChatUI === 'function') {
        window.initChatUI();
    }
}
