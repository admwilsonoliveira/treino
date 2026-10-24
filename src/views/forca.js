// Evolução → Força: índice de força, 1RM estimado por exercício-âncora e progressão real.
import { Chart, LineController, LineElement, PointElement, LinearScale, Tooltip, Legend } from "chart.js";
import { S, flush, getEx, exercisesWithHistory } from "../store.js";
import { ui, actions, render, openModal, closeModal, modalState } from "../ui.js";
import { esc, fmtNum, ddmm, $ } from "../util.js";
import { testesHtml, drawTestes } from "./testes.js";
import { CALIBRAGEM, REPS_MAX, serie1RM, tendencia, ancoras, ancorasSugeridas, indiceForca, variacao4, alertaForca, sessoesSemana, progressao } from "../forca.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Legend);
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const t12 = s => new Date(s + "T12:00:00").getTime();
const fmtD = v => { const d = new Date(v); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"); };
const sinal = (v, dec = 0) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmtNum(Math.abs(v), dec);

/* ---------- cartão do Hoje ---------- */
export function forcaCardHtml(){
  const ix = indiceForca(); if (ix.length < 2) return "";
  const u = ix[ix.length - 1], v = variacao4(), n = sessoesSemana();
  return `<div class="panel" style="margin-top:12px"><div class="between"><div><div class="small muted">Índice de força</div>
      <div class="stat-num" style="font-size:30px;margin-top:2px;color:var(--musculo)">${fmtNum(u.v, 0)}</div></div>
      <div style="text-align:right"><div class="small">${n} sess${n === 1 ? "ão" : "ões"} de força na semana</div><div class="small muted">meta: pelo menos 3</div></div></div>
    <div class="small" style="margin-top:6px">${v ? `<strong style="color:${v.pct >= 0 ? "var(--sucesso)" : v.pct < -10 ? "var(--danger)" : "var(--ink-2)"}">${sinal(v.pct, 1)}% em 4 semanas</strong>` : "Comparação de 4 semanas aparece com mais dados."} <button class="linkbtn" data-act="goForca">Ver força</button></div></div>`;
}
actions.goTestes = () => { ui.tab = "evolucao"; ui.sub = null; ui.evoView = "forca"; render(); const t = document.getElementById("testes"); if (t) t.scrollIntoView(); };
actions.goForca = () => { ui.tab = "evolucao"; ui.sub = null; ui.evoView = "forca"; render(); window.scrollTo(0, 0); };

/* ---------- aba ---------- */
let charts = [];
export function forcaHtml(){
  const ids = ancoras(), ix = indiceForca(), v = variacao4(), al = alertaForca(), n = sessoesSemana();
  let h = al ? `<div class="panel aviso" style="margin-bottom:12px"><strong>${esc(al.titulo)}</strong><p class="small" style="margin:4px 0 0">${esc(al.msg)}</p></div>` : "";
  h += `<div class="panel"><div class="between"><h3>Índice de força</h3><span class="small">${n}/3 sessões na semana</span></div>`;
  if (ix.length){
    const u = ix[ix.length - 1];
    h += `<div class="stat-num" style="font-size:40px;margin-top:6px;color:var(--musculo)">${fmtNum(u.v, 0)}</div>
      <div class="small">${v ? `<strong>${sinal(v.pct, 1)}%</strong> em 4 semanas` : "A comparação de 4 semanas aparece quando houver 4 semanas de dados."}</div>
      ${ix.length >= 2 ? `<div class="chartbox" style="height:180px;margin-top:10px"><canvas id="chIndice"></canvas></div>` : ""}`;
  } else h += `<p class="small muted" style="margin:6px 0 0">Ainda sem dados suficientes. O índice começa depois das ${CALIBRAGEM} primeiras sessões de cada exercício-âncora (nelas você ainda está achando a carga certa).</p>`;
  h += `<p class="small muted" style="margin:10px 0 0">100 = sua primeira medida depois da calibragem. Média dos exercícios-âncora: é o melhor sinal de que o músculo está sendo preservado.</p></div>`;

  h += `<div class="between"><h2>Exercícios-âncora</h2><button class="linkbtn" data-act="forcaAncoras">Escolher</button></div>`;
  if (!ids.length) h += `<div class="panel"><p class="empty">Escolha de 3 a 4 exercícios que você faz toda semana (ex.: leg press, puxada, peito na máquina, remada).</p></div>`;
  if (ancorasSugeridas() && ids.length) h += `<p class="small muted" style="margin:-4px 0 8px">Sugestão automática. Toque em "Escolher" para confirmar ou trocar.</p>`;
  ids.forEach((id, i) => {
    const ser = serie1RM(id), u = ser[ser.length - 1];
    h += `<div class="panel" style="margin-top:10px"><div class="between"><strong>${esc(getEx(id).nome)}</strong>${u ? `<span class="stat-num" style="font-size:22px">${fmtNum(u.v)} kg</span>` : ""}</div>
      ${u ? `<div class="small muted">1RM estimado · melhor série em ${ddmm(u.date)}: ${fmtNum(u.kg)} kg × ${fmtNum(u.reps, 0)}${u.impreciso ? ` <span class="tag gray">estimativa imprecisa (mais de ${REPS_MAX} reps)</span>` : ""}</div>
        ${ser.length >= 2 ? `<div class="chartbox" style="height:150px;margin-top:8px"><canvas id="chF${i}"></canvas></div>` : ""}` : `<div class="small muted">Aguardando sessões depois da calibragem (as ${CALIBRAGEM} primeiras não contam).</div>`}</div>`;
  });

  const pr = progressao();
  if (pr.length) h += `<h2>Progressão real</h2><div class="panel"><div class="scroll-x"><table><thead><tr><th>Exercício</th><th>4 sem. anteriores</th><th>Últimas 4</th><th>Δ</th></tr></thead><tbody>${pr.map(p => {
      const d = p.anterior ? (p.atual - p.anterior) / p.anterior * 100 : null;
      return `<tr><td style="white-space:normal">${esc(getEx(p.id).nome)}</td><td>${p.anterior ? fmtNum(p.anterior) : "–"}</td><td>${fmtNum(p.atual)}</td><td style="font-weight:700;color:${d == null ? "var(--ink-2)" : d >= 0 ? "var(--sucesso)" : "var(--danger)"}">${d == null ? "–" : sinal(d, 1) + "%"}</td></tr>`; }).join("")}</tbody></table></div>
    <p class="small muted" style="margin:8px 0 0">Média do 1RM estimado em kg, sem as ${CALIBRAGEM} sessões de calibragem. Em déficit calórico, manter a carga já é sucesso.</p></div>`;
  return h + testesHtml();
}

export function drawForca(){
  charts.forEach(c => { try{ c.destroy(); }catch(e){} }); charts = [];
  drawTestes();
  const mu = cssVar("--musculo"), ink2 = cssVar("--ink-2"), line = cssVar("--line");
  const base = (el, ds, yFmt) => charts.push(new Chart(el, { type: "line", data: { datasets: ds }, options: {
    responsive: true, maintainAspectRatio: false, animation: false, parsing: false, plugins: { legend: { display: false }, tooltip: { callbacks: { title: it => fmtD(it[0].parsed.x), label: it => yFmt(it.parsed.y) } } },
    scales: { x: { type: "linear", ticks: { color: ink2, maxTicksLimit: 5, callback: fmtD }, grid: { display: false } }, y: { ticks: { color: ink2 }, grid: { color: line } } } } }));
  const ci = $("#chIndice");
  if (ci) base(ci, [{ data: indiceForca().map(p => ({ x: t12(p.semana), y: p.v })), borderColor: mu, backgroundColor: mu, pointRadius: 3, borderWidth: 2.5, tension: .2 }], y => fmtNum(y, 0));
  ancoras().forEach((id, i) => {
    const el = $("#chF" + i); if (!el) return;
    base(el, [
      { data: serie1RM(id).map(p => ({ x: t12(p.date), y: p.v })), showLine: false, pointRadius: 3, borderColor: mu + "66", backgroundColor: mu + "66" },
      { data: tendencia(id).map(p => ({ x: t12(p.date), y: p.v })), borderColor: mu, pointRadius: 0, borderWidth: 2.5, tension: .2 }
    ], y => fmtNum(y) + " kg");
  });
}

/* ---------- escolher os exercícios-âncora ---------- */
actions.forcaAncoras = () => {
  const sel = ancoras().slice(), hist = exercisesWithHistory();
  openModal(`<h3>Exercícios-âncora</h3><p class="small muted" style="margin-top:6px">Escolha de 3 a 4 que você faz toda semana e com carga que dá para progredir.</p>
    <div class="chips" style="margin-top:12px">${hist.map(id => `<button type="button" class="chip" data-act="ancTog" data-v="${esc(id)}" aria-pressed="${sel.includes(id)}">${esc(getEx(id).nome)}</button>`).join("")}</div>
    <div class="err" id="anc-err"></div>
    <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn strength" data-act="ancSalvar">Salvar</button></div>`, { sel });
};
actions.ancTog = el => {
  const k = el.dataset.v, i = modalState.sel.indexOf(k);
  if (i >= 0) modalState.sel.splice(i, 1);
  else { if (modalState.sel.length >= 4){ $("#anc-err").textContent = "No máximo 4."; return; } modalState.sel.push(k); }
  $("#anc-err").textContent = "";
  el.setAttribute("aria-pressed", String(i < 0));
};
actions.ancSalvar = () => {
  if (modalState.sel.length < 1){ $("#anc-err").textContent = "Escolha pelo menos 1 (o ideal são 3 ou 4)."; return; }
  S.settings.forcaAncoras = modalState.sel.slice(); flush("kv", "settings"); closeModal(); render();
};
