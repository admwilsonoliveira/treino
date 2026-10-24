// Aba Saúde (por enquanto aberta pelo Hoje e pelo Perfil): Medicação, doses, sintomas, curva estimada.
import { Chart, LineController, LineElement, PointElement, LinearScale, Tooltip, Legend } from "chart.js";
import { S, flush, setStatus } from "../store.js";
import { ui, views, actions, render, go, openModal, closeModal, modalState } from "../ui.js";
import { esc, num, fmtNum, ymd, ddmm, ddmmyyyy, newId, DIAS, horaCampoHtml, lerHora, $ } from "../util.js";
import { saudeAtiva } from "../saude.js";
import { pesoHtml, drawPeso } from "./peso.js";
import { fitaHtml, drawFita } from "./fita.js";
import { dobrasHtml, drawDobras, dobrasResumo } from "./dobras.js";
import { metodosHtml, drawMetodos } from "./metodos.js";
import { progressoHtml, sessoesFotos } from "./progresso.js";
import { ultimoValor } from "../fita.js";
import { mediaAtual, ritmo } from "../peso.js";
import {
  MEDICAMENTOS, LOCAIS, STATUS_DOSE, nomeLocal, nomeMed, regrasTirzepatida, agenda, avisoIntervalo, sugerirLocal, dosesList, aplicadas,
  nivelAtual, curva, TIPOS_SINTOMA, SINAIS, nomeSintoma, sintomasList, alertasSeguranca, CHECKLIST, checklistPendente, horaAgora, addDias
} from "../medicacao.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Legend);
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const diaSemana = s => DIAS[new Date(s + "T12:00:00").getDay()].toLowerCase();
const ANESTESIA = "Informe o uso de tirzepatida antes de qualquer cirurgia, endoscopia ou sedação (risco de aspiração).";

/* ---------- pedaços usados no Hoje ---------- */
export function alertasHtml(){
  return alertasSeguranca().map(a => `<div class="panel alerta-seg"><strong>${esc(a.titulo)}</strong><p class="small" style="margin:4px 0 0">${esc(a.msg)}</p><p class="small" style="margin:4px 0 0;opacity:.8">Sintoma registrado em ${ddmm(a.date)}.</p></div>`).join("");
}
function textoAgenda(ag){
  if (ag.estado === "sem_config") return { t: "Configure o dia da dose", s: "" };
  const dia = `${diaSemana(ag.programada)}, ${ddmm(ag.programada)}`;
  if (ag.estado === "hoje") return { t: "Hoje é dia da dose", s: dia };
  if (ag.estado === "atrasada") return { t: "Dose atrasada", s: regrasTirzepatida() ? `Era ${dia}. Ainda pode aplicar até ${diaSemana(ag.prazo)}, ${ddmm(ag.prazo)}.` : `Era ${dia}.` };
  return { t: `Próxima dose: ${dia}`, s: ag.dias === 1 ? "amanhã" : `faltam ${ag.dias} dias` };
}
// nas primeiras ~24 h depois da aplicação o nível ainda está subindo (absorção)
const subindo = () => { const u = aplicadas().pop(); return !!u && Date.now() - new Date(u.date + "T" + (u.hora || "12:00") + ":00").getTime() < 24 * 3600000; };
// dose da semana passada que perdeu o prazo de 96 h (só enquanto se espera a próxima)
function msgPulada(ag){
  const ult = ag.puladas && ag.puladas[ag.puladas.length - 1];
  if (ag.estado !== "aguardando" || !ult || addDias(ult, 7) !== ag.programada) return "";
  return `<p class="small" style="margin:8px 0 0">A dose de ${ddmm(ult)} passou do prazo de 4 dias: pule e aplique no próximo dia programado.</p>`;
}
export function medicacaoCardHtml(){
  if (!saudeAtiva()) return "";
  const ag = agenda(), tx = textoAgenda(ag), nv = nivelAtual();
  let h = `<div class="panel" style="margin-top:12px"><div class="between"><div><div class="small muted">Medicação</div><h3 style="margin-top:2px">${esc(tx.t)}</h3><div class="small muted">${esc(tx.s)}</div></div>
    ${nv != null ? `<div style="text-align:right"><div class="stat-num" style="color:var(--dose)">${fmtNum(nv, 0)}%</div><div class="small muted">nível estimado${subindo() ? ", subindo" : ""}</div></div>` : ""}</div>`;
  h += msgPulada(ag);
  h += `<div class="row" style="margin-top:12px">${ag.estado === "hoje" || ag.estado === "atrasada" ? `<button class="btn strength" data-act="doseNova">Registrar dose</button>` : ""}<button class="btn ghost" data-act="goMedicacao">Ver medicação</button></div>`;
  if (checklistPendente()) h += `<button class="linkbtn" data-act="checklistAbrir">Checklist de sintomas da semana (30 s)</button>`;
  return h + `</div>`;
}
actions.goMedicacao = () => go("saude", "medicacao");
actions.goSaude = () => go("saude");

/* ---------- aba Saúde ---------- */
let chart = null;
views.saude = {
  html(){
    if (!saudeAtiva()) return `<div class="panel"><h3>Saúde</h3><p class="small muted" style="margin-top:6px">Ative o acompanhamento de saúde em Perfil → Saúde.</p><button class="btn strength" data-act="goTab" data-tab="perfil" style="margin-top:10px">Ir para o Perfil</button></div>`;
    if (ui.sub === "medicacao") return medicacaoHtml();
    if (ui.sub === "peso") return pesoHtml();
    if (ui.sub === "medidas") return fitaHtml();
    if (ui.sub === "dobras") return dobrasHtml();
    if (ui.sub === "metodos") return metodosHtml();
    if (ui.sub === "fotos") return progressoHtml();
    const tx = textoAgenda(agenda()), m = mediaAtual(), r = ritmo(4);
    return `<h2 style="margin-top:0">Saúde</h2>${alertasHtml()}
      <button class="panel hub" data-act="goMedicacao"><div><strong>Medicação</strong><div class="small muted">${esc(tx.t)}${tx.s ? " · " + esc(tx.s) : ""}</div></div><span aria-hidden="true">›</span></button>
      <button class="panel hub" data-act="goPeso" style="margin-top:12px"><div><strong>Peso</strong><div class="small muted">${m != null ? `${fmtNum(m)} kg (média de 7 dias)${r != null ? " · " + (r > 0 ? "+" : r < 0 ? "−" : "") + fmtNum(Math.abs(r), 2) + " kg/semana" : ""}` : "Nenhuma pesagem ainda"}</div></div><span aria-hidden="true">›</span></button>
      <button class="panel hub" data-act="goFotos" style="margin-top:12px"><div><strong>Fotos de progresso</strong><div class="small muted">${(n => n ? `Última sessão em ${ddmm(n.date)} · só neste celular` : "Frente, lado e costas, uma vez por mês")(sessoesFotos().pop())}</div></div><span aria-hidden="true">›</span></button>
      <button class="panel hub" data-act="goMetodos" style="margin-top:12px"><div><strong>Comparar métodos</strong><div class="small muted">Gordura e massa magra: relógio, fita e dobras</div></div><span aria-hidden="true">›</span></button>
      <button class="panel hub" data-act="goRelCompleto" style="margin-top:12px"><div><strong>Relatório completo</strong><div class="small muted">12 meses, para a IA ou o médico</div></div><span aria-hidden="true">›</span></button>
      <button class="panel hub" data-act="goDobras" style="margin-top:12px"><div><strong>Dobras cutâneas</strong><div class="small muted">${esc(dobrasResumo() || "Nenhuma medida ainda")}</div></div><span aria-hidden="true">›</span></button>
      <button class="panel hub" data-act="goTestes" style="margin-top:12px"><div><strong>Testes mensais</strong><div class="small muted">Sentar e levantar e força de preensão</div></div><span aria-hidden="true">›</span></button>
      <button class="panel hub" data-act="goMedidas" style="margin-top:12px"><div><strong>Medidas com fita</strong><div class="small muted">${(c => c ? `Cintura ${fmtNum(c.v)} cm em ${ddmm(c.date)}` : "Nenhuma medida em jejum ainda")(ultimoValor("cintura_umbigo"))}</div></div><span aria-hidden="true">›</span></button>`;
  },
  after(){ if (ui.sub === "medicacao") drawCurva(); if (ui.sub === "peso") drawPeso(); if (ui.sub === "medidas") drawFita(); if (ui.sub === "dobras") drawDobras(); if (ui.sub === "metodos") drawMetodos(); }
};

function medicacaoHtml(){
  const sd = S.saude, ag = agenda(), tx = textoAgenda(ag);
  let h = `<div class="between"><h2 style="margin-top:0">Medicação</h2><button class="linkbtn" data-act="goSaude">‹ Saúde</button></div>${alertasHtml()}`;
  h += `<div class="panel"><div class="small muted">${esc(nomeMed(sd.medicamento))}${sd.doseAtualMg ? " · " + fmtNum(sd.doseAtualMg) + " mg" : ""}${sd.diaFixo != null ? " · toda " + DIAS[sd.diaFixo].toLowerCase() : ""}</div>
    <h3 style="margin-top:4px">${esc(tx.t)}</h3><div class="small muted">${esc(tx.s)}</div>
    ${msgPulada(ag)}
    <p class="small" style="margin:8px 0 0">Local sugerido para a próxima: <strong>${esc(nomeLocal(sugerirLocal()))}</strong></p>
    <div class="row" style="margin-top:12px"><button class="btn strength" data-act="doseNova">Registrar dose</button><button class="btn ghost" data-act="sintomaNovo">Registrar sintoma</button></div>
    <div class="row" style="margin-top:4px"><button class="linkbtn" data-act="checklistAbrir">Checklist de sintomas</button><button class="linkbtn" data-act="medConfig">Configurar</button></div></div>`;

  if (regrasTirzepatida()){
    const nv = nivelAtual();
    h += `<h2>Nível estimado</h2><div class="panel"><div class="between"><div class="small muted">Últimas 8 semanas e próximos 7 dias</div>${nv != null ? `<strong style="color:var(--dose)">${fmtNum(nv, 0)}% agora${subindo() ? " · subindo" : ""}</strong>` : ""}</div>
      <div class="chartbox" style="height:220px;margin-top:8px"><canvas id="chCurva"></canvas></div>
      <p class="small muted" style="margin:8px 0 0"><strong>Estimativa por modelo farmacocinético — não é dosagem real.</strong> 100% = pico de 5 mg por semana em equilíbrio. A linha tracejada supõe a próxima dose no dia programado.</p></div>`;
  }
  h += `<div class="infobox" style="margin-top:12px">${esc(ANESTESIA)}</div>`;

  const ds = dosesList().slice().reverse();
  h += `<h2>Doses</h2><div class="panel">${ds.length ? `<ul class="hist">${ds.slice(0, 12).map(x => `<li><div><strong>${ddmmyyyy(x.date)}</strong>${x.hora ? ` <span class="muted small">${esc(x.hora)}</span>` : ""}
      <div class="small muted">${x.status === "aplicada" ? (x.doseMg ? fmtNum(x.doseMg) + " mg" : "") + (x.local ? " · " + esc(nomeLocal(x.local)) : "") : (STATUS_DOSE.find(s => s[0] === x.status) || [, x.status])[1]}${x.obs ? " · " + esc(x.obs) : ""}</div></div>
      <button class="del" data-act="doseEditar" data-id="${esc(x.id)}">Editar</button></li>`).join("")}</ul>${ds.length > 12 ? `<p class="small muted">Mostrando as 12 mais recentes de ${ds.length}.</p>` : ""}` : `<p class="empty">Nenhuma dose registrada. Toque em "Registrar dose" depois de aplicar.</p>`}</div>`;

  const ss = sintomasList().slice().reverse();
  h += `<h2>Sintomas</h2><div class="panel">${ss.length ? `<ul class="hist">${ss.slice(0, 12).map(x => `<li><div><strong>${esc(nomeSintoma(x.tipo))}</strong> <span class="muted small">${ddmm(x.date)}</span>
      <div class="small muted">Intensidade ${x.intensidade != null ? x.intensidade : "–"}/10${Object.keys(x.sinais || {}).length ? " · " + (SINAIS[x.tipo] || []).filter(s => x.sinais[s[0]]).map(s => esc(s[1].toLowerCase())).join(", ") : ""}</div></div>
      <button class="del" data-act="sintomaEditar" data-id="${esc(x.id)}">Editar</button></li>`).join("")}</ul>` : `<p class="empty">Nenhum sintoma registrado.</p>`}</div>`;
  h += `<p class="small muted" style="margin-top:16px">O app registra, calcula e avisa. Ele não decide dose: mudanças na medicação, leve ao seu médico.</p>`;
  return h;
}

function drawCurva(){
  if (chart){ try{ chart.destroy(); }catch(e){} chart = null; }
  const el = $("#chCurva"); if (!el) return;
  const c = curva(), dose = cssVar("--dose"), ink2 = cssVar("--ink-2"), line = cssVar("--line"), st = cssVar("--strength");
  const fmtD = v => { const d = new Date(v); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"); };
  const ds = [
    { label: "Nível estimado", data: c.real, borderColor: dose, backgroundColor: dose, pointRadius: 0, borderWidth: 2.5, tension: 0, yAxisID: "y" },
    { label: "Projeção", data: c.futuro, borderColor: dose, borderDash: [6, 4], pointRadius: 0, borderWidth: 2, tension: 0, yAxisID: "y" },
    { label: "Doses", data: c.doses, showLine: false, pointRadius: 5, pointStyle: "triangle", borderColor: dose, backgroundColor: dose, yAxisID: "y" }
  ];
  if (c.peso.length) ds.push({ label: "Peso (média 7 dias)", data: c.peso, borderColor: st, backgroundColor: st, pointRadius: 2, borderWidth: 1.5, tension: .2, yAxisID: "y2" });
  chart = new Chart(el, { type: "line", data: { datasets: ds }, options: {
    responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
    plugins: { legend: { display: true, labels: { color: ink2, boxWidth: 10, filter: i => i.text !== "Projeção" } },
      tooltip: { callbacks: { title: it => fmtD(it[0].parsed.x), label: it => it.dataset.yAxisID === "y2" ? fmtNum(it.parsed.y) + " kg" : it.dataset.label === "Doses" ? "Dose " + fmtNum(c.doses[it.dataIndex].mg) + " mg" : fmtNum(it.parsed.y, 0) + "%" } } },
    scales: {
      x: { type: "linear", min: c.ini, max: c.fim, ticks: { color: ink2, maxTicksLimit: 6, callback: fmtD }, grid: { display: false } },
      y: { min: 0, ticks: { color: ink2, callback: v => v + "%" }, grid: { color: line } },
      y2: { position: "right", display: c.peso.length > 0, ticks: { color: ink2 }, grid: { display: false } }
    } } });
}

/* ---------- registrar dose ---------- */
function modalDose(id){
  const sd = S.saude, x = id ? S.doses[id] : { date: ymd(new Date()), hora: horaAgora(), doseMg: sd.doseAtualMg, local: sugerirLocal(), status: "aplicada" };
  openModal(`<h3>${id ? "Editar dose" : "Registrar dose"}</h3>
    <div class="grid2">
      <div class="field"><label class="lab" for="ds-date">Data</label><input id="ds-date" class="txt" type="date" value="${esc(x.date)}"></div>
      <div class="field"><label class="lab" for="ds-hora-h">Hora</label>${horaCampoHtml("ds-hora", x.hora)}</div>
    </div>
    <div class="field"><span class="lab">Situação</span><div class="scale" style="--n:3">${STATUS_DOSE.map(([k, l]) => `<button type="button" data-act="dsStatus" data-v="${k}" aria-pressed="${x.status === k}">${l}</button>`).join("")}</div></div>
    <div id="ds-aplic" ${x.status === "aplicada" ? "" : "hidden"}>
      <div class="field"><label class="lab" for="ds-mg">Dose (mg)</label><input id="ds-mg" class="txt" type="text" inputmode="decimal" value="${x.doseMg != null ? esc(fmtNum(x.doseMg)) : ""}" placeholder="Ex.: 5"></div>
      <div class="field"><span class="lab">Local da aplicação</span><div class="chips">${LOCAIS.map(([k, l]) => `<button type="button" class="chip" data-act="dsLocal" data-v="${k}" aria-pressed="${x.local === k}">${l}</button>`).join("")}</div>
        ${id ? "" : `<div class="help">Sugerido pelo rodízio: ${esc(nomeLocal(sugerirLocal()))}.</div>`}</div>
    </div>
    <div class="field"><label class="lab" for="ds-obs">Observação</label><input id="ds-obs" class="txt" type="text" value="${esc(x.obs || "")}"></div>
    <div class="warnbox" id="ds-aviso"></div>
    <div class="err" id="ds-err"></div>
    <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn strength" data-act="doseSalvar" data-id="${esc(id || "")}">Salvar</button></div>
    ${id ? `<div class="row" style="margin-top:10px"><button class="btn danger" data-act="doseApagar" data-id="${esc(id)}">Apagar este registro</button></div>` : ""}`,
  { status: x.status, local: x.local || null, confirmado: false });
}
actions.doseNova = () => modalDose(null);
actions.doseEditar = el => modalDose(el.dataset.id);
actions.dsStatus = el => {
  modalState.status = el.dataset.v;
  el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false"));
  $("#ds-aplic").hidden = modalState.status !== "aplicada";
};
actions.dsLocal = el => {
  modalState.local = el.dataset.v;
  el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false"));
};
actions.doseSalvar = el => {
  const id = el.dataset.id || newId("d"), date = $("#ds-date").value, hora = lerHora("ds-hora"), st = modalState.status, mg = num($("#ds-mg").value);
  if (!date){ $("#ds-err").textContent = "Informe a data."; return; }
  if (st === "aplicada" && !(mg > 0 && mg <= 30)){ $("#ds-err").textContent = "Informe a dose em mg."; return; }
  // intervalo mínimo de 72 h: avisa, mas deixa registrar
  const av = st === "aplicada" && regrasTirzepatida() ? avisoIntervalo(date, hora, el.dataset.id) : null;
  if (av && !modalState.confirmado){
    const box = $("#ds-aviso"); box.classList.add("show");
    box.innerHTML = `Esta dose fica a <strong>${av.horas} h</strong> da anterior (${ddmm(av.anterior.date)}). A bula pede no mínimo 72 h entre duas doses. Confira com o seu médico. Se a data estiver certa, toque em Salvar de novo.`;
    modalState.confirmado = true; return;
  }
  const antes = S.doses[id] || {}, doseAnterior = num(S.saude.doseAtualMg);
  S.doses[id] = Object.assign({}, antes, { id, date, hora: hora || null, status: st, medicamento: antes.medicamento || S.saude.medicamento || null,
    doseMg: st === "aplicada" ? mg : null, local: st === "aplicada" ? modalState.local : null, obs: $("#ds-obs").value.trim() || null });
  flush("doses", id);
  // mudança de dose vira evento no gráfico (o app nunca sugere a mudança; só registra)
  const ultima = aplicadas().pop();
  if (st === "aplicada" && ultima && ultima.id === id && mg !== doseAnterior){
    if (doseAnterior > 0){ const eid = newId("e"); S.eventos[eid] = { id: eid, date, tipo: "mudanca_dose", descricao: "dose " + fmtNum(mg) + " mg" }; flush("eventos", eid); }
    S.saude.doseAtualMg = mg; flush("kv", "saude");
  }
  closeModal(); setStatus("Dose registrada"); render();
};
actions.doseApagar = el => {
  if (!confirm("Apagar este registro de dose?")) return;
  delete S.doses[el.dataset.id]; flush("doses", el.dataset.id); closeModal(); render();
};

/* ---------- registrar sintoma ---------- */
function sinaisHtml(tipo, marcados = {}){
  const ss = SINAIS[tipo]; if (!ss) return "";
  return `<div class="field"><span class="lab">Marque o que se aplica</span><div class="chips">${ss.map(([k, l]) => `<button type="button" class="chip" data-act="snSinal" data-v="${k}" aria-pressed="${!!marcados[k]}">${l}</button>`).join("")}</div></div>`;
}
function modalSintoma(id, tipoInicial){
  const x = id ? S.sintomas[id] : { date: ymd(new Date()), hora: horaAgora(), tipo: tipoInicial || null, intensidade: 3, sinais: {} };
  openModal(`<h3>${id ? "Editar sintoma" : "Registrar sintoma"}</h3>
    <div class="field"><span class="lab">O que você sentiu?</span><div class="chips">${TIPOS_SINTOMA.map(([k, l]) => `<button type="button" class="chip" data-act="snTipo" data-v="${k}" aria-pressed="${x.tipo === k}">${l}</button>`).join("")}</div></div>
    <div id="sn-sinais">${sinaisHtml(x.tipo, x.sinais)}</div>
    <div class="field"><span class="lab">Intensidade (0 a 10)</span><div class="rng"><input type="range" min="0" max="10" step="1" value="${x.intensidade != null ? x.intensidade : 3}" id="sn-int" aria-label="Intensidade de 0 a 10" oninput="this.nextElementSibling.textContent=this.value"><output>${x.intensidade != null ? x.intensidade : 3}</output></div></div>
    <div class="grid2">
      <div class="field"><label class="lab" for="sn-date">Data</label><input id="sn-date" class="txt" type="date" value="${esc(x.date)}"></div>
      <div class="field"><label class="lab" for="sn-hora-h">Hora</label>${horaCampoHtml("sn-hora", x.hora)}</div>
    </div>
    <div class="field"><label class="lab" for="sn-obs">Observação</label><input id="sn-obs" class="txt" type="text" value="${esc(x.obs || "")}"></div>
    <div class="err" id="sn-err"></div>
    <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn strength" data-act="sintomaSalvar" data-id="${esc(id || "")}">Salvar</button></div>
    ${id ? `<div class="row" style="margin-top:10px"><button class="btn danger" data-act="sintomaApagar" data-id="${esc(id)}">Apagar este registro</button></div>` : ""}`,
  { tipo: x.tipo, sinais: Object.assign({}, x.sinais || {}), fila: modalState.fila || null });
}
actions.sintomaNovo = () => modalSintoma(null);
actions.sintomaEditar = el => modalSintoma(el.dataset.id);
actions.snTipo = el => {
  modalState.tipo = el.dataset.v; modalState.sinais = {};
  el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false"));
  $("#sn-sinais").innerHTML = sinaisHtml(modalState.tipo);
};
actions.snSinal = el => {
  const k = el.dataset.v; modalState.sinais[k] = !modalState.sinais[k];
  if (!modalState.sinais[k]) delete modalState.sinais[k];
  el.setAttribute("aria-pressed", String(!!modalState.sinais[k]));
};
actions.sintomaSalvar = el => {
  const id = el.dataset.id || newId("y"), date = $("#sn-date").value;
  if (!modalState.tipo){ $("#sn-err").textContent = "Escolha o que você sentiu."; return; }
  if (!date){ $("#sn-err").textContent = "Informe a data."; return; }
  S.sintomas[id] = Object.assign({}, S.sintomas[id] || {}, { id, date, hora: lerHora("sn-hora"), tipo: modalState.tipo,
    intensidade: parseInt($("#sn-int").value, 10), sinais: modalState.sinais, obs: $("#sn-obs").value.trim() || null });
  flush("sintomas", id);
  const fila = modalState.fila;
  closeModal(); setStatus("Sintoma registrado");
  if (fila && fila.length){ const [prox, ...resto] = fila; modalState.fila = resto; modalSintoma(null, prox); return; }
  render();
};
actions.sintomaApagar = el => {
  if (!confirm("Apagar este registro de sintoma?")) return;
  delete S.sintomas[el.dataset.id]; flush("sintomas", el.dataset.id); closeModal(); render();
};

/* ---------- checklist semanal ---------- */
actions.checklistAbrir = () => openModal(`<h3>Checklist da semana</h3>
  <p class="small muted" style="margin-top:6px">Nos últimos 7 dias, você teve algum destes? Marque e depois conte um pouco mais de cada um.</p>
  <div class="chips" style="margin-top:12px">${CHECKLIST.map(([k, l]) => `<button type="button" class="chip" data-act="ckItem" data-v="${k}" aria-pressed="false">${l}</button>`).join("")}</div>
  <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn strength" data-act="ckSalvar">Concluir</button></div>`, { itens: [] });
actions.ckItem = el => {
  const k = el.dataset.v, i = modalState.itens.indexOf(k);
  if (i >= 0) modalState.itens.splice(i, 1); else modalState.itens.push(k);
  el.setAttribute("aria-pressed", String(i < 0));
};
actions.ckSalvar = () => {
  const itens = modalState.itens.slice();
  S.saude.ultimoChecklist = ymd(new Date()); flush("kv", "saude");
  closeModal();
  if (!itens.length){ setStatus("Checklist feito: nenhum sintoma"); render(); return; }
  // abre o registro de cada sintoma marcado, um depois do outro (dor abdominal e tontura pedem os sinais de alerta)
  const [prim, ...resto] = itens; modalState.fila = resto; modalSintoma(null, prim);
};

/* ---------- configuração ---------- */
actions.medConfig = () => {
  const sd = S.saude;
  openModal(`<h3>Configurar medicação</h3>
    <div class="field"><span class="lab">Medicamento</span><div class="chips">${MEDICAMENTOS.map(([k, l]) => `<button type="button" class="chip" data-act="cfMed" data-v="${k}" aria-pressed="${sd.medicamento === k}">${l}</button>`).join("")}</div>
      <div class="help">A curva estimada e as regras da bula (96 h e 72 h) valem só para a tirzepatida.</div></div>
    <div class="field"><span class="lab">Dia fixo da aplicação</span><div class="scale" style="--n:7">${[0, 1, 2, 3, 4, 5, 6].map(d => `<button type="button" data-act="cfDia" data-v="${d}" aria-pressed="${sd.diaFixo === d}">${DIAS[d].slice(0, 3)}</button>`).join("")}</div>
      <div class="help">Trocar o dia é permitido desde que fiquem pelo menos 72 h entre duas doses. O app ajusta a próxima data.</div></div>
    <div class="grid2">
      <div class="field"><label class="lab" for="cf-mg">Dose atual (mg)</label><input id="cf-mg" class="txt" type="text" inputmode="decimal" value="${sd.doseAtualMg != null ? esc(fmtNum(sd.doseAtualMg)) : ""}"></div>
      <div class="field"><label class="lab" for="cf-hora">Lembrete às</label><input id="cf-hora" class="txt" type="time" value="${esc(sd.horaLembrete || "08:00")}"></div>
    </div>
    <label class="small" style="display:flex;gap:10px;align-items:center;margin-top:14px"><input type="checkbox" id="cf-lem" ${sd.lembrete !== false ? "checked" : ""} style="width:22px;height:22px;accent-color:var(--strength)"> Lembrete no dia da dose (app Android)</label>
    <div class="help">A notificação não mostra o nome do remédio na tela de bloqueio.</div>
    <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn strength" data-act="cfSalvar">Salvar</button></div>`,
  { med: sd.medicamento || null, dia: sd.diaFixo != null ? sd.diaFixo : null });
};
actions.cfMed = el => { modalState.med = el.dataset.v; el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false")); };
actions.cfDia = el => { modalState.dia = +el.dataset.v; el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false")); };
actions.cfSalvar = () => {
  const mg = num($("#cf-mg").value);
  Object.assign(S.saude, { medicamento: modalState.med, diaFixo: modalState.dia, doseAtualMg: mg > 0 ? mg : S.saude.doseAtualMg, horaLembrete: $("#cf-hora").value || "08:00", lembrete: $("#cf-lem").checked });
  flush("kv", "saude"); closeModal(); setStatus("Medicação configurada"); render();
};
