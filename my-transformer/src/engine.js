const SPECIAL = { BOS: '\u0002BOS', EOS: '\u0002EOS', UNK: '\u0002UNK' };
const EMBED_DIM = 16;
const HAN_RUN = /^\p{Script=Han}+$/u;
const FALLBACK_CHINESE_WORDS = ['胡萝卜', '红萝卜', '萝卜', '西红柿', '番茄', '土豆', '马铃薯', '白菜', '青菜', '苹果', '香蕉', '橘子', '火车站', '图书馆', '自然语言', '机器学习', '人工智能'];
const CHINESE_SEGMENTER = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('zh-CN', { granularity: 'word' })
  : null;

export function stableHash(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function seededRandom(seedText) {
  let seed = Number.parseInt(stableHash(seedText), 16) >>> 0;
  if (!seed) seed = 0x6d2b79f5;
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
}

function seedVector(key, length = EMBED_DIM) {
  const random = seededRandom(key);
  const vector = Array.from({ length }, () => (random() * 2) - 1);
  return normalize(vector);
}

function normalize(vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map(value => value / norm);
}

function stripMarkdown(markdown) {
  return String(markdown)
    .replace(/\r\n?/g, '\n')
    .replace(/^```[^\n]*\n([\s\S]*?)^```\s*$/gm, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}(?:>|[-+*]|\d+[.)])\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/^\s*(?:[-*_]\s*){3,}$/gm, '')
    .trim();
}

function makeWordTrie(words) {
  const root = new Map();
  for (const word of words) {
    if (!HAN_RUN.test(word) || [...word].length < 2) continue;
    let node = root;
    for (const character of word) {
      if (!node.has(character)) node.set(character, new Map());
      node = node.get(character);
    }
    node.set('', null);
  }
  return root;
}

function tokenizeHanFallback(run, trie) {
  const characters = [...run];
  const tokens = [];
  for (let index = 0; index < characters.length;) {
    let node = trie;
    let match = '';
    let end = index;
    while (end < characters.length && node.has(characters[end])) {
      node = node.get(characters[end]);
      end += 1;
      if (node.has('')) match = characters.slice(index, end).join('');
    }
    tokens.push(match || characters[index]);
    index += match ? [...match].length : 1;
  }
  return tokens;
}

export function tokenize(text, wordVocabulary = []) {
  const pieces = String(text).match(/[A-Za-z]+|\d+|\p{Script=Han}+|[^\s\p{Script=Han}A-Za-z\d]/gu) || [];
  const vocabulary = new Set([...FALLBACK_CHINESE_WORDS, ...(wordVocabulary || [])]);
  const trie = makeWordTrie(vocabulary);
  const tokens = [];
  for (const piece of pieces) {
    if (!HAN_RUN.test(piece)) {
      tokens.push(piece);
    } else if (CHINESE_SEGMENTER) {
      for (const item of CHINESE_SEGMENTER.segment(piece)) tokens.push(item.segment);
    } else {
      tokens.push(...tokenizeHanFallback(piece, trie));
    }
  }
  return tokens;
}

function sentenceSequences(markdown, wordVocabulary = []) {
  const text = stripMarkdown(markdown);
  const paragraphs = text.split(/\n\s*\n+/u);
  const sequences = [];
  for (const paragraph of paragraphs) {
    const tokens = tokenize(paragraph, wordVocabulary);
    let sequence = [];
    for (const token of tokens) {
      sequence.push(token);
      if (/^[。！？.!?]+$/u.test(token)) {
        if (sequence.length) sequences.push(sequence);
        sequence = [];
      }
    }
    if (sequence.length) sequences.push(sequence);
  }
  return sequences;
}

function discoverWordVocabulary(files) {
  const words = new Set(FALLBACK_CHINESE_WORDS);
  for (const file of files) {
    const text = String(file.content ?? '');
    for (const token of tokenize(stripMarkdown(text))) {
      if (HAN_RUN.test(token) && [...token].length > 1) words.add(token);
    }
  }
  return [...words].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function addCount(table, key, token, amount = 1) {
  if (!table[key]) table[key] = Object.create(null);
  table[key][token] = (table[key][token] || 0) + amount;
}

function pairKey(left, right) {
  return JSON.stringify([left, right]);
}

function vectorForEmbedding(token, rawVector, corpusVersion) {
  if (token === SPECIAL.BOS || token === SPECIAL.EOS || token === SPECIAL.UNK) {
    return seedVector(`${corpusVersion}:${token}`);
  }
  const vector = rawVector || Array(EMBED_DIM).fill(0);
  if (vector.every(value => value === 0)) return seedVector(`${corpusVersion}:fallback:${token}`);
  return normalize(vector);
}

function cosine(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / Math.sqrt(normA * normB);
}

function sinPosition(position, dimension = EMBED_DIM) {
  const encoding = Array(dimension);
  for (let i = 0; i < dimension; i += 1) {
    const pair = Math.floor(i / 2);
    const angle = position / (10000 ** ((2 * pair) / dimension));
    encoding[i] = i % 2 === 0 ? Math.sin(angle) : Math.cos(angle);
  }
  return encoding;
}

function fixedMatrix(seed, dimension = EMBED_DIM) {
  const random = seededRandom(seed);
  return Array.from({ length: dimension }, () => Array.from({ length: dimension }, () => (random() * 2 - 1) / Math.sqrt(dimension)));
}

function multiplyMatrix(vector, matrix) {
  return matrix.map(row => row.reduce((sum, weight, index) => sum + weight * vector[index], 0));
}

function softmax(values) {
  const max = Math.max(...values);
  const exponentials = values.map(value => Math.exp(value - max));
  const sum = exponentials.reduce((total, value) => total + value, 0) || 1;
  return exponentials.map(value => value / sum);
}

function makeAttention(contextTokens, embeddingMap, matrices) {
  const positions = contextTokens.map((token, position) => {
    const embedding = embeddingMap[token] || embeddingMap[SPECIAL.UNK];
    const positionVector = sinPosition(position);
    const x = embedding.map((value, index) => value + positionVector[index]);
    return {
      token,
      embedding,
      x,
      q: multiplyMatrix(x, matrices.wq),
      k: multiplyMatrix(x, matrices.wk),
      v: multiplyMatrix(x, matrices.wv),
    };
  });
  const lastIndex = positions.length - 1;
  const query = positions[lastIndex]?.q || Array(EMBED_DIM).fill(0);
  const scores = positions.map((position, index) => index <= lastIndex
    ? query.reduce((sum, value, dimension) => sum + value * position.k[dimension], 0) / Math.sqrt(EMBED_DIM)
    : Number.NEGATIVE_INFINITY);
  const weights = softmax(scores);
  const output = Array(EMBED_DIM).fill(0);
  positions.forEach((position, index) => {
    for (let dimension = 0; dimension < EMBED_DIM; dimension += 1) output[dimension] += weights[index] * position.v[dimension];
  });
  return { positions, weights, output };
}

export async function processCorpus(files, previousSnapshot = null, requestedEmbeddingRounds = 3) {
  const sourceFiles = [];
  for (const file of files) {
    sourceFiles.push({ ...file, content: String(file.content ?? await file.text()) });
  }
  const wordVocabulary = discoverWordVocabulary(sourceFiles);
  const sequences = [];
  const occurrences = [];
  const uniqueTokens = new Set();
  const documentInfo = [];
  for (let fileIndex = 0; fileIndex < sourceFiles.length; fileIndex += 1) {
    const file = sourceFiles[fileIndex];
    const text = file.content;
    documentInfo.push({ id: file.id, name: file.name, size: new Blob([text]).size, updatedAt: file.updatedAt || Date.now(), content: text });
    const parsedSequences = sentenceSequences(text, wordVocabulary);
    parsedSequences.forEach((tokens, sequenceIndex) => {
      const sequenceId = `${file.id}:${sequenceIndex}`;
      sequences.push({ id: sequenceId, fileId: file.id, fileName: file.name, tokens });
      tokens.forEach((token, tokenIndex) => {
        uniqueTokens.add(token);
        occurrences.push({ token, fileId: file.id, fileName: file.name, sequenceIndex, tokenIndex });
      });
    });
    if (fileIndex % 4 === 0) await Promise.resolve();
  }
  const corpusVersion = stableHash(documentInfo.map(file => `${file.id}:${file.name}:${stableHash(file.content)}`).join('|'));
  const ngrams = { unigram: Object.create(null), bigram: Object.create(null), trigram: Object.create(null) };
  const directedEdges = Object.create(null);
  const pairCounts = Object.create(null);
  const rowTotals = Object.create(null);
  const colTotals = Object.create(null);
  let totalPairs = 0;

  for (const sequence of sequences) {
    const marked = [SPECIAL.BOS, ...sequence.tokens, SPECIAL.EOS];
    for (let index = 1; index < marked.length; index += 1) {
      const target = marked[index];
      addCount(ngrams.unigram, '[]', target);
      if (index >= 1) addCount(ngrams.bigram, JSON.stringify([marked[index - 1]]), target);
      if (index >= 2) addCount(ngrams.trigram, JSON.stringify(marked.slice(index - 2, index)), target);
    }
    for (let index = 0; index < sequence.tokens.length - 1; index += 1) {
      const left = sequence.tokens[index];
      const right = sequence.tokens[index + 1];
      const key = pairKey(left, right);
      directedEdges[key] = (directedEdges[key] || 0) + 1;
    }
    const tokens = sequence.tokens;
    for (let centerIndex = 0; centerIndex < tokens.length; centerIndex += 1) {
      const center = tokens[centerIndex];
      for (let offset = -2; offset <= 2; offset += 1) {
        if (offset === 0) continue;
        const contextIndex = centerIndex + offset;
        if (contextIndex < 0 || contextIndex >= tokens.length) continue;
        const context = tokens[contextIndex];
        const key = pairKey(center, context);
        pairCounts[key] = (pairCounts[key] || 0) + 1;
        rowTotals[center] = (rowTotals[center] || 0) + 1;
        colTotals[context] = (colTotals[context] || 0) + 1;
        totalPairs += 1;
      }
    }
  }

  uniqueTokens.add(SPECIAL.BOS);
  uniqueTokens.add(SPECIAL.EOS);
  uniqueTokens.add(SPECIAL.UNK);
  const ppmiVectors = Object.create(null);
  for (const [key, count] of Object.entries(pairCounts)) {
    const [center, context] = JSON.parse(key);
    const denominator = (rowTotals[center] || 0) * (colTotals[context] || 0);
    if (!denominator || !totalPairs) continue;
    const ppmi = Math.max(Math.log((count * totalPairs) / denominator), 0);
    if (!ppmi) continue;
    if (!ppmiVectors[center]) ppmiVectors[center] = Array(EMBED_DIM).fill(0);
    for (let dimension = 0; dimension < EMBED_DIM; dimension += 1) {
      const bit = Number.parseInt(stableHash(`${corpusVersion}|${context}|${dimension}`), 16) & 1;
      ppmiVectors[center][dimension] += ppmi * (bit ? 1 : -1) / 4;
    }
  }
  const baseEmbeddings = Object.create(null);
  for (const token of uniqueTokens) baseEmbeddings[token] = vectorForEmbedding(token, ppmiVectors[token], corpusVersion);
  const embeddingRounds = Math.max(1, Math.min(8, Math.floor(Number(requestedEmbeddingRounds) || 3)));
  const embeddingMap = refineEmbeddings(baseEmbeddings, pairCounts, embeddingRounds);
  const layoutVersion = `${corpusVersion}:embedding-rounds-${embeddingRounds}`;
  const layout = createLayout([...uniqueTokens].filter(token => !Object.values(SPECIAL).includes(token)), directedEdges, embeddingMap, layoutVersion);
  const qkv = {
    version: 'fixed-qkv-v1',
    wq: fixedMatrix('fixed-qkv-v1:WQ'),
    wk: fixedMatrix('fixed-qkv-v1:WK'),
    wv: fixedMatrix('fixed-qkv-v1:WV'),
  };
  const modelVersion = stableHash(`${corpusVersion}:tokenizer-natural-zh-word-v3:embedding-rounds-${embeddingRounds}`);
  return {
    id: modelVersion,
    corpusVersion,
    modelVersion,
    createdAt: Math.max(Date.now(), (previousSnapshot?.createdAt || 0) + 1),
    tokenizerVersion: 'natural-zh-word-v3',
    embeddingVersion: 'ppmi-rp16-v1',
    wordVocabulary,
    embeddingRounds,
    qkvVersion: qkv.version,
    files: documentInfo,
    sequences,
    occurrences,
    ngrams,
    directedEdges,
    pairCounts,
    embeddings: embeddingMap,
    qkv,
    layout,
    vocabularySize: uniqueTokens.size - 3,
    tokenCount: occurrences.length,
  };
}

function refineEmbeddings(baseEmbeddings, pairCounts, rounds) {
  const tokens = Object.keys(baseEmbeddings).filter(token => !Object.values(SPECIAL).includes(token));
  const neighbors = new Map(tokens.map(token => [token, new Map()]));
  for (const [key, count] of Object.entries(pairCounts)) {
    const [center, context] = JSON.parse(key);
    if (!neighbors.has(center) || !neighbors.has(context)) continue;
    neighbors.get(center).set(context, (neighbors.get(center).get(context) || 0) + count);
    neighbors.get(context).set(center, (neighbors.get(context).get(center) || 0) + count);
  }

  let current = { ...baseEmbeddings };
  for (let round = 0; round < rounds; round += 1) {
    const next = { ...current };
    for (const token of tokens) {
      const related = neighbors.get(token);
      if (!related?.size) continue;
      const context = Array(EMBED_DIM).fill(0);
      let totalWeight = 0;
      for (const [neighbor, weight] of related) {
        const vector = current[neighbor];
        if (!vector) continue;
        totalWeight += weight;
        for (let dimension = 0; dimension < EMBED_DIM; dimension += 1) context[dimension] += vector[dimension] * weight;
      }
      if (!totalWeight) continue;
      const base = baseEmbeddings[token];
      const contextScale = 0.35 / totalWeight;
      next[token] = normalize(base.map((value, index) => value * 0.65 + context[index] * contextScale));
    }
    current = next;
  }
  return current;
}

function createLayout(tokens, edges, embeddings, corpusVersion, previousPositions = new Map()) {
  const n = Math.max(tokens.length, 1);
  const side = Math.max(2, Math.ceil(Math.cbrt(30 * n)));
  const lower = -Math.floor(side / 2);
  const upper = lower + side - 1;
  const random = seededRandom(`${corpusVersion}:layout`);
  const nodes = [];
  const positions = new Map();
  const occupied = new Map();
  const getSlotKey = p => p.join(',');
  const clampSlot = p => p.map(value => Math.max(lower, Math.min(upper, Math.round(value))));

  function nearestFree(start, nodeToken, ignoredToken = null) {
    const origin = clampSlot(start);
    if (!occupied.has(getSlotKey(origin)) || occupied.get(getSlotKey(origin)) === ignoredToken) return origin;
    for (let radius = 1; radius <= side; radius += 1) {
      const candidates = [];
      for (let x = Math.max(lower, origin[0] - radius); x <= Math.min(upper, origin[0] + radius); x += 1) {
        for (let y = Math.max(lower, origin[1] - radius); y <= Math.min(upper, origin[1] + radius); y += 1) {
          for (let z = Math.max(lower, origin[2] - radius); z <= Math.min(upper, origin[2] + radius); z += 1) {
            if (Math.max(Math.abs(x - origin[0]), Math.abs(y - origin[1]), Math.abs(z - origin[2])) !== radius) continue;
            const candidate = [x, y, z];
            const occupant = occupied.get(getSlotKey(candidate));
            if (!occupant || occupant === ignoredToken) candidates.push(candidate);
          }
        }
      }
      if (candidates.length) {
        candidates.sort((a, b) => euclidean(a, origin) - euclidean(b, origin) || a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
        return candidates[0];
      }
    }
    return null;
  }

  for (const token of [...tokens].sort()) {
    const vector = embeddings[token] || embeddings[SPECIAL.UNK];
    const projected = [0, 0, 0];
    for (let axis = 0; axis < 3; axis += 1) {
      for (let dim = 0; dim < EMBED_DIM; dim += 1) {
        const bit = Number.parseInt(stableHash(`${corpusVersion}:R:${axis}:${dim}`), 16) & 1;
        projected[axis] += vector[dim] * (bit ? 1 : -1) / Math.sqrt(EMBED_DIM);
      }
    }
    const prior = previousPositions.get(token);
    const position = prior ? clampSlot(prior) : clampSlot(projected.map(value => value * (side * 1.35)));
    const free = nearestFree(position, token);
    const assigned = free || [Math.round(lower + random() * (upper - lower)), Math.round(lower + random() * (upper - lower)), Math.round(lower + random() * (upper - lower))];
    occupied.set(getSlotKey(assigned), token);
    positions.set(token, assigned);
    nodes.push({ token, position: [...assigned], embedding: vector, sources: [] });
  }

  const nodeByToken = new Map(nodes.map(node => [node.token, node]));
  const edgesList = Object.entries(edges).map(([key, weight]) => {
    const [source, target] = JSON.parse(key);
    return { source, target, weight };
  }).sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));

  function euclidean(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
  function moveNode(node, destination) {
    occupied.delete(getSlotKey(node.position));
    node.position = [...destination];
    occupied.set(getSlotKey(node.position), node.token);
  }

  function adjacentSlots(center) {
    const result = [];
    for (let x = Math.max(lower, center[0] - 1); x <= Math.min(upper, center[0] + 1); x += 1) {
      for (let y = Math.max(lower, center[1] - 1); y <= Math.min(upper, center[1] + 1); y += 1) {
        for (let z = Math.max(lower, center[2] - 1); z <= Math.min(upper, center[2] + 1); z += 1) {
          const slot = [x, y, z];
          if (getSlotKey(slot) !== getSlotKey(center)) result.push(slot);
        }
      }
    }
    return result.sort((a, b) => euclidean(a, center) - euclidean(b, center) || a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  }

  function displace(node, chain, depth = 0) {
    if (depth > 64 || chain.has(node.token)) return false;
    const nextChain = new Set(chain);
    nextChain.add(node.token);
    const neighbors = adjacentSlots(node.position);
    const freeSlot = neighbors.find(slot => !occupied.has(getSlotKey(slot)));
    if (freeSlot) {
      moveNode(node, freeSlot);
      return true;
    }
    const occupiedNeighbors = neighbors
      .map(position => ({ position, token: occupied.get(getSlotKey(position)) }))
      .filter(item => item.token && item.token !== node.token && !nextChain.has(item.token));
    for (let index = occupiedNeighbors.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [occupiedNeighbors[index], occupiedNeighbors[swapIndex]] = [occupiedNeighbors[swapIndex], occupiedNeighbors[index]];
    }
    for (const candidate of occupiedNeighbors) {
      const occupant = nodeByToken.get(candidate.token);
      if (!occupant || !displace(occupant, nextChain, depth + 1)) continue;
      if (!occupied.has(getSlotKey(candidate.position))) {
        moveNode(node, candidate.position);
        return true;
      }
    }
    return false;
  }

  function relocate(node, destination, chain = new Set(), depth = 0) {
    if (depth > 64 || chain.has(node.token)) return false;
    const target = clampSlot(destination);
    const targetKey = getSlotKey(target);
    const occupantToken = occupied.get(targetKey);
    if (!occupantToken || occupantToken === node.token) {
      moveNode(node, target);
      return true;
    }
    const occupant = nodeByToken.get(occupantToken);
    if (!occupant) return false;
    const nextChain = new Set(chain);
    nextChain.add(node.token);
    if (!displace(occupant, nextChain, depth + 1)) return false;
    if (occupied.has(targetKey)) return false;
    moveNode(node, target);
    return true;
  }

  function moveTo(node, target) {
    const oldPositions = new Map(nodes.map(item => [item.token, [...item.position]]));
    const oldOccupied = new Map(occupied);
    if (relocate(node, target)) return;
    for (const item of nodes) item.position = oldPositions.get(item.token);
    occupied.clear();
    for (const [key, token] of oldOccupied) occupied.set(key, token);
  }

  for (const edge of edgesList) {
    const source = nodeByToken.get(edge.source);
    const target = nodeByToken.get(edge.target);
    if (!source || !target || source === target) continue;
    const passes = Math.min(edge.weight, 24);
    for (let count = 0; count < passes; count += 1) {
      const oldSource = [...source.position];
      const oldTarget = [...target.position];
      const newSource = oldSource.map((value, axis) => value + Math.sign(oldTarget[axis] - value));
      const newTarget = oldTarget.map((value, axis) => value + Math.sign(oldSource[axis] - value));
      if (euclidean(newSource, newTarget) < 1) continue;
      moveTo(source, newSource);
      moveTo(target, newTarget);
    }
  }
  return { nodes, edges: edgesList, bounds: { min: lower, max: upper, side }, dMin: 1 };
}

function euclidean(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }

function findCandidates(tokens, ngrams) {
  if (tokens.length >= 2) {
    const context = tokens.slice(-2);
    const found = ngrams.trigram[JSON.stringify(context)];
    if (found && Object.keys(found).length) return { order: 3, context, counts: found };
  }
  if (tokens.length >= 1) {
    const context = tokens.slice(-1);
    const found = ngrams.bigram[JSON.stringify(context)];
    if (found && Object.keys(found).length) return { order: 2, context, counts: found };
  }
  const unigram = ngrams.unigram['[]'];
  if (unigram && Object.keys(unigram).length) return { order: 1, context: [], counts: unigram };
  return null;
}

function seededChoice(weights, random) {
  const threshold = random();
  let cumulative = 0;
  for (let index = 0; index < weights.length; index += 1) {
    cumulative += weights[index];
    if (threshold <= cumulative) return index;
  }
  return weights.length - 1;
}

function softmaxAtTemperature(scores, temperature) {
  if (temperature <= 0) {
    const maxIndex = scores.indexOf(Math.max(...scores));
    return scores.map((_, index) => index === maxIndex ? 1 : 0);
  }
  return softmax(scores.map(score => score / temperature));
}

export async function generateReply({ snapshot, userText, role = '', systemPrompt = '', history = [], settings, turn = 0, onStep = () => {}, isCancelled = () => false }) {
  const maxContext = Math.max(16, Number(settings.maxContext) || 128);
  const wordVocabulary = snapshot.wordVocabulary || snapshot.commonTerms || [];
  const systemTokens = tokenize(systemPrompt, wordVocabulary);
  const roleTokens = tokenize(role, wordVocabulary);
  const userTokens = tokenize(userText, wordVocabulary);
  const historyChunks = history.map(item => [...tokenize(item.user || '', wordVocabulary), ...tokenize(item.assistant || '', wordVocabulary)]).filter(chunk => chunk.length);
  let contextWasTruncated = false;
  const fixedTokens = [...systemTokens, ...roleTokens];
  let boundedSystemAndRole = fixedTokens;
  if (boundedSystemAndRole.length > maxContext) {
    boundedSystemAndRole = boundedSystemAndRole.slice(-maxContext);
    contextWasTruncated = true;
  }
  let boundedUser = userTokens;
  const fixedPlusUserSize = boundedSystemAndRole.length + boundedUser.length;
  if (fixedPlusUserSize > maxContext) {
    const userBudget = Math.max(0, maxContext - boundedSystemAndRole.length);
    boundedUser = userBudget ? boundedUser.slice(-userBudget) : [];
    contextWasTruncated = true;
  }
  const budgetForHistory = Math.max(0, maxContext - boundedSystemAndRole.length - boundedUser.length);
  const retainedHistory = [];
  let usedHistory = 0;
  for (let index = historyChunks.length - 1; index >= 0; index -= 1) {
    const chunk = historyChunks[index];
    if (usedHistory + chunk.length > budgetForHistory) { contextWasTruncated = true; break; }
    retainedHistory.unshift(chunk);
    usedHistory += chunk.length;
  }
  if (retainedHistory.length < historyChunks.length) contextWasTruncated = true;
  const context = [...boundedSystemAndRole, ...retainedHistory.flat(), ...boundedUser];
  const initialPromptTokens = [...context];
  const maxTokens = Number(settings.maxTokens) || 48;
  const temperature = Number(settings.temperature ?? 0.8);
  const topK = Math.max(1, Number(settings.topK) || 5);
  const lambda = Math.max(0, Math.min(1, Number(settings.lambda ?? 0.5)));
  const historySeed = history.map(item => `${item.user || ''}:${item.assistant || ''}`).join('|');
  const seed = `${snapshot.modelVersion || snapshot.corpusVersion}|${systemPrompt}|${role}|${historySeed}|${userText}|${turn}|${temperature}|${topK}|${lambda}`;
  const random = seededRandom(seed);
  const matrices = snapshot.qkv;
  const generated = [];
  const steps = [];

  for (let stepIndex = 0; stepIndex < maxTokens; stepIndex += 1) {
    if (isCancelled()) return { cancelled: true, generated, steps, text: detokenize(generated), contextWasTruncated };
    const activeTokens = [...context, ...generated];
    const candidateSet = findCandidates(activeTokens, snapshot.ngrams);
    if (!candidateSet) return { noMatch: true, generated, steps, text: detokenize(generated), contextWasTruncated };
    const attention = makeAttention(activeTokens, snapshot.embeddings, matrices);
    const candidates = Object.entries(candidateSet.counts).map(([token, count]) => {
      const total = Object.values(candidateSet.counts).reduce((sum, value) => sum + value, 0) || 1;
      const probability = count / total;
      const embedding = snapshot.embeddings[token] || snapshot.embeddings[SPECIAL.UNK];
      const similarity = cosine(attention.output, embedding);
      const epsilon = 1e-8;
      const score = lambda * Math.log(probability + epsilon) + (1 - lambda) * similarity;
      return { token, count, probability, similarity, score };
    }).sort((a, b) => b.score - a.score || a.token.localeCompare(b.token));
        const chosenCandidates = candidates.slice(0, topK);
    const weights = softmaxAtTemperature(chosenCandidates.map(candidate => candidate.score), temperature);
    const chosenIndex = temperature <= 0 ? 0 : seededChoice(weights, random);
    const selected = chosenCandidates[chosenIndex];
    const step = {
      index: stepIndex + 1,
      order: candidateSet.order,
      context: activeTokens,
      attentionTokens: activeTokens,
      attentionWeights: attention.weights,
      embedding: snapshot.embeddings[activeTokens.at(-1)] || snapshot.embeddings[SPECIAL.UNK],
      qkv: attention.positions.at(-1) ? { q: attention.positions.at(-1).q, k: attention.positions.at(-1).k, v: attention.positions.at(-1).v } : null,
      candidates: candidates.slice(0, Math.max(8, topK)).map(candidate => ({ ...candidate, selected: candidate.token === selected.token })),
      selected: selected.token,
    };
    steps.push(step);
    generated.push(selected.token);
    onStep({ step, generated: [...generated], text: detokenize(generated) });
    if (selected.token === SPECIAL.EOS) {
      generated.pop();
      return { generated, steps, text: detokenize(generated), ended: true, inputTokens: initialPromptTokens, contextWasTruncated };
    }
    await new Promise(resolve => setTimeout(resolve, 65));
  }
  return { generated, steps, text: detokenize(generated), inputTokens: initialPromptTokens, limitReached: true, contextWasTruncated };
}

export function detokenize(tokens) {
  let output = '';
  for (const token of tokens) {
    if (Object.values(SPECIAL).includes(token)) continue;
    if (!output) { output = token; continue; }
    const previous = [...output].at(-1) || '';
    const isEnglishOrNumber = /^[A-Za-z\d]+$/u.test(token);
    const previousIsWord = /[A-Za-z\d]$/u.test(previous);
    const previousIsAsciiPunctuation = /[,;:!?\.)]$/u.test(previous);
    const previousIsHan = /\p{Script=Han}$/u.test(previous);
    if (isEnglishOrNumber && (previousIsWord || previousIsAsciiPunctuation || previousIsHan)) output += ` ${token}`;
    else output += token;
  }
  return output;
}

export function displayToken(token) {
  if (token === SPECIAL.BOS) return 'BOS';
  if (token === SPECIAL.EOS) return 'EOS';
  if (token === SPECIAL.UNK) return 'UNK';
  return token;
}

export { SPECIAL, EMBED_DIM, seededRandom };

