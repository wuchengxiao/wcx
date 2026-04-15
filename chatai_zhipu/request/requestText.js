// 全局文本API配置，只需在此处维护
window.globalTextApiConfig = {
    model: 'GLM-4.7-Flash',
    apiUrl: '', // 留空表示用登录后的url
    temperature: 1.0,
    web_search: false,
    stream: true,
    timeoutMs: 120000,
    streamIdleTimeoutMs: 180000
};

function tryParseJson(text) {
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
        return JSON.parse(trimmed);
    } catch {
        return null;
    }
}

function getApiErrorMessage(payload, fallback = '请求失败') {
    if (!payload) return fallback;
    if (payload instanceof Error) return payload.message || fallback;
    if (typeof payload === 'string') return payload.trim() || fallback;
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
    if (payload.error) return getApiErrorMessage(payload.error, fallback);
    if (typeof payload.msg === 'string' && payload.msg.trim()) return payload.msg.trim();
    return fallback;
}

function normalizeRequestError(error, fallback = '请求失败') {
    if (error && error.name === 'AbortError') {
        const reasonMessage = error && typeof error.message === 'string' ? error.message.trim() : '';
        return new Error(reasonMessage || '请求超时，请稍后重试');
    }

    const message = getApiErrorMessage(error, fallback);
    return error instanceof Error
        ? new Error(error.message || message)
        : new Error(message);
}

async function getResponseError(res, fallback = '请求失败') {
    const statusText = res && res.status ? `（HTTP ${res.status}）` : '';
    const responseText = await res.text();
    const payload = tryParseJson(responseText);
    const message = getApiErrorMessage(payload || responseText, `${fallback}${statusText}`);
    return new Error(message);
}

function parseStreamPayload(line) {
    const trimmed = String(line || '').trim();
    if (!trimmed || trimmed === 'data: [DONE]') return null;

    const jsonStr = trimmed.startsWith('data: ')
        ? trimmed.slice(6).trim()
        : trimmed;

    if (!jsonStr || jsonStr === '[DONE]') return null;

    const data = JSON.parse(jsonStr);
    if (data && data.error) {
        throw normalizeRequestError(data.error, '文本请求失败');
    }

    return data;
}

// 通用文本API请求（流式，返回异步生成器）
async function* requestTextByMessages({ messages, token, url, tools, tool_choice }) {
    const cfg = window.globalTextApiConfig;
    const apiUrl = url || cfg.apiUrl;
    if (!apiUrl) throw new Error('API地址未配置');
    if (!token) throw new Error('未检测到API密钥');
    const requestBody = {
        model: cfg.model,
        messages,
        temperature: cfg.temperature,
        web_search: cfg.web_search,
        stream: true
    };

    if (Array.isArray(tools) && tools.length) {
        requestBody.tools = tools;
        requestBody.tool_choice = tool_choice || 'auto';
    }

    const options = {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        signal: undefined,
        body: JSON.stringify(requestBody)
    };
    const controller = new AbortController();
    const timeoutMs = Number(cfg.timeoutMs) > 0 ? Number(cfg.timeoutMs) : 30000;
    const streamIdleTimeoutMs = Number(cfg.streamIdleTimeoutMs) > 0
        ? Number(cfg.streamIdleTimeoutMs)
        : Math.max(timeoutMs, 120000);
    let timeoutId = null;
    let abortMessage = '';
    const abortRequest = function(message) {
        abortMessage = typeof message === 'string' ? message : '请求已中断';
        if (!controller.signal.aborted) {
            controller.abort(new DOMException(abortMessage, 'AbortError'));
        }
    };
    const resetAbortTimer = function(nextTimeoutMs) {
        if (timeoutId) {
            window.clearTimeout(timeoutId);
        }
        timeoutId = window.setTimeout(() => {
            abortRequest(nextTimeoutMs === streamIdleTimeoutMs
                ? '流式响应长时间无新内容，请稍后重试'
                : '请求连接超时，请稍后重试');
        }, nextTimeoutMs);
    };

    resetAbortTimer(timeoutMs);
    options.signal = controller.signal;

    try {
        const res = await fetch(apiUrl, options);
        if (!res.ok) {
            throw await getResponseError(res, '文本请求失败');
        }

        if (!res.body) {
            throw new Error('接口未返回可读取的响应内容');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        resetAbortTimer(streamIdleTimeoutMs);

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            resetAbortTimer(streamIdleTimeoutMs);

            buffer += decoder.decode(value, { stream: true });
            //buffer = "{"error":{"code":"1302","message":"Rate limit reached for requests"}}"

            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                try {
                    const data = parseStreamPayload(line);
                    if (data) {
                        yield data;
                    }
                } catch (e) {
                    console.error('解析流式数据失败:', e);
                    throw normalizeRequestError(e, '解析响应数据失败');
                }
            }
        }

        const tail = buffer.trim();
        if (tail) {
            const data = parseStreamPayload(tail);
            if (data) {
                yield data;
            }
        }
    } catch (err) {
        console.error('文本API请求失败:', err);
        if (err && err.name === 'AbortError' && abortMessage) {
            throw new Error(abortMessage);
        }
        throw normalizeRequestError(err, '文本请求失败');
    } finally {
        if (timeoutId) {
            window.clearTimeout(timeoutId);
        }
    }
}
window.requestTextByMessages = requestTextByMessages;
