// 全局文本API配置，只需在此处维护
window.globalTextApiConfig = {
    model: 'GLM-4.7-Flash',
    apiUrl: '', // 留空表示用登录后的url
    temperature: 1.0,
    web_search: false,
    stream: true
};

// 通用文本API请求（流式，返回异步生成器）
async function* requestTextByMessages({ messages, token, url }) {
    const cfg = window.globalTextApiConfig;
    const apiUrl = url || cfg.apiUrl;
    if (!apiUrl) throw new Error('API地址未配置');
    if (!token) throw new Error('未检测到API密钥');
    const options = {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: cfg.model,
            messages,
            temperature: cfg.temperature,
            web_search: cfg.web_search,
            stream: true
        })
    };
    try {
        const res = await fetch(apiUrl, options);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                if (trimmed.startsWith('data: ')) {
                    try {
                        const jsonStr = trimmed.slice(6);
                        const data = JSON.parse(jsonStr);
                        yield data;
                    } catch (e) {
                        console.error('解析流式数据失败:', e);
                    }
                }
            }
        }
    } catch (err) {
        console.error('文本API请求失败:', err);
        yield null;
    }
}
window.requestTextByMessages = requestTextByMessages;
