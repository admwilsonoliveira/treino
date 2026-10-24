// Saúde → Dobras cutâneas: preparação, guia com desenho, 3 leituras em rodízio, soma em mm,
// gráficos, comparação e aba Avançado (fórmulas). A soma em mm é a métrica principal.
import { Chart, LineController, LineElement, PointElement, LinearScale, Tooltip, Legend } from "chart.js";
import { S, flush, setStatus } from "../store.js";
import { ui, actions, inputs, changes, render, openModal, updateModal, closeModal, modalState } from "../ui.js";
import { esc, num, fmtNum, ymd, ddmm, ddmmyyyy, newId, $ } from "../util.js";
import {
  nomeDobra, ponto, PROTOCOLOS, VOLTAS, DIF_MAX_MM, PERTO_LIMITE, DOBRA_GRANDE, FORA, adipometro, oficial, precisaQuarta,
  valorDobra, dentro, dobrasList, soma, somaComum, percentuais, pesagemPerto, conquista
} from "../dobras.js";
import { ultimoValor, indices } from "../fita.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Legend);
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const t12 = s => new Date(s + "T12:00:00").getTime();
const fmtD = v => { const d = new Date(v); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"); };
const sinal = (v, dec = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmtNum(Math.abs(v), dec);
const mmTxt = v => v === FORA ? `>${adipometro().limite}` : v == null ? "–" : fmtNum(v);
const somaTxt = s => `${s.incompleta ? "≥ " : ""}${fmtNum(s.mm)} mm${s.incompleta ? " (incompleta)" : ""}`;

/* ---------- desenho do ponto (silhueta simples, lado direito do corpo) ---------- */
function guiaSvg(k){
  const p = ponto(k); const [, , dir, , vista, x, y] = p;
  const corpo = `<circle cx="60" cy="22" r="14"/><rect x="40" y="40" width="40" height="100" rx="14"/><rect x="22" y="44" width="14" height="78" rx="7"/><rect x="84" y="44" width="14" height="78" rx="7"/><rect x="42" y="136" width="16" height="112" rx="8"/><rect x="62" y="136" width="16" height="112" rx="8"/>`;
  const marca = dir === "diagonal" ? `<line x1="${x - 7}" y1="${y + 7}" x2="${x + 7}" y2="${y - 7}" stroke="var(--walk)" stroke-width="3" stroke-linecap="round"/>` : `<line x1="${x}" y1="${y - 8}" x2="${x}" y2="${y + 8}" stroke="var(--walk)" stroke-width="3" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 120 256" class="guia-svg" role="img" aria-label="Local da dobra ${esc(p[1])}"><g fill="var(--surface-2)" stroke="var(--ink-2)" stroke-width="1.5" opacity=".9">${corpo}</g>
    <text x="60" y="254" text-anchor="middle" font-size="10" fill="var(--ink-2)">${vista === "frente" ? "de frente" : "de costas"} · lado direito</text>
    <circle cx="${x}" cy="${y}" r="9" fill="var(--walk)" opacity=".25"/>${marca}</svg>`;
}

/* ---------- linha no cartão de peso do Hoje ---------- */
export function dobrasResumo(){
  const ds = dobrasList(); if (!ds.length) return "";
  const u = ds[ds.length - 1], ant = ds[ds.length - 2], s = soma(u), c = ant && somaComum(ant, u);
  return `Dobras ${somaTxt(s)}${c ? ` · ${sinal(c.b - c.a)} mm vs ${ddmm(ant.date)}` : ""}`;
}
actions.goDobras = () => { ui.tab = "saude"; ui.sub = "dobras"; render(); window.scrollTo(0, 0); };

/* ---------- tela ---------- */
let charts = [];
export function dobrasHtml(){
  const ds = dobrasList(), ad = adipometro();
  let h = `<div class="between"><h2 style="margin-top:0">Dobras cutâneas</h2><button class="linkbtn" data-act="goSaude">‹ Saúde</button></div>
    <div class="panel"><p class="small muted" style="margin:0 0 10px">${esc(ad.modelo)} · abertura até ${ad.limite} mm. Meça de manhã, em jejum, antes de treinar, sempre do lado direito. A cada 2 a 4 semanas, junto com a fita.</p>
    <button class="btn strength block" data-act="dobrasNova">Medir dobras</button><button class="linkbtn" data-act="dobrasAparelho">Configurar o adipômetro</button></div>`;
  if (!ds.length) return h + `<p class="empty">Registre sua primeira medida de dobras. O app mostra o guia de cada ponto na hora de medir.</p>`;

  const u = ds[ds.length - 1], s = soma(u), ant = ds[ds.length - 2], c = ant && somaComum(ant, u), cq = conquista();
  if (cq && cq.length) h += `<div class="panel conquista"><strong>Conquista!</strong><p class="small" style="margin:4px 0 0">${esc(cq.join(" e "))} ${cq.length > 1 ? "passaram" : "passou"} a caber no adipômetro (abaixo de ${PERTO_LIMITE} mm) e agora ${cq.length > 1 ? "entram" : "entra"} na soma. É gordura da barriga indo embora.</p></div>`;
  h += `<h2>Última medida · ${ddmm(u.date)}</h2><div class="panel"><div class="small muted">Soma das dobras${u.medidoPor === "com_ajuda" ? " · medido com ajuda" + (u.avaliador ? " (" + esc(u.avaliador) + ")" : "") : " · medido sozinho"}</div>
    <div class="stat-num" style="font-size:40px;margin-top:4px;color:var(--gordura)">${s.incompleta ? "≥ " : ""}${fmtNum(s.mm)}<span class="small muted" style="font-weight:600;letter-spacing:0"> mm</span></div>
    ${s.incompleta ? `<div class="small">Incompleta: ${esc(s.fora.map(nomeDobra).join(", "))} passou do limite do aparelho e ficou fora da soma.</div>` : ""}
    ${c ? `<div class="small" style="margin-top:6px"><strong style="color:${c.b - c.a <= 0 ? "var(--sucesso)" : "var(--danger)"}">${sinal(c.b - c.a)} mm</strong> vs ${ddmm(ant.date)} <span class="muted">(mesmos ${c.pontos.length} pontos)</span></div>` : ""}
    <ul class="hist" style="margin-top:8px">${Object.keys(u.leituras).map(k => { const v = valorDobra(u, k); return `<li><span>${esc(nomeDobra(k))}</span><strong${v === FORA || v >= PERTO_LIMITE ? ' style="color:var(--walk)"' : ""}>${mmTxt(v)} mm</strong></li>`; }).join("")}</ul>
    ${Object.keys(u.leituras).some(k => dentro(u, k) && valorDobra(u, k) > DOBRA_GRANDE) ? `<p class="small muted" style="margin:8px 0 0">Dobras grandes têm medida menos precisa. Use principalmente a soma em mm e a tendência, não o % absoluto.</p>` : ""}</div>`;

  if (ds.length >= 2){
    h += `<h2>Evolução</h2><div class="panel"><div class="small muted">Soma dos pontos que couberam em todas as medidas</div><div class="chartbox" style="height:190px;margin-top:6px"><canvas id="chDobSoma"></canvas></div>
      <div class="small muted" style="margin-top:12px">Por ponto (barriga em destaque)</div><div class="chartbox" style="height:200px;margin-top:6px"><canvas id="chDobPonto"></canvas></div></div>`;
    const a = S.dobras[ui.dobA] || ds[ds.length - 2], b = S.dobras[ui.dobB] || u;
    const opt = sel => ds.map(r => `<option value="${esc(r.id)}" ${r.id === sel.id ? "selected" : ""}>${ddmmyyyy(r.date)}</option>`).join("");
    const ks = Object.keys(a.leituras).filter(k => b.leituras[k]);
    h += `<h2>Comparar datas</h2><div class="panel"><div class="grid2" style="margin-bottom:10px"><select class="txt" data-act="dobA">${opt(a)}</select><select class="txt" data-act="dobB">${opt(b)}</select></div>
      ${ks.length ? `<div class="scroll-x"><table><thead><tr><th>Ponto</th><th>${ddmm(a.date)}</th><th>${ddmm(b.date)}</th><th>Δ mm</th><th>Δ %</th></tr></thead><tbody>${ks.map(k => {
        const va = valorDobra(a, k), vb = valorDobra(b, k), ok = va !== FORA && vb !== FORA, d = ok ? vb - va : null;
        return `<tr><td style="white-space:normal">${esc(nomeDobra(k))}</td><td>${mmTxt(va)}</td><td>${mmTxt(vb)}</td><td style="font-weight:700;color:${d == null ? "var(--ink-2)" : d <= 0 ? "var(--sucesso)" : "var(--danger)"}">${d == null ? "–" : sinal(d)}</td><td>${d == null || !va ? "–" : sinal(d / va * 100, 0) + "%"}</td></tr>`; }).join("")}</tbody></table></div>` : `<p class="small muted">Essas datas não têm pontos em comum.</p>`}</div>`;
  }

  // Avançado (recolhido): fórmulas e os três métodos lado a lado
  const pc = percentuais(u), ps = pesagemPerto(u.date), fita = ultimoValor("cintura_umbigo");
  const marinha = fita ? indices(fita.f).gorduraMarinha : null;
  h += `<details class="panel avancado" style="margin-top:16px"><summary>Avançado: % de gordura pelas fórmulas</summary>
    <div class="infobox" style="margin-top:10px">Com adipômetro de plástico e dobras grandes, o % calculado tem erro alto; serve só como curiosidade. Acompanhe a soma em mm.</div>
    <ul class="hist" style="margin-top:8px">${pc.map(f => `<li style="align-items:flex-start"><div><strong>${esc(f.nome)}</strong>${f.pct == null ? `<div class="small muted">${f.falta.length ? "Falta: " + esc(f.falta.map(nomeDobra).join(", ")) + " (não medido ou passou do limite)" : "Fórmula disponível só para homens, com data de nascimento no perfil."}</div>` : ps ? `<div class="small muted">Massa gorda ~${fmtNum(num(ps.peso) * f.pct / 100)} kg · massa magra ~${fmtNum(num(ps.peso) * (1 - f.pct / 100))} kg (pesagem de ${ddmm(ps.date)})</div>` : ""}</div><strong>${f.pct != null ? "~" + fmtNum(f.pct) + "%" : "–"}</strong></li>`).join("")}</ul>
    <div class="small" style="margin-top:12px"><strong>Três métodos lado a lado</strong></div>
    <div class="stats" style="margin-top:6px"><div class="stat"><div class="v">${ps && ps.gorduraPct != null ? fmtNum(ps.gorduraPct) + "%" : "–"}</div><div class="l">relógio</div></div>
      <div class="stat"><div class="v">${marinha != null ? fmtNum(marinha, 0) + "%" : "–"}</div><div class="l">fita (Marinha)</div></div>
      <div class="stat"><div class="v">${(pc.find(f => f.k === "JP7" && f.pct != null) || pc.find(f => f.k === "JP3" && f.pct != null) || {}).pct != null ? fmtNum((pc.find(f => f.k === "JP7" && f.pct != null) || pc.find(f => f.k === "JP3" && f.pct != null)).pct) + "%" : "–"}</div><div class="l">dobras</div></div></div>
    <p class="small muted" style="margin:8px 0 0">Cada método tem erro próprio; compare cada um com ele mesmo ao longo do tempo.</p></details>`;

  h += `<h2>Registros</h2><div class="panel"><ul class="hist">${ds.slice().reverse().map(r => `<li><div><strong>${ddmmyyyy(r.date)}</strong><div class="small muted">${somaTxt(soma(r))} · ${Object.keys(r.leituras).length} pontos</div></div><button class="del" data-act="dobrasApagar" data-id="${esc(r.id)}">Apagar</button></li>`).join("")}</ul></div>`;
  return h;
}
changes.dobA = el => { ui.dobA = el.value; render(); };
changes.dobB = el => { ui.dobB = el.value; render(); };

export function drawDobras(){
  charts.forEach(c => { try{ c.destroy(); }catch(e){} }); charts = [];
  const ds = dobrasList(); if (ds.length < 2) return;
  const gd = cssVar("--gordura"), ink2 = cssVar("--ink-2"), line = cssVar("--line");
  const op = (yl) => ({ responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
    plugins: { legend: { display: yl, labels: { color: ink2, boxWidth: 10 } }, tooltip: { callbacks: { title: it => fmtD(it[0].parsed.x), label: it => (yl ? it.dataset.label + ": " : "") + fmtNum(it.parsed.y) + " mm" } } },
    scales: { x: { type: "linear", ticks: { color: ink2, maxTicksLimit: 5, callback: fmtD }, grid: { display: false } }, y: { ticks: { color: ink2 }, grid: { color: line } } } });
  // soma: pontos da última medida que estão dentro da faixa em todas as medidas que os têm
  const u = ds[ds.length - 1], ks = Object.keys(u.leituras).filter(k => dentro(u, k));
  const serie = ds.filter(r => ks.every(k => dentro(r, k))).map(r => ({ x: t12(r.date), y: soma(r, ks).mm }));
  const a = $("#chDobSoma"); if (a) charts.push(new Chart(a, { type: "line", data: { datasets: [{ data: serie, borderColor: gd, backgroundColor: gd, pointRadius: 4, borderWidth: 2.5, tension: .2 }] }, options: op(false) }));
  const b = $("#chDobPonto"); if (!b) return;
  const todos = [...new Set(ds.flatMap(r => Object.keys(r.leituras)))];
  const dsets = todos.map(k => {
    const barriga = k === "abdominal" || k === "suprailiaca";
    return { label: nomeDobra(k), data: ds.filter(r => dentro(r, k)).map(r => ({ x: t12(r.date), y: valorDobra(r, k) })), borderColor: barriga ? gd : ink2 + "88", backgroundColor: barriga ? gd : ink2 + "88", borderWidth: barriga ? 2.8 : 1.5, pointRadius: barriga ? 4 : 2, tension: .2 };
  });
  charts.push(new Chart(b, { type: "line", data: { datasets: dsets }, options: op(true) }));
}

/* ---------- medir: preparação → rodízio (3 voltas) → 4ª quando precisar → resumo ---------- */
actions.dobrasNova = () => {
  const ad = adipometro();
  openModal(`<h3>Antes de medir</h3>
    <ul class="checklist small"><li>Aperte <strong>ZERO</strong> com o aparelho fechado.</li><li>Confira a bateria (CR2032; o kit tem uma reserva).</li>
      <li>Pele seca, de manhã, em jejum, antes de treinar. Sempre do <strong>lado direito</strong>.</li>
      <li>Pince a dobra com polegar e indicador cerca de 1 cm acima do ponto, posicione o aparelho no ponto e use o <strong>HOLD</strong> uns 2 segundos depois de soltar a pressão.</li>
      <li>Abertura máxima do seu aparelho: <strong>${ad.limite} mm</strong>.</li></ul>
    <div class="field"><span class="lab">Quem vai medir?</span><div class="yn"><button type="button" data-act="dbQuem" data-v="sozinho" aria-pressed="true">Sozinho</button><button type="button" data-act="dbQuem" data-v="com_ajuda" aria-pressed="false">Com ajuda</button></div>
      <div class="help" id="db-proto">${esc(PROTOCOLOS.sozinho.nome)}: ${PROTOCOLOS.sozinho.pontos.map(nomeDobra).join(", ")}.</div></div>
    <div class="field" id="db-aval" hidden><label class="lab" for="db-avaliador">Quem mediu (de preferência sempre a mesma pessoa)</label><input id="db-avaliador" class="txt" type="text" maxlength="40" placeholder="Ex.: Marcos"></div>
    <div class="field" id="db-extras"></div>
    <div class="row" style="margin-top:18px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn strength" data-act="dbComecar">Começar</button></div>`,
  { quem: "sozinho", extras: [] });
  extrasHtml();
};
function extrasHtml(){
  const p = PROTOCOLOS[modalState.quem];
  $("#db-proto").textContent = `${p.nome}: ${p.pontos.map(nomeDobra).join(", ")}.`;
  $("#db-aval").hidden = modalState.quem !== "com_ajuda";
  $("#db-extras").innerHTML = `<span class="lab">Pontos extras (opcional)</span><div class="chips">${p.extras.map(k => `<button type="button" class="chip" data-act="dbExtra" data-v="${k}" aria-pressed="${modalState.extras.includes(k)}">${esc(nomeDobra(k))}</button>`).join("")}</div>`;
}
actions.dbQuem = el => { modalState.quem = el.dataset.v; modalState.extras = []; el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false")); extrasHtml(); };
actions.dbExtra = el => { const k = el.dataset.v, i = modalState.extras.indexOf(k); if (i >= 0) modalState.extras.splice(i, 1); else modalState.extras.push(k); el.setAttribute("aria-pressed", String(i < 0)); };
actions.dbComecar = () => {
  const p = PROTOCOLOS[modalState.quem];
  Object.assign(modalState, { pontos: p.pontos.concat(modalState.extras), leituras: {}, volta: 1, idx: 0, quarta: null, avaliador: ($("#db-avaliador") || {}).value || "" });
  modalState.pontos.forEach(k => { modalState.leituras[k] = []; });
  telaPonto();
};
function telaPonto(){
  const st = modalState, k = st.quarta ? st.quarta[st.idx] : st.pontos[st.idx], p = ponto(k), ad = adipometro();
  const total = st.quarta ? st.quarta.length : st.pontos.length;
  updateModal(`<div class="small muted">${st.quarta ? "Leitura extra (as leituras diferiram mais de " + DIF_MAX_MM + " mm)" : (VOLTAS > 1 ? "Volta " + st.volta + " de " + VOLTAS : "Uma leitura por ponto")} · ponto ${st.idx + 1} de ${total}</div>
    <h3 style="margin-top:4px">${esc(p[1])}</h3>
    <div class="guia"><div>${guiaSvg(k)}</div><div class="small"><p><strong>Dobra ${esc(p[2])}.</strong> ${esc(p[3])}</p>${st.leituras[k].length ? `<p class="muted">Leituras anteriores: ${st.leituras[k].map(mmTxt).join(" · ")} mm</p>` : ""}</div></div>
    <div class="field"><label class="lab" for="db-mm">Leitura (mm)</label><input id="db-mm" class="txt leitura-mm" type="text" inputmode="decimal" placeholder="Ex.: 32,5" data-act="dbMm" autofocus>
      <div class="help" id="db-aviso"></div></div>
    <div class="row"><button class="btn ghost" data-act="dbFora">Passou do limite (&gt;${ad.limite} mm)</button></div>
    <div class="err" id="db-err"></div>
    <div class="row" style="margin-top:14px"><button class="btn ghost" data-act="dbCancelar">Cancelar</button><button class="btn strength" data-act="dbProximo">Próximo</button></div>`);
  const f = $("#db-mm"); if (f) f.focus();
}
inputs.dbMm = el => {
  const v = num(el.value), ad = adipometro(), av = $("#db-aviso");
  av.textContent = v != null && v >= ad.limite ? `Chegou ao limite: use "Passou do limite".` : v != null && v >= PERTO_LIMITE ? `Próximo do limite do aparelho (${ad.limite} mm).` : "";
  av.style.color = v != null && v >= PERTO_LIMITE ? "var(--walk)" : "";
};
function grava(valor){
  const st = modalState, k = st.quarta ? st.quarta[st.idx] : st.pontos[st.idx];
  st.leituras[k].push(valor); st.idx++;
  const total = st.quarta ? st.quarta.length : st.pontos.length;
  if (st.idx < total) return telaPonto();
  if (!st.quarta && st.volta < VOLTAS){ st.volta++; st.idx = 0; return telaPonto(); }
  // com rodízio (mais de 1 volta): leitura extra só nos pontos em que as leituras diferiram mais de 2 mm
  if (!st.quarta && VOLTAS > 1){ const q = st.pontos.filter(x => precisaQuarta(st.leituras[x])); if (q.length){ st.quarta = q; st.idx = 0; return telaPonto(); } }
  telaResumo();
}
actions.dbProximo = () => {
  const v = num($("#db-mm").value), ad = adipometro();
  if (v == null || v <= 0){ $("#db-err").textContent = "Digite a leitura em mm ou toque em \"Passou do limite\"."; return; }
  grava(v >= ad.limite ? FORA : Math.round(v * 10) / 10);
};
actions.dbFora = () => grava(FORA);
actions.dbCancelar = () => { if (confirm("Descartar esta medição?")) closeModal(); };
function telaResumo(){
  const st = modalState, r = { leituras: st.leituras }, s = soma(r);
  updateModal(`<h3>Resultado</h3>
    <div class="stat-num" style="font-size:40px;margin-top:6px;color:var(--gordura)">${s.incompleta ? "≥ " : ""}${fmtNum(s.mm)} mm</div>
    <div class="small muted">Soma das dobras${s.incompleta ? " (incompleta: " + esc(s.fora.map(nomeDobra).join(", ")) + " passou do limite)" : ""}</div>
    <ul class="hist" style="margin-top:8px">${st.pontos.map(k => `<li><span>${esc(nomeDobra(k))}<span class="small muted"> · ${st.leituras[k].map(mmTxt).join(" / ")}</span></span><strong>${mmTxt(oficial(st.leituras[k]))} mm</strong></li>`).join("")}</ul>
    ${VOLTAS > 1 ? `<p class="small muted">O valor de cada ponto é a mediana das leituras.</p>` : ""}
    <div class="field"><label class="lab" for="db-obs">Observação</label><input id="db-obs" class="txt" type="text" maxlength="120"></div>
    <div class="row" style="margin-top:16px"><button class="btn ghost" data-act="dbCancelar">Descartar</button><button class="btn strength" data-act="dbSalvar">Salvar</button></div>`);
}
actions.dbSalvar = () => {
  const st = modalState, id = newId("k"), ad = adipometro();
  S.dobras[id] = { id, date: ymd(new Date()), medidoPor: st.quem, avaliador: st.avaliador || null, adipometro: ad.modelo, limiteMm: ad.limite, leituras: st.leituras,
    foraDaFaixa: st.pontos.filter(k => oficial(st.leituras[k]) === FORA), protocolo: st.quem === "sozinho" ? "JP3" : "JP7", obs: ($("#db-obs").value || "").trim() || null };
  flush("dobras", id); closeModal(); setStatus("Dobras salvas"); ui.tab = "saude"; ui.sub = "dobras"; render(); window.scrollTo(0, 0);
};
actions.dobrasApagar = el => { if (!confirm("Apagar esta medição de dobras?")) return; delete S.dobras[el.dataset.id]; flush("dobras", el.dataset.id); render(); };

/* ---------- configurar o adipômetro ---------- */
actions.dobrasAparelho = () => {
  const ad = adipometro();
  openModal(`<h3>Adipômetro</h3>
    <div class="field"><label class="lab" for="ad-modelo">Modelo</label><input id="ad-modelo" class="txt" type="text" maxlength="60" value="${esc(ad.modelo)}"></div>
    <div class="field"><label class="lab" for="ad-lim">Abertura máxima (mm)</label><input id="ad-lim" class="txt" type="text" inputmode="numeric" value="${ad.limite}"></div>
    <p class="small muted">Modelos de plástico não têm a pressão calibrada dos científicos: os valores podem diferir de um avaliador profissional, mas servem para acompanhar a tendência com a mesma técnica.</p>
    <div class="row" style="margin-top:16px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn strength" data-act="adSalvar">Salvar</button></div>`);
};
actions.adSalvar = () => {
  const lim = num($("#ad-lim").value);
  S.saude.adipometro = { modelo: $("#ad-modelo").value.trim() || null, limite: lim >= 20 && lim <= 120 ? lim : 50 };
  flush("kv", "saude"); closeModal(); render();
};
