// Backup no Google Drive do próprio usuário (pasta oculta do app, escopo drive.appdata).
// O app só enxerga os arquivos que ele mesmo criou; nada do resto do Drive.
// - Login com Google pelo plugin @capgo/capacitor-social-login (APK e web).
// - Backup automático: 20 s depois de qualquer alteração e ao sair do app.
// - Restauração: ao entrar num aparelho novo, ou quando há backup mais novo de outro aparelho.
import { S, flush, setStatus, exportData, validateBackup, restoreData, flushPending, changeHooks } from "./store.js";
import { isNative } from "./native.js";

const WEB_CLIENT_ID = "955091117059-ljiv58m58919efirbdau7onjklvn437f.apps.googleusercontent.com";
const SCOPES = ["email", "profile", "https://www.googleapis.com/auth/drive.appdata"];
const FILE_NAME = "treino-backup.json";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

let SL = null, token = null, tokenExp = 0, dirty = false, timer = null, busy = false;
export const cloud = { status: "", erro: "", remote: null }; // remote: { modifiedTime, device, registros } quando há backup mais novo de outro aparelho

/* ---------- identificação deste aparelho (não vai no backup) ---------- */
function deviceId(){
  try{
    let id = localStorage.getItem("treino.deviceId");
    if (!id){ id = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem("treino.deviceId", id); }
    return id;
  }catch(e){ return "desconhecido"; }
}
export const nuvem = () => (S.settings && S.settings.nuvem) || null;
function setNuvem(patch){
  S.settings.nuvem = Object.assign({}, S.settings.nuvem || {}, patch);
  return flush("kv", "settings", true);
}

/* ---------- login ---------- */
async function plugin(){
  if (SL) return SL;
  const m = await import("@capgo/capacitor-social-login");
  SL = m.SocialLogin;
  // na web, o Google devolve o login para este endereço (cadastrado no Google Cloud como "URI de redirecionamento")
  const redirectUrl = isNative ? undefined : location.origin + location.pathname.replace(/index.html$/, "");
  await SL.initialize({ google: { webClientId: WEB_CLIENT_ID, mode: "online", redirectUrl } });
  return SL;
}
export async function signIn(){
  const sl = await plugin();
  const res = await sl.login({ provider: "google", options: { scopes: SCOPES, prompt: "select_account" } });
  const r = res.result || {};
  if (!r.accessToken || !r.accessToken.token) throw new Error("O Google não liberou o acesso ao Drive. Tente de novo e marque a permissão do Drive.");
  token = r.accessToken.token; tokenExp = Date.now() + 50 * 60 * 1000;
  const p = r.profile || {};
  await setNuvem({ email: p.email || "", nome: p.name || p.givenName || "", conectadoEm: new Date().toISOString() });
  return p;
}
export async function signOut(){
  try{ const sl = await plugin(); await sl.logout({ provider: "google" }); }catch(e){}
  token = null; tokenExp = 0; cloud.remote = null;
  S.settings.nuvem = null; await flush("kv", "settings", true);
}
// Token válido sem incomodar o usuário. No APK o Android renova sozinho; na web é preciso entrar de novo após ~1 h.
async function getToken(){
  if (token && Date.now() < tokenExp) return token;
  if (!nuvem() || !nuvem().email) return null;
  if (isNative){
    try{
      const sl = await plugin();
      const r = await sl.getAuthorizationCode({ provider: "google" });
      if (r && r.accessToken){ token = r.accessToken; tokenExp = Date.now() + 50 * 60 * 1000; return token; }
    }catch(e){}
  }
  return null;
}
export const sessionActive = () => !!(token && Date.now() < tokenExp);

/* ---------- Drive ---------- */
async function api(url, opts = {}){
  const t = await getToken();
  if (!t) throw Object.assign(new Error("Entre com Google de novo para continuar o backup."), { code: "auth" });
  const r = await fetch(url, Object.assign({}, opts, { headers: Object.assign({ Authorization: "Bearer " + t }, opts.headers || {}) }));
  if (r.status === 401){ token = null; tokenExp = 0; throw Object.assign(new Error("Sessão do Google expirou."), { code: "auth" }); }
  if (!r.ok) throw await driveError(r);
  return r;
}
// Traduz o motivo que o Google Drive informa no erro, para o usuário saber o que fazer
async function driveError(r){
  let reason = "", msg = "";
  try{ const j = await r.json(); const e = j.error || {}; msg = e.message || ""; reason = ((e.errors || [])[0] || {}).reason || (e.details || []).map(d => d.reason).filter(Boolean)[0] || e.status || ""; }catch(e){}
  const all = (reason + " " + msg).toLowerCase();
  if (/accessnotconfigured|service_disabled|has not been used|is disabled/.test(all))
    return new Error("A API do Google Drive não está ativada no projeto do Google Cloud. Ative em console.cloud.google.com → APIs → Google Drive API → Ativar.");
  if (/insufficient|scope|permission/.test(all)){
    token = null; tokenExp = 0;
    return Object.assign(new Error("O acesso ao Google Drive não foi autorizado. Toque em \"Sair da conta Google\", entre de novo e marque a permissão do Google Drive."), { code: "auth" });
  }
  return new Error(`Google Drive respondeu ${r.status}${reason ? " (" + reason + ")" : ""}${msg ? ": " + msg : ""}`);
}
async function findFile(){
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const r = await api(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime,size,appProperties)&orderBy=modifiedTime desc`);
  const j = await r.json();
  return (j.files || [])[0] || null;
}
async function downloadFile(id){ return (await api(`${API}/files/${id}?alt=media`)).json(); }
async function uploadFile(existingId, data){
  const body = JSON.stringify(data);
  const meta = { appProperties: { device: deviceId(), registros: String(data.sessions.length) } };
  if (existingId){
    // atualiza conteúdo e metadados numa única requisição
    const boundary = "treino" + Date.now();
    const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
    return (await api(`${UPLOAD}/files/${existingId}?uploadType=multipart&fields=id,modifiedTime`, { method: "PATCH", headers: { "Content-Type": "multipart/related; boundary=" + boundary }, body: multipart })).json();
  }
  const boundary = "treino" + Date.now();
  const createMeta = Object.assign({ name: FILE_NAME, parents: ["appDataFolder"] }, meta);
  const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(createMeta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
  return (await api(`${UPLOAD}/files?uploadType=multipart&fields=id,modifiedTime`, { method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + boundary }, body: multipart })).json();
}

/* ---------- backup e restauração ---------- */
export async function backupNow(manual = false){
  if (busy || !nuvem() || !nuvem().email) return false;
  busy = true;
  try{
    await flushPending();
    const data = exportData();
    const f = await findFile();
    const res = await uploadFile(f && f.id, data);
    dirty = false; cloud.remote = null;
    await setNuvem({ fileId: res.id, ultimoEnvio: res.modifiedTime || new Date().toISOString() });
    cloud.status = ""; cloud.erro = "";
    if (manual) setStatus("Backup salvo no Google Drive");
    return true;
  }catch(e){
    cloud.status = e.code === "auth" ? "auth" : "erro";
    cloud.erro = e.message || "Não foi possível fazer o backup";
    if (manual) setStatus("Backup não foi feito: veja o motivo no Perfil");
    return false;
  }finally{ busy = false; }
}
// Informações do backup no Drive (para perguntar antes de restaurar)
export async function remoteInfo(){
  const f = await findFile();
  if (!f) return null;
  return { id: f.id, modifiedTime: f.modifiedTime, device: (f.appProperties || {}).device, registros: parseInt((f.appProperties || {}).registros || "0", 10), deste: (f.appProperties || {}).device === deviceId() };
}
export async function restoreFromDrive(){
  const f = await findFile();
  if (!f) throw new Error("Não há backup no seu Google Drive ainda.");
  const d = await downloadFile(f.id);
  const err = validateBackup(d); if (err) throw new Error(err);
  const login = nuvem();
  await restoreData(d);
  // mantém o login deste aparelho e registra que já está em dia com o Drive
  S.settings.nuvem = Object.assign({}, login, { fileId: f.id, ultimoEnvio: f.modifiedTime });
  await flush("kv", "settings", true);
  dirty = false; cloud.remote = null;
}
// Ao abrir o app: existe backup mais novo feito por outro aparelho?
export async function checkRemoteNewer(){
  if (!nuvem() || !nuvem().email) return null;
  try{
    const info = await remoteInfo();
    const last = nuvem().ultimoEnvio || "";
    if (info && !info.deste && info.modifiedTime > last){ cloud.remote = info; return info; }
  }catch(e){ if (e.code === "auth") cloud.status = "auth"; }
  return null;
}

/* ---------- automático ---------- */
function scheduleBackup(){
  if (!nuvem() || !nuvem().email) return;
  dirty = true;
  clearTimeout(timer);
  timer = setTimeout(() => backupNow(false), 20 * 1000);
}
changeHooks.push(scheduleBackup);
export function backupIfDirty(){ if (dirty){ clearTimeout(timer); backupNow(false); } }
