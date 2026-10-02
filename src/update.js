// Atualização automática do app instalado.
// O app instalado volta do segundo plano sem recarregar, então procuramos versão nova
// ao abrir, ao voltar para a tela e a cada hora. A troca nunca acontece durante treino,
// caminhada ou com uma janela aberta.
import { registerSW } from "virtual:pwa-register";
import { active, flushPending, setStatus } from "./store.js";
import { modalOpen } from "./ui.js";

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
export function checkForUpdate(){ if (reg) reg.update().catch(() => {}); }

export function initUpdates(){
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
