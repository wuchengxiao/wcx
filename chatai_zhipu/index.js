// Chat Application
class ChatApp {
    constructor() {
        this.themeStorageKey = 'chat_theme';
        this.currentTheme = this.loadTheme();
        this.models = {
            'GLM-4.7': {
                name: 'GLM-4.7-Flash',
                icon: '⚡',
                color: '#f39c12'
            }
        };
        this.currentModel = 'GLM-4.7';
        this.sessions = this.loadSessions();
        this.currentSessionId = null;
        // 临时思考内容（不落盘）
        this.sessionThinkingById = {};
        this.sessionThinkingMessageIdById = {};

        this.applyTheme(this.currentTheme);
        this.init();
    }

    loadTheme() {
        try {
            const saved = localStorage.getItem(this.themeStorageKey);
            return saved === 'light' ? 'light' : 'dark';
        } catch {
            return 'dark';
        }
    }

    saveTheme() {
        try {
            localStorage.setItem(this.themeStorageKey, this.currentTheme);
        } catch {
            // ignore storage errors
        }
    }

    applyTheme(theme) {
        const nextTheme = theme === 'light' ? 'light' : 'dark';
        this.currentTheme = nextTheme;
        document.documentElement.setAttribute('data-theme', nextTheme);
        this.saveTheme();
        this.updateThemeToggleText();
    }

    updateThemeToggleText() {
        const btn = document.getElementById('themeToggleBtn');
        if (!btn)
            return;

        btn.textContent = this.currentTheme === 'light' ? '切换到暗黑主题' : '切换到亮色主题';
        btn.title = btn.textContent;
    }

    toggleTheme() {
        const next = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(next);
        this.showToast(next === 'light' ? '已切换到亮色主题' : '已切换到暗黑主题');
    }

    loadCurrentSessionId() {
        try {
            return localStorage.getItem('chat_current_session_id');
        } catch {
            return null;
        }
    }

    saveCurrentSessionId() {
        try {
            if (this.currentSessionId) {
                localStorage.setItem('chat_current_session_id', this.currentSessionId);
            } else {
                localStorage.removeItem('chat_current_session_id');
            }
        } catch {
            // ignore storage errors
        }
    }

    init() {
        // Load last session or create new one
        const sessionIds = Object.keys(this.sessions);
        const savedCurrentId = this.loadCurrentSessionId();
        if (savedCurrentId && this.sessions[savedCurrentId]) {
            this.currentSessionId = savedCurrentId;
            this.syncCurrentSessionState();
        } else if (sessionIds.length > 0) {
            const latestSession = Object.values(this.sessions)
                .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
            this.currentSessionId = latestSession ? latestSession.id : sessionIds[0];
            this.syncCurrentSessionState();
        } else {
            this.createNewSession();
        }

        this.saveCurrentSessionId();

        this.renderSessionList();
        this.renderChat();
        this.updateModelDisplay();

        // Focus input
        document.getElementById('messageInput').focus();
    }

    // Get session title dynamically from first user message
    getSessionTitle(session) {
        if (!session) return '新对话';
        const firstUserMsg = session.messages?.find(m => m && m.role === 'user' && m.content);
        if (!firstUserMsg) return '新对话';
        const content = String(firstUserMsg.content).trim();
        return content.slice(0, 20) + (content.length > 20 ? '...' : '');
    }

    // Session Management
    loadSessions() {
        try {
            const saved = localStorage.getItem('chat_sessions');
            const sessions = saved ? JSON.parse(saved) : {};
            const modelMap = this.models || {};
            const defaultModel = this.currentModel || Object.keys(modelMap)[0] || null;
            Object.values(sessions).forEach(session => {
                if (!session || typeof session !== 'object')
                    return;
                if (!Array.isArray(session.messages))
                    session.messages = [];
                if (typeof session.roleIndex !== 'number')
                    session.roleIndex = null;
                if (!session.id)
                    session.id = 'session_' + Date.now();
                if (!session.model || !modelMap[session.model])
                    session.model = defaultModel;
                session.createdAt = session.createdAt || new Date().toISOString();
                session.updatedAt = session.updatedAt || new Date().toISOString();
            });
            return sessions;
        } catch {
            return {};
        }
    }

    saveSessions() {
        try {
            const sessionsToSave = Object.fromEntries(
                Object.entries(this.sessions).map(([id, session]) => {
                    const safeMessages = Array.isArray(session.messages)
                        ? session.messages.map(msg => {
                            const safeMsg = { ...msg };
                            delete safeMsg.reasoning;
                            return safeMsg;
                        })
                        : [];
                    return [id, {
                        id,
                        roleIndex: typeof session.roleIndex === 'number' ? session.roleIndex : null,
                        model: session.model || this.currentModel,
                        createdAt: session.createdAt,
                        updatedAt: session.updatedAt,
                        messages: safeMessages
                    }];
                })
            );
            localStorage.setItem('chat_sessions', JSON.stringify(sessionsToSave));
        } catch (e) {
            // ignore storage errors
        }
    }

    createNewSession() {
        const id = 'session_' + Date.now();
        const session = {
            id,
            messages: [],
            model: this.currentModel,
            roleIndex: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.sessions[id] = session;
        this.sessionThinkingById[id] = '';
        this.sessionThinkingMessageIdById[id] = null;
        this.currentSessionId = id;
        this.syncCurrentSessionState();
        this.saveCurrentSessionId();
        this.saveSessions();
        this.renderSessionList();
        this.renderChat();

        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('show');
        }
    }

    switchSession(id) {
        this.currentSessionId = id;
        this.syncCurrentSessionState();
        this.saveCurrentSessionId();
        this.renderSessionList();
        this.renderChat();

        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('show');
        }
    }

    deleteSession(id, event) {
        event.stopPropagation();

        if (confirm('确定要删除这个对话吗？')) {
            delete this.sessions[id];
            delete this.sessionThinkingById[id];
            delete this.sessionThinkingMessageIdById[id];

            const remainingIds = Object.keys(this.sessions);
            if (remainingIds.length > 0) {
                const latestSession = Object.values(this.sessions)
                    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
                this.currentSessionId = latestSession ? latestSession.id : remainingIds[0];
                this.syncCurrentSessionState();
            } else {
                this.createNewSession();
            }

            this.saveCurrentSessionId();
            this.saveSessions();
            this.renderSessionList();
            this.renderChat();
        }
    }

    clearCurrentSession() {
        if (!this.currentSessionId)
            return;

        if (confirm('确定要清空当前对话吗？')) {
            this.sessions[this.currentSessionId].messages = [];
            this.sessionThinkingById[this.currentSessionId] = '';
            this.sessionThinkingMessageIdById[this.currentSessionId] = null;
            this.sessions[this.currentSessionId].updatedAt = new Date().toISOString();
            this.saveSessions();
            this.renderChat();
        }
    }

    exportSession() {
        if (!this.currentSessionId)
            return;

        const session = this.sessions[this.currentSessionId];
        const exportData = {
            title: this.getSessionTitle(session),
            model: this.models[session.model].name,
            createdAt: session.createdAt,
            messages: session.messages.map(m => ({
                role: m.role,
                content: m.content,
                time: m.time
            }))
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)],{
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
            a.download = `chat_${this.getSessionTitle(session)}_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showToast('对话已导出');
    }

    // Model Selection
    toggleModelDropdown() {
        document.getElementById('modelDropdown').classList.toggle('show');
    }

    selectModel(modelId) {
        this.currentModel = modelId;

        if (this.currentSessionId) {
            this.sessions[this.currentSessionId].model = modelId;
            this.saveSessions();
        }

        this.updateModelDisplay();
        document.getElementById('modelDropdown').classList.remove('show');
    }

    updateModelDisplay() {
        const model = this.models[this.currentModel];
        document.getElementById('currentModelName').textContent = model.name;
        document.getElementById('currentModelIcon').textContent = model.icon;
    }

    syncCurrentSessionState() {
        const session = this.sessions[this.currentSessionId];
        if (!session) {
            window.currentRole = null;
            return;
        }

        if (session.model && this.models[session.model]) {
            this.currentModel = session.model;
            this.updateModelDisplay();
        }

        window.currentRole = this.getSessionRole(session);
    }

    getSessionRole(session = this.sessions[this.currentSessionId]) {
        if (!session || typeof session.roleIndex !== 'number')
            return null;
        const roles = Array.isArray(window.roles) ? window.roles : [];
        return roles[session.roleIndex] || null;
    }

    setSessionRole(roleIndex) {
        const session = this.sessions[this.currentSessionId];
        if (!session)
            return;

        const roles = Array.isArray(window.roles) ? window.roles : [];
        if (!roles[roleIndex])
            return;

        session.roleIndex = roleIndex;
        session.updatedAt = new Date().toISOString();
        window.currentRole = roles[roleIndex] || null;
        this.saveSessions();
        this.renderSessionList();
        this.renderChat();
        this.showToast(`已选择：${roles[roleIndex].name}`);
    }

    // Messaging
    // 依赖 request/requestText.js
    async sendMessage() {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();

        if (!content)
            return;

        const session = this.sessions[this.currentSessionId];
        const selectedRole = this.getSessionRole(session);

        // Add user message
        const userMessage = {
            id: 'msg_' + Date.now(),
            role: 'user',
            content,
            time: new Date().toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            })
        };
        session.messages.push(userMessage);
        session.updatedAt = new Date().toISOString();
        this.saveSessions();
        this.renderSessionList();
        this.renderChat();

        input.value = '';
        this.autoResize(input);

        if (selectedRole && selectedRole.enableImageApi) {
            const assistantMessage = {
                id: 'msg_' + (Date.now() + 1),
                role: 'assistant',
                content: '正在生成图片...',
                time: new Date().toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit'
                })
            };
            session.messages.push(assistantMessage);
            session.updatedAt = new Date().toISOString();
            this.saveSessions();
            this.renderChat();

            try {
                if (!window.requestImageByPrompt) {
                    assistantMessage.content = '图片生成功能未加载，请刷新页面后重试。';
                    this.saveSessions();
                    this.updateMessageBubble(assistantMessage.id, assistantMessage.content, '');
                    return;
                }

                const imgUrl = await window.requestImageByPrompt({
                    prompt: content,
                    token: processinput.processedApiKey,
                    url: processinput.processedUrl
                });

                assistantMessage.content = imgUrl
                    ? `![AI生成图片](${imgUrl})`
                    : '图片生成失败，请稍后重试。';

                session.updatedAt = new Date().toISOString();
                this.saveSessions();
                this.renderSessionList();
                this.updateMessageBubble(assistantMessage.id, assistantMessage.content, '');
            } catch (e) {
                assistantMessage.content = '图片生成出现异常，请稍后重试。';
                session.updatedAt = new Date().toISOString();
                this.saveSessions();
                this.renderSessionList();
                this.updateMessageBubble(assistantMessage.id, assistantMessage.content, '');
            }
            return;
        }

        // Show typing indicator
        this.showTypingIndicator();

        // === 使用真实API流式回复 ===
        try {
            const messages = [
                ...(selectedRole && selectedRole.systemPrompt ? [selectedRole.systemPrompt] : []),
                ...session.messages.map(m => ({ role: m.role, content: m.content }))
            ];
            let replyContent = '';
            // 先插入一条空的assistant消息用于流式填充
            const assistantMessage = {
                id: 'msg_' + (Date.now() + 1),
                role: 'assistant',
                content: '',
                time: new Date().toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit'
                })
            };
            session.messages.push(assistantMessage);
            this.sessionThinkingById[this.currentSessionId] = '';
            this.sessionThinkingMessageIdById[this.currentSessionId] = assistantMessage.id;
            this.saveSessions();
            this.renderChat();
            let token = processinput.processedApiKey;
            let url = processinput.processedUrl;
            // 流式请求
            let hasError = false;
            if (window.requestTextByMessages) {
                for await (const chunk of window.requestTextByMessages({ messages, token, url })) {
                    if (!chunk) {
                        hasError = true;
                        break;
                    }
                    const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta ? chunk.choices[0].delta : null;
                    if (delta) {
                        const reasoningChunk = delta.reasoning_content || delta.reasoning || delta.thinking || '';
                        if (reasoningChunk) {
                            const sid = this.currentSessionId;
                            this.sessionThinkingById[sid] = (this.sessionThinkingById[sid] || '') + reasoningChunk;
                            // 还未进入正式回答前，实时显示思考过程
                            this.updateMessageBubble(assistantMessage.id, replyContent, this.sessionThinkingById[sid] || '');
                        }
                    }
                    if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) {
                        replyContent += chunk.choices[0].delta.content;
                        assistantMessage.content = replyContent;
                        // 一旦进入正式回答，隐藏并清空思考过程
                        this.sessionThinkingById[this.currentSessionId] = '';
                        this.sessionThinkingMessageIdById[this.currentSessionId] = null;
                        this.saveSessions();
                        this.updateMessageBubble(assistantMessage.id, replyContent, '');
                    }
                }
            } else {
                hasError = true;
            }
            if (hasError) {
                assistantMessage.content = '【接口请求失败或未配置】';
                this.sessionThinkingById[this.currentSessionId] = '';
                this.sessionThinkingMessageIdById[this.currentSessionId] = null;
                this.saveSessions();
                this.renderChat();
            }
            session.updatedAt = new Date().toISOString();
            this.saveSessions();
            this.renderSessionList();
        } catch (e) {
            // 错误处理
            const session = this.sessions[this.currentSessionId];
            this.sessionThinkingById[this.currentSessionId] = '';
            this.sessionThinkingMessageIdById[this.currentSessionId] = null;
            const assistantMessage = {
                id: 'msg_' + (Date.now() + 2),
                role: 'assistant',
                content: '【请求出错】' + (e && e.message ? e.message : ''),
                time: new Date().toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit'
                })
            };
            session.messages.push(assistantMessage);
            session.updatedAt = new Date().toISOString();
            this.saveSessions();
            this.renderChat();
        }
    }

    // addAssistantResponse 已废弃，流式回复已集成到 sendMessage

    showTypingIndicator() {
        const container = document.getElementById('chatContainer');
        const typingHtml = `
            <div class="messages" id="messagesContainer">
                ${this.renderMessagesHtml()}
                <div class="message">
                    <div class="message-avatar assistant">🤖</div>
                    <div class="message-content">
                        <div class="typing-indicator">
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = typingHtml;
        this.scrollToBottom();
    }

    // Message Actions
    copyMessage(content, event) {
        event.stopPropagation();
        navigator.clipboard.writeText(content).then( () => {
            this.showToast('已复制到剪贴板');
        }
        );
    }

    deleteMessage(messageId, event) {
        event.stopPropagation();

        if (confirm('确定要删除这条消息吗？')) {
            const session = this.sessions[this.currentSessionId];
            session.messages = session.messages.filter(m => m.id !== messageId);
            session.updatedAt = new Date().toISOString();
            this.saveSessions();
            this.renderChat();
        }
    }

    toggleMessageCollapse(messageId, event) {
        event.stopPropagation();

        const session = this.sessions[this.currentSessionId];
        if (!session)
            return;

        const msg = session.messages.find(m => m.id === messageId);
        if (!msg)
            return;

        msg.collapsed = !msg.collapsed;
        this.saveSessions();

        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageEl) {
            this.renderChat();
            return;
        }

        messageEl.classList.toggle('collapsed', !!msg.collapsed);
        const collapseBtn = messageEl.querySelector('.message-action-collapse');
        if (collapseBtn) {
            collapseBtn.textContent = msg.collapsed ? '展开' : '收起';
        }
    }

    showFullscreenByMessageId(messageId, event) {
        if (event)
            event.stopPropagation();

        const session = this.sessions[this.currentSessionId];
        if (!session)
            return;

        const msg = session.messages.find(m => m.id === messageId);
        if (!msg) {
            this.showToast('未找到消息内容');
            return;
        }

        this.showFullscreen(msg.content);
    }

    showFullscreen(content) {
        const modal = document.getElementById('fullscreenModal');
        const contentDiv = document.getElementById('fullscreenContent');

        const safeContent = typeof content === 'string' ? content : String(content ?? '');

        // Parse markdown
        try {
            const html = marked.parse(safeContent);
            contentDiv.innerHTML = html;
        } catch {
            contentDiv.textContent = safeContent;
        }

        // Highlight code blocks
        contentDiv.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
        }
        );

        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeFullscreen() {
        document.getElementById('fullscreenModal').classList.remove('show');
        document.body.style.overflow = '';
    }

    // Rendering
    renderSessionList() {
        const container = document.getElementById('sessionList');
        const sessions = Object.values(this.sessions).sort( (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        // Group sessions by date
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        const groups = {
            '今天': [],
            '昨天': [],
            '更早': []
        };

        sessions.forEach(session => {
            const date = new Date(session.updatedAt).toDateString();
            if (date === today) {
                groups['今天'].push(session);
            } else if (date === yesterday) {
                groups['昨天'].push(session);
            } else {
                groups['更早'].push(session);
            }
        });

        let html = '';

        Object.entries(groups).forEach(([groupName, groupSessions]) => {
            if (groupSessions.length === 0)
                return;

            html += `
                <div class="session-group">
                    <div class="session-group-title">${groupName}</div>
            `;

            groupSessions.forEach(session => {
                const isActive = session.id === this.currentSessionId;
                const model = this.models[session.model] ||{};
                const role = this.getSessionRole(session);
                const roleName = role ? role.name : '未选角色';

                html += `
                    <div class="session-item ${isActive ? 'active' : ''}" onclick="chatApp.switchSession('${session.id}')">
                        <div class="session-icon">${model.icon || ''}</div>
                        <div class="session-info">
                            <div class="session-title">${this.escapeHtml(this.getSessionTitle(session))}</div>
                            <div class="session-meta">${this.escapeHtml(roleName)} · ${model.name || ''} · ${session.messages.length} 条消息</div>
                        </div>
                        <div class="session-actions">
                            <button class="session-action-btn" onclick="chatApp.deleteSession('${session.id}', event)" title="删除">🗑️</button>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
        });

        container.innerHTML = html || '<div style="padding: 20px; text-align: center; color: var(--text-muted);">暂无对话</div>';
    }

    renderChat() {
        const container = document.getElementById('chatContainer');
        const session = this.sessions[this.currentSessionId];

        if (!session) {
            container.innerHTML = this.renderWelcomeScreen();
            document.getElementById('headerTitle').textContent = '新对话';
            return;
        }

        document.getElementById('headerTitle').textContent = this.getSessionTitle(session);

        if (session.messages.length === 0) {
            container.innerHTML = this.renderWelcomeScreen();
            return;
        }

        container.innerHTML = `
            <div class="messages" id="messagesContainer">
                ${this.renderMessagesHtml()}
            </div>
        `;

        const sid = this.currentSessionId;
        const transientThinking = this.sessionThinkingById[sid] || '';
        const thinkingMsgId = this.sessionThinkingMessageIdById[sid];
        if (thinkingMsgId && transientThinking) {
            const msg = session.messages.find(m => m.id === thinkingMsgId);
            this.updateMessageBubble(thinkingMsgId, msg ? (msg.content || '') : '', transientThinking);
        }

        this.scrollToBottom();
    }

    renderMessagesHtml() {
        const session = this.sessions[this.currentSessionId];
        if (!session || session.messages.length === 0)
            return '';

        return session.messages.map(msg => {
            const isUser = msg.role === 'user';
            const isCollapsed = !!msg.collapsed;
            const html = marked.parse(msg.content);
            const reasoningHtml = '';
            const model = session.model ? this.models[session.model] : {};

            return `
                <div class="message ${isCollapsed ? 'collapsed' : ''}" data-message-id="${msg.id}">
                    <div class="message-avatar ${msg.role}">${isUser ? '👤' : '🤖'}</div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-author">${isUser ? '你' : (model.name || '')}</span>
                            <span class="message-time">${msg.time}</span>
                        </div>
                        ${reasoningHtml ? `
                            <details class="message-reasoning" open>
                                <summary>思考过程</summary>
                                <div class="message-reasoning-body">${reasoningHtml}</div>
                            </details>
                        ` : ''}
                        <div class="message-body">${html}</div>
                        <div class="message-actions">
                            <button class="message-action message-action-collapse" onclick="chatApp.toggleMessageCollapse('${msg.id}', event)">
                                ${isCollapsed ? '展开' : '收起'}
                            </button>
                            <button class="message-action" onclick="chatApp.copyMessage(${JSON.stringify(msg.content).replace(/"/g, '&quot;')}, event)">
                                复制
                            </button>
                            <button class="message-action" onclick="chatApp.showFullscreenByMessageId('${msg.id}', event)">
                                全屏
                            </button>
                            <button class="message-action" onclick="chatApp.deleteMessage('${msg.id}', event)">
                                删除
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        ).join('');
    }

    updateMessageBubble(messageId, content, reasoning = '') {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageEl) {
            this.renderChat();
            return;
        }

        let reasoningWrap = messageEl.querySelector('.message-reasoning');

        // 一旦有正式回答内容，移除思考过程展示
        if (content && reasoningWrap) {
            reasoningWrap.remove();
            reasoningWrap = null;
        }

        if (!content && reasoning) {
            if (!reasoningWrap) {
                const contentEl = messageEl.querySelector('.message-content');
                const headerEl = messageEl.querySelector('.message-header');
                if (contentEl && headerEl) {
                    reasoningWrap = document.createElement('details');
                    reasoningWrap.className = 'message-reasoning';
                    reasoningWrap.open = true;
                    reasoningWrap.innerHTML = '<summary>思考过程</summary><div class="message-reasoning-body"></div>';
                    headerEl.insertAdjacentElement('afterend', reasoningWrap);
                }
            }

            const reasoningBodyEl = messageEl.querySelector('.message-reasoning-body');
            if (reasoningBodyEl) {
                reasoningBodyEl.innerHTML = marked.parse(reasoning || '');
                reasoningBodyEl.querySelectorAll('pre code').forEach(block => {
                    hljs.highlightElement(block);
                });
            }
        }

        const bodyEl = messageEl.querySelector('.message-body');
        if (!bodyEl)
            return;

        bodyEl.innerHTML = marked.parse(content || '');

        bodyEl.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
        });

        this.scrollToBottom();
    }

    renderWelcomeScreen() {
        const quickActions = ['解释什么是机器学习', '翻译这段英文', '帮我总结这篇文章'];
        const session = this.sessions[this.currentSessionId];
        const roles = Array.isArray(window.roles) ? window.roles : [];
        const selectedRole = this.getSessionRole(session);
        const roleSelectorHtml = roles.length > 0 ? `
                <div class="role-selector-area">
                    <div class="role-selector-title">选择角色/技能（会话隔离）</div>
                    ${roles.map((role, idx) => `
                        <button class="role-selector-btn ${session && session.roleIndex === idx ? 'active' : ''}" onclick="chatApp.setSessionRole(${idx})">${this.escapeHtml(role.name)}</button>
                    `).join('')}
                </div>
            ` : '';
        return `
            <div class="welcome-screen">
                <div class="welcome-icon">🤖</div>
                <h1 class="welcome-title">AI Chat</h1>
                <p class="welcome-subtitle">
                    智能对话助手，支持多模型切换、上下文记忆、会话管理等功能。
                    开始一个新的对话吧！
                </p>
                ${selectedRole ? `<p class="welcome-subtitle">当前角色：${this.escapeHtml(selectedRole.name)}</p>` : ''}
                ${roleSelectorHtml}
                <div class="quick-actions">
                    <div class="quick-actions-title">试试这些问题：</div>
                    ${quickActions.map(action => `
                        <button class="quick-action" onclick="chatApp.setInput('${action}')">${action}</button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // UI Helpers
    scrollToBottom() {
        const container = document.getElementById('chatContainer');
        container.scrollTop = container.scrollHeight;
    }

    autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }

    handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }

    setInput(text) {
        const input = document.getElementById('messageInput');
        input.value = text;
        input.focus();
        this.autoResize(input);
    }

    toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('show');
    }

    hideMobileBrowserUi(event) {
        // 仅移动端处理
        if (window.innerWidth > 768)
            return;

        // 点击按钮、输入框等交互元素时，不触发
        if (event && event.target && event.target.closest('button,summary,details,input,textarea,a')) {
            return;
        }

        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
            active.blur();
        }

        // 通过轻微滚动触发移动浏览器收起地址栏（受浏览器策略限制）
        requestAnimationFrame(() => {
            window.scrollTo(0, 1);
            setTimeout(() => window.scrollTo(0, 1), 120);
        });
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');

        setTimeout( () => {
            toast.classList.remove('show');
        }
        , 2000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize
const chatApp = new ChatApp();

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.model-selector')) {
        document.getElementById('modelDropdown').classList.remove('show');
    }
}
);

// Highlight code blocks after rendering
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
    }
    );
}
);
