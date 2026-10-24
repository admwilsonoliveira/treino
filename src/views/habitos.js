// Saúde → Hábitos e sono: check-in da noite (20 s), correlações, FC de repouso, STOP-Bang, tabagismo e álcool.
import { S, flush, setStatus } from "../store.js";
import { ui, actions, render, go, openModal, closeModal, modalState, scaleHtml } from "../ui.js";
import { esc, num, fmtNum, ymd, ddmm, ddmmyyyy, newId, horaCampoHtml, lerHora, dataCampoHtml, lerData, $ } from "../util.js";
import { addDias } from "../medicacao.js";
import {
  habitosList, checkinDe, checkinPendente, lembreteCheckin, ESCALAS, humorBaixo, correlacoes, DIAS_PARA_CORRELACAO, fcSemanas, fcTendencia, fcPendenteSemana,
  STOPBANG, STOPBANG_AUTO, stopBangAuto, stopBangList, stopBangUltimo, stopBangDevido, stopBangRisco, alertaStopBang, alertaApneia,
  tabagismo, diasSemFumar, MARCOS_FUMO, alcoolSemanal, alertaAlcool
} from "../habitos.js";

const hoje = () => ymd(new Date());
actions.goHabitos = () => go("saude", "habitos");
const media = (arr, k) => { const v = arr.map(h => num(h[k])).filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };

/* ---------- cartão no Hoje ---------- */
export function checkinCardHtml(){
  if (!checkinPendente()) return "";
  return `<div class="panel" style="margin-top:12px"><div class="between"><div><div class="small muted">Hábitos</div><h3 style="margin-top:2px">Check-in da noite</h3><div class="small muted">Sono, fome, humor e estresse. Leva 20 segundos.</div></div></div>
    <div class="row" style="margin-top:12px"><button class="btn strength" data-act="checkinNovo">Fazer agora</button></div></div>`;
}

/* ---------- check-in ---------- */
const CAMPOS = [["sonoQ", "Qualidade do sono"], ["ronco", "Roncou? (você ou quem dorme junto percebeu)"], ["sonolencia", "Sonolência durante o dia"], ["estresse", "Estresse do dia"], ["fome", "Fome média do dia"], ["humor", "Humor"]];
function checkinHtml(st){
  const c = st, t = tabagismo();
  const sonoOp = Array.from({ length: 21 }, (_, i) => 2 + i * 0.5).map(v => `<option value="${v}" ${c.sonoH === v ? "selected" : ""}>${fmtNum(v)} h</option>`).join("");
  return `<h3>Check-in da noite</h3>
    <div class="yn" style="margin-top:10px"><button type="button" data-act="chkDia" data-v="${hoje()}" aria-pressed="${c.date === hoje()}">Hoje</button><button type="button" data-act="chkDia" data-v="${addDias(hoje(), -1)}" aria-pressed="${c.date === addDias(hoje(), -1)}">Ontem</button></div>
    <div class="field"><label class="lab" for="chk-sono">Horas de sono (noite passada)</label><select id="chk-sono" class="txt"><option value="">--</option>${sonoOp}</select></div>
    ${CAMPOS.map(([k, l]) => `<div class="field"><span class="lab">${l}</span>${scaleHtml(k, ESCALAS[k].length, k === "ronco" || k === "sonolencia" ? 0 : 1, c[k] != null ? c[k] : null, ESCALAS[k].map((x, i) => x || String(i + 1)))}</div>`).join("")}
    <details style="margin-top:10px"${c.alcool != null || c.passos != null || c.fc != null || c.cigarros != null ? " open" : ""}><summary class="small"><strong>Opcional:</strong> ${t.status === "fuma" ? "cigarros, " : ""}álcool, passos e FC de repouso</summary>
      <div class="grid2">
        ${t.status === "fuma" ? `<div class="field"><label class="lab" for="chk-cig">Cigarros</label><input id="chk-cig" class="txt" inputmode="numeric" value="${esc(c.cigarros != null ? c.cigarros : "")}"></div>` : ""}
        <div class="field"><label class="lab" for="chk-alc">Álcool (doses)</label><input id="chk-alc" class="txt" inputmode="decimal" value="${esc(c.alcool != null ? fmtNum(c.alcool) : "")}"></div>
        <div class="field"><label class="lab" for="chk-passos">Passos (do relógio)</label><input id="chk-passos" class="txt" inputmode="numeric" value="${esc(c.passos != null ? c.passos : "")}"></div>
        <div class="field"><label class="lab" for="chk-fc">FC de repouso (bpm)</label><input id="chk-fc" class="txt" inputmode="numeric" value="${esc(c.fc != null ? c.fc : "")}"></div>
      </div>
      <p class="small muted" style="margin:4px 0 0">1 dose = 1 lata de cerveja, 1 taça de vinho ou 1 dose de destilado. FC de repouso: uma vez por semana, a média que o relógio mostra${fcPendenteSemana() ? " (ainda não registrada nesta semana)" : ""}.</p>
    </details>
    <div class="row" style="margin-top:18px"><button class="btn ghost" data-act="closeModal">Cancelar</button><button class="btn strength" data-act="chkSalvar">Salvar</button></div>`;
}
function abrirCheckin(date){
  const atual = checkinDe(date), ant = habitosList().filter(h => h.date < date).pop();
  const st = Object.assign({ date }, atual || { sonoH: ant ? ant.sonoH : null });
  openModal(checkinHtml(st), st);
}
actions.checkinNovo = () => abrirCheckin(hoje());
actions.checkinEditar = el => abrirCheckin(el.dataset.date);
actions.chkDia = el => { closeModal(); abrirCheckin(el.dataset.v); };
actions.chkSalvar = () => {
  const st = modalState, id = "hab-" + st.date, nOuNull = sel => { const e = $(sel); return e ? num(e.value) : null; };
  const r = { id, date: st.date, sonoH: num($("#chk-sono").value), em: new Date().toISOString() };
  CAMPOS.forEach(([k]) => { if (st[k] != null) r[k] = st[k]; });
  [["cigarros", "#chk-cig"], ["alcool", "#chk-alc"], ["passos", "#chk-passos"], ["fc", "#chk-fc"]].forEach(([k, sel]) => { const v = nOuNull(sel); if (v != null && v >= 0) r[k] = v; });
  if (r.fc != null && (r.fc < 30 || r.fc > 130)){ alert("FC de repouso fora do esperado (30 a 130 bpm). Confira o número."); return; }
  if (r.sonoH == null) delete r.sonoH;
  S.habitos[id] = r; flush("habitos", id); closeModal(); setStatus("Check-in salvo"); render();
};

/* ---------- STOP-Bang ---------- */
function stopBangHtml(st){
  const a = stopBangAuto(), pontos = STOPBANG.filter(([k]) => st.resp[k] === true).length;
  const info = { B: a.info.imc != null ? `IMC ${fmtNum(a.info.imc)}` : "sem peso e altura", A: a.info.idade != null ? `${a.info.idade} anos` : "sem data de nascimento", N: a.info.pescoco ? `${fmtNum(a.info.pescoco)} cm` : "sem medida do pescoço", G: "" };
  return `<h3>STOP-Bang</h3><p class="small muted" style="margin-top:6px">Questionário de rastreio de apneia do sono. Não é diagnóstico.</p>
    ${STOPBANG.map(([k, q]) => STOPBANG_AUTO.includes(k)
      ? `<div class="between small" style="padding:8px 0;border-top:1px solid var(--line)"><span>${q}${info[k] ? ` <span class="muted">(${esc(info[k])})</span>` : ""}</span><strong>${st.resp[k] === true ? "Sim" : st.resp[k] === false ? "Não" : "?"}</strong></div>`
      : `<div class="field"><span class="lab">${q}</span><div class="yn"><button type="button" data-act="sbResp" data-k="${k}" data-v="1" aria-pressed="${st.resp[k] === true}">Sim</button><button type="button" data-act="sbResp" data-k="${k}" data-v="0" aria-pressed="${st.resp[k] === false}">Não</button></div></div>`).join("")}
    <p class="small" style="margin-top:10px"><strong>${pontos} de 8 pontos</strong> · risco ${stopBangRisco(pontos)}</p>
    <div class="row" style="margin-top:14px"><button class="btn ghost" data-act="closeModal">Cancelar</button><button class="btn strength" data-act="sbSalvar">Salvar</button></div>`;
}
actions.sbAbrir = () => {
  const a = stopBangAuto(), resp = {};
  STOPBANG_AUTO.forEach(k => { if (a[k] != null) resp[k] = a[k]; });
  openModal(stopBangHtml({ resp }), { resp });
};
actions.sbResp = el => { modalState.resp[el.dataset.k] = el.dataset.v === "1"; $("#sheet").innerHTML = stopBangHtml(modalState); };
actions.sbSalvar = () => {
  const resp = modalState.resp;
  if (["S", "T", "O", "P"].some(k => resp[k] == null)){ alert("Responda as 4 perguntas de sim ou não."); return; }
  const pontos = STOPBANG.filter(([k]) => resp[k] === true).length;
  S.saude.stopbang = stopBangList().filter(x => x.date !== hoje()).concat({ date: hoje(), resp, pontos });
  flush("kv", "saude"); closeModal(); setStatus("STOP-Bang salvo"); render();
};

/* ---------- tabagismo ---------- */
actions.fumoConfig = () => {
  const t = tabagismo();
  openModal(`<h3>Cigarro</h3>
    <div class="field"><span class="lab">Situação</span><div class="scale" style="--n:3">${[["nunca", "Nunca fumei"], ["fuma", "Fumo"], ["parou", "Parei"]].map(([k, l]) => `<button type="button" data-act="fumoStatus" data-v="${k}" aria-pressed="${t.status === k}">${l}</button>`).join("")}</div></div>
    <div class="field" id="fumo-data" ${t.status === "parou" ? "" : "hidden"}><span class="lab">Parei em</span>${dataCampoHtml("fumo", t.parouEm || hoje(), 1990)}</div>
    <p class="small muted">Ao marcar a data em que parou, o gráfico do peso ganha o evento e o ganho médio esperado depois de parar.</p>
    <div class="row" style="margin-top:16px"><button class="btn ghost" data-act="closeModal">Cancelar</button><button class="btn strength" data-act="fumoSalvar">Salvar</button></div>`, { status: t.status });
};
actions.fumoStatus = el => { modalState.status = el.dataset.v; el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === el))); $("#fumo-data").hidden = el.dataset.v !== "parou"; };
actions.fumoSalvar = () => {
  const status = modalState.status; if (!status){ alert("Escolha uma opção."); return; }
  let parouEm = null;
  if (status === "parou"){
    parouEm = lerData("fumo");
    if (!parouEm || parouEm > hoje()){ alert("Confira a data (não pode ser no futuro)."); return; }
    // evento no gráfico do peso (um por data; não duplica)
    const eid = "e-fumo-" + parouEm;
    if (!Object.values(S.eventos).some(e => e.tipo === "parou_de_fumar" && e.date === parouEm)){ S.eventos[eid] = { id: eid, date: parouEm, tipo: "parou_de_fumar", descricao: "parou de fumar" }; flush("eventos", eid); }
  }
  S.saude.tabagismo = { status, parouEm }; flush("kv", "saude"); closeModal(); render();
};

/* ---------- lembrete ---------- */
actions.habConfig = () => {
  const l = lembreteCheckin();
  openModal(`<h3>Lembrete do check-in</h3><p class="small muted" style="margin-top:6px">Notificação diária no app Android.</p>
    <div class="field"><span class="lab">Lembrar</span><div class="yn"><button type="button" data-act="habLemb" data-v="1" aria-pressed="${l.ativo}">Sim</button><button type="button" data-act="habLemb" data-v="0" aria-pressed="${!l.ativo}">Não</button></div></div>
    <div class="field"><span class="lab">Horário</span>${horaCampoHtml("hab-hora", l.hora)}</div>
    <div class="row" style="margin-top:16px"><button class="btn ghost" data-act="closeModal">Cancelar</button><button class="btn strength" data-act="habLembSalvar">Salvar</button></div>`, { ativo: l.ativo });
};
actions.habLemb = el => { modalState.ativo = el.dataset.v === "1"; el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === el))); };
actions.habLembSalvar = () => { S.saude.lembreteCheckin = { ativo: modalState.ativo, hora: lerHora("hab-hora") || "21:00" }; flush("kv", "saude"); closeModal(); setStatus("Lembrete salvo"); render(); };

/* ---------- tela ---------- */
const aviso = a => a ? `<div class="panel aviso" style="margin-bottom:12px"><strong>${esc(a.titulo)}</strong><p class="small" style="margin:4px 0 0">${esc(a.msg)}</p></div>` : "";
export function habitosHtml(){
  const hs = habitosList(), ult7 = hs.filter(h => h.date > addDias(hoje(), -7)), feitoHoje = checkinDe(hoje());
  let h = `<div class="between"><h2 style="margin-top:0">Hábitos e sono</h2><button class="linkbtn" data-act="goSaude">‹ Saúde</button></div>`;
  const hb = humorBaixo();
  if (hb) h += `<div class="panel" style="margin-bottom:12px;border-color:var(--cor-dose)"><strong>${esc(hb.titulo)}</strong><p class="small" style="margin:4px 0 0">${esc(hb.msg)}</p></div>`;
  h += aviso(alertaApneia()) + aviso(alertaAlcool());

  h += `<div class="panel"><div class="between"><div><strong>${feitoHoje ? "Check-in de hoje feito" : "Check-in da noite"}</strong><div class="small muted">Lembrete ${lembreteCheckin().ativo ? "às " + esc(lembreteCheckin().hora) : "desligado"}</div></div>
    <button class="btn ${feitoHoje ? "ghost" : "strength"}" data-act="${feitoHoje ? "checkinEditar" : "checkinNovo"}" data-date="${hoje()}">${feitoHoje ? "Editar" : "Fazer agora"}</button></div>
    <button class="linkbtn" data-act="habConfig">Configurar lembrete</button></div>`;

  // médias de 7 dias
  if (ult7.length){
    const linha = (rot, v, fmt) => `<div class="stat"><div class="v">${v != null ? fmt(v) : "–"}</div><div class="l">${rot}</div></div>`;
    h += `<h2>Últimos 7 dias</h2><div class="stats">${linha("sono médio", media(ult7, "sonoH"), v => fmtNum(v) + " h")}${linha("qualidade (1–5)", media(ult7, "sonoQ"), v => fmtNum(v))}${linha("humor (1–5)", media(ult7, "humor"), v => fmtNum(v))}</div>
      <div class="stats" style="margin-top:8px">${linha("estresse (1–5)", media(ult7, "estresse"), v => fmtNum(v))}${linha("fome (1–5)", media(ult7, "fome"), v => fmtNum(v))}${linha("passos/dia", media(ult7, "passos"), v => Math.round(v).toLocaleString("pt-BR"))}</div>`;
    h += `<div class="panel" style="margin-top:12px"><ul class="hist">${hs.slice(-10).reverse().map(x => `<li><div><strong>${ddmm(x.date)}</strong> <span class="small muted">${x.sonoH != null ? fmtNum(x.sonoH) + " h de sono" : ""}${x.sonoQ ? " · " + ESCALAS.sonoQ[x.sonoQ - 1].toLowerCase() : ""}</span>
      <div class="small muted">${[x.humor && "humor " + x.humor, x.estresse && "estresse " + x.estresse, x.fome && "fome " + x.fome, x.ronco >= 1 && "ronco", x.alcool && fmtNum(x.alcool) + " dose(s)", x.cigarros != null && x.cigarros + " cigarro(s)", x.fc && "FC " + Math.round(x.fc)].filter(Boolean).join(" · ")}</div></div>
      <button class="del" data-act="checkinEditar" data-date="${x.date}">Editar</button></li>`).join("")}</ul></div>`;
  } else h += `<p class="empty" style="margin-top:12px">Nenhum check-in ainda. Faça o primeiro hoje à noite.</p>`;

  // correlações
  const c = correlacoes();
  h += `<h2>O que anda junto</h2><div class="panel">${c.faltam ? `<p class="small muted" style="margin:0">As correlações aparecem depois de ${DIAS_PARA_CORRELACAO} check-ins. Faltam ${c.faltam}.</p>`
    : c.itens.length ? c.itens.map(i => `<div style="margin-bottom:10px"><strong class="small">${esc(i.titulo)}</strong><p class="small" style="margin:2px 0 0">${esc(i.texto.charAt(0).toUpperCase() + i.texto.slice(1))}${i.r != null ? ` <span class="muted">(r = ${fmtNum(i.r, 2)}, ${i.n} dias)</span>` : ""}</p></div>`).join("") + `<p class="small muted" style="margin:0">Correlação não é causa: serve para observar padrões e levar ao médico ou ao coach.</p>`
    : `<p class="small muted" style="margin:0">Ainda sem dados suficientes nos pares (sono, fome, peso, refeições).</p>`}</div>`;

  // FC de repouso
  const fs = fcSemanas(8), ft = fcTendencia();
  h += `<h2>FC de repouso</h2><div class="panel">${fs.length ? `<div class="small">${fs.map(s => `${ddmm(s.fim)}: <strong>${Math.round(s.fc)}</strong> bpm`).join(" · ")}</div>${ft ? (d => `<p class="small" style="margin:6px 0 0">Tendência: ${d <= -2 ? "caindo" : d >= 2 ? "subindo" : "estável"} (${d > 0 ? "+" : ""}${d} bpm em relação ao início do período).</p>`)(Math.round(ft.dif)) : ""}`
    : `<p class="small muted" style="margin:0">Opcional, uma vez por semana: no check-in, em "Opcional", digite a média de repouso que o relógio mostra.</p>`}</div>`;

  // STOP-Bang
  const sb = stopBangUltimo(), asb = alertaStopBang();
  h += `<h2>Apneia do sono (STOP-Bang)</h2><div class="panel">${sb ? `<div class="between"><div><strong>${sb.pontos} de 8</strong> · risco ${stopBangRisco(sb.pontos)}<div class="small muted">Feito em ${ddmmyyyy(sb.date)}${stopBangDevido() ? " · está na hora de refazer" : " · refazer a cada 3 meses"}</div></div></div>${asb && sb.pontos >= 3 ? `<p class="small" style="margin:8px 0 0">${esc(asb.msg)}</p>` : ""}`
    : `<p class="small muted" style="margin:0">8 perguntas de sim ou não (1 minuto). IMC, idade, pescoço e sexo são preenchidos sozinhos.</p>`}
    <button class="btn ${sb && !stopBangDevido() ? "ghost" : "strength"}" data-act="sbAbrir" style="margin-top:10px">${sb ? "Refazer" : "Responder"}</button></div>`;

  // tabagismo
  const t = tabagismo(), ds = diasSemFumar();
  h += `<h2>Cigarro</h2><div class="panel">${t.status === "parou" && ds ? `<div class="stat-num" style="color:var(--cor-sucesso)">${ds.dias}</div><div class="small muted">dia${ds.dias === 1 ? "" : "s"} sem fumar (desde ${ddmmyyyy(t.parouEm)})</div>
      ${ds.marco ? `<p class="small" style="margin:8px 0 0">${esc(ds.marco[1])}</p>` : ""}${ds.proximo ? `<p class="small muted" style="margin:4px 0 0">Próximo marco: ${esc(ds.proximo[1].split(":")[0])} (faltam ${ds.proximo[0] - ds.dias} dias).</p>` : ""}`
    : t.status === "fuma" ? `<p class="small" style="margin:0">Os cigarros entram no check-in (campo opcional). Quando parar, marque a data aqui.</p>`
    : t.status === "nunca" ? `<p class="small muted" style="margin:0">Nunca fumou.</p>` : `<p class="small muted" style="margin:0">Informe se fuma, se parou ou se nunca fumou.</p>`}
    <button class="linkbtn" data-act="fumoConfig">${t.status ? "Alterar" : "Informar"}</button></div>`;

  // álcool
  const al = alcoolSemanal();
  h += `<h2>Álcool</h2><div class="panel">${al ? `<p class="small" style="margin:0">Média de <strong>${fmtNum(al.media)} doses por semana</strong> nas últimas 4 semanas.</p>` : `<p class="small muted" style="margin:0">Registre as doses no check-in (campo opcional) para ver a média por semana.</p>`}
    <p class="small muted" style="margin:6px 0 0">O app cruza o álcool com a GGT e o FLI dos seus exames.</p></div>`;
  return h;
}
