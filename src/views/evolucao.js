// Aba Evolução: cargas por exercício, corpo (peso e bioimpedância), dor lombar e lista de registros.
import { Chart, LineController, LineElement, PointElement, BarController, BarElement, LinearScale, CategoryScale, Tooltip, Legend } from "chart.js";
import { S, done, list, metricsFor, exercisesWithHistory, activePlan, planLetters, getEx, measurementsList, setStatus, kcalFor, imc, imcClasse, hasRestr, dorLabel } from "../store.js";
import { ui, views, actions, changes, render } from "../ui.js";
import { esc, num, fmtNum, ddmm, ddmmyyyy, durMin, timeOf, ymd, pad, mondayOf, downloadBlob } from "../util.js";
import { setsSummary } from "./treinos.js";
import { relatorioHtml } from "./relatorio.js";
import { editarHtml, abrirEdicao } from "./editar.js";

Chart.register(LineController, LineElement, PointElement, BarController, BarElement, LinearScale, CategoryScale, Tooltip, Legend);

let charts = [];
const fmtDur = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? Math.floor(m / 60) + " h " + pad(m % 60) + " min" : m + " min"; };
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function exOptions(){
  // exercícios do plano ativo + os que já têm registro
  const ids = [], p = activePlan();
  if (p) planLetters(p).forEach(L => p.treinos[L].ex.forEach(it => { if (!ids.includes(it.exId)) ids.push(it.exId); }));
  exercisesWithHistory().forEach(id => { if (!ids.includes(id)) ids.push(id); });
  return ids;
}

views.evolucao = {
  html(){
    if (ui.sub === "editar") return editarHtml();
    const v = ui.evoView;
    let h = `<div class="toggle" role="group" aria-label="Visão" style="margin-top:0">${[["cargas", "Cargas"], ["corpo", "Corpo"], ["calorias", "Calorias"], ["dor", "Dor"], ["registros", "Registros"], ["relatorio", "Relatório"]].map(([k, t]) => `<button type="button" data-act="evoView" data-v="${k}" aria-pressed="${v === k}">${t}</button>`).join("")}</div>`;
    if (v === "cargas") h += cargasHtml();
    else if (v === "corpo") h += corpoHtml();
    else if (v === "calorias") h += caloriasHtml();
    else if (v === "dor") h += dorHtml();
    else if (v === "relatorio") h += relatorioHtml();
    else h += registrosHtml();
    return h;
  },
  after(){ if (!ui.sub) drawCharts(); }
};
actions.evoView = el => { ui.evoView = el.dataset.v; render(); };
actions.edOpen = el => abrirEdicao(el.dataset.id);

function cargasHtml(){
  const ids = exOptions();
  if (!ids.length) return `<div class="panel"><div class="empty">Monte um plano e registre seus treinos para ver a evolução das cargas.</div></div>`;
  if (!ui.exSel || !ids.includes(ui.exSel)) ui.exSel = exercisesWithHistory()[0] || ids[0];
  let h = `<div class="panel"><label class="lab" for="exSel" style="font-weight:600">Exercício</label><select id="exSel" class="txt" data-act="exSel" style="margin-top:6px">`;
  ids.map(id => getEx(id)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).forEach(e => { h += `<option value="${esc(e.id)}" ${ui.exSel === e.id ? "selected" : ""}>${esc(e.nome)}</option>`; });
  h += `</select>`;
  const e = getEx(ui.exSel), m = metricsFor(ui.exSel), unit = e.unit || "kg";
  if (e.load !== false) h += `<div class="toggle" role="group" aria-label="Métrica"><button type="button" data-act="metric" data-m="max" aria-pressed="${ui.metric === "max"}">Maior carga</button><button type="button" data-act="metric" data-m="vol" aria-pressed="${ui.metric === "vol"}">Volume total</button></div>`;
  if (!m.length) h += `<div class="empty">Registre ${e.load === false ? "repetições" : "cargas"} deste exercício em um treino concluído para ver a evolução aqui.</div>`;
  else {
    if (e.load !== false && m.length > 1){
      const first = m.find(x => x.max > 0), lastm = m[m.length - 1];
      if (first && lastm.max > 0){
        const diff = lastm.max - first.max;
        h += `<p style="margin:4px 0 10px">${diff > 0 ? `Sua maior carga subiu <strong>${fmtNum(diff)} ${esc(unit)}</strong> desde ${ddmm(first.date)}.` : diff < 0 ? `Sua maior carga está ${fmtNum(-diff)} ${esc(unit)} abaixo de ${ddmm(first.date)}. Em déficit calórico, manter já é uma vitória; observe sono e proteína.` : `Carga mantida desde ${ddmm(first.date)}. Em déficit calórico, isso já protege o músculo.`}</p>`;
      }
    }
    h += `<div class="chartbox"><canvas id="chEx" role="img" aria-label="Evolução de ${esc(e.nome)}"></canvas></div>`;
    h += `<div class="scroll-x" style="margin-top:12px"><table><thead><tr><th>Data</th>${e.load === false ? "" : "<th>Maior carga</th><th>Volume</th>"}<th>Séries</th></tr></thead><tbody>`;
    m.slice().reverse().forEach(x => { h += `<tr><td>${ddmm(x.date)}</td>${e.load === false ? "" : `<td>${x.max ? fmtNum(x.max) : "–"}</td><td>${x.vol ? fmtNum(x.vol) : "–"}</td>`}<td>${setsSummary(x.sets, e)}</td></tr>`; });
    h += `</tbody></table></div>`;
  }
  return h + `</div>`;
}
changes.exSel = el => { ui.exSel = el.value; render(); };
actions.metric = el => { ui.metric = el.dataset.m; render(); };

function corpoHtml(){
  const ms = measurementsList();
  let h = `<div class="panel"><div class="between"><h3>Peso</h3><button class="linkbtn" data-act="addMedida">Registrar medida</button></div>`;
  if (!ms.length) return h + `<div class="empty">Registre seu peso na aba Perfil ou pelo botão acima.</div></div>`;
  const first = ms[0], last = ms[ms.length - 1], diff = last.peso - first.peso, meta = S.profile.metaPeso;
  const im = imc(last.peso, S.profile.altura), im0 = imc(first.peso, S.profile.altura);
  h += `<div class="stats two"><div class="stat"><div class="v">${fmtNum(last.peso)}</div><div class="l">kg atual</div></div><div class="stat"><div class="v">${diff > 0 ? "+" : ""}${fmtNum(diff)}</div><div class="l">kg desde ${ddmm(first.date)}</div></div>
    <div class="stat"><div class="v">${im ? fmtNum(im) : "–"}</div><div class="l">IMC${im ? ": " + imcClasse(im) : ""}${im && ms.length > 1 ? ` (era ${fmtNum(im0)})` : ""}</div></div><div class="stat"><div class="v">${meta ? fmtNum(Math.max(0, last.peso - meta)) : "–"}</div><div class="l">kg até a meta${meta ? ` (IMC ${fmtNum(imc(meta, S.profile.altura))})` : ""}</div></div></div>
    <p class="small muted" style="margin:8px 0 0">O IMC não diferencia músculo de gordura. Para quem treina, o % de gordura da bioimpedância e a cintura dizem mais.</p>`;
  h += `<div class="chartbox" style="margin-top:12px"><canvas id="chPeso" role="img" aria-label="Evolução do peso"></canvas></div></div>`;
  const bio = ms.filter(m => m.gorduraPct != null || m.musculo != null || m.massaGorda != null);
  h += `<h2>Bioimpedância</h2><div class="panel">`;
  if (!bio.length) h += `<div class="empty">Quando você registrar % de gordura, massa gorda ou músculo esquelético, a evolução aparece aqui.</div>`;
  else {
    h += `<div class="chartbox"><canvas id="chBio" role="img" aria-label="Evolução da bioimpedância"></canvas></div>`;
    h += `<div class="scroll-x" style="margin-top:12px"><table><thead><tr><th>Data</th><th>Peso</th><th>Gord. %</th><th>M. gorda</th><th>Músculo</th></tr></thead><tbody>`;
    bio.slice().reverse().forEach(m => { h += `<tr><td>${ddmm(m.date)}</td><td>${fmtNum(m.peso)}</td><td>${m.gorduraPct != null ? fmtNum(m.gorduraPct) : "–"}</td><td>${m.massaGorda != null ? fmtNum(m.massaGorda) : "–"}</td><td>${m.musculo != null ? fmtNum(m.musculo) : "–"}</td></tr>`; });
    h += `</tbody></table></div>`;
  }
  return h + `</div>`;
}

/* ---------- calorias ---------- */
function weeklyKcal(type){
  const by = {};
  done().filter(s => s.type === type).forEach(s => { const k = kcalFor(s); if (k == null) return; const w = ymd(mondayOf(new Date(s.date + "T12:00:00"))); by[w] = (by[w] || 0) + k; });
  // últimas 12 semanas, incluindo semanas sem registro
  const out = [], mon = mondayOf(new Date());
  for (let i = 11; i >= 0; i--){ const d = new Date(mon); d.setDate(mon.getDate() - 7 * i); const k = ymd(d); out.push({ week: k, kcal: by[k] || 0 }); }
  return out;
}
function caloriasHtml(){
  const sum = (type, from) => done().filter(s => s.type === type && s.date >= from).reduce((a, s) => a + (kcalFor(s) || 0), 0);
  const wk = ymd(mondayOf(new Date())), mo = ymd(new Date()).slice(0, 7) + "-01";
  let h = `<div class="stats two"><div class="stat"><div class="v">${sum("treino", wk) + sum("caminhada", wk)}</div><div class="l">kcal nesta semana</div></div><div class="stat"><div class="v">${sum("treino", mo) + sum("caminhada", mo)}</div><div class="l">kcal neste mês</div></div></div>`;
  [["treino", "Musculação", "chKcalT"], ["caminhada", "Caminhada", "chKcalW"]].forEach(([type, title, id]) => {
    const n = done().filter(s => s.type === type).length;
    h += `<h2>${title}</h2><div class="panel">`;
    if (!n) h += `<div class="empty">Conclua ${type === "treino" ? "um treino" : "uma caminhada"} para ver as calorias aqui.</div>`;
    else h += `<div class="small muted" style="margin-bottom:6px">Total por semana (últimas 12 semanas). Semana: ${sum(type, wk)} kcal · Mês: ${sum(type, mo)} kcal.</div><div class="chartbox" style="height:220px"><canvas id="${id}" role="img" aria-label="Calorias de ${title.toLowerCase()} por semana"></canvas></div>`;
    h += `</div>`;
  });
  h += `<p class="small muted" style="margin-top:14px">Valores estimados pelo tempo de atividade e pelo seu peso. Na musculação, consideramos intensidade moderada; na caminhada, a velocidade média. O gasto real pode variar.</p>`;
  return h;
}

function dorHtml(){
  const tr = done().filter(s => s.type === "treino" && s.pre && s.post);
  let h = `<div class="panel"><h3>${dorLabel()} nos treinos</h3>`;
  if (!tr.length) return h + `<div class="empty">Cada check-in e check-out registra sua dor de 0 a 10. Depois do primeiro treino concluído, a tendência aparece aqui.</div></div>`;
  return h + `<p class="small muted" style="margin:6px 0 8px">${hasRestr("lombar") ? "Aceitável: até 3/10 e voltando ao normal em 24 h. Dor que desce para a perna é sinal para parar e procurar avaliação." : "Desconforto leve que passa em até 24 h é comum. Dor forte, pontada ou que piora a cada treino é sinal para ajustar o exercício e procurar avaliação."}</p><div class="chartbox" style="height:220px"><canvas id="chDor" role="img" aria-label="${dorLabel()} antes e depois dos treinos"></canvas></div></div>`;
}

function registrosHtml(){
  const all = done().slice().reverse();
  let h = `<div class="panel">`;
  if (!all.length) h += `<div class="empty">Nenhum treino ou caminhada concluídos ainda. Comece pela aba Hoje.</div>`;
  else {
    h += `<ul class="hist">`;
    all.slice(0, 60).forEach(s => {
      const ms = new Date(s.end) - new Date(s.start), kc = kcalFor(s);
      const alert = s.post && s.post.irradiada ? ' <span class="tag alert">dor na perna</span>' : s.post && s.post.dorAguda ? ' <span class="tag alert">dor forte</span>' : "";
      const inc = s.status === "incompleto" ? ' <span class="tag gray">incompleto</span>' : "";
      h += `<li><div><strong>${ddmm(s.date)}</strong> ${s.type === "treino" ? `<span class="tag">Treino ${esc(s.treino)}</span>` : `<span class="tag walk">Caminhada${num(s.km) ? " " + fmtNum(num(s.km)) + " km" : ""}</span>`}${inc}${alert}
        <div class="small">${timeOf(s.start)} às ${timeOf(s.end)} · ${fmtDur(ms)}${kc != null ? ` · ~${kc} kcal` : ""}</div>${s.post && s.post.obs ? `<div class="small muted">${esc(s.post.obs)}</div>` : ""}</div><div style="display:flex;flex-direction:column;align-items:flex-end"><button class="del" data-act="edOpen" data-id="${esc(s.id)}">Editar</button><button class="del" data-act="del" data-id="${esc(s.id)}">Apagar</button></div></li>`;
    });
    h += `</ul>`;
  }
  h += `</div><h2>Planilha</h2><div class="panel"><p class="small">Baixe todas as séries e caminhadas numa planilha que abre no Excel e no Google Planilhas.</p><button class="btn strength block" data-act="exportCsv">Exportar registros (CSV)</button></div>`;
  return h;
}

/* ---------- gráficos ---------- */
function drawCharts(){
  charts.forEach(c => { try{ c.destroy(); }catch(e){} }); charts = [];
  const ink2 = cssVar("--ink-2"), line = cssVar("--line"), st = cssVar("--strength"), wk = cssVar("--walk"), dg = cssVar("--danger");
  const base = { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: ink2 }, grid: { display: false } }, y: { ticks: { color: ink2 }, grid: { color: line }, beginAtZero: false } } };
  const ds = (label, data, color, extra = {}) => Object.assign({ label, data, borderColor: color, backgroundColor: color, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5, tension: .2, spanGaps: true }, extra);
  const legend = { legend: { display: true, labels: { color: ink2, boxWidth: 12 } } };

  const c1 = document.getElementById("chEx");
  if (c1){
    const e = getEx(ui.exSel), m = metricsFor(ui.exSel);
    const key = e.load === false ? "reps" : ui.metric;
    const unit = e.load === false ? "reps" : (key === "max" ? (e.unit || "kg") : "kg × reps");
    charts.push(new Chart(c1, { type: "line", data: { labels: m.map(x => ddmm(x.date)), datasets: [ds("", m.map(x => x[key] || null), st, { pointRadius: 5, borderWidth: 3 })] },
      options: Object.assign({}, base, { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtNum(c.parsed.y) + " " + unit } } } }) }));
  }
  const c2 = document.getElementById("chDor");
  if (c2){
    const tr = done().filter(s => s.type === "treino" && s.pre && s.post);
    charts.push(new Chart(c2, { type: "line", data: { labels: tr.map(s => ddmm(s.date) + " " + s.treino), datasets: [ds("Antes", tr.map(s => s.pre.dor), wk), ds("Depois", tr.map(s => s.post.dor), dg)] },
      options: Object.assign({}, base, { plugins: legend, scales: { x: base.scales.x, y: { min: 0, max: 10, ticks: { color: ink2, stepSize: 2 }, grid: { color: line } } } }) }));
  }
  [["chKcalT", "treino", st], ["chKcalW", "caminhada", wk]].forEach(([id, type, color]) => {
    const el = document.getElementById(id); if (!el) return;
    const data = weeklyKcal(type);
    charts.push(new Chart(el, { type: "bar", data: { labels: data.map(x => ddmm(x.week)), datasets: [{ data: data.map(x => x.kcal), backgroundColor: color, borderRadius: 4 }] },
      options: Object.assign({}, base, { plugins: { legend: { display: false }, tooltip: { callbacks: { title: c => "Semana de " + c[0].label, label: c => "~" + c.parsed.y + " kcal" } } }, scales: { x: base.scales.x, y: { beginAtZero: true, ticks: { color: ink2 }, grid: { color: line } } } }) }));
  });
  const c3 = document.getElementById("chPeso");
  if (c3){
    const ms = measurementsList(), meta = S.profile.metaPeso;
    const sets = [ds("Peso", ms.map(m => m.peso), st)];
    if (meta) sets.push(ds("Meta", ms.map(() => meta), ink2, { borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5 }));
    charts.push(new Chart(c3, { type: "line", data: { labels: ms.map(m => ddmm(m.date)), datasets: sets },
      options: Object.assign({}, base, { plugins: Object.assign({}, meta ? legend : { legend: { display: false } }, { tooltip: { callbacks: { label: c => c.dataset.label + ": " + fmtNum(c.parsed.y) + " kg" } } }) }) }));
  }
  const c4 = document.getElementById("chBio");
  if (c4){
    const bio = measurementsList().filter(m => m.gorduraPct != null || m.musculo != null || m.massaGorda != null);
    charts.push(new Chart(c4, { type: "line", data: { labels: bio.map(m => ddmm(m.date)), datasets: [
      ds("Gordura (%)", bio.map(m => m.gorduraPct ?? null), dg),
      ds("Massa gorda (kg)", bio.map(m => m.massaGorda ?? null), wk),
      ds("Músculo (kg)", bio.map(m => m.musculo ?? null), st)
    ] }, options: Object.assign({}, base, { plugins: legend }) }));
  }
}

/* ---------- CSV ---------- */
function csvCell(v){ if (v == null) return ""; let s = typeof v === "number" ? String(Math.round(v * 100) / 100).replace(".", ",") : String(v); if (/[";\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'; return s; }
function buildCsv(){
  const head = ["Data", "Tipo", "Treino", "Exercício", "Série", "Carga (kg)", "Repetições", "Série concluída", "Início", "Fim", "Duração (min)", "Km", dorLabel() + " antes", dorLabel() + " depois", hasRestr("lombar") ? "Dor na perna" : "Dor forte", "Energia", "Sono (h)", "Avaliação do treino", "Observação", "Status", "kcal (estimativa)"];
  const rows = [head];
  list().forEach(s => {
    const ms = s.end ? new Date(s.end) - new Date(s.start) : null;
    const c = { ini: timeOf(s.start), fim: timeOf(s.end), dur: ms != null ? durMin(ms) : null,
      da: s.pre ? s.pre.dor : null, dd: s.post ? s.post.dor : null, perna: s.post && (s.post.irradiada != null || s.post.dorAguda != null) ? (s.post.irradiada || s.post.dorAguda ? "Sim" : "Não") : "",
      en: s.pre ? s.pre.energia : null, sono: s.pre ? s.pre.sono : null, av: s.post ? s.post.sens : null, obs: s.post ? s.post.obs : "", st: s.status === "concluido" ? "Concluído" : s.status === "incompleto" ? "Incompleto" : "Em andamento", kc: s.end ? kcalFor(s) : null };
    // kcal só na primeira linha do treino, para a soma no Excel não repetir o valor a cada série
    let first = true;
    const tail = () => { const r = [c.ini, c.fim, c.dur, "", c.da, c.dd, c.perna, c.en, c.sono, c.av, c.obs, c.st, first ? c.kc : null]; first = false; return r; };
    if (s.type === "caminhada"){ rows.push([ddmmyyyy(s.date), "Caminhada", "", "", "", "", "", "", c.ini, c.fim, c.dur, num(s.km), c.da, c.dd, "", c.en, "", "", c.obs, c.st, c.kc]); return; }
    let any = false;
    Object.keys(s.sets || {}).forEach(exId => {
      const e = getEx(exId);
      s.sets[exId].forEach((x, i) => {
        if (num(x.kg) == null && num(x.reps) == null && !x.ok) return;
        any = true;
        rows.push([ddmmyyyy(s.date), "Musculação", s.treino, e.nome, i + 1, e.load === false ? null : num(x.kg), num(x.reps), x.ok ? "Sim" : "Não"].concat(tail()));
      });
    });
    if (!any) rows.push([ddmmyyyy(s.date), "Musculação", s.treino, "", "", "", "", ""].concat(tail()));
  });
  return "﻿" + rows.map(r => r.map(csvCell).join(";")).join("\r\n");
}
actions.exportCsv = () => {
  if (!list().length){ setStatus("Ainda não há registros para exportar"); return; }
  downloadBlob("treino-registros-" + ymd(new Date()) + ".csv", buildCsv(), "text/csv;charset=utf-8");
  setStatus("Planilha salva em Downloads");
};
