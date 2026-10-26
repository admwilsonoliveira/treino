// Saúde → Suplementos: o que tomou hoje ("Tomei" num toque), últimos 7 dias, histórico e cadastro
// (pelo rótulo ou pelo código de barras). Também no "+" (Registrar → Suplemento).
import { S, flush, setStatus } from "../store.js";
import { ui, actions, changes, render, go, openModal, updateModal, closeModal, modalState, rerenderKeepScroll } from "../ui.js";
import { esc, num, fmtNum, ymd, ddmm, ddmmyyyy, newId, horaCampoHtml, lerHora, dataCampoHtml, lerData, $ } from "../util.js";
import { addDias, horaAgora } from "../medicacao.js";
import { buscarOFF } from "../codigobarras.js";
import { pedirCodigo } from "./alimentacao.js";
import { FORMAS, UNIDADES, COMPOSICAO, UI_POR_UG_VITD, suplementosList, usosList, usosDo, nomeSup, fmtDose, emUso, nutrientesDaDose, resumoPeriodo } from "../suplementos.js";

const hoje = () => ymd(new Date());
actions.goSuplementos = () => go("saude", "suplementos");

export function suplementosHtml(){
  const sups = suplementosList(), ativos = sups.filter(emUso), us = usosDo(hoje());
  let h = `<div class="between"><h2 style="margin-top:0">Suplementos</h2><button class="linkbtn" data-act="goSaude">‹ Saúde</button></div>`;
  h += `<div class="panel"><div class="small muted">Hoje, ${ddmm(hoje())}</div>${ativos.length ? `<ul class="hist">${ativos.map(s => {
      const feitos = us.filter(u => u.supId === s.id);
      return `<li><div><strong>${esc(s.nome)}</strong><div class="small muted">${esc(fmtDose(s.dose, s.unidade))}${feitos.length ? " · tomado às " + feitos.map(u => esc(u.hora || "–")).join(", ") : ""}</div></div>
        <div class="row" style="flex-wrap:nowrap;gap:6px"><button class="btn ${feitos.length ? "ghost" : "strength"} sm" data-act="supTomei" data-id="${esc(s.id)}">${feitos.length ? "+1" : "Tomei"}</button><button class="linkbtn" data-act="supUsoNovo" data-id="${esc(s.id)}" aria-label="Outro horário ou dose">…</button></div></li>`; }).join("")}</ul>`
    : `<p class="small muted" style="margin:6px 0 0">Cadastre os suplementos que você usa (creatina, whey, vitamina D...) para registrar com um toque.</p>`}
    <div class="row" style="margin-top:10px"><button class="btn ghost" data-act="supNovo">Cadastrar suplemento</button><button class="btn ghost" data-act="supScan">Escanear código</button></div></div>`;

  // últimos 7 dias
  const r7 = resumoPeriodo(addDias(hoje(), -6), hoje());
  if (r7.length) h += `<h2>Últimos 7 dias</h2><div class="panel"><table><thead><tr><th>Suplemento</th><th>Dias</th><th>Dose média</th><th>Horário</th></tr></thead><tbody>
    ${r7.map(r => `<tr><td>${esc(r.nome)}</td><td>${r.dias}/7</td><td>${esc(fmtDose(r.doseMedia, r.unidade))}</td><td>${esc(r.horario || "–")}</td></tr>`).join("")}</tbody></table></div>`;

  // histórico
  const hist = usosList().slice().reverse().slice(0, 20);
  if (hist.length) h += `<h2>Histórico</h2><div class="panel"><ul class="hist">${hist.map(u => `<li><div><strong>${ddmm(u.date)}</strong> <span class="small muted">${esc(u.hora || "")}</span><div class="small muted">${esc(u.nome)} · ${esc(fmtDose(u.dose, u.unidade))}</div></div>
    <button class="del" data-act="supUsoEditar" data-id="${esc(u.id)}">Editar</button></li>`).join("")}</ul></div>`;

  // cadastrados
  if (sups.length) h += `<h2>Cadastrados</h2><div class="panel"><ul class="hist">${sups.map(s => `<li><div><strong>${esc(nomeSup(s))}</strong><div class="small muted">${esc([(FORMAS.find(f => f[0] === s.forma) || [])[1], fmtDose(s.dose, s.unidade).trim(), s.lembrete && s.lembrete.ativo ? "lembrete " + s.lembrete.hora : "", emUso(s) ? "" : "parado"].filter(Boolean).join(" · "))}</div></div>
    <button class="del" data-act="supEditar" data-id="${esc(s.id)}">Editar</button></li>`).join("")}</ul></div>`;
  h += `<p class="small muted" style="margin-top:14px">O app só registra o que você toma: não sugere suplementos nem doses. Converse com o seu médico ou nutricionista sobre o que usar. O consumo vai para o relatório da semana, o relatório completo, o PDF do médico e o pacote para o coach.</p>`;
  return h;
}

/* ---------- consumo ---------- */
function gravarUso(s, { date = hoje(), hora = horaAgora(), dose = s.dose, id = null } = {}){
  const uid = id || newId("u");
  S.supUso[uid] = { id: uid, date, hora, supId: s.id, nome: s.nome, dose, unidade: s.unidade, n: nutrientesDaDose(s, dose) };
  flush("supUso", uid);
}
actions.supTomei = el => { const s = S.suplementos[el.dataset.id]; if (!s) return; gravarUso(s); setStatus(s.nome + " registrado às " + horaAgora()); rerenderKeepScroll(); };
function usoHtml(st){
  const sups = suplementosList(), s = S.suplementos[st.supId] || sups[0];
  return `<h3>${st.id ? "Editar registro" : "Registrar suplemento"}</h3>
    <div class="field"><label class="lab" for="su-sup">Suplemento</label><select id="su-sup" class="txt" data-act="suSup">${sups.map(x => `<option value="${esc(x.id)}" ${s && x.id === s.id ? "selected" : ""}>${esc(nomeSup(x))}</option>`).join("")}</select></div>
    <div class="field"><span class="lab">Data</span>${dataCampoHtml("su-data", st.date, 2020)}</div>
    <div class="grid2"><div class="field"><span class="lab">Horário</span>${horaCampoHtml("su-hora", st.hora)}</div>
      <div class="field"><label class="lab" for="su-dose">Dose (${esc(s ? s.unidade : "")})</label><input id="su-dose" class="txt" inputmode="decimal" value="${st.dose != null ? fmtNum(st.dose, 2) : s ? fmtNum(s.dose, 2) : ""}"></div></div>
    <div class="err" id="su-err"></div>
    <div class="row" style="margin-top:16px"><button class="btn ghost" data-act="closeModal">Cancelar</button><button class="btn strength" data-act="supUsoSalvar">Salvar</button></div>
    ${st.id ? `<div class="row" style="margin-top:10px"><button class="btn danger" data-act="supUsoApagar">Apagar este registro</button></div>` : ""}`;
}
export function abrirUso(supId){
  if (!suplementosList().length){ actions.supNovo(); return; }
  const st = { supId: supId || (suplementosList().find(x => emUso(x)) || suplementosList()[0]).id, date: hoje(), hora: horaAgora(), dose: null };
  openModal(usoHtml(st), st);
}
actions.supUsoNovo = el => abrirUso(el && el.dataset ? el.dataset.id : null);
actions.supRapido = () => abrirUso(null); // botão "+"
changes.suSup = el => { modalState.supId = el.value; modalState.dose = null; modalState.date = lerData("su-data") || modalState.date; modalState.hora = lerHora("su-hora") || modalState.hora; updateModal(usoHtml(modalState)); };
actions.supUsoEditar = el => { const u = S.supUso[el.dataset.id]; if (!u) return; openModal(usoHtml({ id: u.id, supId: u.supId, date: u.date, hora: u.hora, dose: u.dose }), { id: u.id, supId: u.supId, date: u.date, hora: u.hora, dose: u.dose }); };
actions.supUsoSalvar = () => {
  const s = S.suplementos[$("#su-sup").value], date = lerData("su-data"), hora = lerHora("su-hora"), dose = num($("#su-dose").value);
  if (!s){ $("#su-err").textContent = "Escolha o suplemento."; return; }
  if (!date || date > hoje()){ $("#su-err").textContent = "Confira a data (não pode ser no futuro)."; return; }
  if (!(dose > 0)){ $("#su-err").textContent = "Informe a dose."; return; }
  gravarUso(s, { date, hora: hora || "", dose, id: modalState.id || null }); closeModal(); setStatus("Suplemento registrado"); render();
};
actions.supUsoApagar = () => { if (!confirm("Apagar este registro?")) return; delete S.supUso[modalState.id]; flush("supUso", modalState.id); closeModal(); render(); };

/* ---------- cadastro ---------- */
function cadastroHtml(s, pre){
  const a = s || pre || {}, comp = a.comp || {}, lb = a.lembrete || { ativo: false, hora: "08:00" };
  const vComp = (k, un) => comp[k] == null ? "" : fmtNum(k === "vitD" ? comp[k] * UI_POR_UG_VITD : comp[k], 2);
  return `<h3>${s ? "Editar suplemento" : "Cadastrar suplemento"}</h3>
    ${pre && pre.aviso ? `<div class="infobox" style="margin-top:8px">${esc(pre.aviso)}</div>` : ""}
    <div class="grid2"><div class="field"><label class="lab" for="sp-nome">Nome *</label><input id="sp-nome" class="txt" maxlength="50" value="${esc(a.nome || "")}" placeholder="Creatina monohidratada"></div>
      <div class="field"><label class="lab" for="sp-marca">Marca</label><input id="sp-marca" class="txt" maxlength="40" value="${esc(a.marca || "")}"></div></div>
    <div class="field"><span class="lab">Forma</span><div class="chips">${FORMAS.map(([k, l]) => `<button type="button" class="chip" data-act="spForma" data-v="${k}" aria-pressed="${a.forma === k}">${l}</button>`).join("")}</div></div>
    <div class="grid2"><div class="field"><label class="lab" for="sp-dose">Dose padrão *</label><input id="sp-dose" class="txt" inputmode="decimal" value="${a.dose != null ? fmtNum(a.dose, 2) : ""}" placeholder="3"></div>
      <div class="field"><label class="lab" for="sp-un">Unidade</label><select id="sp-un" class="txt">${UNIDADES.map(u => `<option ${(a.unidade || "g") === u ? "selected" : ""}>${u}</option>`).join("")}</select></div></div>
    <details class="field" ${Object.keys(comp).length ? "open" : ""}><summary class="lab">Composição por dose (opcional, do rótulo)</summary>
      <div class="help">Entra nas vitaminas da semana numa linha separada, "com suplementos". Vitamina D em UI (o app converte).</div>
      <div class="grid2">${COMPOSICAO.map(([k, l, un]) => `<div class="field"><label class="lab" for="sp-${k}">${l} (${un})</label><input id="sp-${k}" class="txt" inputmode="decimal" value="${vComp(k, un)}"></div>`).join("")}</div></details>
    <div class="field"><span class="lab">Lembrete diário (app Android)</span><div class="row" style="align-items:center"><div class="yn"><button type="button" data-act="spLemb" data-v="1" aria-pressed="${!!lb.ativo}">Sim</button><button type="button" data-act="spLemb" data-v="0" aria-pressed="${!lb.ativo}">Não</button></div>${horaCampoHtml("sp-hora", lb.hora || "08:00")}</div></div>
    <div class="err" id="sp-err"></div>
    <div class="row" style="margin-top:16px"><button class="btn ghost" data-act="closeModal">Cancelar</button><button class="btn strength" data-act="supSalvar">Salvar</button></div>
    ${s ? `<div class="row" style="margin-top:10px"><button class="btn danger" data-act="supApagar">Apagar este suplemento</button></div>` : ""}`;
}
function abrirCadastro(s, pre = null){ const a = s || pre || {}; openModal(cadastroHtml(s, pre), { id: s ? s.id : null, forma: a.forma || null, lembrete: !!(a.lembrete && a.lembrete.ativo), ean: a.ean || null }); }
actions.supNovo = () => abrirCadastro(null);
actions.supEditar = el => abrirCadastro(S.suplementos[el.dataset.id]);
actions.spForma = el => { modalState.forma = el.dataset.v; el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === el))); };
actions.spLemb = el => { modalState.lembrete = el.dataset.v === "1"; el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === el))); };
actions.supSalvar = () => {
  const nome = $("#sp-nome").value.trim(), dose = num($("#sp-dose").value);
  if (!nome || !(dose > 0)){ $("#sp-err").textContent = "Informe o nome e a dose padrão."; return; }
  const id = modalState.id || newId("sp"), comp = {};
  COMPOSICAO.forEach(([k]) => { const v = num($("#sp-" + k).value); if (v != null) comp[k] = k === "vitD" ? v / UI_POR_UG_VITD : v; });
  S.suplementos[id] = { id, nome, marca: $("#sp-marca").value.trim(), forma: modalState.forma, dose, unidade: $("#sp-un").value, comp, ean: modalState.ean || undefined,
    lembrete: { ativo: !!modalState.lembrete, hora: lerHora("sp-hora") || "08:00" }, criado: (S.suplementos[id] || {}).criado || new Date().toISOString() };
  flush("suplementos", id); closeModal(); setStatus("Suplemento salvo"); render();
};
actions.supApagar = () => {
  if (!confirm("Apagar este suplemento? Os registros de consumo antigos continuam no histórico.")) return;
  delete S.suplementos[modalState.id]; flush("suplementos", modalState.id); closeModal(); render();
};
// código de barras: já cadastrado → registra; senão busca no Open Food Facts e abre o cadastro preenchido
actions.supScan = () => pedirCodigo(async ean => {
  const ja = suplementosList().find(s => s.ean === ean);
  if (ja){ closeModal(); abrirUso(ja.id); return; }
  setStatus("Buscando o produto…"); const r = await buscarOFF(ean); setStatus("");
  if (r.erro){ alert(r.erro); return; }
  const p = r.produto;
  if (!p){ abrirCadastro(null, { ean, aviso: `O código ${ean} não está no Open Food Facts. Preencha pelo rótulo; da próxima vez o app reconhece pelo código.` }); return; }
  // em pó ou líquido com porção: a composição por dose sai dos valores por 100 g
  const dose = p.porcaoG || null, comp = {};
  if (dose) COMPOSICAO.forEach(([k]) => { if (p[k] != null) comp[k] = p[k] * dose / 100; });
  abrirCadastro(null, { ean, nome: p.nome, marca: p.marca, dose, unidade: "g", forma: dose ? "po" : null, comp,
    aviso: "Encontrado no Open Food Facts. Confira nome, dose e composição com a embalagem: quem cadastra é a comunidade." });
});
