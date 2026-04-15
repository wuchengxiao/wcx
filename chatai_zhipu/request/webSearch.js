// 根据 constants.js 里的 webSearchUrl 和 webSearchApiKey 进行网络搜索
// 参考 requestText.js 和 requestImage.js 的写法，封装函数：参数是用户输入内容，返回搜索结果

window.globalWebSearchConfig = {
	timeoutMs: 30000,
	search_depth: 'basic', // 'basic' | 'advanced'
	max_results: 5,
	include_answer: false,
	include_raw_content: false,
	include_images: false,
	topic: 'general' // 'general' | 'news'
};

function tryParseWebSearchResponse(text) {
	if (typeof text !== 'string') return null;
	const trimmed = text.trim();
	if (!trimmed) return null;
	try {
		return JSON.parse(trimmed);
	} catch {
		return null;
	}
}

function getWebSearchErrorMessage(payload, fallback = '网络搜索失败') {
	if (!payload) return fallback;
	if (payload instanceof Error) return payload.message || fallback;
	if (typeof payload === 'string') return payload.trim() || fallback;
	if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
	if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail.trim();
	if (payload.error) return getWebSearchErrorMessage(payload.error, fallback);
	return fallback;
}

function normalizeWebSearchResults(data) {
	const list = Array.isArray(data && data.results) ? data.results : [];
	return list
		.filter(item => item && typeof item === 'object')
		.map(item => ({
			title: typeof item.title === 'string' ? item.title : '',
			url: typeof item.url === 'string' ? item.url : '',
			content: typeof item.content === 'string' ? item.content : '',
			score: typeof item.score === 'number' ? item.score : null,
			published_date: typeof item.published_date === 'string' ? item.published_date : ''
		}));
}

// 通用网络搜索请求（Tavily）
// @param {string} query 用户输入内容
// @returns {Promise<Array>} 搜索结果数组
async function requestWebSearch(query) {
	const cfg = window.globalWebSearchConfig || {};
	const loginContext = window.processinput || null;
	const apiUrl = loginContext && typeof loginContext.processedWebSearchUrl === 'string' && loginContext.processedWebSearchUrl.trim()
		? loginContext.processedWebSearchUrl.trim()
		: (typeof webSearchUrl === 'string' ? webSearchUrl.trim() : '');
	const apiKey = loginContext && typeof loginContext.processedWebSearchApiKey === 'string' && loginContext.processedWebSearchApiKey.trim()
		? loginContext.processedWebSearchApiKey.trim()
		: (typeof webSearchApiKey === 'string' ? webSearchApiKey.trim() : '');

	if (!query || !String(query).trim()) {
		throw new Error('搜索内容不能为空');
	}
	if (!apiUrl) {
		throw new Error('搜索地址未配置');
	}
	if (!apiKey) {
		throw new Error('搜索密钥未配置');
	}

	const controller = new AbortController();
	const timeoutMs = Number(cfg.timeoutMs) > 0 ? Number(cfg.timeoutMs) : 30000;
	const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

	const body = {
		api_key: apiKey,
		query: String(query).trim(),
		search_depth: cfg.search_depth || 'basic',
		max_results: Number(cfg.max_results) > 0 ? Number(cfg.max_results) : 5,
		include_answer: !!cfg.include_answer,
		include_raw_content: !!cfg.include_raw_content,
		include_images: !!cfg.include_images,
		topic: cfg.topic || 'general'
	};

	try {
		const res = await fetch(apiUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			signal: controller.signal,
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			const responseText = await res.text();
			const payload = tryParseWebSearchResponse(responseText);
			const statusText = res.status ? `（HTTP ${res.status}）` : '';
			throw new Error(getWebSearchErrorMessage(payload || responseText, `网络搜索失败${statusText}`));
		}

		const data = await res.json();
		return normalizeWebSearchResults(data);
	} catch (err) {
		console.error('网络搜索请求失败:', err);
		if (err && err.name === 'AbortError') {
			throw new Error('网络搜索超时，请稍后重试');
		}
		throw (err instanceof Error ? err : new Error(getWebSearchErrorMessage(err, '网络搜索失败')));
	} finally {
		window.clearTimeout(timeoutId);
	}
}

window.requestWebSearch = requestWebSearch;
