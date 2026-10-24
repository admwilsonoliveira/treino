// Armazenamento no aparelho (IndexedDB). Cada "store" guarda objetos com campo id.
const DB_NAME = "treino-app";
// v2: store "fotos" (foto do aparelho de cada exercício)
// v3: stores do módulo Saúde (doses, sintomas, eventos, medidas com fita, exames) — só acréscimo
// v4: store "testes" (testes funcionais: sentar e levantar, preensão) — de todos os usuários
// v5: store "dobras" (dobras cutâneas, módulo Saúde)
const DB_VERSION = 5;
export const SAUDE_STORES = ["doses", "sintomas", "eventos", "fita", "exames", "dobras"];
export const STORES = ["kv", "sessions", "measurements", "plans", "exercises", "fotos", "testes"].concat(SAUDE_STORES);

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
// Restauração "mesclar": só acrescenta o que ainda não existe (pelo id); nada é apagado nem sobrescrito
export function mergeAll(data){
  const alvo = STORES.filter(n => Array.isArray(data[n]) && data[n].length);
  if (!alvo.length) return Promise.resolve(0);
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(alvo, "readwrite");
    let novos = 0;
    alvo.forEach(n => {
      const s = t.objectStore(n);
      data[n].forEach(o => {
        if (!o || o.id == null) return;
        const r = s.getKey(o.id);
        r.onsuccess = () => { if (r.result === undefined){ s.put(o); novos++; } };
      });
    });
    t.oncomplete = () => resolve(novos);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}
// Apaga por completo as stores indicadas (usado em "Apagar meus dados de saúde")
export function clearStores(names){
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(names, "readwrite");
    names.forEach(n => t.objectStore(n).clear());
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}
export async function requestPersist(){
  try{ if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); }catch(e){}
  return false;
}
