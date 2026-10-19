import { clearRecords, getAllRecords, loadSettings, putRecord, putSnapshot, replaceRecords, saveSettings } from './store.js';
import { displayToken, generateReply, processCorpus } from './engine.js';
import { createSpaceViewer } from './visualization.js';

const $ = selector => document.querySelector(selector);
const elements = {
  fileInput: $('#file-input'), chooseFiles: $('#choose-files'), dropZone: $('#drop-zone'), fileList: $('#file-list'), corpusCount: $('#corpus-count'),
  trainingStatus: $('#training-status'), trainingIndicator: $('#training-indicator'), corpusError: $('#corpus-error'), runTraining: $('#run-training'), showSpace: $('#show-space'), trainingRounds: $('#training-rounds'),
  ngramHelp: $('#ngram-help'), ngramHelpDialog: $('#ngram-help-dialog'), closeNgramHelp: $('#close-ngram-help'),
  role: $('#role-input'), system: $('#system-input'), promptSave: $('#prompt-save-state'), clearPrompts: $('#clear-prompts'), temperature: $('#temperature'), temperatureValue: $('#temperature-value'),
  topK: $('#top-k'), topKValue: $('#top-k-value'), lambda: $('#lambda'), lambdaValue: $('#lambda-value'), maxTokens: $('#max-tokens'), maxContext: $('#max-context'),
  chatHistory: $('#chat-history'), chatEmpty: $('#chat-empty'), input: $('#user-input'), send: $('#send-button'), clearChat: $('#clear-chat'), chatState: $('#chat-state'),
  generationStatus: $('#generation-status'), processEmpty: $('#process-empty'), processList: $('#process-list'), dialog: $('#space-dialog'), canvas: $('#space-canvas'),
  spaceCount: $('#space-count'), spaceDetail: $('#space-detail'), spaceTooltip: $('#space-tooltip'), spaceEmpty: $('#space-empty'), closeSpace: $('#close-space'), resetCamera: $('#reset-camera'), fullscreenSpace: $('#space-fullscreen'), spaceSearch: $('#space-search'), spaceSearchInput: $('#space-search-input'), spaceSearchStatus: $('#space-search-status'), showAllSuccessors: $('#show-all-successors'), showTopSuccessor: $('#show-top-successor'), toastRegion: $('#toast-region'),
};

let corpusFiles = [];
let snapshot = null;
let messages = [];
let isTraining = false;
let isGenerating = false;
let cancelGeneration = false;
let generationTurn = 0;
let conversationEpoch = 0;
let currentTask = 0;
let toastTimeouts = new Set();

const viewer = createSpaceViewer({ dialog: elements.dialog, canvas: elements.canvas, count: elements.spaceCount, detail: elements.spaceDetail, tooltip: elements.spaceTooltip, empty: elements.spaceEmpty, closeButton: elements.closeSpace, resetButton: elements.resetCamera, onFocusChange: updateSuccessorControls });

function updateSuccessorControls(selection) {
  const disabled = !selection || selection.count === 0;
  elements.showAllSuccessors.disabled = disabled;
  elements.showTopSuccessor.disabled = disabled;
  elements.showAllSuccessors.classList.toggle('active', Boolean(selection?.count && selection.mode === 'all'));
  elements.showTopSuccessor.classList.toggle('active', Boolean(selection?.count && selection.mode === 'top'));
}

function updateFullscreenControl() {
  const isFullscreen = document.fullscreenElement === elements.dialog || elements.dialog.classList.contains('is-fullscreen-fallback');
  elements.fullscreenSpace.textContent = isFullscreen ? '退出全屏' : '全屏显示';
  elements.fullscreenSpace.setAttribute('aria-label', isFullscreen ? '退出空间全屏' : '全屏显示空间');
  requestAnimationFrame(() => viewer.resize());
}

function toast(message, isError = false, duration = 3200) {
  const node = document.createElement('div');
  node.className = `toast${isError ? ' error' : ''}`;
  node.textContent = message;
  elements.toastRegion.append(node);
  const timeout = setTimeout(() => { node.remove(); toastTimeouts.delete(timeout); }, duration);
  toastTimeouts.add(timeout);
}

function setTrainingStatus(text, state = 'idle') {
  elements.trainingStatus.textContent = text;
  elements.trainingIndicator.className = `status-dot status-${state}`;
}

function escapeBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function renderFiles() {
  elements.corpusCount.textContent = `${corpusFiles.length} 个文件`;
  elements.fileList.replaceChildren();
  if (!corpusFiles.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-inline';
    empty.textContent = '尚未添加语料文件';
    elements.fileList.append(empty);
  } else {
    for (const file of corpusFiles) {
      const row = document.createElement('div');
      row.className = 'file-row';
      const icon = document.createElement('span');
      icon.className = 'file-icon';
      icon.textContent = 'MD';
      const meta = document.createElement('div');
      meta.className = 'file-meta';
      const name = document.createElement('strong');
      name.textContent = file.name;
      name.title = file.name;
      const description = document.createElement('span');
      description.textContent = `${escapeBytes(new Blob([file.content]).size)} · 已导入`;
      meta.append(name, description);
      const replace = document.createElement('button');
      replace.type = 'button';
      replace.className = 'icon-button';
      replace.setAttribute('aria-label', `替换 ${file.name}`);
      replace.title = '替换文件';
      replace.textContent = '↻';
      replace.addEventListener('click', () => { elements.fileInput.dataset.replaceId = file.id; elements.fileInput.click(); });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-button';
      remove.setAttribute('aria-label', `删除 ${file.name}`);
      remove.title = '删除文件';
      remove.textContent = '×';
      remove.addEventListener('click', () => removeFile(file.id));
      row.append(icon, meta, replace, remove);
      elements.fileList.append(row);
    }
  }
  elements.runTraining.disabled = !corpusFiles.length || isTraining;
  elements.showSpace.disabled = !snapshot?.layout?.nodes?.length || isTraining;
  elements.send.disabled = isGenerating || isTraining || !snapshot?.vocabularySize;
  elements.clearChat.disabled = messages.length === 0;
}

async function runTraining() {
  const task = ++currentTask;
  isTraining = true;
  elements.corpusError.hidden = true;
  elements.corpusError.textContent = '';
  setTrainingStatus('预训练中...', 'working');
  renderFiles();
  try {
    const next = await processCorpus(corpusFiles, snapshot, elements.trainingRounds.value);
    if (task !== currentTask) return;
    await putSnapshot(next);
    if (task !== currentTask) return;
    snapshot = next;
    setTrainingStatus('预训练完成。', 'done');
  } catch (error) {
    if (task !== currentTask) return;
    elements.corpusError.textContent = `本地保存或统计失败：${error.message || '未知错误'}。保留上一次成功结果。`;
    elements.corpusError.hidden = false;
    setTrainingStatus(snapshot ? '保留上一次成功结果' : '处理失败', 'idle');
    toast('语料处理失败，请检查文件或浏览器存储空间。', true);
  } finally {
    if (task === currentTask) {
      isTraining = false;
      renderFiles();
    }
  }
}

async function persistFiles() {
  await replaceRecords('corpusFiles', corpusFiles);
}

async function importFiles(fileList) {
  const candidates = [...fileList];
  if (!candidates.length) return;
  const accepted = [];
  const errors = [];
  for (const file of candidates) {
    if (!file.name.toLowerCase().endsWith('.md')) { errors.push(`${file.name} 不是 .md 文件`); continue; }
    if (file.size > 2 * 1024 * 1024) { errors.push(`${file.name} 超过 2 MB 限制`); continue; }
    try {
      const content = await file.text();
      if (!content.trim()) { errors.push(`${file.name} 内容为空`); continue; }
      const replacementId = elements.fileInput.dataset.replaceId;
      const sameName = corpusFiles.find(item => item.name === file.name);
      const old = replacementId ? corpusFiles.find(item => item.id === replacementId) : sameName;
      const id = old?.id || `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      accepted.push({ id, name: file.name, content, updatedAt: Date.now() });
      if (replacementId) delete elements.fileInput.dataset.replaceId;
    } catch {
      errors.push(`${file.name} 无法读取`);
    }
  }
  if (accepted.length) {
    for (const file of accepted) {
      const existingIndex = corpusFiles.findIndex(item => item.id === file.id || item.name === file.name);
      if (existingIndex >= 0) corpusFiles.splice(existingIndex, 1, file);
      else corpusFiles.push(file);
    }
    renderFiles();
    try {
      await persistFiles();
      await runTraining();
    } catch (error) {
      toast(`保存文件失败：${error.message}`, true);
    }
  }
  if (errors.length) toast(errors.join('；'), true, 5500);
  elements.fileInput.value = '';
}

async function removeFile(id) {
  corpusFiles = corpusFiles.filter(file => file.id !== id);
  renderFiles();
  try {
    await persistFiles();
    await runTraining();
  } catch (error) { toast(`删除或保存失败：${error.message}`, true); }
}

function renderMessage(message) {
  const article = document.createElement('article');
  article.className = `message ${message.role}`;
  if (message.id) article.dataset.messageId = message.id;
  const meta = document.createElement('span');
  meta.className = 'message-meta';
  meta.textContent = message.role === 'user' ? `你 · ${formatTime(message.createdAt)}` : `TOKEN LAB · ${formatTime(message.createdAt)}`;
  if (message.role === 'assistant') {
    const thought = makeElement('section', 'message-thought');
    thought.append(makeElement('strong', '', '思考内容'));
    thought.append(makeElement('p', 'message-thought-text', message.thoughtText || (message.pending ? '正在根据上下文生成…' : '（该回复未保存思考文本）')));
    article.append(meta, thought);
  } else {
    article.append(meta);
  }
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = message.text || (message.pending ? '正在生成回复…' : '');
  article.append(bubble);
  if (message.role === 'assistant' && message.text) {
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    const copy = document.createElement('button');
    copy.className = 'copy-button';
    copy.type = 'button';
    copy.textContent = '复制回复';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(message.text); toast('已复制到剪贴板'); }
      catch { toast('复制失败，请手动选择文本。', true); }
    });
    actions.append(copy);
    article.append(actions);
  }
  elements.chatHistory.append(article);
}

function renderMessages() {
  elements.chatHistory.replaceChildren();
  if (!messages.length) elements.chatHistory.append(elements.chatEmpty);
  else messages.forEach(renderMessage);
  elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
  elements.chatState.textContent = messages.length ? `${messages.length} 条消息 · 完整记录保留` : '尚无会话';
  elements.clearChat.disabled = messages.length === 0;
}

function updateAssistantMessage(message) {
  const article = elements.chatHistory.querySelector(`[data-message-id="${message.id}"]`);
  if (!article) return;
  const followOutput = elements.chatHistory.scrollHeight - elements.chatHistory.scrollTop - elements.chatHistory.clientHeight < 40;
  const thought = article.querySelector('.message-thought-text');
  const bubble = article.querySelector('.message-bubble');
  if (thought) thought.textContent = message.thoughtText || (message.pending ? '正在根据上下文生成…' : '');
  if (bubble) bubble.textContent = message.text || (message.pending ? '正在生成回复…' : '');
  if (followOutput) elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(timestamp || Date.now());
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderAttention(step) {
  const section = makeElement('div', 'attention-scroll');
  const grid = makeElement('div', 'attention-grid');
  grid.style.setProperty('--attention-cols', Math.max(1, step.attentionWeights.length));
  grid.append(makeElement('span', 'attention-label', '查询位置'));
  step.attentionTokens.forEach(token => grid.append(makeElement('span', '', displayToken(token).slice(0, 7))));
  grid.append(makeElement('span', 'attention-label', displayToken(step.attentionTokens.at(-1) || '')));
  step.attentionWeights.forEach(weight => {
    const cell = makeElement('span', 'attention-cell', Number(weight).toFixed(2));
    cell.style.background = `rgba(114, 87, 231, ${Math.max(0.13, Math.min(0.9, 0.16 + weight * 1.8))})`;
    grid.append(cell);
  });
  section.append(grid);
  return section;
}

function createProcessStages() {
  const stages = {};
  const definitions = [
    ['context', '上下文 Tokenization'],
    ['attention', '最后位置的 Self-Attention 权重'],
    ['candidates', '当前 N-gram 候选'],
  ];
  for (const [key, title] of definitions) {
    const stage = makeElement('section', 'process-stage');
    stage.append(makeElement('h4', 'process-stage-title', title));
    let entries;
    if (key === 'candidates') {
      const scroll = makeElement('div', 'table-scroll candidate-history-scroll');
      const table = makeElement('table', 'candidate-table');
      const head = document.createElement('thead');
      const header = document.createElement('tr');
      ['步骤', '候选', '次数', '频率', '相似度', '融合分数', '结果'].forEach(label => header.append(makeElement('th', '', label)));
      head.append(header);
      entries = document.createElement('tbody');
      table.append(head, entries);
      scroll.append(table);
      stage.append(scroll);
    } else {
      entries = makeElement('div', 'process-stage-entries');
      stage.append(entries);
    }
    elements.processList.append(stage);
    stages[key] = entries;
  }
  return stages;
}

function appendCandidateRows(step) {
  step.candidates.forEach(candidate => {
    const row = document.createElement('tr');
    if (candidate.selected) row.className = 'selected';
    [`第${step.index}步`, displayToken(candidate.token), String(candidate.count), candidate.probability.toFixed(3), candidate.similarity.toFixed(3), candidate.score.toFixed(3), candidate.selected ? '✓' : ''].forEach(value => row.append(makeElement('td', '', value)));
    processStages.candidates.append(row);
  });
}

function renderProcessSteps(steps) {
  elements.processList.replaceChildren();
  elements.processEmpty.hidden = steps.length > 0;
  processStages = null;
  steps.forEach(appendProcessStep);
}

function appendProcessStep(step) {
  const list = elements.processList;
  const followOutput = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  if (!processStages) processStages = createProcessStages();
  elements.processEmpty.hidden = true;

  if (!processStages.context.childElementCount) {
    const tokenRow = makeElement('div', 'token-row');
    step.context.forEach(token => tokenRow.append(makeElement('span', 'token-chip', displayToken(token))));
    processStages.context.append(tokenRow);
  }
  processStages.attention.replaceChildren(renderAttention(step));
  appendCandidateRows(step);
  if (followOutput) list.scrollTop = list.scrollHeight;
}

function setGenerationStatus(text, error = false, cancelButton = false) {
  elements.generationStatus.replaceChildren();
  elements.generationStatus.hidden = !text;
  elements.generationStatus.classList.toggle('error', error);
  if (text) elements.generationStatus.append(document.createTextNode(text));
  if (cancelButton) {
    const button = makeElement('button', 'text-button danger-text', '停止');
    button.type = 'button';
    button.style.marginLeft = '12px';
    button.addEventListener('click', () => { cancelGeneration = true; setGenerationStatus('正在停止…'); });
    elements.generationStatus.append(button);
  }
}

function turnsFromMessages() {
  const result = [];
  for (let index = 0; index < messages.length; index += 1) {
    const current = messages[index];
    if (current.role !== 'user') continue;
    const reply = messages[index + 1]?.role === 'assistant' ? messages[index + 1] : null;
    result.push({ user: current.text, assistant: reply?.text || '' });
  }
  return result;
}

async function saveConversation() {
  await putRecord('conversations', { id: 'active-conversation', messages, updatedAt: Date.now() });
}

async function submitMessage() {
  const text = elements.input.value.trim();
  if (!text || isGenerating) return;
  if (!snapshot || !Object.keys(snapshot.ngrams.unigram || {}).length) {
    toast('请先导入有效的 Markdown 语料。', true);
    return;
  }
  const userMessage = { role: 'user', text, createdAt: Date.now() };
  const assistantMessage = {
    id: `assistant-${Date.now()}-${generationTurn + 1}`,
    role: 'assistant',
    text: '',
    thoughtText: '',
    pending: true,
    createdAt: Date.now(),
  };
  messages.push(userMessage, assistantMessage);
  renderMessages();
  elements.input.value = '';
  isGenerating = true;
  const submissionEpoch = conversationEpoch;
  cancelGeneration = false;
  generationTurn += 1;
  elements.send.disabled = true;
  setGenerationStatus('正在执行 N-gram 与 Self-Attention 模拟…', false, true);
  renderProcessSteps([]);
  try { await saveConversation(); } catch { toast('无法持久化会话记录，但本次会话仍会显示。', true); }
  const settings = currentSettings();
  try {
    const result = await generateReply({
      snapshot,
      userText: text,
      role: elements.role.value,
      systemPrompt: elements.system.value,
      history: turnsFromMessages().slice(0, -1),
      settings,
      turn: generationTurn,
      isCancelled: () => cancelGeneration,
      onStep: ({ step, generated, text: thoughtText }) => {
        assistantMessage.thoughtText = thoughtText;
        updateAssistantMessage(assistantMessage);
        appendProcessStep(step);
        setGenerationStatus(`生成中 · 已选择 ${generated.length} 个 token`, false, true);
      },
    });
    if (submissionEpoch !== conversationEpoch) return;
    if (result.contextWasTruncated) toast('本轮推理输入超出上下文上限，已按规则裁剪算法输入；完整会话记录仍保留。', false, 5000);
    assistantMessage.pending = false;
    if (result.cancelled || cancelGeneration) {
      assistantMessage.text = result.text || '本轮生成已停止。';
      assistantMessage.thoughtText ||= result.text;
      assistantMessage.cancelled = true;
      renderMessages();
      setGenerationStatus('本轮生成已取消。');
    } else if (result.noMatch) {
      assistantMessage.text = '没有匹配的语料模式。请尝试输入与导入语料更接近的内容。';
      assistantMessage.thoughtText = '没有找到可用的 N-gram 候选。';
      renderMessages();
      setGenerationStatus('未找到可续写的 N-gram 模式。', true);
    } else {
      assistantMessage.text = result.text || '（结束标记前没有生成可见 token）';
      assistantMessage.thoughtText = result.text || '没有生成可见 token。';
      renderMessages();
      setGenerationStatus(result.limitReached ? `已达到本轮上限（${settings.maxTokens} 个新 token）。` : '生成完成。');
    }
    await saveConversation();
  } catch (error) {
    assistantMessage.pending = false;
    assistantMessage.text = `生成失败：${error.message || '未知错误'}`;
    assistantMessage.thoughtText ||= '生成过程未能完成。';
    renderMessages();
    try { await saveConversation(); } catch { /* Keep the visible failure state if storage is unavailable. */ }
    setGenerationStatus(`生成失败：${error.message || '未知错误'}`, true);
    toast('生成过程发生错误。', true);
  } finally {
    isGenerating = false;
    elements.send.disabled = !snapshot?.vocabularySize;
    renderFiles();
  }
}

function currentSettings() {
  return { role: elements.role.value, systemPrompt: elements.system.value, temperature: Number(elements.temperature.value), topK: Number(elements.topK.value), lambda: Number(elements.lambda.value), maxTokens: Number(elements.maxTokens.value), maxContext: Number(elements.maxContext.value), trainingRounds: Number(elements.trainingRounds.value) };
}

let saveTimer = null;
let processStages = null;
function bindSettings() {
  const updateSettingDisplays = () => {
    elements.temperatureValue.textContent = Number(elements.temperature.value).toFixed(1);
    elements.topKValue.textContent = elements.topK.value;
    elements.lambdaValue.textContent = Number(elements.lambda.value).toFixed(2);
  };
  const scheduleSave = () => {
    updateSettingDisplays();
    elements.promptSave.textContent = '正在保存…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try { await saveSettings(currentSettings()); elements.promptSave.textContent = '自动保存在本机'; }
      catch { elements.promptSave.textContent = '设置保存失败'; }
    }, 350);
  };
  [elements.role, elements.system, elements.temperature, elements.topK, elements.lambda, elements.maxTokens, elements.maxContext].forEach(control => control.addEventListener('input', scheduleSave));
  elements.trainingRounds.addEventListener('change', () => {
    scheduleSave();
    if (corpusFiles.length) void runTraining();
  });
  elements.clearPrompts.addEventListener('click', async () => {
    elements.role.value = '';
    elements.system.value = '';
    scheduleSave();
    try { await saveSettings(currentSettings()); toast('已清空角色设定和系统提示词'); }
    catch { toast('设置保存失败。', true); }
  });
  updateSettingDisplays();
}

async function clearConversation() {
  if (!messages.length) return;
  conversationEpoch += 1;
  cancelGeneration = true;
  messages = [];
  generationTurn = 0;
  renderMessages();
  renderProcessSteps([]);
  setGenerationStatus('会话已清空。');
  try { await clearRecords('conversations'); }
  catch { toast('会话已在页面清空，但未能清除本地保存副本。', true); }
}

async function initialize() {
  elements.chatEmpty.remove();
  try {
    const [savedFiles, savedSnapshots, savedConversation, savedSettings] = await Promise.all([
      getAllRecords('corpusFiles'), getAllRecords('snapshots'), getAllRecords('conversations'), loadSettings(),
    ]);
    corpusFiles = savedFiles;
    snapshot = savedSnapshots.sort((a, b) => b.createdAt - a.createdAt)[0] || null;
    const conversation = savedConversation.find(item => item.id === 'active-conversation');
    messages = conversation?.messages || [];
    if (savedSettings) {
      elements.role.value = savedSettings.role;
      elements.system.value = savedSettings.systemPrompt;
      elements.temperature.value = String(savedSettings.temperature);
      elements.topK.value = String(savedSettings.topK);
      elements.lambda.value = String(savedSettings.lambda);
      elements.maxTokens.value = String(savedSettings.maxTokens);
      elements.maxContext.value = String(savedSettings.maxContext || 128);
      elements.trainingRounds.value = String(savedSettings.trainingRounds || 3);
    }
    if (snapshot) setTrainingStatus('预训练完成。', 'done');
    else if (corpusFiles.length) setTrainingStatus('需要重新统计语料', 'idle');
    renderFiles();
    renderMessages();
    bindSettings();
    if (corpusFiles.length && (!snapshot || snapshot.tokenizerVersion !== 'natural-zh-word-v3')) await runTraining();
  } catch (error) {
    toast(`无法读取本地数据：${error.message || '请重新导入语料。'}`, true, 6000);
    setTrainingStatus('本地数据读取失败', 'idle');
    renderFiles();
    renderMessages();
    bindSettings();
  }
}

elements.chooseFiles.addEventListener('click', () => { delete elements.fileInput.dataset.replaceId; elements.fileInput.click(); });
elements.ngramHelp.addEventListener('click', () => elements.ngramHelpDialog.showModal());
elements.closeNgramHelp.addEventListener('click', () => elements.ngramHelpDialog.close());
elements.ngramHelpDialog.addEventListener('click', event => {
  if (event.target === elements.ngramHelpDialog) elements.ngramHelpDialog.close();
});
elements.fileInput.addEventListener('change', event => importFiles(event.target.files));
elements.dropZone.addEventListener('click', event => { if (event.target.closest('button')) return; elements.fileInput.click(); });
elements.dropZone.addEventListener('dragover', event => { event.preventDefault(); elements.dropZone.classList.add('drag-over'); });
elements.dropZone.addEventListener('dragleave', () => elements.dropZone.classList.remove('drag-over'));
elements.dropZone.addEventListener('drop', event => { event.preventDefault(); elements.dropZone.classList.remove('drag-over'); importFiles(event.dataTransfer.files); });
elements.showSpace.addEventListener('click', () => {
  if (!snapshot) return;
  elements.spaceSearchInput.value = '';
  elements.spaceSearchStatus.textContent = '';
  viewer.open(snapshot);
});
elements.spaceSearch.addEventListener('submit', event => {
  event.preventDefault();
  const query = elements.spaceSearchInput.value.trim();
  if (!query) {
    elements.spaceSearchStatus.textContent = '请输入要查找的 Token。';
    return;
  }
  elements.spaceSearchStatus.textContent = viewer.focusToken(query) ? `已定位 Token「${query}」。` : `没有找到 Token「${query}」。`;
});
elements.spaceSearchInput.addEventListener('input', () => { elements.spaceSearchStatus.textContent = ''; });
elements.fullscreenSpace.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement === elements.dialog) {
      await document.exitFullscreen();
    } else if (elements.dialog.classList.contains('is-fullscreen-fallback')) {
      elements.dialog.classList.remove('is-fullscreen-fallback');
      updateFullscreenControl();
    } else if (elements.dialog.requestFullscreen) {
      try {
        await elements.dialog.requestFullscreen();
      } catch {
        elements.dialog.classList.add('is-fullscreen-fallback');
        updateFullscreenControl();
      }
    } else {
      elements.dialog.classList.add('is-fullscreen-fallback');
      updateFullscreenControl();
    }
  } catch {
    toast('无法切换到全屏显示。', true);
  }
});
document.addEventListener('fullscreenchange', updateFullscreenControl);
elements.dialog.addEventListener('cancel', event => {
  if (!elements.dialog.classList.contains('is-fullscreen-fallback')) return;
  event.preventDefault();
  elements.dialog.classList.remove('is-fullscreen-fallback');
  updateFullscreenControl();
});
elements.dialog.addEventListener('close', () => {
  elements.dialog.classList.remove('is-fullscreen-fallback');
  updateFullscreenControl();
});
elements.showAllSuccessors.addEventListener('click', () => {
  const count = viewer.setSuccessorMode('all');
  elements.spaceSearchStatus.textContent = count === null
    ? '请先定位或单击一个 Token。'
    : count ? `已显示全部 ${count} 个后继 Token。` : '当前 Token 没有后继。';
});
elements.showTopSuccessor.addEventListener('click', () => {
  const count = viewer.setSuccessorMode('top');
  elements.spaceSearchStatus.textContent = count === null
    ? '请先定位或单击一个 Token。'
    : count ? '已显示权重最高的后继 Token。' : '当前 Token 没有后继。';
});
elements.send.addEventListener('click', submitMessage);
elements.input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitMessage(); }
});
elements.clearChat.addEventListener('click', clearConversation);
elements.runTraining.addEventListener('click', () => { if (corpusFiles.length && !isTraining) void runTraining(); });
elements.dialog.addEventListener('close', () => elements.showSpace.focus());

initialize();

