/**
 * agent-baidu.js
 * 百度智能体接口模块
 * 支持: 百度智能体 · threadId 会话保持 · uiData 图片卡片
 */
(function () {
'use strict';

/* ==================== 错误码 ==================== */
const BAIDU_ERR = {
  0:    '成功',
  11:   'App ID 无效，请在设置中检查',
  13:   'Secret Key 无效或已过期，请在设置中检查',
  18:   '请求过于频繁，请稍后再试',
  19:   '百度智能体调用额度不足',
  1000: '请求参数错误，请检查消息内容',
  1001: '百度智能体不存在或已下线'
};

/* ==================== 预设 ==================== */
const PRESETS = {
  'baidu-agent': { apiType: 'baidu' }
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

/* ==================== 解析百度返回数据 ==================== */

/**
 * 解析百度智能体单条 SSE payload 或完整 JSON
 *
 * 支持的 content 格式：
 *   - dataType: "uiData"  且 data.image_url 存在 → 图片卡片（修改点 2）
 *   - dataType: "markdown" / "text"              → 文本
 *   - dataType: "image"   / "pic"                → 普通图片
 *   - 未知类型 → 回退提取 text / url
 *
 * 返回: { texts:[], images:[], imageCards:[], finished, error, threadId }
 */
function parseBaiduPayload(payload) {
  const result = {
    texts:      [],
    images:     [],
    imageCards: [],     /* ★ 修改点 2: uiData 富图片信息 */
    finished:   false,
    error:      null,
    threadId:   null    /* ★ 修改点 1: 会话线程 ID */
  };

  /* 顶层 status 错误 */
  if (payload.status !== undefined && payload.status !== 0) {
    const msg = BAIDU_ERR[payload.status] || `百度智能体错误 (status: ${payload.status})`;
    result.error = msg + (payload.message ? '：' + payload.message : '');
    return result;
  }

  const msgNode = payload.data?.message;
  if (!msgNode) return result;

  /* ★ 修改点 1: 提取 threadId */
  if (msgNode.threadId) {
    result.threadId = msgNode.threadId;
  }

  if (msgNode.endTurn) result.finished = true;

  const contentArr = msgNode.content;
  if (!Array.isArray(contentArr)) return result;

  for (const item of contentArr) {
    if (item.isFinished) result.finished = true;

    const d  = item.data || {};
    const dt = (item.dataType || '').toLowerCase();
    const t  = (d.type       || '').toLowerCase();

    /* ★ 修改点 2: uiData + image_url → 图片卡片 */
    if (dt === 'uidata' && d.image_url) {
      result.imageCards.push({
        url:         d.image_url,
        description: d.description || '',
        tag:         d.tag         || '',
        editUrl:     d.pc_edit_jump_url   || '',
        wiseEditUrl: d.wise_edit_jump_url || ''
      });
      continue;
    }

    /* 原有类型判断 */
    const isText  = (dt === 'markdown' || dt === 'text'  || t === 'txt'   || t === 'text');
    const isImage = (dt === 'image'    || dt === 'pic'   || t === 'img'   || t === 'image' || t === 'pic');

    if (isImage) {
      const imgUrl = d.url || d.picUrl || d.src || d.imageUrl || d.originalUrl || d.pic || '';
      if (imgUrl) result.images.push(imgUrl);
    } else if (isText) {
      if (d.text) result.texts.push(d.text);
    } else {
      /* 未知类型回退 */
      if (d.text) result.texts.push(d.text);
      const fallbackImg = d.url || d.picUrl || d.src || '';
      if (fallbackImg) result.images.push(fallbackImg);
    }
  }

  return result;
}

/* ==================== 模拟流式输出 ==================== */
function simulateStream(text, cbs) {
  return new Promise(resolve => {
    let i = 0;
    const chunkSize = 3;
    const delay     = 18;
    function tick() {
      if (abortCtrl?.signal?.aborted) { cbs.onDone(); resolve(); return; }
      if (i >= text.length)           { cbs.onDone(); resolve(); return; }
      cbs.onChunk(text.slice(i, i + chunkSize));
      i += chunkSize;
      setTimeout(tick, delay);
    }
    tick();
  });
}

/* ==================== 将 parsed 结果转为 Markdown ==================== */
function parsedToMarkdown(parsed) {
  let md = parsed.texts.join('');

  /* uiData 图片卡片 */
  for (const card of parsed.imageCards) {
    md += `\n\n![${esc(card.description || '百度智能体图片')}](${esc(card.url)})`;
    if (card.tag) md += `\n\n> \u{1F3F7}\uFE0F ${esc(card.tag)}`;
    md += '\n\n';
  }

  /* 普通图片 */
  for (const imgUrl of parsed.images) {
    md += `\n\n![百度智能体图片](${esc(imgUrl)})\n\n`;
  }

  return md;
}

/* ==================== 核心发送逻辑 ==================== */
async function send({ text, conv, cfg, cbs }) {
  abortCtrl = new AbortController();

  let url = 'https://agentapi.baidu.com/assistant/conversation'
    + `?appId=${encodeURIComponent(cfg.baiduAppId)}`
    + `&secretKey=${encodeURIComponent(cfg.baiduSecretKey)}`;
  if (cfg.corsProxy) url = cfg.corsProxy.replace(/\/+$/, '') + '/' + url;

  const openId = cfg.baiduOpenId || ('web_' + (conv?.id || 'user'));

  /* ★ 修改点 1: 有 threadId 时带上 */
  const reqBody = {
    message: {
      content: {
        type: 'text',
        value: { showText: text }
      }
    },
    source: cfg.baiduAppId,
    from:   'openapi',
    openId: openId
  };
  if (conv?.threadId) {
    reqBody.threadId = conv.threadId;
  }

  try {
    const resp = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(reqBody),
      signal:  abortCtrl.signal
    });

    /* ── HTTP 错误 ── */
    if (!resp.ok) {
      let hint = `请求失败 (HTTP ${resp.status})`;
      if (resp.status === 401) hint = 'App ID 或 Secret Key 认证失败，请在设置中检查';
      else if (resp.status === 403) hint = '没有访问权限，请确认智能体是否已发布';
      else if (resp.status === 404) hint = '接口地址不存在，请确认 App ID 是否正确';
      else if (resp.status === 429) hint = '请求过于频繁或额度不足，请稍后再试';
      else if (resp.status >= 500) hint = '百度服务端错误，请稍后重试';
      try { const j = JSON.parse(await resp.text()); if (j.errmsg) hint += '：' + j.errmsg; } catch {}
      cbs.onError('api', hint);
      return;
    }

    const rawText = await resp.text();
    const lines   = rawText.split('\n').filter(l => l.trim());
    const isSSE   = lines.some(l => l.trim().startsWith('data:'));

    /* ════════════════════════════════════
       SSE 流式
       ════════════════════════════════════ */
    if (isSSE) {
      let hasContent  = false;
      let hasError    = false;
      let finished    = false;
      const seenImgs  = new Set();

      for (const line of lines) {
        if (finished || hasError) break;
        const trim = line.trim();
        if (!trim) continue;

        let jsonStr = trim;
        if (trim.startsWith('data:')) jsonStr = trim.slice(5).trim();
        if (!jsonStr) continue;

        let payload;
        try { payload = JSON.parse(jsonStr); } catch { continue; }

        const parsed = parseBaiduPayload(payload);

        if (parsed.error && !hasContent) {
          cbs.onError('api', parsed.error);
          hasError = true;
          break;
        }

        /* ★ 修改点 1: 回传 threadId */
        if (parsed.threadId && cbs.onThreadId) {
          cbs.onThreadId(parsed.threadId);
        }

        /* 文本 */
        for (const txt of parsed.texts) {
          cbs.onChunk(txt);
          hasContent = true;
        }

        /* ★ 修改点 2: uiData 图片卡片 → Markdown */
        for (const card of parsed.imageCards) {
          if (!seenImgs.has(card.url)) {
            seenImgs.add(card.url);
            let imgMd = `\n\n![${card.description || '百度智能体图片'}](${card.url})`;
            if (card.tag) imgMd += `\n\n> \u{1F3F7}\uFE0F ${card.tag}`;
            imgMd += '\n\n';
            cbs.onChunk(imgMd);
            hasContent = true;
          }
        }

        /* 普通图片 */
        for (const imgUrl of parsed.images) {
          if (!seenImgs.has(imgUrl)) {
            seenImgs.add(imgUrl);
            cbs.onChunk(`\n\n![百度智能体图片](${imgUrl})\n\n`);
            hasContent = true;
          }
        }

        if (parsed.finished) finished = true;
      }

      if (!hasError) {
        if (!hasContent) cbs.onError('api', '百度智能体返回了空内容，请检查智能体配置');
        else cbs.onDone();
      }

    /* ════════════════════════════════════
       非流式 JSON
       ════════════════════════════════════ */
    } else {
      let data;
      try { data = JSON.parse(rawText); } catch {
        cbs.onError('api', '百度智能体返回了无法解析的响应');
        return;
      }

      const parsed = parseBaiduPayload(data);
      if (parsed.error) { cbs.onError('api', parsed.error); return; }

      /* ★ 修改点 1 */
      if (parsed.threadId && cbs.onThreadId) {
        cbs.onThreadId(parsed.threadId);
      }

      if (!parsed.texts.length && !parsed.images.length && !parsed.imageCards.length) {
        cbs.onError('api',
          '百度智能体返回了空内容，请检查智能体配置\n\n```\n' +
          JSON.stringify(data, null, 2) + '\n```');
        return;
      }

      await simulateStream(parsedToMarkdown(parsed), cbs);
    }

  } catch (err) {
    handleFetchError(err, cbs);
  }
}

/* ==================== 注册智能体 ==================== */
window.AIChatAgents = window.AIChatAgents || {};
window.AIChatAgents.baidu = {
  type:    'baidu',
  label:   '百度智能体',
  presets: PRESETS,

  /* 需要的设置字段分组 */
  fieldGroup: 'baidu',

  validate(cfg) {
    if (!cfg.baiduAppId)     return { ok: false, message: '请先在设置中配置百度智能体的 App ID' };
    if (!cfg.baiduSecretKey) return { ok: false, message: '请先在设置中配置百度智能体的 Secret Key' };
    return { ok: true };
  },

  getModelLabel() {
    return '百度智能体';
  },

  send,

  abort() {
    if (abortCtrl) { abortCtrl.abort(); abortCtrl = null; }
  }
};

})();
