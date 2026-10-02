import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "./styles.css";

import { S, loadAll, flushPending, activePlan, autoCloseStale } from "./store.js";
import { ui, views, actions, inputs, changes, render, go, openModal, closeModal, modalOpen, syncWakeLock, stopRest } from "./ui.js";
import { $, esc, ddmm, timeOf } from "./util.js";
import "./views/hoje.js";
import "./views/treinos.js";
import "./views/caminhada.js";
import "./views/evolucao.js";
import "./views/perfil.js";
import { startOnboarding } from "./views/onboarding.js";
import { initUpdates, checkForUpdate, tryApplyUpdate } from "./update.js";

initUpdates();

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
  else {
    if (S.settings && checkStale()) render();
    checkForUpdate(); tryApplyUpdate();
  }
  syncWakeLock();
});
// Ao fechar uma janela ou concluir um registro, aplica a atualização que estiver esperando
document.addEventListener("click", () => setTimeout(tryApplyUpdate, 300));
window.addEventListener("pagehide", () => flushPending());

(async function start(){
  try{
    await loadAll();
  }catch(e){
    $("#app").innerHTML = `<div class="panel"><h3>Não foi possível abrir seus dados</h3><p class="small muted" style="margin-top:6px">O navegador bloqueou o armazenamento. Verifique se não está em uma aba anônima.</p></div>`;
    return;
  }
  checkStale();
  if (!S.profile || !activePlan() && !Object.keys(S.plans).length) startOnboarding();
  else render();
  setInterval(() => { if (checkStale()) render(); }, 60 * 1000);
})();

// Treino esquecido: sem atividade por 3 h, encerra como incompleto e avisa o usuário
function checkStale(){
  const s = autoCloseStale(); if (!s) return false;
  stopRest();
  setTimeout(() => openModal(`<h3>Treino encerrado automaticamente</h3>
    <p style="margin-top:10px">O treino ${esc(s.treino)} de ${ddmm(s.date)}, iniciado às ${timeOf(s.start)}, ficou mais de 3 horas sem atividade. Ele foi salvo como <strong>incompleto</strong>, terminando às ${timeOf(s.end)}, com as séries que você registrou.</p>
    <div class="row" style="margin-top:20px"><button class="btn strength" data-act="closeModal">Entendi</button></div>`), 50);
  return true;
}
