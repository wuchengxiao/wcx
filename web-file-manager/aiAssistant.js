/**
 * aiAssistant.js
 * AI协助功能模块 - 通过AI API方式快速创建、修改、操作文件
 */

const AI_ASSISTANT_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'list_files',
            description: '获取当前所有文件列表，了解已存在的文件',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_file',
            description: '获取指定文件的详细信息和内容',
            parameters: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: '文件ID'
                    },
                    name: {
                        type: 'string',
                        description: '文件名（如果不知道ID，可以用名称查询）'
                    }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_file',
            description: '创建新文件',
            parameters: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string',
                        description: '文件名（包含扩展名，如 memo.md, style.css）'
                    },
                    content: {
                        type: 'string',
                        description: '文件初始内容'
                    }
                },
                required: ['name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'update_file',
            description: '更新文件内容',
            parameters: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: '文件ID'
                    },
                    name: {
                        type: 'string',
                        description: '文件名（如果不知道ID，可以用名称查询）'
                    },
                    content: {
                        type: 'string',
                        description: '新的文件内容'
                    }
                },
                required: ['content']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'delete_file',
            description: '删除指定文件',
            parameters: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: '文件ID'
                    },
                    name: {
                        type: 'string',
                        description: '文件名（如果不知道ID，可以用名称查询）'
                    }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'search_files',
            description: '按关键字搜索文件',
            parameters: {
                type: 'object',
                properties: {
                    keyword: {
                        type: 'string',
                        description: '搜索关键字'
                    }
                },
                required: ['keyword']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_file_lines',
            description: '获取文件指定行范围的内容',
            parameters: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: '文件ID'
                    },
                    name: {
                        type: 'string',
                        description: '文件名（如果不知道ID，可以用名称查询）'
                    },
                    startLine: {
                        type: 'number',
                        description: '起始行（从1开始）'
                    },
                    endLine: {
                        type: 'number',
                        description: '结束行（包含）'
                    }
                },
                required: ['startLine', 'endLine']
            }
        }
    }
];

class AIAssistant {
    constructor() {
        this.dialogVisible = false;
        this.conversation = [];
        this.isProcessing = false;
        this.init();
    }

    init() {
        this.createDialog();
        this.bindEvents();
    }

    createDialog() {
        const dialogHTML = `
            <div id="ai-assistant-overlay" class="ai-assistant-overlay"></div>
            <div id="ai-assistant-dialog" class="ai-assistant-dialog">
                <div class="ai-assistant-header">
                    <div class="ai-assistant-title">
                        <span class="ai-icon">🤖</span>
                        <span>AI 协助</span>
                    </div>
                    <button id="ai-assistant-close" class="ai-assistant-close-btn">×</button>
                </div>
                <div id="ai-assistant-messages" class="ai-assistant-messages">
                    <div class="ai-assistant-welcome">
                        <p>👋 你好！我是你的 AI 文件助手。</p>
                        <p>你可以用自然语言描述你想要对文件进行的操作，例如：</p>
                        <ul>
                            <li>创建一个名为 "notes.md" 的文件，内容是待办事项清单</li>
                            <li>修改 "示例代码.js"，添加一个计算平方的函数</li>
                            <li>删除 "旧文件.txt"</li>
                            <li>查看所有文件列表</li>
                        </ul>
                        <p>我会自动帮你完成这些操作！</p>
                    </div>
                </div>
                <div class="ai-assistant-input-area">
                    <textarea 
                        id="ai-assistant-input" 
                        class="ai-assistant-input" 
                        placeholder="请描述你想对文件进行的操作..."
                        rows="2"
                    ></textarea>
                    <button id="ai-assistant-send" class="ai-assistant-send-btn">发送</button>
                </div>
            </div>
        `;

        const styleHTML = `
            <style>
                .ai-assistant-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 1000;
                    display: none;
                }
                .ai-assistant-overlay.show {
                    display: block;
                }
                .ai-assistant-dialog {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 90%;
                    max-width: 700px;
                    max-height: 80vh;
                    background: var(--bg-primary, #ffffff);
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                    z-index: 1001;
                    display: none;
                    flex-direction: column;
                }
                .ai-assistant-dialog.show {
                    display: flex;
                }
                .ai-assistant-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--border-color, #eee);
                }
                .ai-assistant-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--text-primary, #333);
                }
                .ai-icon {
                    font-size: 20px;
                }
                .ai-assistant-close-btn {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: var(--text-secondary, #999);
                    padding: 4px 8px;
                    border-radius: 4px;
                    transition: background 0.2s;
                }
                .ai-assistant-close-btn:hover {
                    background: var(--bg-secondary, #f5f5f5);
                }
                .ai-assistant-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px 20px;
                }
                .ai-assistant-welcome {
                    text-align: center;
                    color: var(--text-secondary, #666);
                    padding: 20px 0;
                }
                .ai-assistant-welcome p {
                    margin: 8px 0;
                }
                .ai-assistant-welcome ul {
                    text-align: left;
                    margin: 12px auto;
                    max-width: 400px;
                    padding-left: 24px;
                }
                .ai-assistant-welcome li {
                    margin: 6px 0;
                }
                .ai-message {
                    margin-bottom: 16px;
                    display: flex;
                    gap: 10px;
                }
                .ai-message.user {
                    flex-direction: row-reverse;
                }
                .ai-message-avatar {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    flex-shrink: 0;
                }
                .ai-message.user .ai-message-avatar {
                    background: var(--primary-color, #4a90d9);
                    color: white;
                }
                .ai-message.assistant .ai-message-avatar {
                    background: var(--bg-secondary, #f5f5f5);
                    color: var(--text-primary, #333);
                }
                .ai-message-content {
                    max-width: 80%;
                    padding: 10px 14px;
                    border-radius: 12px;
                    font-size: 14px;
                    line-height: 1.5;
                }
                .ai-message.user .ai-message-content {
                    background: var(--primary-color, #4a90d9);
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                .ai-message.assistant .ai-message-content {
                    background: var(--bg-secondary, #f5f5f5);
                    color: var(--text-primary, #333);
                    border-bottom-left-radius: 4px;
                }
                .ai-message-content pre {
                    background: rgba(0,0,0,0.1);
                    padding: 8px 12px;
                    border-radius: 6px;
                    overflow-x: auto;
                    font-size: 12px;
                }
                .ai-message-content code {
                    background: rgba(0,0,0,0.1);
                    padding: 2px 4px;
                    border-radius: 4px;
                    font-size: 13px;
                }
                .ai-assistant-input-area {
                    display: flex;
                    gap: 10px;
                    padding: 16px 20px;
                    border-top: 1px solid var(--border-color, #eee);
                }
                .ai-assistant-input {
                    flex: 1;
                    padding: 10px 14px;
                    border: 1px solid var(--border-color, #ddd);
                    border-radius: 8px;
                    font-size: 14px;
                    resize: vertical;
                    min-height: 44px;
                    max-height: 150px;
                }
                .ai-assistant-input:focus {
                    outline: none;
                    border-color: var(--primary-color, #4a90d9);
                }
                .ai-assistant-send-btn {
                    padding: 10px 24px;
                    background: var(--primary-color, #4a90d9);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                    flex-shrink: 0;
                }
                .ai-assistant-send-btn:hover {
                    background: var(--primary-dark, #3a7bc8);
                }
                .ai-assistant-send-btn:disabled {
                    background: #ccc;
                    cursor: not-allowed;
                }
                .ai-tool-call-info {
                    font-size: 12px;
                    color: var(--text-secondary, #999);
                    margin-top: 4px;
                    padding: 4px 8px;
                    background: var(--bg-tertiary, #f0f0f0);
                    border-radius: 4px;
                    font-family: monospace;
                }
                .ai-typing-indicator {
                    display: inline-flex;
                    gap: 4px;
                }
                .ai-typing-dot {
                    width: 6px;
                    height: 6px;
                    background: var(--text-secondary, #999);
                    border-radius: 50%;
                    animation: ai-typing 1.4s infinite ease-in-out both;
                }
                .ai-typing-dot:nth-child(1) { animation-delay: -0.32s; }
                .ai-typing-dot:nth-child(2) { animation-delay: -0.16s; }
                @keyframes ai-typing {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styleHTML);
        document.body.insertAdjacentHTML('beforeend', dialogHTML);

        this.overlay = document.getElementById('ai-assistant-overlay');
        this.dialog = document.getElementById('ai-assistant-dialog');
        this.messagesContainer = document.getElementById('ai-assistant-messages');
        this.input = document.getElementById('ai-assistant-input');
        this.sendBtn = document.getElementById('ai-assistant-send');
        this.closeBtn = document.getElementById('ai-assistant-close');
    }

    bindEvents() {
        this.closeBtn.addEventListener('click', () => this.closeDialog());
        this.overlay.addEventListener('click', () => this.closeDialog());
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    openDialog() {
        this.dialogVisible = true;
        this.overlay.classList.add('show');
        this.dialog.classList.add('show');
        this.input.focus();
    }

    closeDialog() {
        this.dialogVisible = false;
        this.overlay.classList.remove('show');
        this.dialog.classList.remove('show');
    }

    addMessage(role, content, toolCallInfo = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${role}`;

        const avatar = document.createElement('div');
        avatar.className = 'ai-message-avatar';
        avatar.textContent = role === 'user' ? '👤' : '🤖';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'ai-message-content';
        contentDiv.innerHTML = this.formatMessage(content);

        if (toolCallInfo) {
            const toolInfo = document.createElement('div');
            toolInfo.className = 'ai-tool-call-info';
            toolInfo.textContent = toolCallInfo;
            contentDiv.appendChild(toolInfo);
        }

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);

        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    formatMessage(content) {
        if (!content) return '';
        let formatted = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
            return `<pre><code>${code.trim()}</code></pre>`;
        });

        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

        formatted = formatted.replace(/\n/g, '<br>');

        return formatted;
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    showTyping() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'ai-message assistant';
        typingDiv.id = 'ai-typing-indicator';

        const avatar = document.createElement('div');
        avatar.className = 'ai-message-avatar';
        avatar.textContent = '🤖';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'ai-message-content';
        contentDiv.innerHTML = '<div class="ai-typing-indicator"><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div></div>';

        typingDiv.appendChild(avatar);
        typingDiv.appendChild(contentDiv);

        this.messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    removeTyping() {
        const typing = document.getElementById('ai-typing-indicator');
        if (typing) typing.remove();
    }

    async sendMessage() {
        const content = this.input.value.trim();
        if (!content || this.isProcessing) return;

        if (!window.globalTextApiConfig || !getApiToken()) {
            this.addMessage('assistant', '❌ 请先配置 AI API 密钥。');
            return;
        }

        this.input.value = '';
        this.isProcessing = true;
        this.sendBtn.disabled = true;

        this.addMessage('user', content);

        const welcome = document.querySelector('.ai-assistant-welcome');
        if (welcome) welcome.remove();

        this.showTyping();

        try {
            const systemContext = this.buildSystemContext();
            const messages = [
                systemContext,
                ...this.conversation,
                { role: 'user', content }
            ];

            const result = await this.processWithAI(messages);

            this.conversation.push({ role: 'user', content });
            this.conversation.push({ role: 'assistant', content: result });

            this.addMessage('assistant', result);

            window.dispatchEvent(new CustomEvent('ai-assistant-action', { detail: { action: 'refresh' } }));
        } catch (error) {
            console.error('AI协助处理失败:', error);
            this.addMessage('assistant', `❌ 处理失败：${error.message}`);
        } finally {
            this.removeTyping();
            this.isProcessing = false;
            this.sendBtn.disabled = false;
            this.input.focus();
        }
    }

    buildSystemContext() {
        const files = window.FileService.getAllFiles();
        const fileList = files.map(f => `- ${f.name} (ID: ${f.id})`).join('\n');

        return {
            role: 'system',
            content: `你是一个文件管理助手，负责帮助用户创建、修改、删除和查看文件。

当前文件列表：
${fileList || '暂无文件'}

可用工具：
1. list_files - 获取所有文件列表
2. get_file - 获取指定文件的详细信息和内容（需要ID或名称）
3. create_file - 创建新文件（需要文件名和可选内容）
4. update_file - 更新文件内容（需要ID或名称，以及新内容）
5. delete_file - 删除指定文件（需要ID或名称）
6. search_files - 按关键字搜索文件
7. get_file_lines - 获取文件指定行范围的内容

请根据用户需求，选择合适的工具进行操作。回答时请用自然、友好的语言向用户说明操作结果。`
        };
    }

    async processWithAI(messages) {
        let toolCalls = [];
        let toolResults = [];
        let finalAnswer = '';

        const processFirstPass = async () => {
            let choice = null;
            for await (const chunk of window.requestTextByMessages({
                messages,
                token: getApiToken(),
                url: window.globalTextApiConfig.apiUrl,
                tools: AI_ASSISTANT_TOOLS,
                tool_choice: 'auto'
            })) {
                choice = chunk.choices && chunk.choices[0] ? chunk.choices[0] : null;
                const delta = choice && choice.delta ? choice.delta : null;

                if (delta && Array.isArray(delta.tool_calls)) {
                    delta.tool_calls.forEach(toolCall => {
                        const idx = typeof toolCall.index === 'number' ? toolCall.index : toolCalls.length;
                        if (!toolCalls[idx]) {
                            toolCalls[idx] = {
                                id: toolCall.id || '',
                                type: toolCall.type || 'function',
                                function: {
                                    name: '',
                                    arguments: ''
                                }
                            };
                        }
                        if (toolCall.function && toolCall.function.name) {
                            toolCalls[idx].function.name = toolCall.function.name;
                        }
                        if (toolCall.function && typeof toolCall.function.arguments === 'string') {
                            toolCalls[idx].function.arguments += toolCall.function.arguments;
                        }
                    });
                }

                if (delta && typeof delta.content === 'string' && delta.content) {
                    finalAnswer += delta.content;
                }
            }

            const msg = choice && choice.message ? choice.message : null;
            if (msg && Array.isArray(msg.tool_calls)) {
                msg.tool_calls.forEach(toolCall => {
                    const idx = typeof toolCall.index === 'number' ? toolCall.index : toolCalls.length;
                    if (!toolCalls[idx]) {
                        toolCalls[idx] = { ...toolCall };
                    }
                });
            }

            if (msg && typeof msg.content === 'string' && msg.content) {
                finalAnswer += msg.content;
            }
        };

        await processFirstPass();

        toolCalls = toolCalls.filter(Boolean);

        if (toolCalls.length > 0) {
            for (const toolCall of toolCalls) {
                const result = await this.executeToolCall(toolCall);
                toolResults.push(result);
            }

            const secondPassMessages = [
                ...messages,
                {
                    role: 'assistant',
                    content: '',
                    tool_calls: toolCalls
                },
                ...toolResults
            ];

            finalAnswer = '';
            let choice = null;
            for await (const chunk of window.requestTextByMessages({
                messages: secondPassMessages,
                token: getApiToken(),
                url: window.globalTextApiConfig.apiUrl
            })) {
                choice = chunk.choices && chunk.choices[0] ? chunk.choices[0] : null;
                const delta = choice && choice.delta ? choice.delta : null;

                if (delta && typeof delta.content === 'string' && delta.content) {
                    finalAnswer += delta.content;
                }
            }

            const msg = choice && choice.message ? choice.message : null;
            if (msg && typeof msg.content === 'string' && msg.content) {
                finalAnswer += msg.content;
            }
        }

        return finalAnswer || '已完成操作。';
    }

    async executeToolCall(toolCall) {
        const toolName = toolCall && toolCall.function ? toolCall.function.name : '';
        let args = {};

        try {
            const argsStr = toolCall.function && typeof toolCall.function.arguments === 'string' 
                ? toolCall.function.arguments 
                : '{}';
            args = JSON.parse(argsStr);
        } catch {
            args = {};
        }

        let result = { success: false, message: '未知错误' };

        const fileId = args.id || this.resolveFileIdByName(args.name);

        switch (toolName) {
            case 'list_files':
                result = {
                    success: true,
                    files: window.FileService.getAllFiles()
                };
                break;

            case 'get_file':
                if (fileId) {
                    const file = window.FileService.getFileById(fileId);
                    result = file ? { success: true, file } : { success: false, message: '未找到文件' };
                } else if (args.name) {
                    result = { success: false, message: `未找到名为 "${args.name}" 的文件` };
                } else {
                    result = { success: false, message: '请提供文件ID或名称' };
                }
                break;

            case 'create_file':
                if (args.name) {
                    result = window.FileService.createFile(args.name, args.content || '');
                } else {
                    result = { success: false, message: '请提供文件名' };
                }
                break;

            case 'update_file':
                if (fileId && args.content !== undefined) {
                    result = window.FileService.updateFile(fileId, args.content);
                } else if (!fileId) {
                    result = { success: false, message: '请提供文件ID或名称' };
                } else {
                    result = { success: false, message: '请提供文件内容' };
                }
                break;

            case 'delete_file':
                if (fileId) {
                    result = window.FileService.deleteFile(fileId);
                } else if (args.name) {
                    result = { success: false, message: `未找到名为 "${args.name}" 的文件` };
                } else {
                    result = { success: false, message: '请提供文件ID或名称' };
                }
                break;

            case 'search_files':
                if (args.keyword) {
                    result = {
                        success: true,
                        files: window.FileService.searchFiles(args.keyword)
                    };
                } else {
                    result = { success: false, message: '请提供搜索关键字' };
                }
                break;

            case 'get_file_lines':
                if (fileId && args.startLine !== undefined && args.endLine !== undefined) {
                    result = window.FileService.getFileLines(fileId, args.startLine, args.endLine);
                } else if (!fileId) {
                    result = { success: false, message: '请提供文件ID或名称' };
                } else {
                    result = { success: false, message: '请提供起始行和结束行' };
                }
                break;

            default:
                result = { success: false, message: `未知工具: ${toolName}` };
        }

        return {
            role: 'tool',
            tool_call_id: toolCall.id || '',
            name: toolName,
            content: JSON.stringify(result)
        };
    }

    resolveFileIdByName(name) {
        if (!name) return null;
        const files = window.FileService.getAllFiles();
        const file = files.find(f => f.name.toLowerCase() === name.toLowerCase());
        return file ? file.id : null;
    }
}

window.AIAssistant = AIAssistant;
window.aiAssistant = new AIAssistant();

window.openAIAssistant = function() {
    window.aiAssistant.openDialog();
};