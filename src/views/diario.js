// Registro alimentar do dia (entrega 3b): refeições com itens (gramas ou medida caseira), água,
// metas com anéis e barras, refeições salvas, "repetir de ontem", recentes e o cartão do Hoje.
import { S, flush, setStatus } from "../store.js";
import { ui, actions, inputs, render, openModal, updateModal, closeModal, modalState } from "../ui.js";
import { esc, num, fmtNum, ymd, ddmm, newId, DIAS, horaCampoHtml, lerHora, $ } from "../util.js";
import { carregarBanco, bancoPronto, alimento, nomeCompleto, buscar, medidas, paraGramas } from "../alimentos.js";
import { TIPOS_REFEICAO, nomeTipo, tipoPelaHora, refeicoesDo, aguaDo, totalDia, proteinaDaRefeicao, metas, aguaTotal, refeicoesComProteina,
  alertasAlimentacao, diaDeDose, semanaProteinaTreino, alimentosRecentes, favoritosAutomaticos } from "../nutricao.js";
import { addDias, horaAgora } from "../medicacao.js";
import { PERIODOS_ALIM, baixarRelAlimentar } from "../relalimentar.js";
import { tdeeAdaptativo } from "../nutricao.js";
import { diagnostico } from "../diagnostico.js";

const hoje = () => ymd(new Date());
const kg = v => fmtNum(v, v >= 100 ? 0 : 1);
const litros = ml => fmtNum(ml / 1000, 1) + " L";
function anel(pct, cor, centro, sub){
  const r = 31, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return `<div class="anel"><svg width="78" height="78" viewBox="0 0 78 78" aria-hidden="true"><circle cx="39" cy="39" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="8"/>
    <circle cx="39" cy="39" r="${r}" fill="none" stroke="${cor}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 39 39)"/></svg>
    <div class="anel-v"><strong>${centro}</strong><span>${sub}</span></div></div>`;
}
function barra(rotulo, v, meta, un, tipo){
  // tipo "min": quanto mais melhor até a meta; "max": é limite (acima fica âmbar)
  const pct = meta ? Math.min(1.2, (v || 0) / meta) : 0, passou = tipo === "max" && (v || 0) > meta;
  return `<div class="barra-n"><div class="between small"><span>${rotulo}</span><span>${v != null ? kg(v) : "0"} ${un}${meta ? ` <span class="muted">/ ${tipo === "max" ? "até " : ""}${kg(meta)}</span>` : ""}</span></div>
    <div class="barra-t"><i style="width:${Math.min(100, pct * 100)}%;background:${passou ? "var(--walk)" : "var(--strength)"}"></i></div></div>`;
}

/* ---------- cartão do Hoje: anéis de proteína e água ---------- */
export function nutricaoCardHtml(){
  if (!(S.saude && S.saude.ativo)) return "";
  const d = hoje(), m = metas(), t = totalDia(d).t, prot = t.prot || 0, agua = aguaTotal(d), h = new Date().getHours();
  let falta = "";
  if (h >= 17 && prot < m.prot.alvo){
    // opções entre os favoritos e recentes com mais proteína por porção
    if (bancoPronto()){
      const ids = [...new Set(((S.saude.favAlimentos) || []).concat(alimentosRecentes(15)))];
      const ops = ids.map(alimento).filter(a => a && num(a.prot) > 0).map(a => { const md = medidas(a)[0] || { n: "100 g", g: 100 }; return { a, md, p: num(a.prot) * md.g / 100 }; })
        .filter(x => x.p >= 8).sort((x, y) => y.p - x.p).slice(0, 3);
      if (ops.length) falta = ` Opções: ${ops.map(x => `${esc(x.a.nome.split(",")[0])} (${esc(x.md.n)} ≈ ${fmtNum(x.p, 0)} g)`).join(", ")}.`;
    } else carregarBanco();
    falta = `<p class="small" style="margin:8px 0 0">Faltam <strong>${fmtNum(m.prot.alvo - prot, 0)} g</strong> de proteína para o alvo.${falta}</p>`;
  }
  return `<div class="panel" style="margin-top:12px"><div class="between"><div class="small muted">Alimentação de hoje</div><button class="linkbtn" data-act="goAlimentacao">Ver dia</button></div>
    <div class="aneis">${anel(prot / m.prot.alvo, prot >= m.prot.piso ? "var(--strength)" : "var(--walk)", fmtNum(prot, 0) + " g", "proteína")}
      ${anel(agua / m.agua, "var(--musculo)", litros(agua), "água")}
      <div class="small"><div>Proteína: piso ${m.prot.piso} · alvo ${m.prot.alvo} g</div><div class="muted">Água: meta ${litros(m.agua)}</div>
        <div class="agua-btns"><button class="btn ghost sm" data-act="aguaMais" data-v="200">+200</button><button class="btn ghost sm" data-act="aguaMais" data-v="300">+300</button><button class="btn ghost sm" data-act="aguaMais" data-v="500">+500</button></div></div></div>
    ${falta}${diaDeDose() ? `<p class="small" style="margin:8px 0 0;color:var(--walk)">Dia da dose (ou o seguinte): prefira refeições menores e com menos gordura, o risco de náusea é maior.</p>` : ""}
    <div class="row" style="margin-top:10px"><button class="btn strength" data-act="refNova">Registrar refeição</button></div></div>`;
}
export const alertasAlimentacaoHtml = () => alertasAlimentacao();

/* ---------- tela do dia (topo da Alimentação) ---------- */
export function diarioHtml(){
  if (favoritosAutomaticos()) flush("kv", "saude");
  const d = ui.diaAlim || hoje(), m = metas(), tot = totalDia(d), t = tot.t, agua = aguaTotal(d), refs = refeicoesDo(d);
  const dn = new Date(d + "T12:00:00"), titulo = d === hoje() ? "Hoje" : d === addDias(hoje(), -1) ? "Ontem" : `${DIAS[dn.getDay()]}, ${ddmm(d)}`;
  const prot = t.prot || 0, cheio = prot >= m.prot.alvo, acima = prot > m.prot.teto;
  let h = `<div class="panel"><div class="between"><button class="btn ghost sm" data-act="diaAlim" data-v="-1" aria-label="Dia anterior">‹</button><strong>${titulo}</strong><button class="btn ghost sm" data-act="diaAlim" data-v="1" aria-label="Próximo dia" ${d >= hoje() ? "disabled" : ""}>›</button></div>
    <div class="aneis" style="margin-top:10px">${anel(prot / m.prot.alvo, prot >= m.prot.piso ? "var(--strength)" : "var(--walk)", fmtNum(prot, 0) + " g", "proteína")}${anel(agua / m.agua, "var(--musculo)", litros(agua), "água")}
      <div class="small"><div>Piso ${m.prot.piso} · alvo ${m.prot.alvo} · teto ${m.prot.teto} g</div><div class="muted">${refeicoesComProteina(d)} de ${m.refeicoesComProt} refeições com 30 g ou mais</div>
        <div class="agua-btns"><button class="btn ghost sm" data-act="aguaMais" data-v="200">+200</button><button class="btn ghost sm" data-act="aguaMais" data-v="300">+300</button><button class="btn ghost sm" data-act="aguaMais" data-v="500">+500</button></div></div></div>
    ${acima ? `<p class="small" style="margin:8px 0 0;color:var(--walk)">Proteína já alta hoje: priorize fibras e vegetais.</p>` : cheio ? `<p class="small" style="margin:8px 0 0;color:var(--sucesso)">Alvo de proteína atingido.</p>` : ""}
    ${barra("Fibra", t.fibra, m.fibra[0], "g", "min")}${barra("Açúcar adicionado (rótulos)", t.acucarAd, m.acucarAd, "g", "max")}${barra("Sódio", t.sodio, m.sodio, "mg", "max")}
    <div class="small muted" style="margin-top:8px">Energia: <strong style="color:var(--ink)">${fmtNum(t.kcal || 0, 0)} kcal</strong> (informação, sem meta) · carboidratos ${fmtNum(t.carb || 0, 0)} g · gorduras ${fmtNum(t.gord || 0, 0)} g</div>
    ${aguaDo(d).length ? `<button class="linkbtn" data-act="aguaDesfazer">Desfazer última água (${fmtNum(aguaDo(d).slice(-1)[0].ml, 0)} ml)</button>` : ""}</div>`;
  h += `<div class="between"><h2>Refeições</h2><button class="linkbtn" data-act="metasAlim">Metas</button></div>`;
  if (!refs.length) h += `<div class="panel"><p class="empty" style="padding:6px 0">Nenhuma refeição registrada neste dia.</p></div>`;
  refs.forEach(r => {
    const p = proteinaDaRefeicao(r), kc = (r.itens || []).reduce((s, it) => s + (num((it.n || {}).kcal) || 0), 0);
    h += `<button class="panel ref-card" data-act="refEditar" data-id="${esc(r.id)}"><div class="between"><strong>${esc(nomeTipo(r.tipo))}</strong><span class="small muted">${esc(r.hora || "")}</span></div>
      <div class="small muted">${(r.itens || []).map(it => esc(it.nome.split(",")[0]) + " " + esc(it.medida || fmtNum(it.g, 0) + " g")).join(" · ") || "sem itens"}</div>
      <div class="small" style="margin-top:4px"><strong style="color:${p >= 30 ? "var(--sucesso)" : "var(--ink)"}">${fmtNum(p, 0)} g proteína</strong> · ${fmtNum(kc, 0)} kcal</div></button>`;
  });
  h += `<div class="row" style="margin-top:10px"><button class="btn strength" data-act="refNova">Registrar refeição</button><button class="btn ghost" data-act="relAlimAbrir">Exportar relatório</button></div>
    <button class="panel hub" data-act="goVitaminas" style="margin-top:12px"><div><strong>Vitaminas da semana</strong><div class="small muted">Análise dos 8 nutrientes-alvo e alimentos que ajudam</div></div><span aria-hidden="true">›</span></button>`;
  // proteína × treino de força na semana
  const s = semanaProteinaTreino();
  h += `<h2>Semana: proteína × treino</h2><div class="panel"><div class="stats" style="margin-top:0;grid-template-columns:1fr 1fr">
    <div class="stat"><div class="v">${s.diasNoPiso}/${s.diasRegistrados || 0}</div><div class="l">dias registrados com proteína ≥ ${m.prot.piso} g</div></div>
    <div class="stat"><div class="v">${s.sessoesForca}/3</div><div class="l">sessões de força na semana</div></div></div>
    <p class="small muted" style="margin:8px 0 0">Proteína sem treino de força não basta para preservar o músculo, e vice-versa (consenso de 2025 sobre GLP-1).</p></div>`;
  h += tdeeHtml();
  return h;
}
// gasto calórico real (pelo que você comeu e pelo que a balança mostrou) ao lado das estimativas por fórmula
function tdeeHtml(){
  const t = tdeeAdaptativo(), dg = diagnostico() || {};
  let h = `<h2>Gasto calórico real</h2><div class="panel">`;
  if (t.ok){
    h += `<div class="stat-num" style="font-size:32px">${fmtNum(t.tdee, 0)}<span class="small muted" style="font-weight:600;letter-spacing:0"> kcal/dia</span></div>
      <p class="small" style="margin:6px 0 0">Nos últimos ${t.dias} dias você comeu em média <strong>${fmtNum(t.ingestao, 0)} kcal</strong> (${t.registrados} dias registrados) e a tendência do peso variou <strong>${t.dPeso > 0 ? "+" : t.dPeso < 0 ? "−" : ""}${fmtNum(Math.abs(t.dPeso), 1)} kg</strong>.</p>`;
  } else h += `<p class="small" style="margin:0">Registre mais dias para estimar seu gasto real: é preciso registrar a alimentação em pelo menos 80% dos dias de uma janela de 3 a 4 semanas, com pesagens no começo e no fim (agora: ${t.registrados} dos últimos 28 dias).</p>`;
  const fx = [dg.gastoDia ? `pela fórmula e o plano: ${fmtNum(dg.gastoDia, 0)} kcal` : null, dg.gastoReal ? `pela fórmula e os treinos feitos: ${fmtNum(dg.gastoReal, 0)} kcal` : null].filter(Boolean);
  if (fx.length) h += `<p class="small muted" style="margin:8px 0 0">Estimativas do app ${fx.join(" · ")}.</p>`;
  return h + `<p class="small muted" style="margin:8px 0 0">Só informação: não é meta de calorias. Leve ao seu médico ou nutricionista.</p></div>`;
}
actions.diaAlim = el => { const d = addDias(ui.diaAlim || hoje(), +el.dataset.v); ui.diaAlim = d > hoje() ? hoje() : d; render(); };
actions.aguaMais = el => {
  const id = newId("w"), d = ui.tab === "saude" && ui.sub === "alimentacao" ? (ui.diaAlim || hoje()) : hoje();
  S.agua[id] = { id, date: d, hora: horaAgora(), ml: +el.dataset.v }; flush("agua", id);
  setStatus("+" + el.dataset.v + " ml de água"); render();
};
actions.aguaDesfazer = () => { const u = aguaDo(ui.diaAlim || hoje()).slice(-1)[0]; if (!u) return; delete S.agua[u.id]; flush("agua", u.id); render(); };

/* ---------- relatório da alimentação (médico ou IA) ---------- */
actions.relAlimAbrir = () => openModal(`<h3>Relatório da alimentação</h3>
  <p class="small muted" style="margin-top:6px">Tudo o que foi registrado dia a dia (horários, alimentos, quantidades e valores), o acumulado por semana e as médias de vitaminas e minerais.</p>
  <div class="toggle" role="group" style="margin:12px 0">${PERIODOS_ALIM.map(([k, l]) => `<button type="button" data-act="relAlimPer" data-v="${k}" aria-pressed="${k === "7"}">${l}</button>`).join("")}</div>
  <div class="row"><button class="btn strength" data-act="relAlimBaixar" data-v="pdf">Para o médico (PDF)</button><button class="btn ghost" data-act="relAlimBaixar" data-v="md">Para a IA (Markdown)</button></div>
  <p class="small muted" style="margin:10px 0 0">Contém dados de saúde: envie só para quem você confia.</p>
  <div class="row" style="margin-top:10px"><button class="btn ghost block" data-act="closeModal">Fechar</button></div>`, { per: "7" });
actions.relAlimPer = el => { modalState.per = el.dataset.v; el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false")); };
actions.relAlimBaixar = async el => {
  el.disabled = true; setStatus("Gerando relatório…");
  try{ await carregarBanco(); await baixarRelAlimentar(modalState.per, el.dataset.v); setStatus("Relatório gerado"); }
  catch(e){ setStatus(""); alert("Não foi possível gerar o relatório: " + (e.message || e)); }
  finally{ el.disabled = false; }
};

/* ---------- metas ---------- */
actions.metasAlim = () => {
  const m = metas();
  openModal(`<h3>Metas da alimentação</h3>
    <p class="small muted" style="margin-top:6px">${m.personalizada ? "Metas definidas por você." : "Padrão calculado pelo seu peso (1,2 / 1,4 / 1,6 g de proteína por kg). Ajuste com o que combinou com o seu médico ou nutricionista."}</p>
    <div class="grid2">${[["piso", "Proteína: piso (g)"], ["alvo", "Proteína: alvo (g)"], ["teto", "Proteína: teto (g)"]].map(([k, l]) => `<div class="field"><label class="lab" for="mt-${k}">${l}</label><input id="mt-${k}" class="txt" type="text" inputmode="numeric" value="${m.prot[k]}"></div>`).join("")}
    <div class="field"><label class="lab" for="mt-agua">Água (ml por kg)</label><input id="mt-agua" class="txt" type="text" inputmode="numeric" value="${m.aguaMlKg}"></div></div>
    <p class="small muted">Fibra 25 a 38 g, açúcar adicionado abaixo de 25 g e sódio abaixo de 2.300 mg ficam fixos. Calorias aparecem só como informação.</p>
    <div class="err" id="mt-err"></div>
    <div class="row" style="margin-top:16px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn strength" data-act="metasSalvar">Salvar</button></div>`);
};
actions.metasSalvar = () => {
  const p = { piso: num($("#mt-piso").value), alvo: num($("#mt-alvo").value), teto: num($("#mt-teto").value) }, a = num($("#mt-agua").value);
  if (!(p.piso > 0 && p.alvo >= p.piso && p.teto >= p.alvo)){ $("#mt-err").textContent = "Use piso ≤ alvo ≤ teto."; return; }
  S.saude.metasAlimentares = { proteina: p, aguaMlKg: a >= 20 && a <= 60 ? a : 35 }; flush("kv", "saude"); closeModal(); render();
};

/* ---------- editor de refeição ---------- */
function novoItem(a, g, medida){ return { alimentoId: a.id, nome: nomeCompleto(a), g, medida: medida || null, f: a.f, n: Object.fromEntries(Object.entries(paraGramas(a, g)).filter(([, v]) => v != null)) }; }
actions.refNova = async () => {
  await carregarBanco();
  const d = ui.tab === "saude" && ui.sub === "alimentacao" ? (ui.diaAlim || hoje()) : hoje(), hora = horaAgora();
  openModal(`<div></div>`, { id: null, date: d, hora, tipo: tipoPelaHora(hora), itens: [], fome: null, saciedade: null, obs: "" }); telaEditor();
};
actions.refEditar = async el => {
  await carregarBanco();
  const r = S.refeicoes[el.dataset.id]; if (!r) return;
  openModal(`<div></div>`, JSON.parse(JSON.stringify(Object.assign({ fome: null, saciedade: null, obs: "" }, r)))); telaEditor();
};
function telaEditor(){
  const st = modalState, p = st.itens.reduce((s, it) => s + (num(it.n.prot) || 0), 0), kc = st.itens.reduce((s, it) => s + (num(it.n.kcal) || 0), 0);
  const ontem = refeicoesDo(addDias(st.date, -1)).filter(r => r.tipo === st.tipo);
  const salvas = Object.values(S.refSalvas || {});
  updateModal(`<div class="between"><h3>${st.id ? "Editar refeição" : "Registrar refeição"}</h3><button class="linkbtn" data-act="refFechar">Fechar</button></div>
    <div class="chips" style="margin-top:8px">${TIPOS_REFEICAO.map(([k, l]) => `<button type="button" class="chip" data-act="refTipo" data-v="${k}" aria-pressed="${st.tipo === k}">${l}</button>`).join("")}</div>
    <div class="grid2"><div class="field"><label class="lab" for="rf-date">Data</label><input id="rf-date" class="txt" type="date" max="${hoje()}" value="${st.date}"></div>
      <div class="field"><label class="lab" for="rf-hora-h">Hora</label>${horaCampoHtml("rf-hora", st.hora)}</div></div>
    <div class="field"><span class="lab">Itens</span>${st.itens.length ? `<ul class="hist">${st.itens.map((it, i) => `<li><div><strong>${esc(it.nome)}</strong><div class="small muted">${esc(it.medida || fmtNum(it.g, 0) + " g")} · ${fmtNum(num(it.n.prot) || 0, 1)} g prot. · ${fmtNum(num(it.n.kcal) || 0, 0)} kcal</div></div><button class="del" data-act="refItemDel" data-i="${i}">Tirar</button></li>`).join("")}</ul>
      <div class="small" style="margin-top:4px"><strong>Total: ${fmtNum(p, 0)} g de proteína · ${fmtNum(kc, 0)} kcal</strong></div>` : `<p class="small muted" style="margin:0">Nenhum item ainda.</p>`}
      <div class="row" style="margin-top:8px"><button class="btn strength" data-act="refAddItem">+ Alimento</button>${salvas.length ? `<button class="btn ghost" data-act="refUsarSalva">Refeição salva</button>` : ""}${ontem.length && !st.id ? `<button class="btn ghost" data-act="refRepetirOntem">Repetir de ontem</button>` : ""}</div></div>
    <details class="field"><summary class="lab">Fome antes e saciedade depois (opcional)</summary>
      <div class="field"><span class="lab small">Fome antes (0 a 10)</span><div class="rng"><input type="range" min="0" max="10" value="${st.fome ?? 5}" id="rf-fome" oninput="this.nextElementSibling.textContent=this.value"><output>${st.fome ?? "–"}</output></div></div>
      <div class="field"><span class="lab small">Saciedade depois (0 a 10)</span><div class="rng"><input type="range" min="0" max="10" value="${st.saciedade ?? 5}" id="rf-sac" oninput="this.nextElementSibling.textContent=this.value"><output>${st.saciedade ?? "–"}</output></div></div></details>
    <label class="small" style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="rf-salvar" style="width:20px;height:20px;accent-color:var(--strength)"> Guardar como refeição salva</label>
    <input id="rf-salvar-nome" class="txt" type="text" maxlength="40" placeholder="Nome (ex.: Café padrão)" style="margin-top:6px">
    <div class="err" id="rf-err"></div>
    <div class="row" style="margin-top:14px"><button class="btn strength" data-act="refSalvar">Salvar</button></div>
    ${st.id ? `<div class="row" style="margin-top:10px"><button class="btn danger" data-act="refApagar">Apagar esta refeição</button></div>` : ""}`);
}
// guarda o que foi digitado antes de trocar de tela dentro do modal
function lerCampos(){
  const st = modalState, d = $("#rf-date"); if (!d) return;
  st.date = d.value || st.date; st.hora = lerHora("rf-hora") || st.hora;
  const f = $("#rf-fome"), s = $("#rf-sac");
  if (f && f.nextElementSibling.textContent !== "–") st.fome = +f.value;
  if (s && s.nextElementSibling.textContent !== "–") st.saciedade = +s.value;
}
actions.refTipo = el => { lerCampos(); modalState.tipo = el.dataset.v; telaEditor(); };
actions.refItemDel = el => { lerCampos(); modalState.itens.splice(+el.dataset.i, 1); telaEditor(); };
actions.refFechar = () => { if (!modalState.itens.length || modalState.id || confirm("Descartar esta refeição?")) closeModal(); };
actions.refRepetirOntem = () => { lerCampos(); refeicoesDo(addDias(modalState.date, -1)).filter(r => r.tipo === modalState.tipo).forEach(r => r.itens.forEach(it => modalState.itens.push(JSON.parse(JSON.stringify(it))))); telaEditor(); };
actions.refUsarSalva = () => {
  lerCampos();
  updateModal(`<h3>Refeições salvas</h3><ul class="hist">${Object.values(S.refSalvas).map(s => `<li><button class="linkbtn al-item" data-act="refSalvaAplicar" data-id="${esc(s.id)}"><span>${esc(s.nome)}</span><span class="small muted">${s.itens.map(i => esc(i.nome.split(",")[0])).join(" · ")}</span></button><button class="del" data-act="refSalvaApagar" data-id="${esc(s.id)}">Apagar</button></li>`).join("")}</ul>
    <div class="row" style="margin-top:12px"><button class="btn ghost block" data-act="refVoltar">Voltar</button></div>`);
};
actions.refSalvaAplicar = el => {
  const s = S.refSalvas[el.dataset.id];
  // recalcula pelos valores atuais do alimento (se ainda existir)
  s.itens.forEach(it => { const a = alimento(it.alimentoId); modalState.itens.push(a ? novoItem(a, it.g, it.medida) : JSON.parse(JSON.stringify(it))); });
  telaEditor();
};
actions.refSalvaApagar = el => { if (!confirm("Apagar esta refeição salva?")) return; delete S.refSalvas[el.dataset.id]; flush("refSalvas", el.dataset.id); actions.refUsarSalva(); };
actions.refVoltar = () => telaEditor();

// escolher um alimento: recentes e favoritos primeiro, depois a busca
actions.refAddItem = () => { lerCampos(); modalState.q = ""; telaBusca(); };
function listaAlimentos(q){
  const ids = q ? buscar(q, 25) : [...new Set(alimentosRecentes(10).concat((S.saude.favAlimentos || [])))].map(alimento).filter(Boolean);
  if (!ids.length) return `<p class="small muted">${q ? "Nada encontrado." : "Digite para buscar. Os alimentos que você usar vão aparecer aqui."}</p>`;
  return `<ul class="hist">${ids.map(a => `<li><button class="linkbtn al-item" data-act="refEscolher" data-id="${esc(a.id)}"><span>${esc(nomeCompleto(a))}</span><span class="small muted">${a.prot != null ? fmtNum(a.prot, 1) + " g prot./100 g" : ""}</span></button></li>`).join("")}</ul>`;
}
function telaBusca(){
  updateModal(`<div class="between"><h3>Adicionar alimento</h3><button class="linkbtn" data-act="refVoltar">Voltar</button></div>
    <input class="txt" id="rf-q" type="search" placeholder="Buscar (ex.: arroz, ovo, whey)" data-act="refBusca" value="${esc(modalState.q || "")}" autocomplete="off" style="margin-top:8px">
    <div class="small muted" style="margin-top:8px">${modalState.q ? "" : "Recentes e favoritos"}</div><div id="rf-res">${listaAlimentos(modalState.q)}</div>
    <p class="small muted" style="margin:8px 0 0">Não achou um industrializado? Cadastre pelo rótulo em Saúde → Alimentação → Meus alimentos.</p>`);
  const i = $("#rf-q"); if (i) i.focus();
}
inputs.refBusca = el => { modalState.q = el.value; const r = $("#rf-res"); if (r) r.innerHTML = listaAlimentos(el.value); };
actions.refEscolher = el => { modalState.escolha = { id: el.dataset.id, g: null, medida: null }; const a = alimento(el.dataset.id), m = medidas(a)[0]; modalState.escolha.g = m ? m.g : 100; modalState.escolha.medida = m ? m.n : null; telaQtd(); };
function telaQtd(){
  const e = modalState.escolha, a = alimento(e.id), ms = medidas(a), v = paraGramas(a, e.g);
  updateModal(`<div class="between"><h3>${esc(nomeCompleto(a))}</h3><button class="linkbtn" data-act="refAddItem">Voltar</button></div>
    <div class="field"><span class="lab">Quanto?</span><div class="chips">${ms.map((m, i) => `<button type="button" class="chip" data-act="refMed" data-i="${i}" aria-pressed="${e.medida === m.n}">${esc(m.n)} (${fmtNum(m.g)} g)</button>`).join("")}</div>
      <div class="rng" style="margin-top:8px"><input class="txt" id="rf-g" type="text" inputmode="decimal" value="${fmtNum(e.g)}" data-act="refG" style="max-width:120px"><span>gramas</span></div>
      ${e.medida ? `<div class="grid2" style="margin-top:6px"><span class="small muted">Quantas?</span><div class="row" style="gap:6px">${[0.5, 1, 1.5, 2, 3].map(x => `<button type="button" class="chip" data-act="refMult" data-v="${x}">${fmtNum(x, 1)}×</button>`).join("")}</div></div>` : ""}</div>
    <div class="small" id="rf-prev">${prevHtml(v)}</div>
    <div class="row" style="margin-top:14px"><button class="btn strength" data-act="refItemOk">Adicionar</button></div>`);
}
const prevHtml = v => `<strong>${fmtNum(v.prot || 0, 1)} g de proteína</strong> · ${fmtNum(v.kcal || 0, 0)} kcal · fibra ${v.fibra != null ? fmtNum(v.fibra, 1) + " g" : "sem dado"}`;
actions.refMed = el => { const a = alimento(modalState.escolha.id), m = medidas(a)[+el.dataset.i]; Object.assign(modalState.escolha, { g: m.g, medida: m.n, base: m }); telaQtd(); };
actions.refMult = el => {
  const e = modalState.escolha, a = alimento(e.id), base = e.base || medidas(a).find(m => m.n === e.medida) || medidas(a)[0]; if (!base) return;
  const x = +el.dataset.v; e.base = base; e.g = base.g * x; e.medida = (x === 1 ? "" : fmtNum(x, 1) + "× ") + base.n; telaQtd();
};
inputs.refG = el => { const g = num(el.value); if (g > 0 && g < 5000){ const e = modalState.escolha; e.g = g; e.medida = null; const p = $("#rf-prev"); if (p) p.innerHTML = prevHtml(paraGramas(alimento(e.id), g)); } };
actions.refItemOk = () => { const e = modalState.escolha, a = alimento(e.id); modalState.itens.push(novoItem(a, e.g, e.medida)); modalState.escolha = null; telaEditor(); };

actions.refSalvar = () => {
  lerCampos();
  const st = modalState;
  if (!st.itens.length){ $("#rf-err").textContent = "Adicione pelo menos um alimento."; return; }
  if (!st.date || st.date > hoje()){ $("#rf-err").textContent = "Confira a data."; return; }
  const id = st.id || newId("r");
  S.refeicoes[id] = { id, date: st.date, hora: st.hora, tipo: st.tipo, itens: st.itens, fome: st.fome, saciedade: st.saciedade, obs: st.obs || null };
  flush("refeicoes", id);
  if ($("#rf-salvar") && $("#rf-salvar").checked){
    const sid = newId("s"), nome = ($("#rf-salvar-nome").value || "").trim() || nomeTipo(st.tipo);
    S.refSalvas[sid] = { id: sid, nome, itens: st.itens.map(it => ({ alimentoId: it.alimentoId, nome: it.nome, g: it.g, medida: it.medida, n: it.n })) }; flush("refSalvas", sid);
  }
  closeModal(); setStatus("Refeição salva"); render();
};
actions.refApagar = () => { if (!confirm("Apagar esta refeição?")) return; delete S.refeicoes[modalState.id]; flush("refeicoes", modalState.id); closeModal(); render(); };
