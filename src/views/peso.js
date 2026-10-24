// Saúde → Peso: média de 7 dias com faixas de dose e eventos, ritmo, projeção, platô, composição, FFMI e estudo.
import { Chart, LineController, LineElement, PointElement, LinearScale, Tooltip, Legend } from "chart.js";
import { S, flush, setStatus } from "../store.js";
import { ui, views, actions, render, openModal, closeModal, modalState } from "../ui.js";
import { esc, num, fmtNum, ymd, ddmm, ddmmyyyy, newId, $ } from "../util.js";
import { addDias, diasAte } from "../medicacao.js";
import { cinturaResumo } from "./fita.js";
import {
  pesagens, serieMedia, mediaAtual, ultimaPesagem, ritmo, perdaTotal, projecao, composicao, ffmiMensal, SURMOUNT, suaCurva,
  faixasDose, TIPOS_EVENTO, nomeEvento, eventosList, notaEvento, ganhoFumo, plato, media7
} from "../peso.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Legend);
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const t12 = s => new Date(s + "T12:00:00").getTime();
const fmtD = v => { const d = new Date(v); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"); };
const sinal = (v, dec = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmtNum(Math.abs(v), dec);
const mesNome = m => ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][+m.slice(5, 7) - 1] + "/" + m.slice(2, 4);

/* ---------- cartão do Hoje ---------- */
export function pesoCardHtml(){
  const m = mediaAtual(); if (m == null) return "";
  const r = ritmo(4), pt = perdaTotal();
  return `<div class="panel" style="margin-top:12px"><div class="between"><div><div class="small muted">Peso · média de 7 dias</div>
      <div class="stat-num" style="font-size:34px;margin-top:2px">${fmtNum(m)}<span class="small muted" style="font-weight:600;letter-spacing:0"> kg</span></div></div>
      <button class="linkbtn" data-act="goPeso">Ver peso</button></div>
    <div class="small" style="margin-top:6px">${r != null ? `<strong style="color:${r < 0 ? "var(--sucesso)" : "var(--ink-2)"}">${sinal(r, 2)} kg/semana</strong> <span class="muted">(4 sem.)</span>` : ""}${pt ? ` · ${sinal(pt.kg)} kg desde ${ddmm(pt.desde)}` : ""}</div>
    ${cinturaResumo() ? `<div class="small muted" style="margin-top:4px">${esc(cinturaResumo())}</div>` : ""}</div>`;
}
actions.goPeso = () => { ui.tab = "saude"; ui.sub = "peso"; render(); window.scrollTo(0, 0); };

/* ---------- tela ---------- */
let charts = [];
ui.pesoFaixa = ui.pesoFaixa || "tudo";
export function pesoHtml(){
  const m = mediaAtual(), u = ultimaPesagem();
  let h = `<div class="between"><h2 style="margin-top:0">Peso</h2><button class="linkbtn" data-act="goSaude">‹ Saúde</button></div>`;
  if (m == null) return h + `<div class="panel"><p class="empty">Registre a primeira pesagem para ver a média, o ritmo e o gráfico.</p><button class="btn strength" data-act="addMedida">Registrar peso</button></div>`;
  const pt = perdaTotal(), r1 = ritmo(1), r4 = ritmo(4), r6 = ritmo(6);
  h += `<div class="panel"><div class="small muted">Média de 7 dias · última pesagem ${ddmm(u.date)}</div>
    <div class="stat-num" style="font-size:44px;margin-top:4px">${fmtNum(m)}<span class="small muted" style="font-weight:600;letter-spacing:0"> kg</span></div>
    ${pt ? `<div class="small" style="margin-top:6px"><strong style="color:var(--sucesso)">${sinal(pt.kg)} kg (${sinal(pt.pct)}%)</strong> desde ${ddmmyyyy(pt.desde)}</div>` : ""}
    <div class="stats" style="margin-top:12px">${[[r1, "1 semana"], [r4, "4 semanas"], [r6, "6 semanas"]].map(([v, l]) => `<div class="stat"><div class="v">${v != null ? sinal(v, 2) : "–"}</div><div class="l">kg/sem · ${l}</div></div>`).join("")}</div>
    <div class="row" style="margin-top:12px"><button class="btn strength" data-act="addMedida">Registrar peso</button><button class="btn ghost" data-act="eventoNovo">Adicionar evento</button></div></div>`;

  h += `<div class="toggle" role="group">${[["4s", "4 semanas"], ["3m", "3 meses"], ["tudo", "Tudo"]].map(([k, l]) => `<button type="button" data-act="pesoFaixa" data-v="${k}" aria-pressed="${ui.pesoFaixa === k}">${l}</button>`).join("")}</div>
    <div class="panel"><div class="chartbox" style="height:240px"><canvas id="chPeso"></canvas></div>
    <div class="legenda small muted"><span><i style="background:var(--strength)"></i>Média 7 dias</span><span><i style="background:var(--strength);opacity:.35"></i>Pesagem do dia</span><span><i style="background:var(--dose);opacity:.4"></i>Faixa da dose</span><span><i style="background:var(--walk)"></i>Evento</span></div></div>`;

  const evs = eventosList().slice().reverse();
  if (evs.length) h += `<h2>Eventos</h2><div class="panel"><ul class="hist">${evs.slice(0, 10).map(e => { const n = notaEvento(e);
      return `<li style="align-items:flex-start"><div><strong>${ddmm(e.date)}</strong> · ${esc(nomeEvento(e.tipo))}${e.descricao ? `<div class="small muted">${esc(e.descricao)}</div>` : ""}${n ? `<div class="small" style="margin-top:4px">${esc(n)}</div>` : ""}</div><button class="del" data-act="eventoEditar" data-id="${esc(e.id)}">Editar</button></li>`; }).join("")}</ul></div>`;

  const pl = plato();
  if (pl && pl.nivel !== "ok") h += `<h2>Tendência</h2><div class="panel${pl.nivel === "plato" ? " aviso" : ""}"><strong>${esc(pl.titulo)}</strong><p class="small" style="margin:4px 0 0">${esc(pl.msg)}</p>
    ${pl.contexto ? `<p class="small muted" style="margin:6px 0 0">${esc(pl.contexto)}</p>` : ""}${pl.semCintura ? `<p class="small muted" style="margin:6px 0 0">Meça a cintura em jejum para confirmar: se ela estiver caindo, você está perdendo gordura mesmo com o peso parado.</p>` : ""}
    ${pl.eventosRecentes ? `<p class="small muted" style="margin:6px 0 0">Há eventos nas últimas 4 semanas que podem mexer no peso; a leitura fica menos confiável.</p>` : ""}</div>`;

  const pj = projecao();
  if (pj.length) h += `<h2>Projeção</h2><div class="panel"><div class="stats" style="margin-top:0">${pj.map(p => `<div class="stat"><div class="v">${p.alvo}</div><div class="l">kg em ${mesNome(p.date)}</div></div>`).join("")}</div>
    <p class="small muted" style="margin:8px 0 0">Projeção pelo ritmo das últimas 4 semanas. O ritmo costuma diminuir com o tempo; use como referência, não como promessa.</p></div>`;

  const cp = composicao();
  if (cp) h += `<h2>Composição da perda</h2><div class="panel"><div class="small muted">De ${ddmm(cp.de)} a ${ddmm(cp.ate)}: ${sinal(cp.dPeso)} kg de peso, ${sinal(cp.dGordura)} kg de gordura</div>
    <div class="barra-comp"><i style="flex:${Math.round(cp.gordura * 100)};background:var(--gordura)"></i><i style="flex:${100 - Math.round(cp.gordura * 100)};background:var(--musculo)"></i></div>
    <div class="legenda small muted" style="margin-top:0"><span><i style="background:var(--gordura)"></i>Gordura ~${Math.round(cp.gordura * 100)}%</span><span><i style="background:var(--musculo)"></i>Massa magra ~${100 - Math.round(cp.gordura * 100)}%</span></div>
    <p class="small" style="margin:8px 0 0">Faixa provável de gordura: ${Math.round(cp.faixa[0] * 100)}% a ${Math.round(cp.faixa[1] * 100)}%. No estudo (DEXA), cerca de 74% foi gordura e 26% massa magra.</p>
    <p class="small muted" style="margin:6px 0 0">Estimativa do relógio — use como tendência. Recalculada a cada 4 semanas (próxima: ${ddmm(cp.proximo)}).</p></div>`;

  const ff = ffmiMensal();
  if (ff.length) h += `<h2>Índice de massa magra (FFMI)</h2><div class="panel"><div class="stats" style="margin-top:0;grid-template-columns:repeat(${Math.min(4, ff.length)},1fr)">${ff.slice(-4).map(x => `<div class="stat"><div class="v">${fmtNum(x.v)}</div><div class="l">${mesNome(x.mes)}</div></div>`).join("")}</div>
    <p class="small muted" style="margin:8px 0 0">(peso − massa gorda) ÷ altura². Mantê-lo estável enquanto o peso cai indica que o músculo está sendo preservado. Média dos homens: 18 a 20.</p></div>`;

  if (S.saude.inicioTratamento) h += `<h2>Você vs. estudo SURMOUNT-1</h2><div class="panel"><div class="chartbox" style="height:220px"><canvas id="chEstudo"></canvas></div>
    <p class="small muted" style="margin:8px 0 0">% de perda por semana de tratamento. Curvas médias do estudo, aproximadas a partir do gráfico publicado; cada pessoa tem sua trajetória.</p></div>`;
  return h;
}
actions.pesoFaixa = el => { ui.pesoFaixa = el.dataset.v; render(); };

// Faixas de dose e eventos desenhados atrás das linhas
const fundoPlugin = {
  id: "fundoSaude",
  beforeDatasetsDraw(c, _a, o){
    const { ctx, chartArea: a, scales: { x } } = c; if (!a) return;
    ctx.save();
    const maxMg = Math.max(...o.faixas.map(f => f.mg), 1);
    o.faixas.forEach(f => {
      const x1 = Math.max(a.left, x.getPixelForValue(t12(f.de))), x2 = Math.min(a.right, x.getPixelForValue(t12(f.ate)));
      if (x2 <= x1) return;
      ctx.globalAlpha = 0.06 + 0.22 * f.mg / maxMg; ctx.fillStyle = o.cor; ctx.fillRect(x1, a.top, x2 - x1, a.bottom - a.top);
    });
    ctx.globalAlpha = 1; ctx.strokeStyle = o.corEvento; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    o.eventos.forEach(e => { const px = x.getPixelForValue(t12(e.date)); if (px < a.left || px > a.right) return; ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke(); });
    ctx.restore();
  }
};
export function drawPeso(){
  charts.forEach(c => { try{ c.destroy(); }catch(e){} }); charts = [];
  const el = $("#chPeso"); if (!el) return;
  const st = cssVar("--strength"), ink2 = cssVar("--ink-2"), line = cssVar("--line"), dose = cssVar("--dose"), wk = cssVar("--walk"), gord = cssVar("--gordura");
  const u = ultimaPesagem(), fim = t12(addDias(ymd(new Date()), 1));
  const ini = ui.pesoFaixa === "4s" ? fim - 29 * 864e5 : ui.pesoFaixa === "3m" ? fim - 92 * 864e5 : t12(pesagens()[0].date) - 864e5;
  const pts = pesagens().map(m => ({ x: t12(m.date), y: num(m.peso) })).filter(p => p.x >= ini);
  const med = serieMedia().map(p => ({ x: t12(p.date), y: p.v })).filter(p => p.x >= ini);
  const ds = [
    { label: "Pesagem", data: pts, showLine: false, pointRadius: 3, borderColor: st + "55", backgroundColor: st + "55" },
    { label: "Média 7 dias", data: med, borderColor: st, backgroundColor: st, pointRadius: 0, borderWidth: 2.8, tension: .25 }
  ];
  // parou de fumar: ganho médio esperado a partir do peso daquele dia
  eventosList().filter(e => e.tipo === "parou_de_fumar").forEach(e => {
    const base = media7(e.date) || (u && num(u.peso)); if (!base) return;
    const linha = []; for (let d = 0; d <= Math.min(365, diasAte(e.date, ymd(new Date())) + 7); d += 7) linha.push({ x: t12(addDias(e.date, d)), y: base + ganhoFumo(d) });
    ds.push({ label: "Ganho esperado ao parar de fumar", data: linha.filter(p => p.x >= ini), borderColor: gord, borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5 });
  });
  charts.push(new Chart(el, { type: "line", data: { datasets: ds }, plugins: [fundoPlugin], options: {
    responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
    plugins: { legend: { display: false }, fundoSaude: { faixas: faixasDose(), eventos: eventosList(), cor: dose, corEvento: wk },
      tooltip: { callbacks: { title: it => fmtD(it[0].parsed.x), label: it => it.dataset.label + ": " + fmtNum(it.parsed.y) + " kg" } } },
    scales: { x: { type: "linear", min: ini, max: fim, ticks: { color: ink2, maxTicksLimit: 6, callback: fmtD }, grid: { display: false } },
      y: { ticks: { color: ink2, callback: v => fmtNum(v, 0) }, grid: { color: line } } } } }));

  const el2 = $("#chEstudo"); if (!el2) return;
  const sua = suaCurva(), sem = Math.max(24, Math.ceil((sua.length ? sua[sua.length - 1].x : 0) + 6));
  const ds2 = Object.entries(SURMOUNT).map(([k, arr]) => ({ label: "Estudo " + k, data: arr.filter(p => p[0] <= Math.max(sem, 24) + 12).map(([x, y]) => ({ x, y })), borderColor: k === "5 mg" ? ink2 : ink2 + "88", borderDash: k === "5 mg" ? [] : [4, 4], pointRadius: 0, borderWidth: 1.5, tension: .3 }));
  ds2.push({ label: "Você", data: sua, borderColor: st, backgroundColor: st, pointRadius: 2, borderWidth: 2.8, tension: .2 });
  charts.push(new Chart(el2, { type: "line", data: { datasets: ds2 }, options: {
    responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
    plugins: { legend: { display: true, labels: { color: ink2, boxWidth: 10 } }, tooltip: { callbacks: { title: it => "Semana " + fmtNum(it[0].parsed.x, 0), label: it => it.dataset.label + ": " + fmtNum(it.parsed.y) + "%" } } },
    scales: { x: { type: "linear", min: 0, max: sem, ticks: { color: ink2, callback: v => "sem " + v }, grid: { display: false } },
      y: { max: 0, ticks: { color: ink2, callback: v => v + "%" }, grid: { color: line } } } } }));
}

/* ---------- eventos ---------- */
function modalEvento(id){
  const e = id ? S.eventos[id] : { date: ymd(new Date()), tipo: null, descricao: "" };
  openModal(`<h3>${id ? "Editar evento" : "Adicionar evento"}</h3>
    <p class="small muted" style="margin-top:6px">Eventos aparecem como linhas nos gráficos e ajudam a entender mudanças no peso.</p>
    <div class="field"><span class="lab">Tipo</span><div class="chips">${TIPOS_EVENTO.map(([k, l]) => `<button type="button" class="chip" data-act="evTipo" data-v="${k}" aria-pressed="${e.tipo === k}">${l}</button>`).join("")}</div></div>
    <div class="field"><label class="lab" for="ev-date">Data</label><input id="ev-date" class="txt" type="date" value="${esc(e.date)}"></div>
    <div class="field"><label class="lab" for="ev-desc">Descrição</label><input id="ev-desc" class="txt" type="text" value="${esc(e.descricao || "")}" placeholder="Ex.: creatina 5 g/dia"></div>
    <div class="err" id="ev-err"></div>
    <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn strength" data-act="eventoSalvar" data-id="${esc(id || "")}">Salvar</button></div>
    ${id ? `<div class="row" style="margin-top:10px"><button class="btn danger" data-act="eventoApagar" data-id="${esc(id)}">Apagar este evento</button></div>` : ""}`, { tipo: e.tipo });
}
actions.eventoNovo = () => modalEvento(null);
actions.eventoEditar = el => modalEvento(el.dataset.id);
actions.evTipo = el => { modalState.tipo = el.dataset.v; el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false")); };
actions.eventoSalvar = el => {
  const date = $("#ev-date").value;
  if (!modalState.tipo){ $("#ev-err").textContent = "Escolha o tipo."; return; }
  if (!date){ $("#ev-err").textContent = "Informe a data."; return; }
  const id = el.dataset.id || newId("e");
  S.eventos[id] = Object.assign({}, S.eventos[id] || {}, { id, date, tipo: modalState.tipo, descricao: $("#ev-desc").value.trim() || null });
  flush("eventos", id); closeModal(); setStatus("Evento salvo"); render();
};
actions.eventoApagar = el => {
  if (!confirm("Apagar este evento?")) return;
  delete S.eventos[el.dataset.id]; flush("eventos", el.dataset.id); closeModal(); render();
};
