// Treinos → Cronômetros (todos os usuários): timer simples e intervalado (HIIT: esforço + descanso em loop
// até pausar). Bipes de contagem regressiva nos últimos 5 segundos de cada fase e um bipe longo na troca.
// O tempo é calculado pelo relógio (não por contagem), então não atrasa se o celular ficar lento.
import { S, flush } from "../store.js";
import { ui, actions, changes, render, syncWakeLock } from "../ui.js";
import { esc, pad, $ } from "../util.js";
import { telaLigadaExtra, falar } from "../native.js";

const T = { modo: "timer", rodando: false, fase: "timer", fim: 0, restante: 0, volta: 1, ultimoBipe: null, ultimaFala: null, iv: null };
const cfg = () => Object.assign({ timer: 60, esforco: 30, descanso: 30, predefinicoes: [], voz: false }, (S.settings && S.settings.cronometros) || {});
const mmss = s => { s = Math.max(0, Math.ceil(s)); return pad(Math.floor(s / 60)) + ":" + pad(s % 60); };
actions.goCronometros = () => { ui.tab = "treinos"; ui.sub = "cronometros"; render(); window.scrollTo(0, 0); };

/* ---------- som ---------- */
let audio = null;
function bipe(freq = 880, dur = 0.12, vol = 0.35){
  try{
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
    o.type = "square"; o.frequency.value = freq; o.connect(g); g.connect(audio.destination);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }catch(e){}
  try{ if (navigator.vibrate) navigator.vibrate(dur > 0.3 ? 400 : 60); }catch(e){}
}

/* ---------- motor ---------- */
// "cinquenta segundos", "um minuto e trinta segundos", "dois minutos"
const falaTempo = seg => { const m = Math.floor(seg / 60), s = seg % 60, min = m === 1 ? "1 minuto" : m + " minutos";
  return m ? (s ? `${min} e ${s} segundos` : min) : `${s} segundos`; };
const duracaoFase = f => f === "timer" ? cfg().timer : f === "esforco" ? cfg().esforco : cfg().descanso;
function iniciarFase(f){ T.fase = f; T.fim = Date.now() + duracaoFase(f) * 1000; T.ultimoBipe = null; T.ultimaFala = duracaoFase(f); }
function tick(){
  if (!T.rodando) return;
  const resta = (T.fim - Date.now()) / 1000, seg = Math.ceil(resta);
  // contagem regressiva: um bipe curto em 5, 4, 3, 2, 1
  if (seg <= 5 && seg >= 1 && T.ultimoBipe !== seg){ T.ultimoBipe = seg; bipe(880, 0.12); }
  // voz (opcional): o tempo que falta a cada 10 segundos (os bipes cuidam dos 5 finais)
  if (cfg().voz && seg > 5 && seg % 10 === 0 && seg < T.ultimaFala){ T.ultimaFala = seg; falar(falaTempo(seg)); }
  if (resta <= 0){
    bipe(1320, 0.6, 0.45); // fim da fase: bipe longo e mais agudo
    if (cfg().voz) falar(T.modo === "timer" ? "Tempo!" : T.fase === "esforco" ? "Descanse!" : "Volte!");
    if (T.modo === "timer"){ parar(false); T.restante = 0; render(); return; }
    if (T.fase === "esforco") iniciarFase("descanso"); else { T.volta++; iniciarFase("esforco"); }
  }
  atualizarTela();
}
function atualizarTela(){
  const el = $("#cr-tempo"); if (!el) return;
  const resta = T.rodando ? (T.fim - Date.now()) / 1000 : T.restante;
  el.textContent = mmss(resta);
  const box = $("#cr-box"); if (box){ box.dataset.fase = T.fase; box.classList.toggle("final", T.rodando && resta <= 5); }
  const f = $("#cr-fase"); if (f) f.textContent = T.modo === "timer" ? "Timer" : (T.fase === "esforco" ? "Esforço" : "Descanso") + " · volta " + T.volta;
}
function parar(guardar = true){
  if (guardar && T.rodando) T.restante = (T.fim - Date.now()) / 1000;
  T.rodando = false; clearInterval(T.iv); T.iv = null;
  ui.cronometroAtivo = false; telaLigadaExtra(false); syncWakeLock();
}
actions.crIniciar = () => {
  bipe(660, 0.05, 0.05); // libera o som no celular (precisa de um toque do usuário)
  if (cfg().voz && !T.restante) falar(T.modo === "timer" ? "Valendo!" : "Vai!");
  if (!T.restante || T.restante <= 0){ T.volta = 1; iniciarFase(T.modo === "timer" ? "timer" : "esforco"); }
  else { T.fim = Date.now() + T.restante * 1000; T.ultimoBipe = null; T.ultimaFala = Math.ceil(T.restante); }
  T.rodando = true; clearInterval(T.iv); T.iv = setInterval(tick, 100);
  ui.cronometroAtivo = true; telaLigadaExtra(true); syncWakeLock(); render();
};
actions.crPausar = () => { parar(true); render(); };
actions.crZerar = () => { parar(false); T.restante = 0; T.volta = 1; T.fase = T.modo === "timer" ? "timer" : "esforco"; render(); };
actions.crModo = el => { if (T.rodando) return; T.modo = el.dataset.v; T.restante = 0; T.volta = 1; T.fase = T.modo === "timer" ? "timer" : "esforco"; render(); };

/* ---------- configurar tempos ---------- */
function salvarCfg(parcial){ S.settings.cronometros = Object.assign(cfg(), parcial); flush("kv", "settings"); }
changes.crTempo = el => {
  const k = el.dataset.k, m = +$("#cr-" + k + "-m").value, s = +$("#cr-" + k + "-s").value, total = Math.max(1, m * 60 + s);
  salvarCfg({ [k]: total }); if (!T.rodando){ T.restante = 0; } render();
};
actions.crPredef = el => { if (T.rodando) return; const [e, d] = el.dataset.v.split("/").map(Number); salvarCfg({ esforco: e, descanso: d }); T.restante = 0; render(); };
actions.crSalvarPredef = () => {
  const c = cfg(), v = c.esforco + "/" + c.descanso;
  if (!c.predefinicoes.includes(v)) salvarCfg({ predefinicoes: c.predefinicoes.concat(v).slice(-6) });
  render();
};
actions.crVoz = () => { salvarCfg({ voz: !cfg().voz }); if (cfg().voz) falar("Voz ligada"); render(); };
actions.crApagarPredef = el => { salvarCfg({ predefinicoes: cfg().predefinicoes.filter(x => x !== el.dataset.v) }); render(); };

function campoTempo(k, rotulo, seg){
  const m = Math.floor(seg / 60), s = seg % 60, op = (n, sel) => Array.from({ length: n }, (_, i) => `<option value="${i}" ${i === sel ? "selected" : ""}>${pad(i)}</option>`).join("");
  return `<div class="field"><span class="lab">${rotulo}</span><div class="hora-campo"><select id="cr-${k}-m" class="txt" data-act="crTempo" data-k="${k}" aria-label="Minutos" ${T.rodando ? "disabled" : ""}>${op(60, m)}</select><span>min</span>
    <select id="cr-${k}-s" class="txt" data-act="crTempo" data-k="${k}" aria-label="Segundos" ${T.rodando ? "disabled" : ""}>${op(60, s)}</select><span>s</span></div></div>`;
}

export function cronometrosHtml(){
  const c = cfg(), resta = T.rodando ? (T.fim - Date.now()) / 1000 : (T.restante > 0 ? T.restante : duracaoFase(T.modo === "timer" ? "timer" : "esforco"));
  let h = `<div class="between"><h2 style="margin-top:4px">Cronômetros</h2><button class="linkbtn" data-act="backTreinos">‹ Treinos</button></div>
    <div class="toggle" role="group">${[["timer", "Timer"], ["hiit", "Intervalado (HIIT)"]].map(([k, l]) => `<button type="button" data-act="crModo" data-v="${k}" aria-pressed="${T.modo === k}" ${T.rodando ? "disabled" : ""}>${l}</button>`).join("")}</div>
    <div class="panel cr-box" id="cr-box" data-fase="${T.fase}"><div class="small" id="cr-fase">${T.modo === "timer" ? "Timer" : (T.fase === "esforco" ? "Esforço" : "Descanso") + " · volta " + T.volta}</div>
      <div class="cr-tempo" id="cr-tempo">${mmss(resta)}</div>
      <div class="row">${T.rodando ? `<button class="btn ghost" data-act="crPausar">Pausar</button>` : `<button class="btn strength" data-act="crIniciar">${T.restante > 0 ? "Continuar" : "Iniciar"}</button>`}<button class="btn ghost" data-act="crZerar">Zerar</button></div></div>`;
  if (T.modo === "timer") h += `<div class="panel" style="margin-top:12px">${campoTempo("timer", "Tempo", c.timer)}</div>`;
  else h += `<div class="panel" style="margin-top:12px"><div class="grid2">${campoTempo("esforco", "Esforço", c.esforco)}${campoTempo("descanso", "Descanso", c.descanso)}</div>
    <p class="small muted" style="margin:6px 0 0">Roda em loop (esforço → descanso → esforço...) até você pausar.</p>
    <div class="field"><span class="lab">Predefinições</span><div class="chips">${["20/10", "30/30", "40/20", "45/15"].concat(c.predefinicoes.filter(p => !["20/10", "30/30", "40/20", "45/15"].includes(p))).map(p => `<button type="button" class="chip" data-act="crPredef" data-v="${p}" aria-pressed="${p === c.esforco + "/" + c.descanso}">${p.replace("/", " s / ")} s</button>`).join("")}
      <button type="button" class="chip" data-act="crSalvarPredef">+ guardar atual</button></div>
      ${c.predefinicoes.length ? `<div class="small muted" style="margin-top:6px">Suas: ${c.predefinicoes.map(p => `${esc(p)} <button class="linkbtn" data-act="crApagarPredef" data-v="${esc(p)}">tirar</button>`).join(" · ")}</div>` : ""}</div></div>`;
  h += `<div class="panel" style="margin-top:12px"><label class="between" style="gap:12px;cursor:pointer"><span><strong>Falar o tempo</strong><span class="small muted" style="display:block">A cada 10 segundos fala quanto falta; no fim do esforço fala "Descanse!" e no fim do descanso, "Volte!". Os bipes continuam.</span></span>
    <button type="button" class="chip" data-act="crVoz" aria-pressed="${!!c.voz}">${c.voz ? "Ligada" : "Desligada"}</button></label></div>`;
  h += `<p class="small muted" style="margin-top:12px">Bipes nos últimos 5 segundos de cada fase e um bipe longo na troca. A tela fica ligada enquanto o cronômetro roda. Deixe o volume de mídia ligado; com a tela travada ou o app em segundo plano, o som pode não tocar.</p>`;
  return h;
}
export function cronometrosAfter(){ atualizarTela(); }
