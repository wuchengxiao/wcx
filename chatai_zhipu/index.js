// Chat Application
class ChatApp {
    constructor() {
        this.themeStorageKey = 'chat_theme';
        this.currentTheme = this.loadTheme();
        this.isPersonaPickerOpen = false;
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
        this.isSending = false;
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
        this.setupViewportHeightFix();
        this.setupMobileKeyboardFix();

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
        this.updateInputPlaceholder();

        // Focus input
        document.getElementById('messageInput').focus();
    }

    setupViewportHeightFix() {
        if (this._viewportFixInited)
            return;

        this._viewportFixInited = true;
        this._updateViewportHeight = this.updateViewportHeight.bind(this);

        this.updateViewportHeight();

        window.addEventListener('resize', this._updateViewportHeight, {
            passive: true
        });
        window.addEventListener('orientationchange', this._updateViewportHeight, {
            passive: true
        });

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', this._updateViewportHeight, {
                passive: true
            });
            window.visualViewport.addEventListener('scroll', this._updateViewportHeight, {
                passive: true
            });
        }
    }

    updateViewportHeight() {
        const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        if (!viewportHeight)
            return;

        document.documentElement.style.setProperty('--app-height', `${Math.round(viewportHeight)}px`);

        if (this._isKeyboardInputFocused) {
            this.keepInputAreaVisible();
        }
    }

    setupMobileKeyboardFix() {
        const input = document.getElementById('messageInput');
        if (!input)
            return;

        const onFocus = () => {
            if (window.innerWidth > 768)
                return;

            this._isKeyboardInputFocused = true;
            this.keepInputAreaVisible();

            setTimeout(() => this.keepInputAreaVisible(), 120);
            setTimeout(() => this.keepInputAreaVisible(), 320);
        };

        const onBlur = () => {
            this._isKeyboardInputFocused = false;
            setTimeout(() => this.updateViewportHeight(), 120);
        };

        input.addEventListener('focus', onFocus);
        input.addEventListener('blur', onBlur);
    }

    keepInputAreaVisible() {
        if (window.innerWidth > 768)
            return;

        window.scrollTo(0, 0);

        const inputArea = document.querySelector('.input-area');
        if (inputArea) {
            inputArea.scrollIntoView({
                block: 'nearest',
                inline: 'nearest'
            });
        }

        this.scrollToBottom();
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
        this.isPersonaPickerOpen = true;
        this.syncCurrentSessionState();
        this.saveCurrentSessionId();
        this.saveSessions();
        this.renderSessionList();
        this.renderChat();
        this.updateInputPlaceholder();

        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('show');
        }
    }

    switchSession(id) {
        this.currentSessionId = id;
        this.isPersonaPickerOpen = false;
        this.syncCurrentSessionState();
        this.saveCurrentSessionId();
        this.renderSessionList();
        this.renderChat();
        this.updateInputPlaceholder();

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
            this.isPersonaPickerOpen = true;
            this.saveSessions();
            this.renderChat();
            this.updateInputPlaceholder();
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
            this.updateInputPlaceholder();
            return;
        }

        if (session.model && this.models[session.model]) {
            this.currentModel = session.model;
            this.updateModelDisplay();
        }

        window.currentRole = this.getActiveRole(session);
        this.updateInputPlaceholder();
    }

    getDefaultRole() {
        return {
            name: '通用模型',
            intro: '未选择人物时，默认使用通用模型直接回答你的问题。',
            guide: [
                '我可以直接回答通用问题、解释概念、总结内容，并提供日常帮助。'
            ],
            systemPrompt: {
                role: 'system',
                content: '你是一个通用 AI 助手。请直接、清晰、友好地回答用户问题。\n\n- 优先理解用户意图并给出有帮助的回答\n- 表达准确，结构清晰，避免冗长空话\n- 当用户的问题需要步骤、示例或总结时，主动提供更易理解的组织方式\n- 如无特别要求，保持自然、简洁、实用的中文表达'
            }
        };
    }

    getSessionRole(session = this.sessions[this.currentSessionId]) {
        if (!session || typeof session.roleIndex !== 'number')
            return null;
        const roles = Array.isArray(window.roles) ? window.roles : [];
        return roles[session.roleIndex] || null;
    }

    getActiveRole(session = this.sessions[this.currentSessionId]) {
        return this.getSessionRole(session) || this.getDefaultRole();
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
        this.isPersonaPickerOpen = false;
        window.currentRole = roles[roleIndex] || null;
        this.appendRoleGreeting(window.currentRole, session);
        this.saveSessions();
        this.renderSessionList();
        this.renderChat();
        this.updateInputPlaceholder();
        this.showToast(`已切换对话人物：${roles[roleIndex].name}`);
    }

    togglePersonaPicker(force) {
        this.isPersonaPickerOpen = typeof force === 'boolean' ? force : !this.isPersonaPickerOpen;
        this.renderChat();
    }

    getRolesGroupedByCategory() {
        const roles = Array.isArray(window.roles) ? window.roles : [];
        return roles.reduce((groups, role, idx) => {
            const category = role && role.category ? role.category : '其他人物';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push({
                role,
                idx
            });
            return groups;
        }, {});
    }

    renderRoleSelectorHtml(session = this.sessions[this.currentSessionId], title = '选择想对话的人物（每个会话独立）') {
        const groupedRoles = this.getRolesGroupedByCategory();
        const currentRoleIndex = session && typeof session.roleIndex === 'number' ? session.roleIndex : null;

        if (Object.keys(groupedRoles).length === 0) {
            return '';
        }

        return `
            <div class="role-selector-area">
                <div class="role-selector-title">${this.escapeHtml(title)}</div>
                ${Object.entries(groupedRoles).map(([category, items]) => `
                    <div class="role-selector-group">
                        <div class="role-selector-group-title">${this.escapeHtml(category)}</div>
                        <div class="role-selector-group-list">
                            ${items.map(({ role, idx }) => `
                                <button
                                    class="role-selector-btn ${currentRoleIndex === idx ? 'active' : ''}"
                                    onclick="chatApp.setSessionRole(${idx})"
                                    title="${this.escapeHtml(role.intro || '')}"
                                >
                                    <span class="role-selector-btn-name">${this.escapeHtml(role.name)}</span>
                                    ${role.intro ? `<span class="role-selector-btn-desc">${this.escapeHtml(role.intro)}</span>` : ''}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderPersonaBanner(session) {
        const selectedRole = this.getSessionRole(session);
        const activeRole = this.getActiveRole(session);
        const isDefaultRole = !selectedRole;

        return `
            <div class="persona-panel ${this.isPersonaPickerOpen ? 'open' : ''}">
                <div class="persona-panel-header">
                    <div class="persona-panel-info">
                        <div class="persona-panel-label">当前对话人物</div>
                        <div class="persona-panel-name">${this.escapeHtml(activeRole.name)}${isDefaultRole ? '（默认）' : ''}</div>
                        <div class="persona-panel-intro">${this.escapeHtml(selectedRole ? (selectedRole.intro || '你正在与该人物进行设定化对话。') : '当前未选择人物，将默认使用通用模型回答。')}</div>
                    </div>
                    <button class="persona-panel-btn" onclick="chatApp.togglePersonaPicker()">
                        ${this.isPersonaPickerOpen ? '收起列表' : (selectedRole ? '更换人物' : '选择人物')}
                    </button>
                </div>
                ${this.isPersonaPickerOpen ? this.renderRoleSelectorHtml(session, '从列表里选择一个想对话的人物') : ''}
            </div>
        `;
    }

    updateInputPlaceholder() {
        const input = document.getElementById('messageInput');
        if (!input)
            return;

        const selectedRole = this.getSessionRole();
        input.placeholder = selectedRole
            ? `对${selectedRole.name}说点什么...（Shift + Enter 换行）`
            : '直接输入即可，未选择人物时将使用通用模型回答...';
    }

    buildRoleGreeting(role) {
        if (!role)
            return '你好！请选择你想聊的话题，我会一步步带你开始。';

        const name = role.name || '助手';
        if (typeof role.openingLine === 'string' && role.openingLine.trim()) {
            return role.openingLine.trim();
        }

        const firstGuide = Array.isArray(role.guide)
            ? String(role.guide.find(item => typeof item === 'string' && item.trim()) || '').trim()
            : '';

        if (firstGuide) {
            return `你好，我是${name}。${firstGuide}`;
        }

        const intro = typeof role.intro === 'string' ? role.intro.trim() : '';
        if (intro) {
            return `你好，我是${name}。${intro}`;
        }

        return `你好，我是${name}。你可以直接告诉我你的需求，我会先给你一个清晰的起步方案。`;
    }

    getAssistantDisplayName(session = this.sessions[this.currentSessionId]) {
        const activeRole = this.getActiveRole(session);
        if (activeRole && activeRole.name) {
            return activeRole.name;
        }

        const model = session && session.model ? this.models[session.model] : null;
        return model && model.name ? model.name : '助手';
    }

    appendRoleGreeting(role, session = this.sessions[this.currentSessionId]) {
        if (!session || !role)
            return;

        const greeting = this.buildRoleGreeting(role);
        const roleGreetingMessage = {
            id: 'msg_' + (Date.now() + 1),
            role: 'assistant',
            content: greeting,
            isRoleGreeting: true,
            time: new Date().toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            })
        };

        const lastMessage = session.messages[session.messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isRoleGreeting) {
            session.messages[session.messages.length - 1] = roleGreetingMessage;
        } else {
            session.messages.push(roleGreetingMessage);
        }
    }

    getRequestErrorText(error, prefix = '请求失败') {
        const rawMessage = (() => {
            if (!error) return '';
            if (typeof error === 'string') return error.trim();
            if (error instanceof Error) return String(error.message || '').trim();
            if (error.error) return this.getRequestErrorText(error.error, prefix).replace(/^【[^】]+】/, '').trim();
            if (typeof error.message === 'string') return error.message.trim();
            if (typeof error.msg === 'string') return error.msg.trim();
            return '';
        })();

        return `【${prefix}】${rawMessage || '请稍后重试。'}`;
    }

    getFunctionCallingTools(selectedRole) {
        if (!window.enableFunctionCalling) {
            return [];
        }

        const allTools = Array.isArray(window.llmTools) ? window.llmTools : [];
        const enableWebSearch = document.getElementById('enableWebSearch');
        const allowWebSearch = !enableWebSearch || !!enableWebSearch.checked;
        const allowedToolNames = [];

        if (allowWebSearch) {
            allowedToolNames.push('web_search');
        }

        if (selectedRole && selectedRole.enableImageApi) {
            allowedToolNames.push('generate_image');
        }

        return allTools.filter(tool => {
            const name = tool && tool.function ? tool.function.name : '';
            return allowedToolNames.includes(name);
        });
    }

    buildToolInstructionMessage(tools) {
        if (!Array.isArray(tools) || !tools.length) {
            return null;
        }

        const toolNames = tools
            .map(tool => tool && tool.function ? tool.function.name : '')
            .filter(Boolean);

        const instructions = [
            '你可以按需调用工具。是否调用工具由你自行判断。'
        ];

        if (toolNames.includes('web_search')) {
            instructions.push('- 当用户问题依赖最新资讯、实时信息、网页资料或需要查证时，调用 `web_search`。');
        }

        if (toolNames.includes('generate_image')) {
            instructions.push('- 当用户明确要求生成图片、插画、海报、配图时，调用 `generate_image`。');
            instructions.push('- 在拿到 `generate_image` 返回的图片 URL 后，用 Markdown 图片语法 `![生成图片](url)` 展示结果。');
        }

        instructions.push('- 如果不需要工具，就直接正常回答。');

        return {
            role: 'system',
            content: instructions.join('\n')
        };
    }

    mergeFunctionToolCalls(currentToolCalls, incomingToolCalls) {
        if (!Array.isArray(incomingToolCalls) || !incomingToolCalls.length) {
            return currentToolCalls;
        }

        const merged = Array.isArray(currentToolCalls) ? currentToolCalls.slice() : [];

        incomingToolCalls.forEach(toolCall => {
            if (!toolCall) {
                return;
            }

            const index = typeof toolCall.index === 'number' ? toolCall.index : merged.length;
            const current = merged[index] || {
                id: '',
                type: toolCall.type || 'function',
                function: {
                    name: '',
                    arguments: ''
                }
            };

            if (toolCall.id) {
                current.id = toolCall.id;
            }

            if (toolCall.type) {
                current.type = toolCall.type;
            }

            if (!current.function) {
                current.function = {
                    name: '',
                    arguments: ''
                };
            }

            if (toolCall.function && toolCall.function.name) {
                current.function.name = toolCall.function.name;
            }

            if (toolCall.function && typeof toolCall.function.arguments === 'string') {
                current.function.arguments += toolCall.function.arguments;
            }

            merged[index] = current;
        });

        return merged.filter(Boolean);
    }

    parseFunctionToolArguments(toolCall) {
        const argsText = toolCall && toolCall.function ? toolCall.function.arguments : '';
        if (!argsText) {
            return {};
        }

        try {
            return JSON.parse(argsText);
        } catch {
            return {};
        }
    }

    getToolCallProgressText(toolCalls) {
        const names = (Array.isArray(toolCalls) ? toolCalls : [])
            .map(toolCall => toolCall && toolCall.function ? toolCall.function.name : '')
            .filter(Boolean);

        if (!names.length) {
            return '正在处理请求...';
        }

        if (names.length === 1 && names[0] === 'web_search') {
            return '正在联网搜索...';
        }

        if (names.length === 1 && names[0] === 'generate_image') {
            return '正在生成图片...';
        }

        return '正在调用工具处理请求...';
    }

    formatToolCallLabel(toolName) {
        if (toolName === 'web_search') {
            return '联网搜索';
        }

        if (toolName === 'generate_image') {
            return '图片生成';
        }

        return toolName || '工具调用';
    }

    updateMessageToolTrace(message, toolTrace) {
        if (!message) {
            return;
        }

        message.toolTrace = typeof toolTrace === 'string' ? toolTrace : '';
        this.saveSessions();

        if (message.id) {
            this.updateMessageBubble(message.id, message.content || '', '', message.toolTrace);
        }
    }

    async executeFunctionToolCall(toolCall, token, url) {
        const toolName = toolCall && toolCall.function ? toolCall.function.name : '';
        const args = this.parseFunctionToolArguments(toolCall);

        if (toolName === 'web_search') {
            if (!window.requestWebSearch) {
                throw new Error('网络搜索功能未加载，请刷新页面后重试。');
            }

            const query = typeof args.query === 'string' ? args.query.trim() : '';
            const searchResult = await window.requestWebSearch(query);
            return {
                role: 'tool',
                tool_call_id: toolCall.id || '',
                name: 'web_search',
                content: JSON.stringify(searchResult)
            };
        }

        if (toolName === 'generate_image') {
            if (!window.requestImageByPrompt) {
                throw new Error('图片生成功能未加载，请刷新页面后重试。');
            }

            const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : '';
            const imageUrl = await window.requestImageByPrompt({
                prompt,
                token,
                url
            });

            return {
                role: 'tool',
                tool_call_id: toolCall.id || '',
                name: 'generate_image',
                content: JSON.stringify({
                    url: imageUrl
                })
            };
        }

        throw new Error('暂不支持的工具调用：' + toolName);
    }

    async streamAssistantResponse(options) {
        const opts = options || {};
        const sessionId = this.currentSessionId;
        const assistantMessage = opts.assistantMessage;
        let replyContent = '';
        let toolCalls = null;

        for await (const chunk of window.requestTextByMessages({
            messages: opts.messages,
            token: opts.token,
            url: opts.url,
            tools: opts.tools,
            tool_choice: opts.tools && opts.tools.length ? 'auto' : undefined
        })) {
            if (!chunk) {
                throw new Error('接口未返回有效数据');
            }

            if (chunk.error) {
                throw new Error(this.getRequestErrorText(chunk.error, '请求失败').replace(/^【请求失败】/, '').trim());
            }

            const choice = chunk.choices && chunk.choices[0] ? chunk.choices[0] : null;
            const delta = choice && choice.delta ? choice.delta : null;

            if (delta) {
                const reasoningChunk = delta.reasoning_content || delta.reasoning || delta.thinking || '';
                if (reasoningChunk) {
                    this.sessionThinkingById[sessionId] = (this.sessionThinkingById[sessionId] || '') + reasoningChunk;
                    this.updateMessageBubble(assistantMessage.id, replyContent, this.sessionThinkingById[sessionId] || '');
                }

                if (Array.isArray(delta.tool_calls)) {
                    toolCalls = this.mergeFunctionToolCalls(toolCalls, delta.tool_calls);
                }

                if (!toolCalls && typeof delta.content === 'string' && delta.content) {
                    replyContent += delta.content;
                    assistantMessage.content = replyContent;
                    this.sessionThinkingById[sessionId] = '';
                    this.sessionThinkingMessageIdById[sessionId] = null;
                    this.saveSessions();
                    this.updateMessageBubble(assistantMessage.id, replyContent, '');
                }
            }

            if (!delta && choice && choice.message && typeof choice.message.content === 'string' && choice.message.content) {
                replyContent += choice.message.content;
                assistantMessage.content = replyContent;
                this.sessionThinkingById[sessionId] = '';
                this.sessionThinkingMessageIdById[sessionId] = null;
                this.saveSessions();
                this.updateMessageBubble(assistantMessage.id, replyContent, '');
            }

            if (!delta && choice && choice.message && Array.isArray(choice.message.tool_calls)) {
                toolCalls = this.mergeFunctionToolCalls(toolCalls, choice.message.tool_calls);
            }
        }

        return {
            replyContent,
            toolCalls: Array.isArray(toolCalls) ? toolCalls.filter(Boolean) : []
        };
    }

    // Messaging
    // 依赖 request/requestText.js
    async sendMessage(options = {}) {
        const opts = options || {};
        const input = document.getElementById('messageInput');
        const usesInputValue = typeof opts.content !== 'string';
        const rawContent = usesInputValue ? input.value : opts.content;
        const content = typeof rawContent === 'string' ? rawContent.trim() : '';

        if (!content)
            return;

        if (this.isSending) {
            this.showToast('请等待当前回复完成后再发送');
            return;
        }

        this.isSending = true;

        const session = this.sessions[this.currentSessionId];
        const selectedRole = this.getSessionRole(session);
        const activeRole = this.getActiveRole(session);

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

        if (usesInputValue && input) {
            input.value = '';
            this.autoResize(input);
        }

        // Show typing indicator
        this.showTypingIndicator();

        // === 使用真实API流式回复 ===
        let assistantMessage = null;
        try {
            const token = processinput.processedApiKey;
            const url = processinput.processedUrl;
            const tools = this.getFunctionCallingTools(activeRole);
            const toolInstructionMessage = this.buildToolInstructionMessage(tools);
            const messages = [
                ...(activeRole && activeRole.systemPrompt ? [activeRole.systemPrompt] : []),
                ...(toolInstructionMessage ? [toolInstructionMessage] : []),
                ...session.messages.map(m => ({ role: m.role, content: m.content }))
            ];

            assistantMessage = {
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
            this.isPersonaPickerOpen = false;
            this.saveSessions();
            this.renderChat();

            if (!window.requestTextByMessages) {
                throw new Error('文本请求功能未加载，请刷新页面后重试。');
            }

            const firstPass = await this.streamAssistantResponse({
                messages,
                token,
                url,
                tools,
                assistantMessage
            });

            let replyContent = firstPass.replyContent;
            const toolCalls = firstPass.toolCalls;

            if (toolCalls.length) {
                const initialToolTrace = toolCalls.map((toolCall, index) => {
                    const toolName = toolCall && toolCall.function ? toolCall.function.name : '';
                    return `${index + 1}. 模型决定调用：**${this.formatToolCallLabel(toolName)}**`;
                }).join('\n');

                assistantMessage.content = this.getToolCallProgressText(toolCalls);
                this.updateMessageToolTrace(assistantMessage, initialToolTrace);
                this.sessionThinkingById[this.currentSessionId] = '';
                this.sessionThinkingMessageIdById[this.currentSessionId] = null;
                this.updateMessageBubble(assistantMessage.id, assistantMessage.content, '', assistantMessage.toolTrace || '');

                const assistantToolMessage = {
                    role: 'assistant',
                    content: replyContent || '',
                    tool_calls: toolCalls
                };
                const toolResults = [];

                for (const [index, toolCall] of toolCalls.entries()) {
                    const toolName = toolCall && toolCall.function ? toolCall.function.name : '';
                    const args = this.parseFunctionToolArguments(toolCall);
                    const startLine = toolName === 'web_search'
                        ? `${index + 1}. 开始执行 **${this.formatToolCallLabel(toolName)}**：${args.query || '未提供查询词'}`
                        : `${index + 1}. 开始执行 **${this.formatToolCallLabel(toolName)}**：${args.prompt || '未提供描述'}`;
                    const nextTrace = [assistantMessage.toolTrace || '', startLine].filter(Boolean).join('\n');
                    this.updateMessageToolTrace(assistantMessage, nextTrace);

                    const toolResult = await this.executeFunctionToolCall(toolCall, token, url);
                    toolResults.push(toolResult);

                    let finishLine = `${index + 1}. **${this.formatToolCallLabel(toolName)}** 执行完成`;
                    if (toolName === 'web_search') {
                        try {
                            const parsed = JSON.parse(toolResult.content || '[]');
                            finishLine += `，共返回 ${Array.isArray(parsed) ? parsed.length : 0} 条结果`;
                        } catch {
                            // ignore parse failure
                        }
                    }
                    if (toolName === 'generate_image') {
                        finishLine += '，已拿到图片地址';
                    }

                    this.updateMessageToolTrace(assistantMessage, [assistantMessage.toolTrace || '', finishLine].filter(Boolean).join('\n'));
                }

                assistantMessage.content = '';
                this.saveSessions();
                this.updateMessageBubble(assistantMessage.id, '', '', assistantMessage.toolTrace || '');

                const finalPass = await this.streamAssistantResponse({
                    messages: messages.concat(assistantToolMessage, toolResults),
                    token,
                    url,
                    tools: undefined,
                    assistantMessage
                });

                replyContent = finalPass.replyContent;

                if (!replyContent.trim()) {
                    const imageToolResult = toolResults.find(item => item && item.name === 'generate_image');
                    if (imageToolResult) {
                        try {
                            const imagePayload = JSON.parse(imageToolResult.content || '{}');
                            if (imagePayload && imagePayload.url) {
                                replyContent = `![AI生成图片](${imagePayload.url})`;
                                assistantMessage.content = replyContent;
                                this.saveSessions();
                                this.updateMessageBubble(assistantMessage.id, replyContent, '');
                            }
                        } catch {
                            // ignore fallback parse failure
                        }
                    }
                }
            }

            if (!replyContent.trim()) {
                assistantMessage.content = '【请求失败】接口未返回有效内容';
                this.sessionThinkingById[this.currentSessionId] = '';
                this.sessionThinkingMessageIdById[this.currentSessionId] = null;
                this.saveSessions();
                this.updateMessageBubble(assistantMessage.id, assistantMessage.content, '');
            }

            session.updatedAt = new Date().toISOString();
            this.saveSessions();
            this.renderSessionList();
            this.updateInputPlaceholder();
        } catch (e) {
            this.sessionThinkingById[this.currentSessionId] = '';
            this.sessionThinkingMessageIdById[this.currentSessionId] = null;

            if (assistantMessage) {
                assistantMessage.content = this.getRequestErrorText(e, '请求失败');
            } else {
                assistantMessage = {
                    id: 'msg_' + (Date.now() + 2),
                    role: 'assistant',
                    content: this.getRequestErrorText(e, '请求失败'),
                    time: new Date().toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                };
                session.messages.push(assistantMessage);
            }

            session.updatedAt = new Date().toISOString();
            this.saveSessions();
            this.renderSessionList();

            if (assistantMessage && assistantMessage.id) {
                this.updateMessageBubble(assistantMessage.id, assistantMessage.content, '');
            } else {
                this.renderChat();
            }
        } finally {
            this.isSending = false;
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
        if (event)
            event.stopPropagation();

        const text = typeof content === 'string' ? content : String(content ?? '');

        const fallbackCopy = () => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.top = '-9999px';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();

            let ok = false;
            try {
                ok = document.execCommand('copy');
            } catch {
                ok = false;
            }

            document.body.removeChild(textarea);

            if (ok) {
                this.showToast('已复制到剪贴板');
            } else {
                this.showToast('复制失败，请手动复制');
            }
        };

        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    this.showToast('已复制到剪贴板');
                })
                .catch(() => {
                    fallbackCopy();
                });
            return;
        }

        fallbackCopy();
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

    getUserMessageRound(session, messageId) {
        if (!session || !Array.isArray(session.messages))
            return null;

        const startIndex = session.messages.findIndex(message => message && message.id === messageId);
        if (startIndex < 0)
            return null;

        const userMessage = session.messages[startIndex];
        if (!userMessage || userMessage.role !== 'user')
            return null;

        let endIndex = startIndex;
        for (let index = startIndex + 1; index < session.messages.length; index++) {
            const currentMessage = session.messages[index];
            if (!currentMessage)
                continue;
            if (currentMessage.role === 'user')
                break;
            endIndex = index;
        }

        return {
            startIndex,
            endIndex,
            userMessage,
            removedMessages: session.messages.slice(startIndex, endIndex + 1)
        };
    }

    removeMessageRound(session, roundInfo) {
        if (!session || !roundInfo)
            return;

        const removedMessages = Array.isArray(roundInfo.removedMessages) ? roundInfo.removedMessages : [];
        const thinkingMessageId = this.sessionThinkingMessageIdById[this.currentSessionId];

        if (thinkingMessageId && removedMessages.some(message => message && message.id === thinkingMessageId)) {
            this.sessionThinkingById[this.currentSessionId] = '';
            this.sessionThinkingMessageIdById[this.currentSessionId] = null;
        }

        session.messages.splice(roundInfo.startIndex, roundInfo.endIndex - roundInfo.startIndex + 1);
        session.updatedAt = new Date().toISOString();
    }

    async resendMessage(messageId, event) {
        if (event)
            event.stopPropagation();

        if (this.isSending) {
            this.showToast('请等待当前回复完成后再重发');
            return;
        }

        const session = this.sessions[this.currentSessionId];
        const roundInfo = this.getUserMessageRound(session, messageId);
        if (!roundInfo) {
            this.showToast('只能重发用户发送的消息');
            return;
        }

        const resendContent = typeof roundInfo.userMessage.content === 'string'
            ? roundInfo.userMessage.content.trim()
            : '';
        if (!resendContent) {
            this.showToast('这条消息内容为空，无法重发');
            return;
        }

        const assistantCount = Math.max(0, roundInfo.endIndex - roundInfo.startIndex);
        const confirmText = assistantCount > 0
            ? '确定要重发这条消息吗？当前这条消息及其回答会被删除，然后重新发送。'
            : '确定要重发这条消息吗？当前这条消息会被删除，然后重新发送。';

        if (!confirm(confirmText))
            return;

        this.removeMessageRound(session, roundInfo);
        this.saveSessions();
        this.renderSessionList();
        this.renderChat();
        this.updateInputPlaceholder();

        await this.sendMessage({ content: resendContent, source: 'resend' });
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
                const roleName = role ? role.name : this.getDefaultRole().name;

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
            ${this.renderPersonaBanner(session)}
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
            const toolTraceHtml = msg.toolTrace ? marked.parse(msg.toolTrace) : '';
            const assistantDisplayName = this.getAssistantDisplayName(session);

            return `
                <div class="message ${isCollapsed ? 'collapsed' : ''}" data-message-id="${msg.id}">
                    <div class="message-avatar ${msg.role}">${isUser ? '👤' : '🤖'}</div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-author">${this.escapeHtml(isUser ? '你' : assistantDisplayName)}</span>
                            <span class="message-time">${msg.time}</span>
                        </div>
                        ${reasoningHtml ? `
                            <details class="message-reasoning" open>
                                <summary>思考过程</summary>
                                <div class="message-reasoning-body">${reasoningHtml}</div>
                            </details>
                        ` : ''}
                        ${toolTraceHtml ? `
                            <details class="message-tooltrace" open>
                                <summary>工具调用过程</summary>
                                <div class="message-tooltrace-body">${toolTraceHtml}</div>
                            </details>
                        ` : ''}
                        <div class="message-body">${html}</div>
                        <div class="message-actions">
                            <button class="message-action message-action-collapse" onclick="chatApp.toggleMessageCollapse('${msg.id}', event)">
                                ${isCollapsed ? '展开' : '收起'}
                            </button>
                            ${isUser ? `
                                <button class="message-action" onclick="chatApp.resendMessage('${msg.id}', event)">
                                    重发
                                </button>
                            ` : ''}
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

    updateMessageBubble(messageId, content, reasoning = '', toolTrace) {
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

        if (toolTrace !== undefined) {
            let toolTraceWrap = messageEl.querySelector('.message-tooltrace');

            if (!toolTrace) {
                if (toolTraceWrap) {
                    toolTraceWrap.remove();
                }
            } else {
                if (!toolTraceWrap) {
                    const contentEl = messageEl.querySelector('.message-content');
                    const bodyEl = messageEl.querySelector('.message-body');
                    if (contentEl) {
                        toolTraceWrap = document.createElement('details');
                        toolTraceWrap.className = 'message-tooltrace';
                        toolTraceWrap.open = true;
                        toolTraceWrap.innerHTML = '<summary>工具调用过程</summary><div class="message-tooltrace-body"></div>';
                        if (bodyEl) {
                            bodyEl.insertAdjacentElement('beforebegin', toolTraceWrap);
                        } else {
                            contentEl.appendChild(toolTraceWrap);
                        }
                    }
                }

                const toolTraceBodyEl = messageEl.querySelector('.message-tooltrace-body');
                if (toolTraceBodyEl) {
                    toolTraceBodyEl.innerHTML = marked.parse(toolTrace || '');
                    toolTraceBodyEl.querySelectorAll('pre code').forEach(block => {
                        hljs.highlightElement(block);
                    });
                }
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
        const activeRole = this.getActiveRole(session);
        const roleSelectorHtml = roles.length > 0
            ? this.renderRoleSelectorHtml(session, '选择一个你现在想对话的人物')
            : '';
        return `
            <div class="welcome-screen">
                <div class="welcome-icon">🎭</div>
                <h1 class="welcome-title">人物对话</h1>
                <p class="welcome-subtitle">
                    从人物列表里选一个你想交谈的对象，系统会自动切换到对应身份口吻与你对话。
                    每个会话的人物独立保存，你可以把不同人物放到不同会话中持续聊下去。
                </p>
                <p class="welcome-subtitle">当前对话人物：${this.escapeHtml(activeRole.name)}${selectedRole ? '' : '（默认）'}</p>
                ${roleSelectorHtml}
                <div class="quick-actions">
                    <div class="quick-actions-title">你可以直接开聊，也可以先选一个人物再开始：</div>
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
window.chatApp = chatApp;

let hasSyncedInitialRoles = false;
function syncChatAfterRolesReady() {
    if (hasSyncedInitialRoles) {
        return;
    }

    hasSyncedInitialRoles = true;
    chatApp.syncCurrentSessionState();
    chatApp.renderSessionList();
    chatApp.renderChat();
    chatApp.updateInputPlaceholder();
}

window.addEventListener(window.roleReadyEventName || 'roles:loaded', () => {
    syncChatAfterRolesReady();
});

if (window.rolesReady && typeof window.rolesReady.then === 'function') {
    window.rolesReady.then(() => {
        syncChatAfterRolesReady();
    });
}

window.onLoginSuccess = function() {
    const app = document.getElementById('app');
    if (app) {
        app.style.display = 'flex';
    }

    chatApp.syncCurrentSessionState();
    chatApp.renderSessionList();
    chatApp.renderChat();
    chatApp.updateModelDisplay();
    chatApp.updateInputPlaceholder();

    if (window.rolesReady && typeof window.rolesReady.then === 'function') {
        window.rolesReady.then(() => {
            chatApp.syncCurrentSessionState();
            chatApp.renderChat();
            chatApp.updateInputPlaceholder();
        });
    }

    const input = document.getElementById('messageInput');
    if (input) {
        input.focus();
    }
};

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
