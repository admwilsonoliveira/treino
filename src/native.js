// Recursos do app Android (Capacitor). No navegador, tudo aqui vira "não faz nada".
// - Cronômetro do treino e do descanso na notificação (tela de bloqueio) — plugin próprio TreinoTimer
// - Alarme no fim do descanso e lembretes de treino/caminhada — LocalNotifications
// - Tela ligada — KeepAwake; botão voltar — App; salvar arquivos — Filesystem + Share
import { Capacitor, registerPlugin } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();
const TreinoTimer = registerPlugin("TreinoTimer");

let LN = null, KA = null, AppP = null, FS = null, SH = null, BR = null;
const ID = { treino: 4101, descanso: 4102, caminhada: 4103, alarme: 5001 };
const LEMBRETE_BASE = { treino: 6000, caminhada: 6010 };
let permOk = null;
export const notifReady = () => permOk === true;

export async function initNative(){
  if (!isNative) return;
  [{ LocalNotifications: LN }, { KeepAwake: KA }, { App: AppP }, { Filesystem: FS }, { Share: SH }, { Browser: BR }] = await Promise.all([
    import("@capacitor/local-notifications"), import("@capacitor-community/keep-awake"), import("@capacitor/app"),
    import("@capacitor/filesystem"), import("@capacitor/share"), import("@capacitor/browser")
  ]);
  try{
    await LN.createChannel({ id: "descanso_fim", name: "Fim do descanso", description: "Alarme quando o descanso entre séries termina", importance: 5, visibility: 1, vibration: true });
    await LN.createChannel({ id: "lembretes", name: "Lembretes", description: "Lembretes de treino e caminhada", importance: 4, visibility: 1, vibration: true });
  }catch(e){}
}

/* ---------- permissões ---------- */
export async function ensureNotifPermission(){
  if (!isNative) return false;
  if (permOk) return true;
  try{
    let p = await LN.checkPermissions();
    if (p.display !== "granted") p = await LN.requestPermissions();
    permOk = p.display === "granted";
  }catch(e){ permOk = false; }
  return permOk;
}
export async function notifStatus(){
  if (!isNative) return { notif: false, exact: false };
  try{
    const p = await LN.checkPermissions();
    let exact = true;
    try{ const e = await LN.checkExactNotificationSetting(); exact = e.exact_alarm === "granted"; }catch(e){}
    return { notif: p.display === "granted", exact };
  }catch(e){ return { notif: false, exact: false }; }
}
export async function openExactAlarmSettings(){ try{ await LN.changeExactNotificationSetting(); }catch(e){} }

/* ---------- cronômetro na notificação ---------- */
const shown = {};
async function showOngoing(key, opts){
  const sig = JSON.stringify(opts);
  if (shown[key] === sig) return;
  shown[key] = sig;
  try{ await TreinoTimer.show(Object.assign({ id: ID[key] }, opts)); }catch(e){ delete shown[key]; }
}
async function hideOngoing(key){
  if (!(key in shown)) return;
  delete shown[key];
  try{ await TreinoTimer.hide({ id: ID[key] }); }catch(e){}
}
// Chamado a cada renderização: mostra/esconde as notificações de treino e caminhada em andamento
export async function syncOngoing(treino, caminhada){
  if (!isNative) return;
  if (treino){
    if (await ensureNotifPermission()) showOngoing("treino", { title: `Treino ${treino.treino} em andamento`, text: treino.foco || "Toque para voltar ao treino", when: new Date(treino.start).getTime(), countDown: false });
  } else hideOngoing("treino");
  if (caminhada){
    if (await ensureNotifPermission()) showOngoing("caminhada", { title: "Caminhada em andamento", text: "Toque para fazer o check-out", when: new Date(caminhada.start).getTime(), countDown: false });
  } else hideOngoing("caminhada");
  try{ if (treino) await KA.keepAwake(); else await KA.allowSleep(); }catch(e){}
}

/* ---------- descanso ---------- */
export async function restScheduled(endMs, label){
  if (!isNative || !(await ensureNotifPermission())) return;
  const left = endMs - Date.now(); if (left <= 0) return;
  await restCanceled(false);
  showOngoing("descanso", { title: "Descanso", text: label ? label + ": próxima série" : "Descansando", when: endMs, countDown: true, timeoutMs: left });
  try{
    await LN.schedule({ notifications: [{
      id: ID.alarme, title: "Descanso acabou", body: label ? "Hora da próxima série: " + label : "Hora da próxima série",
      channelId: "descanso_fim", schedule: { at: new Date(endMs), allowWhileIdle: true }, autoCancel: true
    }] });
  }catch(e){}
}
export async function restCanceled(hideBar = true){
  if (!isNative) return;
  try{ await LN.cancel({ notifications: [{ id: ID.alarme }] }); }catch(e){}
  if (hideBar) hideOngoing("descanso");
}

/* ---------- lembretes semanais ---------- */
const hm = s => { const [h, m] = String(s || "").split(":").map(Number); return isFinite(h) && isFinite(m) ? { h, m } : null; };
export async function scheduleReminders({ treinos, walk }){
  if (!isNative) return;
  const ids = [];
  for (let d = 0; d < 7; d++) ids.push({ id: LEMBRETE_BASE.treino + d }, { id: LEMBRETE_BASE.caminhada + d });
  try{ await LN.cancel({ notifications: ids }); }catch(e){}
  const list = [];
  (treinos || []).forEach(t => { const x = hm(t.hora); if (x) list.push({ id: LEMBRETE_BASE.treino + t.weekday, title: t.title, body: t.body, channelId: "lembretes", schedule: { on: { weekday: t.weekday + 1, hour: x.h, minute: x.m }, allowWhileIdle: true } }); });
  (walk || []).forEach(t => { const x = hm(t.hora); if (x) list.push({ id: LEMBRETE_BASE.caminhada + t.weekday, title: t.title, body: t.body, channelId: "lembretes", schedule: { on: { weekday: t.weekday + 1, hour: x.h, minute: x.m }, allowWhileIdle: true } }); });
  if (!list.length) return;
  if (!(await ensureNotifPermission())) return;
  try{ await LN.schedule({ notifications: list }); }catch(e){}
}
export async function testNotification(){
  if (!isNative || !(await ensureNotifPermission())) return false;
  try{
    await LN.schedule({ notifications: [{ id: 5999, title: "Teste do Treino", body: "Se você ouviu e viu isto com a tela travada, o alarme está funcionando.", channelId: "descanso_fim", schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true } }] });
    return true;
  }catch(e){ return false; }
}

/* ---------- botão voltar do Android ---------- */
export function onBackButton(handler){
  if (!isNative || !AppP) return;
  AppP.addListener("backButton", () => { if (!handler()) AppP.minimizeApp(); });
}

/* ---------- salvar arquivo (backup, planilha) ---------- */
function blobToBase64(blob){
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
}
export async function saveFileNative(filename, blob){
  const data = await blobToBase64(blob);
  const w = await FS.writeFile({ path: filename, data, directory: "CACHE" });
  await SH.share({ title: filename, dialogTitle: "Salvar ou enviar " + filename, files: [w.uri] });
}

/* ---------- abrir link externo (YouTube, download do APK) ---------- */
export function openExternal(url){
  if (isNative && BR) return BR.open({ url }).catch(() => { location.href = url; });
  window.open(url, "_blank", "noopener");
}
