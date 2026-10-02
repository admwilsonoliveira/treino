// Infraestrutura da interface: abas, ações, janelas (modal), cronômetros.
import { $, dur } from "./util.js";
import { S, active } from "./store.js";
import { isNative, syncOngoing, restScheduled, restCanceled, notifReady } from "./native.js";

export const ui = { tab: "hoje", sub: null, treino: null, exSel: null, metric: "max", evoView: "cargas" };
export const views = {};      // aba -> { html(), after?() }
export const actions = {};    // data-act (clique) -> fn(el, ev)
export const inputs = {};     // data-act (digitação) -> fn(el, ev)
export const changes = {};    // data-act (change) -> fn(el, ev)

let onboarding = null;
export function setOnboarding(v){ onboarding = v; }

export function render(){
  const tabs = $("#tabs");
  const app = $("#app");
  if (onboarding){
    tabs.hidden = true;
    app.innerHTML = onboarding.html();
    if (onboarding.after) onboarding.after();
  } else {
    tabs.hidden = false;
    document.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-current", b.dataset.tab === ui.tab ? "page" : "false"));
    const v = views[ui.tab];
    app.innerHTML = v.html();
    if (v.after) v.after();
  }
  tick();
  syncWakeLock();
  if (isNative) syncOngoing(active("treino"), active("caminhada"));
  greet();
}
function greet(){
  const h = new Date().getHours(), nome = S.profile && S.profile.nome ? ", " + S.profile.nome.split(" ")[0] : "";
  $("#hello").textContent = (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite") + nome;
}
export function go(tab, sub = null){ ui.tab = tab; ui.sub = sub; render(); window.scrollTo(0, 0); }
export function rerenderKeepScroll(){ const y = window.scrollY; render(); window.scrollTo(0, y); }

/* ---------- modal ---------- */
export let modalState = {};
export function openModal(html, state = {}){
  modalState = state;
  $("#sheet").innerHTML = html; $("#modal").style.display = "flex";
  document.body.style.overflow = "hidden";
  const f = $("#sheet").querySelector("[autofocus], input, button"); if (f) f.focus({ preventScroll: true });
}
export function updateModal(html){ $("#sheet").innerHTML = html; }
export function closeModal(){ $("#modal").style.display = "none"; $("#sheet").innerHTML = ""; modalState = {}; document.body.style.overflow = ""; }
export const modalOpen = () => $("#modal").style.display === "flex";

export const scaleHtml = (name, n, start, sel = null, labels = null) =>
  `<div class="scale" role="group" style="--n:${n}">${Array.from({ length: n }, (_, i) => { const v = i + start; return `<button type="button" data-act="scale" data-name="${name}" data-v="${v}" aria-pressed="${sel === v}">${labels ? labels[i] : v}</button>`; }).join("")}</div>`;
export const rangeHtml = (name, v) =>
  `<div class="rng"><input type="range" min="0" max="10" step="1" value="${v}" data-act="range" data-name="${name}" aria-label="Dor de 0 a 10"><output id="out-${name}">${v}</output></div>`;

actions.scale = el => {
  modalState[el.dataset.name] = parseInt(el.dataset.v, 10);
  el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false"));
};
inputs.range = el => {
  modalState[el.dataset.name] = parseInt(el.value, 10);
  const o = document.getElementById("out-" + el.dataset.name); if (o) o.textContent = el.value;
};
actions.closeModal = () => closeModal();

/* ---------- relógios ---------- */
export function tick(){
  document.querySelectorAll("[data-since]").forEach(el => { el.textContent = dur(Date.now() - new Date(el.dataset.since).getTime()); });
}
setInterval(tick, 1000);

const rest = { end: 0, total: 0, iv: null, label: "" };
export function startRest(sec, label = ""){
  rest.total = sec; rest.end = Date.now() + sec * 1000; rest.label = label;
  restScheduled(rest.end, label); // app Android: cronômetro na tela de bloqueio + alarme no fim
  $("#rest").style.display = "flex";
  clearInterval(rest.iv); rest.iv = setInterval(restTick, 250); restTick();
}
export function stopRest(){ clearInterval(rest.iv); $("#rest").style.display = "none"; restCanceled(); }
function restTick(){
  const left = rest.end - Date.now();
  if (left <= 0){
    $("#restT").textContent = "Vai!"; $("#restBar").style.width = "0%";
    clearInterval(rest.iv);
    // no app Android o alarme do sistema já toca e vibra; aqui só no navegador
    if (!(isNative && notifReady())){
      try{ if (navigator.vibrate) navigator.vibrate([200, 100, 200]); }catch(e){}
      beep();
    }
    setTimeout(() => { if (rest.end - Date.now() <= 0) $("#rest").style.display = "none"; }, 4000);
    return;
  }
  $("#restT").textContent = dur(left + 999);
  $("#restBar").style.width = Math.max(0, Math.min(100, left / (rest.total * 1000) * 100)) + "%";
}
actions["rest-add"] = () => {
  rest.end = Math.max(rest.end, Date.now()) + 30000; rest.total += 30;
  $("#rest").style.display = "flex";
  restScheduled(rest.end, rest.label);
  clearInterval(rest.iv); rest.iv = setInterval(restTick, 250); restTick();
};
actions["rest-stop"] = () => stopRest();
actions.rest = el => startRest(parseInt(el.dataset.s, 10));

let audioCtx = null;
function beep(){
  try{
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25].forEach(t => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.25, audioCtx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t + 0.2);
      o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.2);
    });
  }catch(e){}
}

/* ---------- tela ligada durante treino/caminhada ---------- */
let wakeLock = null;
export async function syncWakeLock(){
  if (isNative) return; // no app Android a tela ligada é controlada em native.js
  const want = !!active("treino") && document.visibilityState === "visible";
  try{
    if (want && !wakeLock && "wakeLock" in navigator){
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if (!want && wakeLock){
      await wakeLock.release(); wakeLock = null;
    }
  }catch(e){ wakeLock = null; }
}
