// Armazenamento no aparelho (IndexedDB). Cada "store" guarda objetos com campo id.
const DB_NAME = "treino-app";
// v2: store "fotos" (foto do aparelho de cada exercício)
const DB_VERSION = 2;
export const STORES = ["kv", "sessions", "measurements", "plans", "exercises", "fotos"];

let dbp = null;
function open(){
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach(n => { if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: "id" }); });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}
function tx(store, mode, fn){
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode), s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}
export const getAll = store => tx(store, "readonly", s => s.getAll());
export const put = (store, obj) => tx(store, "readwrite", s => { s.put(JSON.parse(JSON.stringify(obj))); });
export const del = (store, id) => tx(store, "readwrite", s => { s.delete(id); });
export function replaceAll(data){
  // Restauração: apaga e regrava, numa única transação, só as stores presentes no backup
  // (o backup do Drive não leva as fotos; elas vêm de um arquivo separado)
  const alvo = STORES.filter(n => Array.isArray(data[n]));
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(alvo, "readwrite");
    alvo.forEach(n => {
      const s = t.objectStore(n); s.clear();
      (data[n] || []).forEach(o => { if (o && o.id != null) s.put(o); });
    });
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}
export async function requestPersist(){
  try{ if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); }catch(e){}
  return false;
}
