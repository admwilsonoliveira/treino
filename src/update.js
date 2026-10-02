// Atualização do app.
// - Navegador/PWA: o app instalado volta do segundo plano sem recarregar, então procuramos versão nova
//   ao abrir, ao voltar para a tela e a cada hora. A troca nunca acontece durante treino, caminhada
//   ou com uma janela aberta.
// - App Android (APK): consultamos a última "release" no GitHub e mostramos um aviso para baixar.
import { registerSW } from "virtual:pwa-register";
import { active, flushPending, setStatus } from "./store.js";
import { ui, modalOpen, render } from "./ui.js";
import { isNative } from "./native.js";

const REPO = "admwilsonoliveira/treino";
export const APK_URL = `https://github.com/${REPO}/releases/latest/download/treino.apk`;
export const APK_BUILD = typeof __APK_BUILD__ !== "undefined" ? __APK_BUILD__ : 0;

let pending = false, apply = null, reg = null;

function canApply(){ return !active("treino") && !active("caminhada") && !modalOpen(); }
export async function tryApplyUpdate(){
  if (!pending || !apply || !canApply()) return;
  pending = false;
  setStatus("Atualizando o app…");
  await flushPending();
  apply(true); // ativa a nova versão e recarrega a página
  // garantia: se a página não estava sob controle do service worker, o recarregamento automático não dispara
  setTimeout(() => location.reload(), 2500);
}
export function checkForUpdate(){
  if (isNative) return checkApkUpdate();
  if (reg) reg.update().catch(() => {});
}

export function initUpdates(){
  if (isNative){ checkApkUpdate(); return; }
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  apply = registerSW({
    immediate: true,
    onNeedRefresh(){
      pending = true;
      if (canApply()) tryApplyUpdate();
      else setStatus("Nova versão pronta: será instalada ao terminar o registro");
    },
    onRegisteredSW(_url, r){
      reg = r;
      if (r) setInterval(() => r.update().catch(() => {}), 60 * 60 * 1000);
    }
  });
}

/* ---------- APK ---------- */
let lastCheck = 0;
export async function checkApkUpdate(force = false){
  if (!isNative || !APK_BUILD) return;
  if (!force && Date.now() - lastCheck < 3 * 3600 * 1000) return;
  lastCheck = Date.now();
  try{
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) return;
    const rel = await r.json();
    const n = parseInt(String(rel.tag_name || "").split(".").pop(), 10);
    const asset = (rel.assets || []).find(a => /\.apk$/i.test(a.name));
    if (n > APK_BUILD && asset){
      ui.apkUpdate = { versao: String(rel.tag_name).replace(/^v/, ""), url: asset.browser_download_url };
      if (ui.tab === "hoje" || ui.tab === "perfil") render();
    }
  }catch(e){}
}
