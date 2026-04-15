// Function Calling 自动决策主流程（纯静态页面版）

(function() {
    function parseToolArguments(toolCall) {
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

    async function executeToolCall(toolCall, token, url) {
        const toolName = toolCall && toolCall.function ? toolCall.function.name : '';
        const args = parseToolArguments(toolCall);

        if (toolName === 'web_search') {
            if (!window.requestWebSearch) {
                throw new Error('网络搜索功能未加载，请刷新页面后重试。');
            }
            const query = typeof args.query === 'string' ? args.query.trim() : '';
            const result = await window.requestWebSearch(query);
            return {
                role: 'tool',
                tool_call_id: toolCall.id || '',
                name: 'web_search',
                content: JSON.stringify(result)
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

    window.chatWithFunctionCalling = async function(messages, options) {
        const opts = options || {};
        const llm = typeof opts.callLLM === 'function' ? opts.callLLM : window.callLLM;
        const tools = Array.isArray(opts.tools) ? opts.tools : window.llmTools;
        const token = opts.token || (window.processinput && window.processinput.processedApiKey ? window.processinput.processedApiKey : '');
        const url = opts.url || (window.processinput && window.processinput.processedUrl ? window.processinput.processedUrl : '');

        if (typeof llm !== 'function') {
            throw new Error('LLM 调用函数未加载，请刷新页面后重试。');
        }

        const firstResponse = await llm({
            messages,
            tools,
            token,
            url
        });

        if (!firstResponse || !Array.isArray(firstResponse.tool_calls) || !firstResponse.tool_calls.length) {
            return {
                type: 'text',
                content: firstResponse && typeof firstResponse.content === 'string' ? firstResponse.content : ''
            };
        }

        const assistantToolMessage = {
            role: 'assistant',
            content: firstResponse.content || '',
            tool_calls: firstResponse.tool_calls
        };
        const toolResults = [];

        for (const toolCall of firstResponse.tool_calls) {
            toolResults.push(await executeToolCall(toolCall, token, url));
        }

        const finalResponse = await llm({
            messages: messages.concat(assistantToolMessage, toolResults),
            tools,
            token,
            url
        });

        return {
            type: 'text',
            content: finalResponse && typeof finalResponse.content === 'string' ? finalResponse.content : '',
            tool_calls: firstResponse.tool_calls,
            tool_results: toolResults
        };
    };
})();
