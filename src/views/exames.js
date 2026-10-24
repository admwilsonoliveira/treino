// Saúde → Exames: grupos com sinal de cor, cálculos (não-HDL, TG/HDL, testosterona livre, FLI, TyG, FIB-4),
// pendências, próxima coleta, gráfico de evolução e lançamento manual ou por arquivo preparado.
import { Chart, LineController, LineElement, PointElement, LinearScale, Tooltip } from "chart.js";
import { S, flush, setStatus } from "../store.js";
import { ui, actions, inputs, render, openModal, updateModal, closeModal, modalState } from "../ui.js";
import { esc, num, fmtNum, ymd, ddmm, ddmmyyyy, newId, dataCampoHtml, lerData, $ } from "../util.js";
import { CATALOGO, GRUPOS_EXAME, padrao, examesList, serie, sinal, lipidios, testosterona, fli, fliMensal, tyg, fib4, hdlCaindo, pendentes, PROXIMA_COLETA } from "../exames.js";
import { onHistoricoFile } from "./saude.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip);
const COR = { ok: "var(--sucesso)", amarelo: "var(--walk)", vermelho: "var(--danger)", pendente: "var(--ink-2)" };
const fv = v => v == null ? "–" : fmtNum(v, Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2);
const ref = x => x.refMin != null && x.refMax != null ? `${fv(x.refMin)}–${fv(x.refMax)}` : x.refMin != null ? `> ${fv(x.refMin)}` : x.refMax != null ? `< ${fv(x.refMax)}` : "";
actions.goExames = () => { ui.tab = "saude"; ui.sub = "exames"; render(); window.scrollTo(0, 0); };

export function examesHtml(){
  const xs = examesList();
  let h = `<div class="between"><h2 style="margin-top:0">Exames</h2><button class="linkbtn" data-act="goSaude">‹ Saúde</button></div>
    <div class="panel"><div class="row"><button class="btn strength" data-act="exNovo">Lançar exame</button><button class="btn ghost" data-act="exImportar">Importar arquivo</button></div>
    <input type="file" id="exFile" accept="application/json,.json" hidden>
    <p class="small muted" style="margin:8px 0 0">Preencha à mão a partir do laudo, ou envie o laudo para o seu assistente preparar um arquivo para importar.</p></div>`;
  if (!xs.length) return h + `<p class="empty">Nenhum exame ainda. Os cálculos (FLI, TyG, testosterona livre...) aparecem quando houver os exames necessários.</p>`;

  // cálculos
  const calc = [], t = testosterona().pop(), f = fli(), ty = tyg(), fb = fib4(), lp = lipidios().pop();
  if (lp && lp.naoHdl != null) calc.push(["Não-HDL", `${fv(lp.naoHdl)} mg/dL`, "abaixo de 130", lp.naoHdl < 130 ? "ok" : "amarelo", ddmm(lp.date)]);
  if (lp && lp.tgHdl != null) calc.push(["Triglicérides/HDL", fmtNum(lp.tgHdl, 1), "ideal < 2; > 3,5 sugere resistência à insulina", lp.tgHdl < 2 ? "ok" : lp.tgHdl <= 3.5 ? "amarelo" : "vermelho", ddmm(lp.date)]);
  if (t) calc.push(["Testosterona livre (Vermeulen)", `${fmtNum(t.livre, 1)} ng/dL · biodisponível ${fv(t.bio)}`, "3,4–24,6 ng/dL", t.livre >= 3.4 ? "ok" : "amarelo", ddmm(t.date) + (t.albPadrao ? " · albumina padrão 4,3" : "")]);
  if (f) calc.push(["FLI (gordura no fígado)", fmtNum(f.valor, 0), "< 30 descarta · 30–59 indeterminado · ≥ 60 sugere esteatose", f.valor < 30 ? "ok" : f.valor < 60 ? "amarelo" : "vermelho", f.ggtAntiga ? "GGT antiga: recalcular com exame novo" : "hoje"]);
  if (ty) calc.push(["TyG (resistência à insulina)", fmtNum(ty.valor, 2), "~8,5 associado a esteatose; > 8,8 sugere resistência", ty.valor <= 8.5 ? "ok" : ty.valor <= 8.8 ? "amarelo" : "vermelho", ty.datasDiferentes ? `TG de ${ddmm(ty.tgData)} e glicose de ${ddmm(ty.glData)}: recalcular com exames da mesma data` : ddmm(ty.tgData)]);
  if (fb) calc.push(["FIB-4 (fibrose no fígado)", fmtNum(fb.valor, 2), "abaixo de 1,3 = baixo risco", fb.valor < 1.3 ? "ok" : "amarelo", ddmm(fb.date)]);
  if (calc.length) h += `<h2>Calculados</h2><div class="panel"><ul class="hist">${calc.map(([n, v, r, s, d]) => `<li style="align-items:flex-start"><div><strong>${esc(n)}</strong><div class="small muted">${esc(r)}</div><div class="small muted">${esc(d)}</div></div><strong style="color:${COR[s]};text-align:right">${esc(v)}</strong></li>`).join("")}</ul>
    ${hdlCaindo() ? `<p class="small" style="margin:8px 0 0;color:var(--walk)">Seu HDL está indo na direção contrária à do estudo (no SURMOUNT-1 subiu em média ~8%); converse com o médico. Para metas de colesterol, priorize o não-HDL e, se o médico pedir, a ApoB.</p>` : ""}
    ${fliMensal().length >= 2 ? `<p class="small muted" style="margin:8px 0 0">FLI por mês: ${fliMensal().map(x => `${ddmm(x.date)} ${fmtNum(x.valor, 0)}`).join(" · ")}. Como a cintura entra na conta, cada centímetro a menos ajuda o fígado.</p>` : ""}</div>`;

  // pendências
  const pend = pendentes();
  if (pend.length) h += `<h2>Pendências</h2><div class="panel"><ul class="hist">${pend.map(x => `<li><span>${esc(padrao(x.nome).nome)} <span class="small muted">· ${ddmmyyyy(x.date)}</span></span><span class="small muted">${esc(x.obs || "sem resultado")}</span></li>`).join("")}</ul></div>`;

  // grupos
  GRUPOS_EXAME.forEach(g => {
    const nomes = [...new Set(xs.map(x => padrao(x.nome)).filter(p => p.grupo === g).map(p => p.nome))];
    if (!nomes.length) return;
    h += `<details class="panel grupo-exame" ${g === "Lipídios" || g === "Vitaminas e ferro" ? "open" : ""}><summary><strong>${esc(g)}</strong></summary><ul class="hist">${nomes.map(n => {
      const s = serie(n), u = s[s.length - 1], a = s[s.length - 2];
      if (!u) return "";
      const sg = sinal(u), d = a ? u.valor - a.valor : null;
      return `<li><button class="linkbtn al-item" data-act="exVer" data-v="${esc(n)}"><span>${esc(n)}</span><span class="small muted">${ddmmyyyy(u.date)}${ref(u) ? " · ref. " + esc(ref(u)) : ""}${d != null ? ` · antes ${fv(a.valor)}` : ""}</span></button>
        <strong style="color:${COR[sg]};white-space:nowrap">${fv(u.valor)} <span class="small muted">${esc(u.unidade || "")}</span></strong></li>`;
    }).join("")}</ul></details>`;
  });
  h += `<h2>Próxima coleta (sugestão)</h2><div class="panel"><ul class="checklist small">${PROXIMA_COLETA.map(x => `<li>${esc(x)}</li>`).join("")}</ul><p class="small muted" style="margin:6px 0 0">A critério do seu médico.</p></div>`;
  return h;
}
export function examesAfter(){
  const f = $("#exFile");
  if (f) f.addEventListener("change", () => { if (f.files[0]) onHistoricoFile(f.files[0]); f.value = ""; });
}
actions.exImportar = () => $("#exFile").click();

/* ---------- evolução de um exame ---------- */
let chart = null;
actions.exVer = el => {
  const n = el.dataset.v, s = examesList().filter(x => padrao(x.nome).nome === n);
  openModal(`<div class="between"><h3>${esc(n)}</h3><button class="linkbtn" data-act="closeModal">Fechar</button></div>
    ${s.filter(x => x.valor != null).length >= 2 ? `<div class="chartbox" style="height:200px;margin-top:8px"><canvas id="chExame"></canvas></div>` : ""}
    <ul class="hist">${s.slice().reverse().map(x => `<li><div><strong>${x.valor != null ? fv(x.valor) + " " + esc(x.unidade || "") : "pendente"}</strong><div class="small muted">${ddmmyyyy(x.date)}${x.laboratorio ? " · " + esc(x.laboratorio) : ""}${ref(x) ? " · ref. " + esc(ref(x)) : ""}</div></div><button class="del" data-act="exEditar" data-id="${esc(x.id)}">Editar</button></li>`).join("")}</ul>`);
  const c = $("#chExame"); if (!c) return;
  if (chart){ try{ chart.destroy(); }catch(e){} }
  const css = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim(), t12 = d => new Date(d + "T12:00:00").getTime();
  const pts = s.filter(x => x.valor != null).map(x => ({ x: t12(x.date), y: x.valor })), u = s.filter(x => x.valor != null).pop();
  const ini = S.saude && S.saude.inicioTratamento;
  const faixa = { id: "faixa", beforeDatasetsDraw(ch){ const { ctx, chartArea: a, scales: { x, y } } = ch; ctx.save();
    if (u.refMin != null || u.refMax != null){ const y1 = y.getPixelForValue(u.refMax != null ? u.refMax : y.max), y2 = y.getPixelForValue(u.refMin != null ? u.refMin : y.min); ctx.fillStyle = css("--sucesso"); ctx.globalAlpha = 0.12; ctx.fillRect(a.left, Math.max(a.top, y1), a.right - a.left, Math.min(a.bottom, y2) - Math.max(a.top, y1)); }
    if (ini){ const px = x.getPixelForValue(t12(ini)); if (px > a.left && px < a.right){ ctx.globalAlpha = 1; ctx.strokeStyle = css("--dose"); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke(); } }
    ctx.restore(); } };
  const fmtD = v => { const d = new Date(v); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + String(d.getFullYear()).slice(2); };
  chart = new Chart(c, { type: "line", data: { datasets: [{ data: pts, borderColor: css("--strength"), backgroundColor: css("--strength"), pointRadius: 4, borderWidth: 2.5, tension: 0.2 }] }, plugins: [faixa],
    options: { responsive: true, maintainAspectRatio: false, animation: false, parsing: false, plugins: { legend: { display: false }, tooltip: { callbacks: { title: it => fmtD(it[0].parsed.x) } } },
      scales: { x: { type: "linear", min: Math.min(pts[0].x, ini ? t12(ini) : pts[0].x) - 15 * 864e5, max: pts[pts.length - 1].x + 15 * 864e5, ticks: { color: css("--ink-2"), maxTicksLimit: 4, callback: fmtD }, grid: { display: false } },
        y: { suggestedMin: u.refMin != null ? u.refMin * 0.8 : undefined, suggestedMax: u.refMax != null ? u.refMax * 1.1 : undefined, ticks: { color: css("--ink-2") }, grid: { color: css("--line") } } } } });
};

/* ---------- lançar ou editar ---------- */
actions.exNovo = () => { openModal(`<div></div>`, { id: null, nome: "", q: "" }); telaEscolha(); };
function telaEscolha(){
  const q = (modalState.q || "").toLowerCase(), lista = CATALOGO.map(c => c[0]).filter(n => !q || n.toLowerCase().includes(q));
  updateModal(`<div class="between"><h3>Qual exame?</h3><button class="linkbtn" data-act="closeModal">Fechar</button></div>
    <input class="txt" id="ex-q" type="search" placeholder="Buscar (ex.: HDL, B12)" data-act="exBusca" value="${esc(modalState.q || "")}" style="margin-top:8px">
    <div class="chips" style="margin-top:8px" id="ex-lista">${lista.map(n => `<button type="button" class="chip" data-act="exEscolher" data-v="${esc(n)}">${esc(n)}</button>`).join("")}
      <button type="button" class="chip" data-act="exEscolher" data-v="">Outro…</button></div>`);
  const i = $("#ex-q"); if (i){ i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}
inputs.exBusca = el => { modalState.q = el.value; telaEscolha(); };
actions.exEscolher = el => { modalState.nome = el.dataset.v; telaForm(); };
actions.exEditar = el => { const x = S.exames[el.dataset.id]; if (!x) return; openModal(`<div></div>`, { id: x.id, nome: x.nome, x }); telaForm(); };
function telaForm(){
  const st = modalState, ant = st.nome ? serie(padrao(st.nome).nome).pop() : null, x = st.x || { date: ymd(new Date()), unidade: ant ? ant.unidade : "", refMin: ant ? ant.refMin : null, refMax: ant ? ant.refMax : null, laboratorio: ant ? ant.laboratorio : "" };
  updateModal(`<h3>${st.id ? "Editar exame" : "Lançar exame"}</h3>
    <div class="field"><label class="lab" for="ex-nome">Exame</label><input id="ex-nome" class="txt" type="text" value="${esc(st.nome)}" placeholder="Nome do exame"></div>
    <div class="field"><span class="lab">Data da coleta</span>${dataCampoHtml("ex-data", x.date, 2010)}</div>
    <div class="grid2"><div class="field"><label class="lab" for="ex-valor">Resultado</label><input id="ex-valor" class="txt" type="text" inputmode="decimal" value="${x.valor != null ? esc(fmtNum(x.valor, 4)) : ""}" placeholder="vazio = pendente"></div>
      <div class="field"><label class="lab" for="ex-un">Unidade</label><input id="ex-un" class="txt" type="text" value="${esc(x.unidade || "")}" placeholder="mg/dL"></div>
      <div class="field"><label class="lab" for="ex-min">Referência mínima</label><input id="ex-min" class="txt" type="text" inputmode="decimal" value="${x.refMin != null ? esc(fmtNum(x.refMin, 4)) : ""}"></div>
      <div class="field"><label class="lab" for="ex-max">Referência máxima</label><input id="ex-max" class="txt" type="text" inputmode="decimal" value="${x.refMax != null ? esc(fmtNum(x.refMax, 4)) : ""}"></div></div>
    <div class="field"><label class="lab" for="ex-lab">Laboratório</label><input id="ex-lab" class="txt" type="text" value="${esc(x.laboratorio || "")}"></div>
    ${ant && !st.id ? `<p class="small muted">Unidade e referência vieram do último ${esc(padrao(st.nome).nome)} (${ddmmyyyy(ant.date)}). Confira no laudo.</p>` : ""}
    <div class="err" id="ex-err"></div>
    <div class="row" style="margin-top:14px"><button class="btn ghost" data-act="closeModal">Cancelar</button><button class="btn strength" data-act="exSalvar">Salvar</button></div>
    ${st.id ? `<div class="row" style="margin-top:10px"><button class="btn danger" data-act="exApagar">Apagar este resultado</button></div>` : ""}`);
}
actions.exSalvar = () => {
  const nome = $("#ex-nome").value.trim(), date = lerData("ex-data"), v = num($("#ex-valor").value);
  if (!nome){ $("#ex-err").textContent = "Informe o nome do exame."; return; }
  if (!date || date > ymd(new Date())){ $("#ex-err").textContent = "Data inválida."; return; }
  const id = modalState.id || newId("x");
  S.exames[id] = Object.assign({}, S.exames[id] || {}, { id, date, nome: padrao(nome).grupo === "Outros" ? nome : padrao(nome).nome, valor: v, unidade: $("#ex-un").value.trim() || null,
    refMin: num($("#ex-min").value), refMax: num($("#ex-max").value), laboratorio: $("#ex-lab").value.trim() || null, status: v == null ? "pendente" : "liberado" });
  flush("exames", id); closeModal(); setStatus("Exame salvo"); render();
};
actions.exApagar = () => { if (!confirm("Apagar este resultado?")) return; delete S.exames[modalState.id]; flush("exames", modalState.id); closeModal(); render(); };
