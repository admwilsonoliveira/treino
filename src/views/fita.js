// Saúde → Medidas com fita: registro com 1 leitura por ponto (a 2ª é opcional), índices, progresso da cintura e comparação.
import { Chart, LineController, LineElement, PointElement, LinearScale, Tooltip, Legend } from "chart.js";
import { S, flush, setStatus } from "../store.js";
import { ui, actions, inputs, changes, render, openModal, closeModal, modalState } from "../ui.js";
import { esc, num, fmtNum, ymd, ddmm, ddmmyyyy, newId, $ } from "../util.js";
import { GRUPOS, PONTOS, nomePonto, ehBraco, DIF_MAX, oficial, valorPonto, fitaList, fitaOficial, ultimoValor, indices, metasCintura, baseCintura, alertaPescoco } from "../fita.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Legend);
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const t12 = s => new Date(s + "T12:00:00").getTime();
const fmtD = v => { const d = new Date(v); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"); };
const sinal = (v, dec = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmtNum(Math.abs(v), dec);

/* ---------- linha da cintura no cartão de peso do Hoje ---------- */
export function cinturaResumo(){
  const u = ultimoValor("cintura_umbigo"); if (!u) return "";
  const prox = metasCintura().find(m => m < u.v);
  return `Cintura ${fmtNum(u.v)} cm${prox ? ` · próxima meta: abaixo de ${fmtNum(prox, 0)} cm` : ""}`;
}
actions.goMedidas = () => { ui.tab = "saude"; ui.sub = "medidas"; render(); window.scrollTo(0, 0); };
actions.pescocoVisto = () => { S.saude.pescocoAvisadoMes = ymd(new Date()).slice(0, 7); flush("kv", "saude"); render(); };

/* ---------- tela ---------- */
let chart = null;
ui.fitaSemJejum = ui.fitaSemJejum || false;
export function fitaHtml(){
  let h = `<div class="between"><h2 style="margin-top:0">Medidas com fita</h2><button class="linkbtn" data-act="goSaude">‹ Saúde</button></div>`;
  const todas = fitaList();
  h += `<div class="panel"><p class="small muted" style="margin:0 0 10px">Meça de manhã, em jejum, com a mesma fita. Lado direito primeiro, depois o esquerdo.</p>
    <button class="btn strength block" data-act="fitaNova">Registrar medidas</button></div>`;
  if (!todas.length) return h + `<p class="empty">Nenhuma medida ainda. Comece pela cintura na altura do umbigo e pelo pescoço.</p>`;

  const ult = fitaOficial().pop(), pe = alertaPescoco() || (ultimoValor("pescoco", { soJejum: false }) && ultimoValor("pescoco", { soJejum: false }).v > 43);
  if (ult){
    const ix = indices(ult), c = valorPonto(ult, "cintura_umbigo");
    h += `<h2>Última medida em jejum · ${ddmm(ult.date)}</h2><div class="panel"><div class="stats" style="margin-top:0">
      <div class="stat"><div class="v">${c != null ? fmtNum(c) : "–"}</div><div class="l">cintura (cm)</div></div>
      <div class="stat"><div class="v">${ix.cinturaAltura != null ? fmtNum(ix.cinturaAltura, 2) : "–"}</div><div class="l">cintura/altura · meta &lt; 0,50</div></div>
      <div class="stat"><div class="v">${ix.cinturaQuadril != null ? fmtNum(ix.cinturaQuadril, 2) : "–"}</div><div class="l">cintura/quadril · meta &lt; ${S.profile && S.profile.sexo === "F" ? "0,85" : "0,90"}</div></div></div>
      ${ix.gorduraMarinha != null ? `<p class="small" style="margin:10px 0 0">% de gordura pela fórmula da Marinha: <strong>~${fmtNum(ix.gorduraMarinha, 0)}%</strong> <span class="muted">(cada método tem erro próprio; compare cada um com ele mesmo ao longo do tempo)</span></p>` : ""}
      ${pe ? `<p class="small" style="margin:8px 0 0;color:var(--walk)"><strong>Pescoço acima de 43 cm:</strong> fator de risco para apneia do sono. Comente com o médico.</p>` : ""}</div>`;
  }

  // progresso da cintura
  const base = baseCintura(), metas = metasCintura(), uc = ultimoValor("cintura_umbigo");
  if (base && uc && metas.length){
    const fim = metas[metas.length - 1], total = base.v - fim, feito = Math.max(0, Math.min(1, (base.v - uc.v) / (total || 1)));
    h += `<h2>Cintura: caminho até a meta</h2><div class="panel"><div class="prog-cint"><i style="width:${Math.round(feito * 100)}%"></i>${metas.map(m => `<b style="left:${Math.round((base.v - m) / (total || 1) * 100)}%"></b>`).join("")}</div>
      <div class="between small muted" style="margin-top:6px"><span>${fmtNum(base.v)} cm (${ddmm(base.date)})</span><span>${metas.map(m => fmtNum(m, 0)).join(" → ")} cm</span></div>
      <p class="small" style="margin:8px 0 0">Agora: <strong>${fmtNum(uc.v)} cm</strong>${base.v - uc.v > 0 ? ` · ${sinal(uc.v - base.v)} cm desde o início` : ""}.</p>
      <button class="linkbtn" data-act="fitaMetas">Editar metas</button></div>`;
  }

  // gráfico da cintura
  h += `<h2>Evolução da cintura</h2><div class="panel"><div class="chartbox" style="height:200px"><canvas id="chFita"></canvas></div>
    <label class="small" style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" data-act="fitaSemJejum" ${ui.fitaSemJejum ? "checked" : ""} style="width:20px;height:20px;accent-color:var(--strength)"> Mostrar medidas sem jejum</label></div>`;

  // comparação entre duas datas
  if (todas.length >= 2){
    const a = S.fita[ui.fitaA] || todas[todas.length - 2], b = S.fita[ui.fitaB] || todas[todas.length - 1];
    const opt = sel => todas.map(f => `<option value="${esc(f.id)}" ${f.id === sel.id ? "selected" : ""}>${ddmmyyyy(f.date)}${f.jejum ? "" : " (sem jejum)"}</option>`).join("");
    const linhas = PONTOS.filter(([k]) => valorPonto(a, k) != null && valorPonto(b, k) != null).map(([k, n]) => {
      const d = valorPonto(b, k) - valorPonto(a, k), bom = ehBraco(k) ? d >= 0 : d < 0;
      return `<tr><td style="white-space:normal">${esc(n)}</td><td>${fmtNum(valorPonto(a, k))}</td><td>${fmtNum(valorPonto(b, k))}</td><td style="color:${d === 0 && !ehBraco(k) ? "var(--ink-2)" : bom ? "var(--sucesso)" : "var(--danger)"};font-weight:700">${sinal(d)}</td></tr>`;
    }).join("");
    h += `<h2>Comparar datas</h2><div class="panel"><div class="grid2" style="margin-bottom:10px"><select class="txt" data-act="fitaA">${opt(a)}</select><select class="txt" data-act="fitaB">${opt(b)}</select></div>
      ${linhas ? `<div class="scroll-x"><table><thead><tr><th>Ponto</th><th>${ddmm(a.date)}</th><th>${ddmm(b.date)}</th><th>Δ cm</th></tr></thead><tbody>${linhas}</tbody></table></div>` : `<p class="small muted">Essas datas não têm pontos em comum.</p>`}
      <p class="small muted" style="margin:8px 0 0">Verde: diminuiu (nos braços, aumentou ou manteve).</p></div>`;
  }

  h += `<h2>Registros</h2><div class="panel"><ul class="hist">${todas.slice().reverse().map(f => `<li><div><strong>${ddmmyyyy(f.date)}</strong> ${f.jejum ? "" : `<span class="tag gray">sem jejum</span>`}
    <div class="small muted">${Object.keys(f.leituras || {}).length} ponto${Object.keys(f.leituras || {}).length === 1 ? "" : "s"}${valorPonto(f, "cintura_umbigo") != null ? " · cintura " + fmtNum(valorPonto(f, "cintura_umbigo")) + " cm" : ""}</div></div>
    <button class="del" data-act="fitaEditar" data-id="${esc(f.id)}">Editar</button></li>`).join("")}</ul></div>`;
  return h;
}
changes.fitaSemJejum = el => { ui.fitaSemJejum = el.checked; render(); };
changes.fitaA = el => { ui.fitaA = el.value; render(); };
changes.fitaB = el => { ui.fitaB = el.value; render(); };

export function drawFita(){
  if (chart){ try{ chart.destroy(); }catch(e){} chart = null; }
  const el = $("#chFita"); if (!el) return;
  const st = cssVar("--strength"), ink2 = cssVar("--ink-2"), line = cssVar("--line"), wk = cssVar("--walk");
  const pts = fs => fs.filter(f => valorPonto(f, "cintura_umbigo") != null).map(f => ({ x: t12(f.date), y: valorPonto(f, "cintura_umbigo") }));
  const ds = [{ label: "Cintura em jejum", data: pts(fitaOficial()), borderColor: st, backgroundColor: st, pointRadius: 4, borderWidth: 2.5, tension: .2 }];
  if (ui.fitaSemJejum) ds.push({ label: "Sem jejum", data: pts(fitaList().filter(f => !f.jejum)), showLine: false, pointRadius: 4, pointStyle: "rectRot", borderColor: wk, backgroundColor: wk });
  const todos = ds.flatMap(d => d.data); if (!todos.length) return;
  const metas = metasCintura();
  chart = new Chart(el, { type: "line", data: { datasets: ds }, options: {
    responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
    plugins: { legend: { display: ui.fitaSemJejum, labels: { color: ink2, boxWidth: 10 } }, tooltip: { callbacks: { title: it => fmtD(it[0].parsed.x), label: it => fmtNum(it.parsed.y) + " cm" } } },
    scales: { x: { type: "linear", min: Math.min(...todos.map(p => p.x)) - 3 * 864e5, max: Math.max(...todos.map(p => p.x)) + 3 * 864e5, ticks: { color: ink2, maxTicksLimit: 5, callback: fmtD }, grid: { display: false } },
      y: { suggestedMin: metas.length ? metas[0] - 2 : undefined, ticks: { color: ink2, precision: 0, callback: v => fmtNum(v, 0) }, grid: { color: line } } } } });
}

/* ---------- registrar medidas ---------- */
function pontoHtml(k, n, arr){
  const v = i => arr && arr[i] != null ? esc(fmtNum(num(arr[i]))) : "";
  const terceira = arr && arr.length >= 3;
  return `<div class="ponto" data-p="${k}"><div class="lab small">${esc(n)}</div>
    <div class="leit"><input class="txt" id="fp-${k}-0" type="text" inputmode="decimal" placeholder="1ª" value="${v(0)}" data-act="fitaLeitura" data-p="${k}">
    <input class="txt" id="fp-${k}-1" type="text" inputmode="decimal" placeholder="2ª (opcional)" value="${v(1)}" data-act="fitaLeitura" data-p="${k}">
    <input class="txt" id="fp-${k}-2" type="text" inputmode="decimal" placeholder="3ª" value="${v(2)}" data-act="fitaLeitura" data-p="${k}" ${terceira ? "" : "hidden"}></div>
    <div class="help" id="fh-${k}"></div></div>`;
}
function modalFita(id){
  const f = id ? S.fita[id] : { date: ymd(new Date()), jejum: true, leituras: {} };
  openModal(`<h3>${id ? "Editar medidas" : "Registrar medidas"}</h3>
    <div class="grid2"><div class="field"><label class="lab" for="ft-date">Data</label><input id="ft-date" class="txt" type="date" value="${esc(f.date)}"></div>
      <div class="field"><span class="lab">Condição</span><label class="small" style="display:flex;gap:8px;align-items:center;min-height:44px"><input type="checkbox" id="ft-jejum" ${f.jejum ? "checked" : ""} style="width:22px;height:22px;accent-color:var(--strength)"> Em jejum</label></div></div>
    <p class="small muted" style="margin:8px 0 0">Preencha só os pontos que quiser. Uma leitura basta; a 2ª é opcional (se diferir mais de ${DIF_MAX} cm da 1ª, o app pede uma 3ª).</p>
    ${GRUPOS.map(([g, ps], i) => `<details class="grupo" ${i === 0 || ps.some(([k]) => f.leituras[k]) ? "open" : ""}><summary>${g}</summary>${ps.map(([k, n]) => pontoHtml(k, n, f.leituras[k])).join("")}</details>`).join("")}
    <div class="field"><label class="lab" for="ft-obs">Observação</label><input id="ft-obs" class="txt" type="text" value="${esc(f.obs || "")}"></div>
    <div class="err" id="ft-err"></div>
    <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn strength" data-act="fitaSalvar" data-id="${esc(id || "")}">Salvar</button></div>
    ${id ? `<div class="row" style="margin-top:10px"><button class="btn danger" data-act="fitaApagar" data-id="${esc(id)}">Apagar este registro</button></div>` : ""}`);
  PONTOS.forEach(([k]) => atualizaPonto(k));
}
const leiturasDe = k => [0, 1, 2].map(i => { const el = $(`#fp-${k}-${i}`); return el && !el.hidden ? num(el.value) : null; });
function atualizaPonto(k){
  const [a, b, c] = leiturasDe(k), t = $(`#fp-${k}-2`), help = $(`#fh-${k}`); if (!t || !help) return;
  const precisa = a != null && b != null && Math.abs(a - b) > DIF_MAX;
  if (precisa) t.hidden = false;
  const vals = [a, b, precisa || !t.hidden ? c : null].filter(x => x != null);
  help.textContent = precisa && c == null ? `As leituras diferem ${fmtNum(Math.abs(a - b))} cm: faça uma 3ª.` : vals.length ? `Valor: ${fmtNum(oficial(vals))} cm` : "";
}
inputs.fitaLeitura = el => atualizaPonto(el.dataset.p);
actions.fitaNova = () => modalFita(null);
actions.fitaEditar = el => modalFita(el.dataset.id);
actions.fitaSalvar = el => {
  const date = $("#ft-date").value; if (!date){ $("#ft-err").textContent = "Informe a data."; return; }
  const leituras = {}; let falta = null;
  PONTOS.forEach(([k, n]) => {
    const [a, b, c] = leiturasDe(k), vals = [a, b, c].filter(x => x != null);
    if (!vals.length) return;
    if (vals.some(v => v < 15 || v > 200)){ falta = falta || `${n}: confira o valor (em cm).`; return; }
    if (a != null && b != null && Math.abs(a - b) > DIF_MAX && c == null){ falta = falta || `${n}: faça a 3ª leitura.`; return; }
    leituras[k] = vals;
  });
  if (falta){ $("#ft-err").textContent = falta; return; }
  if (!Object.keys(leituras).length){ $("#ft-err").textContent = "Preencha pelo menos um ponto."; return; }
  const id = el.dataset.id || newId("f");
  S.fita[id] = Object.assign({}, S.fita[id] || {}, { id, date, jejum: $("#ft-jejum").checked, leituras, obs: $("#ft-obs").value.trim() || null });
  flush("fita", id); closeModal(); setStatus("Medidas salvas"); render();
};
actions.fitaApagar = el => {
  if (!confirm("Apagar este registro de medidas?")) return;
  delete S.fita[el.dataset.id]; flush("fita", el.dataset.id); closeModal(); render();
};

/* ---------- metas de cintura ---------- */
actions.fitaMetas = () => {
  const m = metasCintura();
  openModal(`<h3>Metas de cintura</h3><p class="small muted" style="margin-top:6px">Da primeira para a última. Referência: cintura/altura 0,50 = metade da sua altura.</p>
    <div class="grid2">${[0, 1, 2].map(i => `<div class="field"><label class="lab" for="mt-${i}">Meta ${i + 1} (cm)</label><input id="mt-${i}" class="txt" type="text" inputmode="decimal" value="${m[i] != null ? esc(fmtNum(m[i], 0)) : ""}"></div>`).join("")}</div>
    <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn strength" data-act="fitaMetasSalvar">Salvar</button></div>`);
};
actions.fitaMetasSalvar = () => {
  S.saude.metasCintura = [0, 1, 2].map(i => num($(`#mt-${i}`).value)).filter(x => x > 40 && x < 200);
  if (!S.saude.metasCintura.length) delete S.saude.metasCintura;
  flush("kv", "saude"); closeModal(); render();
};
