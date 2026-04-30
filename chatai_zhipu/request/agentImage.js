// 百度智能体平台API调用实现
(function (fun) {
    fun();
})(function () {
    const API_URL = 'https://agentapi.baidu.com/assistant/conversation';

    window.BaiduAgentConfig = {
        APP_ID: 'am0E1J6JLxOrUkviDlGtZ0RWDtvIhcuQ',
        SECRET_KEY: 'pPnkLLIvAXWYna7X8kOHwj7sa4izcZLD'
    };

    window.BaiduAgentState = {
        threadId: ''
    };

    function tryParseBaiduAgentResponse(text) {
        if (typeof text !== 'string') return null;
        const trimmed = text.trim();
        if (!trimmed) return null;
        try {
            return JSON.parse(trimmed);
        } catch {
            return null;
        }
    }

    function getBaiduAgentErrorMessage(payload, fallback = '百度智能体请求失败') {
        if (!payload) return fallback;
        if (payload instanceof Error) return payload.message || fallback;
        if (typeof payload === 'string') return payload.trim() || fallback;
        if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
        if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail.trim();
        if (payload.error) return getBaiduAgentErrorMessage(payload.error, fallback);
        return fallback;
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

    async function getBaiduAgentConversation(userText, callbacks) {
        const cfg = window.BaiduAgentConfig || {};
        const state = window.BaiduAgentState || {};
        const appId = cfg.APP_ID;
        const secretKey = cfg.SECRET_KEY;

        if (!appId || !secretKey) {
            throw new Error('百度智能体配置不完整，请检查APP_ID和SECRET_KEY');
        }

        const url = `${API_URL}?appId=${appId}&secretKey=${secretKey}`;

        const payload = {
            threadId: state.threadId || '',
            message: {
                content: {
                    type: 'text',
                    value: { showText: userText }
                }
            },
            source: appId,
            from: 'openapi',
            openId: 'wcx'
        };

        const controller = new AbortController();
        const timeoutMs = Number(cfg.timeoutMs) > 0 ? Number(cfg.timeoutMs) : 60000;
        const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            if (!response.ok) throw new Error('网络响应错误');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let botResponseText = '';
            let hasMarkdownContent = false;
            let fullDataBuffer = '';
            let latestToolsStatus = [];
            let renderedImageUrls = [];
            let hasImage = false;

            if (callbacks?.onStart) callbacks.onStart();

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
                                    if (callbacks?.onThinking) {
                                        callbacks.onThinking(latestToolsStatus);
                                    }
                                }

                                if (item?.dataType === 'uiData') {
                                    const imageUrls = collectUiImageUrls(item?.data);
                                    imageUrls.forEach(imageUrl => {
                                        hasImage = true;
                                        renderedImageUrls.push(imageUrl);
                                        if (callbacks?.onImage) {
                                            callbacks.onImage(imageUrl, item?.data?.description || item?.data?.tag || '图片');
                                        }
                                    });
                                }
                            });

                            if (callbacks?.onUpdate) {
                                callbacks.onUpdate(botResponseText, hasMarkdownContent);
                            }
                        }
                    } catch (e) {
                        console.warn('JSON解析错误', e);
                    }
                }
            }

            if (callbacks?.onComplete) {
                callbacks.onComplete({
                    text: botResponseText,
                    hasMarkdown: hasMarkdownContent,
                    images: renderedImageUrls,
                    hasImage: hasImage,
                    threadId: state.threadId
                });
            }

            return {
                text: botResponseText,
                hasMarkdown: hasMarkdownContent,
                images: renderedImageUrls,
                hasImage: hasImage,
                threadId: state.threadId
            };

        } catch (err) {
            console.error('百度智能体对话失败:', err);
            if (err.name === 'AbortError') {
                throw new Error('百度智能体对话超时，请稍后重试');
            }
            throw (err instanceof Error ? err : new Error(getBaiduAgentErrorMessage(err, '百度智能体对话失败')));
        } finally {
            window.clearTimeout(timeoutId);
        }
    }

    async function clearBaiduAgentSession() {
        window.BaiduAgentState.threadId = '';
    }

    window.getBaiduAgentConversation = getBaiduAgentConversation;
    window.clearBaiduAgentSession = clearBaiduAgentSession;
});