// Armazenamento no aparelho (IndexedDB). Cada "store" guarda objetos com campo id.
const DB_NAME = "treino-app";
const DB_VERSION = 1;
export const STORES = ["kv", "sessions", "measurements", "plans", "exercises"];

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
  // Restauração completa: apaga tudo e grava o conteúdo do backup numa única transação
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORES, "readwrite");
    STORES.forEach(n => {
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
