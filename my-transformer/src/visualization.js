export function createSpaceViewer({ dialog, canvas, count, detail, tooltip, empty, closeButton, resetButton, onFocusChange = () => {} }) {
  const context = canvas.getContext('2d');
  let snapshot = null;
  let rotationX = -0.38;
  let rotationY = 0.55;
  let zoom = 1;
  let projected = [];
  let dragging = false;
  let lastPointer = null;
  let pointerOrigin = null;
  let pointerMoved = false;
  let selectedToken = null;
  let relatedTokens = [];
  let successorMode = 'top';
  let focusPosition = [0, 0, 0];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let animationFrame = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  function projectNode(node) {
    if (node.token === selectedToken) {
      return { x: width / 2, y: height / 2, depth: 0, scale: Math.min(width, height) * 0.33 * zoom, node };
    }
    const bounds = snapshot.layout.bounds || { min: -5, max: 5 };
    const span = Math.max(Math.abs(bounds.min), Math.abs(bounds.max), 1);
    let [x, y, z] = node.position.map((value, index) => (value - focusPosition[index]) / span);
    const cosY = Math.cos(rotationY);
    const sinY = Math.sin(rotationY);
    const rotatedX = x * cosY - z * sinY;
    const rotatedZ = x * sinY + z * cosY;
    const cosX = Math.cos(rotationX);
    const sinX = Math.sin(rotationX);
    const rotatedY = y * cosX - rotatedZ * sinX;
    const depth = y * sinX + rotatedZ * cosX;
    const perspective = 2.35 / (2.35 - depth * 0.5);
    const scale = Math.min(width, height) * 0.33 * zoom * perspective;
    return { x: width / 2 + rotatedX * scale, y: height / 2 + rotatedY * scale, depth, scale, node };
  }

  function render() {
    if (!width || !height) return;
    context.clearRect(0, 0, width, height);
    context.save();
    context.strokeStyle = '#e7e9f1';
    context.lineWidth = 1;
    context.setLineDash([3, 5]);
    context.beginPath();
    context.ellipse(width / 2, height / 2, Math.min(width, height) * 0.31 * zoom, Math.min(width, height) * 0.13 * zoom, -0.23, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.restore();
    if (!snapshot?.layout?.nodes?.length) return;

    const visibleTokens = selectedToken
      ? new Set([selectedToken, ...relatedTokens])
      : null;
    projected = snapshot.layout.nodes
      .filter(node => !visibleTokens || visibleTokens.has(node.token))
      .map(projectNode);
    const byToken = new Map(projected.map(item => [item.node.token, item]));
    const edgeLimit = snapshot.layout.edges.length > 600 ? 600 : snapshot.layout.edges.length;
    for (let index = 0; index < edgeLimit; index += 1) {
      const edge = snapshot.layout.edges[index];
      if (visibleTokens && (edge.source !== selectedToken || !visibleTokens.has(edge.target))) continue;
      const from = byToken.get(edge.source);
      const to = byToken.get(edge.target);
      if (!from || !to) continue;
      const alpha = Math.min(0.38, 0.08 + Math.log1p(edge.weight) * 0.08);
      context.strokeStyle = `rgba(137, 121, 216, ${alpha})`;
      context.lineWidth = Math.min(2, 0.6 + Math.log1p(edge.weight) * 0.28);
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    }

    projected.sort((a, b) => a.depth - b.depth);
    const labelSlots = new Set();
    const degree = new Map();
    for (const edge of snapshot.layout.edges) {
      degree.set(edge.source, (degree.get(edge.source) || 0) + edge.weight);
      degree.set(edge.target, (degree.get(edge.target) || 0) + edge.weight);
    }
    const labelTokens = new Set([...degree.entries()].sort((a, b) => b[1] - a[1]).slice(0, 65).map(([token]) => token));
    const min = snapshot.layout.bounds?.min ?? -1;
    const max = snapshot.layout.bounds?.max ?? 1;
    const palette = ['#7158e9', '#4f83e8', '#23a785', '#de739c', '#eea451', '#8793d4'];
    for (const item of projected) {
      const normalized = (item.depth + 1.5) / 3;
      const radius = Math.max(2.1, Math.min(6.5, 3.1 + normalized * 2.5 + Math.log1p(degree.get(item.node.token) || 0) * 0.25));
      const color = palette[Math.abs(hashString(item.node.token)) % palette.length];
      context.beginPath();
      context.fillStyle = color;
      context.globalAlpha = 0.52 + normalized * 0.45;
      context.arc(item.x, item.y, radius, 0, Math.PI * 2);
      context.fill();
      if (item.node.token === selectedToken) {
        context.globalAlpha = 1;
        context.strokeStyle = '#2d3150';
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(item.x, item.y, radius + 3.2, 0, Math.PI * 2);
        context.stroke();
      }
      context.globalAlpha = 1;
      const label = displayLabel(item.node.token);
      const cellX = Math.round(item.x / 64);
      const cellY = Math.round(item.y / 28);
      const cell = `${cellX}:${cellY}`;
      if ((labelTokens.has(item.node.token) || item.node.token === selectedToken) && !labelSlots.has(cell)) {
        labelSlots.add(cell);
        context.font = '10px DM Sans, sans-serif';
        context.fillStyle = '#616b80';
        context.fillText(label.slice(0, 16), item.x + 7, item.y - 5);
      }
    }
    context.fillStyle = '#a0a8b7';
    context.font = '9px DM Mono, monospace';
    context.fillText(`x,y,z ∈ [${min}, ${max}]`, 11, height - 11);
  }

  function displayLabel(token) {
    if (token === '\u0002BOS') return 'BOS';
    if (token === '\u0002EOS') return 'EOS';
    if (token === '\u0002UNK') return 'UNK';
    return token;
  }

  function hashString(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return hash >>> 0;
  }

  function showNode(item) {
    if (!item) return;
    focusNode(item.node);
    const embedding = (snapshot.embeddings[item.node.token] || []).map(value => value.toFixed(2)).join(', ');
    const sources = snapshot.occurrences.filter(entry => entry.token === item.node.token).slice(0, 5);
    detail.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = `Token「${displayLabel(item.node.token)}」`;
    const position = document.createElement('span');
    position.textContent = `坐标 (${item.node.position.map(value => value.toFixed(1)).join(', ')})`;
    const source = document.createElement('span');
    source.textContent = sources.length ? `来源：${sources.map(value => `${value.fileName} · 序列 ${value.sequenceIndex + 1}`).join('；')}` : '特殊 token，无语料来源';
    const vector = document.createElement('span');
    vector.textContent = `Embedding：[${embedding}]`;
    detail.append(title, position, source, vector);
    render();
  }

  function focusNode(node) {
    selectedToken = node.token;
    successorMode = 'top';
    setVisibleSuccessors();
    rotationX = -0.38;
    rotationY = 0.55;
    fitFocusedNodes(node);
    resize();
    onFocusChange({ token: selectedToken, count: relatedTokens.length, mode: successorMode });
  }

  function getSuccessors(token) {
    const successors = new Map();
    for (const edge of snapshot.layout.edges) {
      if (edge.source !== token || edge.target === token) continue;
      successors.set(edge.target, Math.max(successors.get(edge.target) || 0, edge.weight));
    }
    return [...successors.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([target]) => target);
  }

  function setVisibleSuccessors() {
    const successors = getSuccessors(selectedToken);
    relatedTokens = successorMode === 'all' ? successors : successors.slice(0, 1);
  }

  function fitFocusedNodes(node) {
    const span = Math.max(Math.abs(snapshot.layout.bounds?.min ?? -1), Math.abs(snapshot.layout.bounds?.max ?? 1), 1);
    const relatedNodes = relatedTokens
      .map(token => snapshot.layout.nodes.find(item => item.token === token))
      .filter(Boolean);
    const farthestDistance = relatedNodes.reduce((farthest, item) => Math.max(
      farthest,
      Math.hypot(...item.position.map((value, index) => value - node.position[index])) / span,
    ), 0);
    const viewSize = Math.min(width || canvas.clientWidth, height || canvas.clientHeight);
    zoom = farthestDistance > 0 && viewSize > 0
      ? Math.max(0.35, Math.min(18, 38 / (0.33 * viewSize * farthestDistance)))
      : 1.5;
  }

  function setSuccessorMode(mode) {
    if (!selectedToken || !snapshot) return null;
    successorMode = mode === 'all' ? 'all' : 'top';
    setVisibleSuccessors();
    const node = snapshot.layout.nodes.find(item => item.token === selectedToken);
    if (node) fitFocusedNodes(node);
    render();
    onFocusChange({ token: selectedToken, count: relatedTokens.length, mode: successorMode });
    return relatedTokens.length;
  }

  function focusToken(query) {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery || !snapshot?.layout?.nodes?.length) return false;
    const node = snapshot.layout.nodes.find(item => item.token === normalizedQuery)
      || snapshot.layout.nodes.find(item => displayLabel(item.token) === normalizedQuery);
    if (!node) return false;
    showNode({ node });
    return true;
  }

  function pointerDown(event) {
    dragging = true;
    lastPointer = { x: event.clientX, y: event.clientY };
    pointerOrigin = { x: event.clientX, y: event.clientY };
    pointerMoved = false;
    canvas.setPointerCapture(event.pointerId);
  }
  function pointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    if (dragging && lastPointer) {
      const dx = event.clientX - lastPointer.x;
      const dy = event.clientY - lastPointer.y;
      if (pointerOrigin && Math.hypot(event.clientX - pointerOrigin.x, event.clientY - pointerOrigin.y) > 4) pointerMoved = true;
      rotationY += dx * 0.009;
      rotationX = Math.max(-1.48, Math.min(1.48, rotationX + dy * 0.009));
      lastPointer = { x: event.clientX, y: event.clientY };
      render();
      return;
    }
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let nearest = null;
    let distance = 18;
    for (const item of projected) {
      const current = Math.hypot(item.x - x, item.y - y);
      if (current < distance) { nearest = item; distance = current; }
    }
    if (nearest) {
      tooltip.hidden = false;
      tooltip.textContent = displayLabel(nearest.node.token);
      tooltip.style.left = `${Math.min(width - 160, x + 12)}px`;
      tooltip.style.top = `${Math.max(6, y - 10)}px`;
      canvas.style.cursor = 'pointer';
    } else {
      tooltip.hidden = true;
      canvas.style.cursor = dragging ? 'grabbing' : 'grab';
    }
  }
  function pointerUp(event) {
    if (!dragging) return;
    const moved = !pointerMoved && pointerOrigin && Math.hypot(event.clientX - pointerOrigin.x, event.clientY - pointerOrigin.y) < 4;
    dragging = false;
    lastPointer = null;
    pointerOrigin = null;
    pointerMoved = false;
    if (moved) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      let nearest = null;
      let distance = 16;
      for (const item of projected) {
        const current = Math.hypot(item.x - x, item.y - y);
        if (current < distance) { nearest = item; distance = current; }
      }
      if (nearest) showNode(nearest);
    }
  }

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', () => { dragging = false; lastPointer = null; pointerOrigin = null; pointerMoved = false; });
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    zoom = Math.max(0.35, Math.min(18, zoom * (event.deltaY < 0 ? 1.15 : 0.87)));
    render();
  }, { passive: false });
  resetButton.addEventListener('click', () => { rotationX = -0.38; rotationY = 0.55; zoom = 1; focusPosition = [0, 0, 0]; selectedToken = null; relatedTokens = []; successorMode = 'top'; onFocusChange(null); render(); });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { cancelAnimationFrame(animationFrame); });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  window.addEventListener('resize', resize);

  return {
    open(nextSnapshot) {
      snapshot = nextSnapshot;
      selectedToken = null;
      relatedTokens = [];
      successorMode = 'top';
      onFocusChange(null);
      focusPosition = [0, 0, 0];
      detail.textContent = '点击任意节点，查看 token 向量与来源信息。';
      count.textContent = `${nextSnapshot.layout.nodes.length} 个 token · ${nextSnapshot.layout.edges.length} 条共现边`;
      empty.hidden = nextSnapshot.layout.nodes.length > 0;
      if (!dialog.open) dialog.showModal();
      requestAnimationFrame(resize);
    },
    focusToken,
    setSuccessorMode,
    resize,
  };
}

