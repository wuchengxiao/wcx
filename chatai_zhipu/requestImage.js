// 全局文本API配置，只需在此处维护
window.globalImageApiConfig = {
    model: 'Cogview-3-Flash',
    apiUrl: '', // 留空表示用登录后的url
    apiKey: '', // 留空表示用登录后的key
    size: '1280x1280',
};

// 通用文生图API请求
async function requestImageByPrompt({ prompt, token, url }) {
    const cfg = window.globalImageApiConfig;
    if (!prompt) throw new Error('prompt不能为空');
    const options = {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + (token || cfg.apiKey),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: cfg.model,
            prompt,
            size: cfg.size
        })
    };
    try {
        const res = await fetch(url || cfg.apiUrl, options);
        const data = await res.json();
        if (data && data.data && data.data[0] && data.data[0].url) {
            return data.data[0].url;
        } else {
            throw new Error('未获取到图片链接');
        }
    } catch (err) {
        console.error('文生图API请求失败:', err);
        return null;
    }
}
window.requestImageByPrompt = requestImageByPrompt;
