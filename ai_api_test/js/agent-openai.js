/**
 * agent-openai.js
 * OpenAI 兼容接口智能体模块
 * 支持: OpenAI / DeepSeek / 通义千问 / Moonshot / SiliconFlow / 智谱 GLM
 */
(function () {
'use strict';

/* ==================== 错误码 ==================== */
const OPENAI_ERR = {
  401: 'API Key 无效或已过期，请在设置中检查认证信息',
  403: '没有访问权限，请确认 API Key 是否有该模型的使用权限',
  404: 'API 地址不正确，请在设置中核对 Base URL',
  429: '请求过于频繁或额度不足，请稍后再试',
  500: '服务端内部错误，请稍后重试',
  502: '网关错误，服务可能正在维护',
  503: '服务暂时不可用，请稍后重试'
};

/* ==================== 预设 ==================== */
const PRESETS = {
  openai:        { apiType: 'openai', url: 'https://api.openai.com/v1',                        model: 'gpt-4o' },
  deepseek:      { apiType: 'openai', url: 'https://api.deepseek.com/v1',                       model: 'deepseek-chat' },
  qwen:          { apiType: 'openai', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  moonshot:      { apiType: 'openai', url: 'https://api.moonshot.cn/v1',                        model: 'moonshot-v1-8k' },
  siliconflow:   { apiType: 'openai', url: 'https://api.siliconflow.cn/v1',                     model: 'deepseek-ai/DeepSeek-V3' },
  zhipu:         { apiType: 'openai', url: 'https://open.bigmodel.cn/api/paas/v4',              model: 'glm-4-flash' }
};

/* ==================== 内部状态 ==================== */
let abortCtrl = null;

/* ==================== 工具函数 ==================== */
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function handleFetchError(err, cbs) {
  if (err.name === 'AbortError') { cbs.onDone(); return; }
  const msg = err.message || '';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') ||
      msg.includes('network') || msg.includes('Load failed')) {
    cbs.onError('network',
      '网络连接失败。可能原因：\n' +
      '1. 网络不稳定或已断开\n' +
      '2. 浏览器跨域限制（请在设置中配置 CORS 代理）\n' +
      '3. API 地址不正确');
  } else {
    cbs.onError('unknown', '请求出错：' + msg);
  }
}

/* ==================== 构建对话历史 ==================== */
function buildHistory(conv, settings) {
  const msgs = [];
  if (settings.sysPrompt) msgs.push({ role: 'system', content: settings.sysPrompt });
  const hist = (conv.messages || []).filter(m => m.role === 'user' || m.role === 'assistant');
  const max  = settings.ctxWindow || 20;
  const pairs = [];
  for (let i = hist.length - 1; i >= 0 && pairs.length < max; i--) {
    if (hist[i].role === 'assistant') {
      const um = hist[i - 1];
      if (um && um.role === 'user') { pairs.unshift([um, hist[i]]); i--; }
    }
  }
  pairs.forEach(([u, a]) => {
    msgs.push({ role: 'user', content: u.content });
    msgs.push({ role: 'assistant', content: a.content });
  });
  return msgs;
}

/* ==================== 核心发送逻辑 ==================== */
async function send({ text, conv, cfg, cbs }) {
  abortCtrl = new AbortController();

  let url = cfg.apiUrl.replace(/\/+$/, '') + '/chat/completions';
  if (cfg.corsProxy) url = cfg.corsProxy.replace(/\/+$/, '') + '/' + url;

  const history = buildHistory(conv, cfg);
  /* 确保最后一条是当前用户消息 */
  const lastUser = text || [...(conv.messages || [])].reverse().find(m => m.role === 'user')?.content || '';
  history.push({ role: 'user', content: lastUser });

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model: cfg.modelName,
        messages: history,
        stream: true
      }),
      signal: abortCtrl.signal
    });

    /* ── HTTP 错误 ── */
    if (!resp.ok) {
      let hint = OPENAI_ERR[resp.status] || `请求失败 (HTTP ${resp.status})`;
      try {
        const j = JSON.parse(await resp.text());
        if (j.error?.message) hint += '：' + j.error.message;
      } catch {}
      cbs.onError('api', hint);
      return;
    }

    const ct = resp.headers.get('content-type') || '';

    /* ── 非流式 JSON 响应 ── */
    if (!ct.includes('text/event-stream') && ct.includes('application/json')) {
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || '';
      if (content) cbs.onChunk(content);
      cbs.onDone();
      return;
    }

    /* ── SSE 流式响应 ── */
    const reader = resp.body.getReader();
    const dec    = new TextDecoder();
    let buf      = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';

      for (const line of lines) {
        const trim = line.trim();
        if (!trim || !trim.startsWith('data:')) continue;
        const payload = trim.slice(5).trim();
        if (payload === '[DONE]') { cbs.onDone(); return; }
        try {
          const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
          if (delta) cbs.onChunk(delta);
        } catch {}
      }
    }

    cbs.onDone();

  } catch (err) {
    handleFetchError(err, cbs);
  }
}

/* ==================== 注册智能体 ==================== */
window.AIChatAgents = window.AIChatAgents || {};
window.AIChatAgents.openai = {
  type:    'openai',
  label:   'OpenAI 兼容',
  presets: PRESETS,

  /* 需要的设置字段分组 */
  fieldGroup: 'openai',

  validate(cfg) {
    if (!cfg.apiUrl)    return { ok: false, message: '请先在设置中配置 API 地址' };
    if (!cfg.apiKey)    return { ok: false, message: '请先在设置中配置 API Key' };
    if (!cfg.modelName) return { ok: false, message: '请先在设置中配置模型名称' };
    return { ok: true };
  },

  getModelLabel(cfg) {
    return cfg.modelName || '未配置';
  },

  send,

  abort() {
    if (abortCtrl) { abortCtrl.abort(); abortCtrl = null; }
  }
};

})();
