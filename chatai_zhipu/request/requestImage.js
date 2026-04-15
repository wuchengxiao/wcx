// 全局文本API配置，只需在此处维护
window.globalImageApiConfig = {
    model: 'Cogview-3-Flash',
    apiUrl: '', // 留空表示用登录后的url
    apiKey: '', // 留空表示用登录后的key
    size: '1280x1280',
    timeoutMs: 30000,
};

function tryParseImageResponse(text) {
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
        return JSON.parse(trimmed);
    } catch {
        return null;
    }
}

function getImageErrorMessage(payload, fallback = '图片请求失败') {
    if (!payload) return fallback;
    if (payload instanceof Error) return payload.message || fallback;
    if (typeof payload === 'string') return payload.trim() || fallback;
    if (payload.error) return getImageErrorMessage(payload.error, fallback);
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
    if (typeof payload.msg === 'string' && payload.msg.trim()) return payload.msg.trim();
    return fallback;
}

// 通用文生图API请求
async function requestImageByPrompt({ prompt, token, url }) {
    const cfg = window.globalImageApiConfig;
    const imgUrl = url.replace('/v4/chat/completions', '/v4/images/generations');
    if (!prompt) throw new Error('prompt不能为空');
    const controller = new AbortController();
    const timeoutMs = Number(cfg.timeoutMs) > 0 ? Number(cfg.timeoutMs) : 30000;
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    const options = {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + (token || cfg.apiKey),
            'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
            model: cfg.model,
            prompt,
            size: cfg.size
        })
    };
    try {
        const res = await fetch(imgUrl || cfg.apiUrl, options);
        if (!res.ok) {
            const responseText = await res.text();
            const payload = tryParseImageResponse(responseText);
            const statusText = res.status ? `（HTTP ${res.status}）` : '';
            throw new Error(getImageErrorMessage(payload || responseText, `图片请求失败${statusText}`));
        }

        const data = await res.json();
        if (data && data.data && data.data[0] && data.data[0].url) {
            return data.data[0].url;
        } else {
            throw new Error(getImageErrorMessage(data, '未获取到图片链接'));
        }
    } catch (err) {
        console.error('文生图API请求失败:', err);
        if (err && err.name === 'AbortError') {
            throw new Error('图片请求超时，请稍后重试');
        }
        throw (err instanceof Error ? err : new Error(getImageErrorMessage(err, '图片请求失败')));
    } finally {
        window.clearTimeout(timeoutId);
    }
}
window.requestImageByPrompt = requestImageByPrompt;
