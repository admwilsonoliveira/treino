// Saúde → Comparar métodos: % de gordura e massa magra ao longo do tempo por relógio (bioimpedância),
// fita (fórmula da Marinha) e dobras (Jackson & Pollock 7 e 3, Petroski). Cada método tem erro próprio.
import { Chart, LineController, LineElement, PointElement, LinearScale, Tooltip, Legend } from "chart.js";
import { measurementsList } from "../store.js";
import { ui, actions, render } from "../ui.js";
import { esc, num, fmtNum, ddmm, $ } from "../util.js";
import { fitaOficial, indices } from "../fita.js";
import { dobrasList, percentuais, pesagemPerto } from "../dobras.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Legend);
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const t12 = s => new Date(s + "T12:00:00").getTime();
const fmtD = v => { const d = new Date(v); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"); };
const mgDe = m => num(m.massaGorda) != null ? num(m.massaGorda) : (num(m.gorduraPct) != null ? num(m.peso) * num(m.gorduraPct) / 100 : null);
// pesagem mais próxima (até 3 dias), para converter % em kg nas medidas de fita
function pesoPerto(date, dias){
  const ps = measurementsList().filter(m => num(m.peso) != null && Math.abs(t12(m.date) - t12(date)) <= dias * 864e5);
  return ps.sort((a, b) => Math.abs(t12(a.date) - t12(date)) - Math.abs(t12(b.date) - t12(date)))[0] || null;
}

// Uma série por método: [{ date, pct, magra }]
export function seriesMetodos(){
  const S = {};
  const add = (k, date, pct, peso) => { (S[k] = S[k] || []).push({ date, pct, magra: pct != null && peso ? peso * (1 - pct / 100) : null }); };
  measurementsList().filter(m => num(m.peso) != null && mgDe(m) != null).forEach(m => {
    (S.relogio = S.relogio || []).push({ date: m.date, pct: num(m.gorduraPct) != null ? num(m.gorduraPct) : mgDe(m) / num(m.peso) * 100, magra: num(m.peso) - mgDe(m), musculo: (m.duvidoso || []).includes("musculo") ? null : num(m.musculo) });
  });
  fitaOficial().forEach(f => { const pc = indices(f).gorduraMarinha; if (pc != null){ const p = pesoPerto(f.date, 3); add("marinha", f.date, pc, p && num(p.peso)); } });
  dobrasList().forEach(r => { const p = pesagemPerto(r.date); percentuais(r).forEach(x => { if (x.pct != null) add(x.k, r.date, x.pct, p && num(p.peso)); }); });
  return S;
}
const METODOS = [["relogio", "Relógio (bioimpedância)", "--gordura"], ["marinha", "Fita (Marinha)", "--strength"], ["JP7", "Dobras: 7 (J&P)", "--dose"], ["JP3", "Dobras: 3 (J&P)", "--walk"], ["PETROSKI4", "Dobras: Petroski", "--musculo"]];

export function metodosHtml(){
  const se = seriesMetodos(), tem = METODOS.filter(([k]) => se[k] && se[k].length);
  let h = `<div class="between"><h2 style="margin-top:0">Comparar métodos</h2><button class="linkbtn" data-act="goSaude">‹ Saúde</button></div>`;
  if (!tem.length) return h + `<p class="empty">Registre pesagens com bioimpedância, medidas com fita (cintura e pescoço, em jejum) ou dobras para comparar os métodos.</p>`;
  h += `<div class="panel"><div class="scroll-x"><table><thead><tr><th>Método</th><th>Última</th><th>Gordura</th><th>Massa magra</th></tr></thead><tbody>
    ${tem.map(([k, n, c]) => { const u = se[k][se[k].length - 1]; return `<tr><td style="white-space:normal"><i class="bolinha" style="background:var(${c})"></i>${esc(n)}</td><td>${ddmm(u.date)}</td><td><strong>${fmtNum(u.pct)}%</strong></td><td>${u.magra != null ? fmtNum(u.magra) + " kg" : "–"}</td></tr>`; }).join("")}</tbody></table></div>
    <p class="small muted" style="margin:8px 0 0">Cada método tem erro próprio (o relógio, ±2–3 pontos de % de gordura). O valor real provavelmente fica entre eles. Compare cada método com ele mesmo ao longo do tempo.</p></div>
    <h2>% de gordura</h2><div class="panel"><div class="chartbox" style="height:240px"><canvas id="chMetPct"></canvas></div></div>
    <h2>Massa magra e músculo</h2><div class="panel"><div class="chartbox" style="height:240px"><canvas id="chMetMagra"></canvas></div>
    <p class="small muted" style="margin:8px 0 0">Massa magra = peso − massa gorda (inclui músculo, ossos, órgãos e água). A linha tracejada é o músculo esquelético do relógio. Manter a massa magra enquanto o peso cai é o objetivo.</p></div>`;
  return h;
}
actions.goMetodos = () => { ui.tab = "saude"; ui.sub = "metodos"; render(); window.scrollTo(0, 0); };

let charts = [];
export function drawMetodos(){
  charts.forEach(c => { try{ c.destroy(); }catch(e){} }); charts = [];
  const se = seriesMetodos(), ink2 = cssVar("--ink-2"), line = cssVar("--line");
  const tudo = Object.values(se).flat(); if (!tudo.length) return;
  const min = Math.min(...tudo.map(p => t12(p.date))) - 3 * 864e5, max = Math.max(...tudo.map(p => t12(p.date))) + 3 * 864e5;
  const op = un => ({ responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
    plugins: { legend: { display: true, labels: { color: ink2, boxWidth: 10 } }, tooltip: { callbacks: { title: it => fmtD(it[0].parsed.x), label: it => it.dataset.label + ": " + fmtNum(it.parsed.y) + un } } },
    scales: { x: { type: "linear", min, max, ticks: { color: ink2, maxTicksLimit: 5, callback: fmtD }, grid: { display: false } }, y: { ticks: { color: ink2 }, grid: { color: line } } } });
  const ds = campo => METODOS.filter(([k]) => se[k] && se[k].some(p => p[campo] != null)).map(([k, n, c]) => {
    const cor = cssVar(c), pts = se[k].filter(p => p[campo] != null).map(p => ({ x: t12(p.date), y: p[campo] }));
    return { label: n, data: pts, borderColor: cor, backgroundColor: cor, pointRadius: pts.length > 20 ? 2 : 4, borderWidth: 2.2, tension: .2 };
  });
  const a = $("#chMetPct"); if (a) charts.push(new Chart(a, { type: "line", data: { datasets: ds("pct") }, options: op("%") }));
  const b = $("#chMetMagra"); if (!b) return;
  const d2 = ds("magra");
  if (se.relogio && se.relogio.some(p => p.musculo != null)){ const cor = cssVar("--gordura"); d2.push({ label: "Músculo esquelético (relógio)", data: se.relogio.filter(p => p.musculo != null).map(p => ({ x: t12(p.date), y: p.musculo })), borderColor: cor, borderDash: [5, 4], pointRadius: 2, borderWidth: 1.6, tension: .2 }); }
  charts.push(new Chart(b, { type: "line", data: { datasets: d2 }, options: op(" kg") }));
}
