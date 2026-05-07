(function (fun) {
    fun();
})(function () {
    const API_URL = 'https://agentapi.baidu.com/assistant/conversation';

    window.RoleAgentModelConfig = {
        APP_ID: 'VmtYVYxVXlWa1pQVm1ocFRUSjRWbFJYTVRCT1JsSldXa1JDVjJKR1dsbFpNRlUxVlRGYVJsTllaRlZXZWtaUVZGVmtUMVpzU25WaVJrSlhVbFJXVDFkWGVHdGlhekZ5VGxab1VGSkVRVGs9',
        SECRET_KEY: 'VlZd1UyUlhTbGhhUlhCT1RVaENTbGRZY0c5VVJtUjFZVE53VDJWc1JqTldSM2hYVkd4SmQxUnFWazlTYkVwRldrVldNRTVHV25SVVZEQTk=',
        timeoutMs: 60000
    };

    window.RoleAgentModelState = {
        threadId: ''
    };

    function getRoleAgentModelErrorMessage(payload, fallback = 'role-agent 请求失败') {
        if (!payload) return fallback;
        if (payload instanceof Error) return payload.message || fallback;
        if (typeof payload === 'string') return payload.trim() || fallback;
        if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
        if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail.trim();
        if (payload.error) return getRoleAgentModelErrorMessage(payload.error, fallback);
        return fallback;
    }

    function collectRoleAgentImageUrls(uiData) {
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

    async function getRoleAgentModelConversation(userText, callbacks) {
        const cfg = window.RoleAgentModelConfig || {};
        const state = window.RoleAgentModelState || {};
        
        const savedToken = getTokenFromStorage();
        const inputVars = savedToken.split('-');

        const appId = decryptStringNTimes(inputVars[2], insertCharAtPosition(inputVars[0], 'a', cfg.APP_ID));;
        const secretKey = decryptStringNTimes(inputVars[5], insertCharAtPosition(inputVars[3], 'o', cfg.SECRET_KEY));

        if (!appId || !secretKey || appId === 'YOUR_ROLE_AGENT_APP_ID' || secretKey === 'YOUR_ROLE_AGENT_SECRET_KEY') {
            throw new Error('请先在 request/roleAgent.js 中填写 role-agent 的 APP_ID 和 SECRET_KEY');
        }

        const url = `${API_URL}?appId=${encodeURIComponent(appId)}&secretKey=${encodeURIComponent(secretKey)}`;

        const payload = {
            threadId: state.threadId || '',
            message: {
                content: {
                    type: 'text',
                    value: {
                        showText: userText
                    }
                }
            },
            source: appId,
            from: 'openapi',
            openId: 'web-chat'
        };

        const controller = new AbortController();
        const timeoutMs = Number(cfg.timeoutMs) > 0 ? Number(cfg.timeoutMs) : 60000;
        const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`网络响应错误（HTTP ${response.status}）`);
            }

            if (!response.body) {
                throw new Error('接口未返回可读取响应体');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullDataBuffer = '';
            let botResponseText = '';
            let hasMarkdownContent = false;
            let renderedImageUrls = [];
            const renderedImageUrlSet = new Set();

            if (callbacks && typeof callbacks.onStart === 'function') {
                callbacks.onStart();
            }

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

                        if (data && data.data && data.data.message && data.data.message.threadId) {
                            state.threadId = data.data.message.threadId;
                        }

                        if (data && data.status === 0 && data.data && data.data.message && Array.isArray(data.data.message.content)) {
                            data.data.message.content.forEach(item => {
                                if (item && item.dataType === 'markdown') {
                                    hasMarkdownContent = true;
                                    botResponseText += (item.data && item.data.text) || '';
                                } else if (item && item.dataType === 'text') {
                                    botResponseText += (item.data && item.data.text) || '';
                                } else if (item && item.dataType === 'uiData') {
                                    const imageUrls = collectRoleAgentImageUrls(item.data);
                                    const imageAlt = item && item.data && (item.data.description || item.data.tag)
                                        ? String(item.data.description || item.data.tag).trim()
                                        : 'AI生成图片';

                                    imageUrls.forEach(imageUrl => {
                                        if (!renderedImageUrlSet.has(imageUrl)) {
                                            renderedImageUrlSet.add(imageUrl);
                                            renderedImageUrls.push(imageUrl);
                                            hasMarkdownContent = true;

                                            if (botResponseText && !botResponseText.endsWith('\n')) {
                                                botResponseText += '\n';
                                            }
                                            botResponseText += `\n![${imageAlt}](${imageUrl})\n`;

                                            if (callbacks && typeof callbacks.onImage === 'function') {
                                                callbacks.onImage(imageUrl, imageAlt);
                                            }
                                        }
                                    });
                                }
                            });

                            if (callbacks && typeof callbacks.onUpdate === 'function') {
                                callbacks.onUpdate(botResponseText, hasMarkdownContent);
                            }
                        }
                    } catch (e) {
                        console.warn('role-agent JSON 解析错误', e);
                    }
                }
            }

            if (callbacks && typeof callbacks.onComplete === 'function') {
                callbacks.onComplete({
                    text: botResponseText,
                    hasMarkdown: hasMarkdownContent,
                    images: renderedImageUrls,
                    hasImage: renderedImageUrls.length > 0,
                    threadId: state.threadId
                });
            }

            return {
                text: botResponseText,
                hasMarkdown: hasMarkdownContent,
                images: renderedImageUrls,
                hasImage: renderedImageUrls.length > 0,
                threadId: state.threadId
            };
        } catch (err) {
            console.error('role-agent 对话失败:', err);
            if (err && err.name === 'AbortError') {
                throw new Error('role-agent 对话超时，请稍后重试');
            }
            throw (err instanceof Error
                ? err
                : new Error(getRoleAgentModelErrorMessage(err, 'role-agent 对话失败')));
        } finally {
            window.clearTimeout(timeoutId);
        }
    }

    async function clearRoleAgentModelSession() {
        window.RoleAgentModelState.threadId = '';
    }

    window.getRoleAgentModelConversation = getRoleAgentModelConversation;
    window.clearRoleAgentModelSession = clearRoleAgentModelSession;
});