import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "./styles.css";

import { S, loadAll, flushPending, activePlan } from "./store.js";
import { ui, views, actions, inputs, changes, render, go, closeModal, modalOpen, syncWakeLock } from "./ui.js";
import { $ } from "./util.js";
import "./views/hoje.js";
import "./views/treinos.js";
import "./views/caminhada.js";
import "./views/evolucao.js";
import "./views/perfil.js";
import { startOnboarding } from "./views/onboarding.js";

actions.goTab = el => go(el.dataset.tab);

document.addEventListener("click", ev => {
  const tabBtn = ev.target.closest("nav.tabs button[data-tab]");
  if (tabBtn){ go(tabBtn.dataset.tab); return; }
  if (ev.target.id === "modal"){ closeModal(); return; }
  const el = ev.target.closest("[data-act]"); if (!el) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el, ev);
});
document.addEventListener("input", ev => {
  const el = ev.target, fn = el.dataset && inputs[el.dataset.act];
  if (fn) fn(el, ev);
});
document.addEventListener("change", ev => {
  const el = ev.target, fn = el.dataset && changes[el.dataset.act];
  if (fn) fn(el, ev);
});
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && modalOpen()) closeModal(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushPending();
  syncWakeLock();
});
window.addEventListener("pagehide", () => flushPending());

(async function start(){
  try{
    await loadAll();
  }catch(e){
    $("#app").innerHTML = `<div class="panel"><h3>Não foi possível abrir seus dados</h3><p class="small muted" style="margin-top:6px">O navegador bloqueou o armazenamento. Verifique se não está em uma aba anônima.</p></div>`;
    return;
  }
  if (!S.profile || !activePlan() && !Object.keys(S.plans).length) startOnboarding();
  else render();
})();
