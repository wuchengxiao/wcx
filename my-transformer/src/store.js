const DB_NAME = 'token-lab-local';
const DB_VERSION = 1;
const STORES = ['corpusFiles', 'snapshots', 'conversations', 'settings'];

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开本地存储'));
  });
}

async function withStore(name, mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const store = tx.objectStore(name);
    let result;
    try { result = operation(store); } catch (error) { reject(error); db.close(); return; }
    tx.oncomplete = () => { db.close(); resolve(result?.result); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('本地存储操作失败')); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('本地存储事务已取消')); };
  });
}

export async function putRecord(storeName, record) {
  return withStore(storeName, 'readwrite', store => store.put(record));
}

export async function putSnapshot(snapshot) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('snapshots', 'readwrite');
    tx.objectStore('snapshots').put(snapshot);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('保存预训练结果失败')); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('保存预训练结果失败')); };
  });
}

export async function replaceRecords(storeName, records) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    for (const record of records) store.put(record);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('保存本地数据失败')); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('保存本地数据失败')); };
  });
}

export async function getAllRecords(storeName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error('读取本地数据失败'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error || new Error('读取本地数据失败')); };
  });
}

export async function getRecord(storeName, id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('读取本地数据失败'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error || new Error('读取本地数据失败')); };
  });
}

export async function deleteRecord(storeName, id) {
  return withStore(storeName, 'readwrite', store => store.delete(id));
}

export async function clearRecords(storeName) {
  return withStore(storeName, 'readwrite', store => store.clear());
}

export async function saveSettings(settings) {
  await putRecord('settings', { id: 'app-settings', ...settings });
}

export async function loadSettings() {
  const saved = await getRecord('settings', 'app-settings');
  return saved ? { role: saved.role || '', systemPrompt: saved.systemPrompt || '', temperature: Number(saved.temperature ?? 0.8), topK: Number(saved.topK ?? 5), lambda: Number(saved.lambda ?? 0.5), maxTokens: Number(saved.maxTokens ?? 48), maxContext: Number(saved.maxContext ?? 128) } : null;
}

