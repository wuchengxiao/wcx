// 全局文本API配置，只需在此处维护
window.globalTextApiConfig = {
    model: 'glm-4.7',
    apiUrl: '', // 留空表示用登录后的url
    temperature: 1.0,
    web_search: true,
    stream: true
};

// 通用文本API请求（非流式，返回完整结果）
async function requestTextByMessages({ messages, token, url }) {
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
            stream: cfg.stream
        })
    };
    try {
        const res = await fetch(apiUrl, options);
        const data = await res.json();
        return data;
    } catch (err) {
        console.error('文本API请求失败:', err);
        return null;
    }
}
window.requestTextByMessages = requestTextByMessages;
