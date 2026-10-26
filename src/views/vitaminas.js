// Saúde → Vitaminas da semana: os 8 nutrientes-alvo, o selo do exame, as sugestões de alimentos
// (com "não quero") e as preferências alimentares. Nunca sugere suplemento.
import { S, flush, setStatus } from "../store.js";
import { ui, actions, render, openModal, updateModal, closeModal, modalState } from "../ui.js";
import { esc, fmtNum, ymd, ddmm, ddmmyyyy, mondayOf, $ } from "../util.js";
import { addDias } from "../medicacao.js";
import { refeicoesDo, totaisDe } from "../nutricao.js";
import { carregarBanco, bancoPronto, itensBanco, alimento, nomeCompleto } from "../alimentos.js";
import { analise, sugestoesDaSemana, guardarSemana, prefs, MIN_DIAS } from "../vitaminas.js";
import { mediaSuplementos } from "../suplementos.js";

const COR = { baixo: "var(--danger)", atencao: "var(--walk)", ok: "var(--sucesso)" };
const ROT = { baixo: "baixo", atencao: "atenção", ok: "ok" };
const fmtV = (v, un) => un === "dias" ? fmtNum(v, 1) + " dias/semana" : fmtNum(v, v >= 100 ? 0 : 1) + " " + un;
actions.goVitaminas = () => { ui.tab = "saude"; ui.sub = "vitaminas"; render(); window.scrollTo(0, 0); };
const semanaAtual = () => ymd(mondayOf(new Date()));

/* ---------- cartão do Hoje (uma vez por semana, se houver nutriente baixo) ---------- */
export function vitaminasCardHtml(){
  if (!(S.saude && S.saude.ativo) || !Object.keys(S.refeicoes || {}).length) return "";
  if (!bancoPronto()){ carregarBanco(); return ""; }
  if ((S.saude.vitVistoSemana || "") === semanaAtual()) return "";
  const r = analise(); if (!r.ok) return "";
  // no máximo 3: os ligados a exame primeiro, depois os mais baixos
  const baixos = r.itens.filter(x => x.classe === "baixo").sort((a, b) => (b.exame ? 1 : 0) - (a.exame ? 1 : 0) || a.pct - b.pct).slice(0, 3);
  if (!baixos.length) return "";
  return `<div class="panel aviso" style="margin-top:12px"><strong>Vitaminas da semana</strong>
    <p class="small" style="margin:4px 0 0">${baixos.map(x => `${esc(x.nome)} ${fmtNum(x.pct, 0)}%${x.exame ? " (seu exame também)" : ""}`).join(" · ")}. Veja alimentos que ajudam.</p>
    <div class="row" style="margin-top:10px"><button class="btn strength" data-act="goVitaminas">Ver sugestões</button><button class="btn ghost" data-act="vitVisto">Depois</button></div></div>`;
}
actions.vitVisto = () => { S.saude.vitVistoSemana = semanaAtual(); flush("kv", "saude"); render(); };

/* ---------- tela ---------- */
export function vitaminasHtml(){
  let h = `<div class="between"><h2 style="margin-top:0">Vitaminas da semana</h2><button class="linkbtn" data-act="goSaude">‹ Saúde</button></div>`;
  if (!bancoPronto()){ carregarBanco().then(render); return h + `<div class="loading">Carregando…</div>`; }
  const r = analise();
  if (guardarSemana(r)) flush("kv", "saude");
  if (!r.ok) return h + `<div class="panel"><p class="small" style="margin:0">Registre mais dias para a análise: são precisos pelo menos ${MIN_DIAS} dias com refeições nos últimos 7 (agora: ${r.dias}).</p>
    <button class="btn strength" data-act="goAlimentacao" style="margin-top:10px">Ir para a Alimentação</button></div>` + prefsBotao();
  const sup = mediaSuplementos(r.fim); // média diária vinda dos suplementos registrados (linha separada)
  h += `<div class="panel"><div class="small muted" style="margin-bottom:6px">Média dos últimos ${r.dias} dias com registro (só comida)</div>
    ${r.itens.map(x => `<div class="vit-linha"><div class="between small"><span><strong>${esc(x.nome)}</strong>${x.exame ? ` <span class="selo-exame">seu exame também</span>` : ""}</span>
      <span>${fmtV(x.media, x.un)} <span class="muted">/ ${fmtV(x.meta, x.un)}</span> <strong style="color:${COR[x.classe] || "var(--ink-2)"}">${x.pct != null ? fmtNum(x.pct, 0) + "%" : ""}</strong></span></div>
      <div class="barra-t"><i style="width:${Math.min(100, x.pct || 0)}%;background:${COR[x.classe] || "var(--ink-2)"}"></i></div>
      ${sup[x.k] > 0 && x.un !== "dias" && x.meta ? `<div class="small" style="margin-top:2px">Com suplementos: ${fmtV(x.media + sup[x.k], x.un)} <strong>${fmtNum((x.media + sup[x.k]) / x.meta * 100, 0)}%</strong></div>` : ""}
      ${x.cob < 70 && x.un !== "dias" ? `<div class="small muted">Só ${x.cob}% do que você comeu tinha dado deste nutriente: o valor real provavelmente é maior.</div>` : ""}</div>`).join("")}
    <p class="small muted" style="margin:10px 0 0">Abaixo de 70% = baixo · 70 a 99% = atenção · 100% ou mais = ok. Metas diárias (DRI, homens de 31 a 50 anos).</p></div>`;
  const sug = sugestoesDaSemana(r);
  if (!sug.length) h += `<div class="panel" style="margin-top:12px"><p class="small" style="margin:0">Nenhum nutriente-alvo baixo nesta semana. Continue assim.</p></div>`;
  sug.forEach(s => {
    const x = s.item;
    h += `<div class="panel" style="margin-top:12px"><strong>${esc(x.nome)}: ${fmtNum(x.pct, 0)}% da meta</strong>${x.exame ? `<div class="small" style="margin-top:2px">Seu exame de ${ddmmyyyy(x.exame.date)} também mostrou isso.</div>` : ""}
      <p class="small" style="margin:6px 0 4px">Para equilibrar:</p>
      ${s.alimentos.length ? `<ul class="hist">${s.alimentos.map(a => `<li><div><strong>${esc(nomeCompleto(a.a))}</strong><div class="small muted">${esc(a.md.n)} ≈ ${fmtV(a.v, x.k === "omega3" ? "g" : x.un)}${x.k === "omega3" ? " de gordura boa" : ""}${a.prot >= 5 ? ` · ${fmtNum(a.prot, 0)} g de proteína` : ""}</div></div><button class="del" data-act="vitNaoQuero" data-id="${esc(a.a.id)}">Não quero</button></li>`).join("")}</ul>`
        : `<p class="small muted">Sem sugestões que combinem com as suas preferências.</p>`}
      ${s.experimentar ? `<p class="small" style="margin:8px 0 0">Para experimentar (opcional): <strong>${esc(nomeCompleto(s.experimentar.a))}</strong> (${esc(s.experimentar.md.n)}). <button class="linkbtn" data-act="vitNaoQuero" data-id="${esc(s.experimentar.a.id)}" data-exp="1">Não quero</button></p>` : ""}
      ${s.notas.map(n => `<p class="small" style="margin:8px 0 0;color:var(--walk)">${esc(n)}</p>`).join("")}</div>`;
  });
  if (sug.some(s => s.experimentar) && (S.saude.experimentarMes || "") !== ymd(new Date()).slice(0, 7)){ S.saude.experimentarMes = ymd(new Date()).slice(0, 7); flush("kv", "saude"); }
  h += mapaHtml() + avancadoHtml(r);
  h += `<p class="small muted" style="margin-top:14px">O app sugere alimentos, nunca suplementos. Sobre reposição de vitaminas, leve ao seu médico.</p>` + prefsBotao();
  return h;
}
/* ---------- mapa de calor: 8 alvos × últimas 12 semanas (cada semana analisada até o domingo) ---------- */
export function mapaSemanas(n = 12){
  const seg = ymd(mondayOf(new Date())), out = [];
  for (let i = n - 1; i >= 0; i--){
    const ini = addDias(seg, -7 * i), fim = i === 0 ? ymd(new Date()) : addDias(ini, 6), r = analise(fim);
    if (r.ok) out.push({ semana: ini, r });
  }
  return out;
}
function mapaHtml(){
  const ws = mapaSemanas(); if (ws.length < 2) return "";
  const ks = ws[0].r.itens.map(x => [x.k, x.nome]);
  return `<h2>Semanas</h2><div class="panel"><div class="scroll-x"><table class="mapa"><thead><tr><th></th>${ws.map(w => `<th>${ddmm(w.semana)}</th>`).join("")}</tr></thead><tbody>
    ${ks.map(([k, n]) => `<tr><td>${esc(n)}</td>${ws.map(w => { const x = w.r.itens.find(y => y.k === k); return `<td><span class="cel ${x.classe}" title="${x.pct != null ? Math.round(x.pct) + "%" : ""}">${x.pct != null ? Math.round(x.pct) : ""}</span></td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="small muted" style="margin:8px 0 0">% da meta em cada semana (semana de segunda a domingo). Vermelho = baixo, amarelo = atenção, verde = ok.</p></div>`;
}

/* ---------- Avançado: tabela completa da DRI (só consulta, não gera sugestões) ---------- */
const DRI = [["vitA", "Vitamina A", "µg", 900], ["vitC", "Vitamina C", "mg", 90], ["vitD", "Vitamina D", "µg", 15], ["vitE", "Vitamina E", "mg", 15], ["vitK", "Vitamina K", "µg", 120],
  ["b1", "Tiamina (B1)", "mg", 1.2], ["b2", "Riboflavina (B2)", "mg", 1.3], ["b3", "Niacina (B3)", "mg", 16], ["b6", "Vitamina B6", "mg", 1.3], ["b12", "Vitamina B12", "µg", 2.4],
  ["folato", "Folato", "µg", 400], ["calcio", "Cálcio", "mg", 1000], ["ferro", "Ferro", "mg", 8], ["magnesio", "Magnésio", "mg", 420], ["zinco", "Zinco", "mg", 11],
  ["potassio", "Potássio", "mg", 3400], ["selenio", "Selênio", "µg", 55], ["fosforo", "Fósforo", "mg", 700], ["cobre", "Cobre", "mg", 0.9], ["fibra", "Fibra", "g", 38]];
function avancadoHtml(r){
  const dias = [0, 1, 2, 3, 4, 5, 6].map(i => addDias(r.fim, -i)).filter(d => refeicoesDo(d).length), tot = totaisDe(dias.flatMap(d => refeicoesDo(d)));
  return `<details class="panel avancado" style="margin-top:16px"><summary>Avançado: todos os nutrientes (DRI)</summary>
    <p class="small muted" style="margin:8px 0">Só para consulta: não gera sugestões. Vários nutrientes não têm dado em boa parte dos alimentos, então a média pode parecer baixa sem ser.</p>
    <div class="scroll-x"><table><thead><tr><th>Nutriente</th><th>Média/dia</th><th>DRI</th><th>%</th><th>Com dado</th></tr></thead><tbody>
    ${DRI.map(([k, n, un, ref]) => { const v = (tot.t[k] || 0) / dias.length, cob = tot.itens ? Math.round((tot.cob[k] || 0) / tot.itens * 100) : 0;
      return `<tr><td>${esc(n)}</td><td>${cob ? fmtNum(v, v >= 100 ? 0 : 1) + " " + un : "sem dado"}</td><td>${fmtNum(ref, ref < 10 ? 1 : 0)} ${un}</td><td>${cob ? fmtNum(v / ref * 100, 0) + "%" : "–"}</td><td>${cob}%</td></tr>`; }).join("")}</tbody></table></div>
    <p class="small muted" style="margin:8px 0 0">DRI (IOM), homens de 31 a 50 anos.</p></details>`;
}
const prefsBotao = () => `<div class="row" style="margin-top:12px"><button class="btn ghost block" data-act="prefsAbrir">Preferências alimentares</button></div>`;
actions.vitNaoQuero = el => {
  const p = S.saude.prefs = Object.assign({}, prefs(), S.saude.prefs || {});
  p.bloqueados = [...new Set((p.bloqueados || []).concat(el.dataset.id))];
  flush("kv", "saude"); setStatus("Não será mais sugerido"); render();
};

/* ---------- preferências alimentares ---------- */
const SUGESTOES_NAO_PREPARO = ["fígado", "miúdos", "bucho", "língua", "coração"];
actions.prefsAbrir = async () => { await carregarBanco(); openModal(`<div></div>`, JSON.parse(JSON.stringify(prefs()))); telaPrefs(); };
function telaPrefs(){
  const p = modalState, peixes = itensBanco().filter(a => a.grupo === "Pescados e frutos do mar").concat(Object.values(S.alimentos || {}).filter(a => a.grupo === "Pescados e frutos do mar"));
  updateModal(`<div class="between"><h3>Preferências alimentares</h3><button class="linkbtn" data-act="closeModal">Fechar</button></div>
    <p class="small muted" style="margin-top:6px">Valem para todas as sugestões do app.</p>
    <div class="field"><span class="lab">Não preparo em casa (nunca sugerir)</span>
      <div class="chips">${[...new Set(SUGESTOES_NAO_PREPARO.concat(p.naoPreparo))].map(t => `<button type="button" class="chip" data-act="prNao" data-v="${esc(t)}" aria-pressed="${p.naoPreparo.includes(t)}">${esc(t)}</button>`).join("")}</div>
      <div class="rng" style="margin-top:6px"><input id="pr-novo" class="txt" type="text" maxlength="30" placeholder="Outro (ex.: jiló)"><button class="btn ghost sm" data-act="prNaoAdd">Adicionar</button></div></div>
    <div class="field"><label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="pr-peixe" ${p.peixesRestritos ? "checked" : ""} data-act="prPeixe" style="width:20px;height:20px;accent-color:var(--strength)"> <strong>Peixes e frutos do mar: só os que eu marcar</strong></label>
      <div class="help">Os outros aparecem no máximo 1 vez por mês como "para experimentar", se um nutriente estiver baixo há 2 semanas.</div>
      ${p.peixesRestritos ? `<div class="chips" style="margin-top:6px">${peixes.map(a => `<button type="button" class="chip" data-act="prPeixeLib" data-v="${esc(a.id)}" aria-pressed="${p.peixesLiberados.includes(a.id)}">${esc(nomeCompleto(a))}</button>`).join("")}</div>` : ""}</div>
    ${p.bloqueados.length ? `<div class="field"><span class="lab">Você tocou em "não quero"</span><ul class="hist">${p.bloqueados.map(id => { const a = alimento(id); return `<li><span>${esc(a ? nomeCompleto(a) : id)}</span><button class="del" data-act="prDesbloq" data-v="${esc(id)}">Voltar a sugerir</button></li>`; }).join("")}</ul></div>` : ""}
    <div class="row" style="margin-top:16px"><button class="btn strength block" data-act="prSalvar">Salvar</button></div>`);
}
const alterna = (arr, v) => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); };
actions.prNao = el => { alterna(modalState.naoPreparo, el.dataset.v); telaPrefs(); };
actions.prNaoAdd = () => { const v = ($("#pr-novo").value || "").trim().toLowerCase(); if (v && !modalState.naoPreparo.includes(v)) modalState.naoPreparo.push(v); telaPrefs(); };
actions.prPeixe = el => { modalState.peixesRestritos = el.checked; telaPrefs(); };
actions.prPeixeLib = el => { alterna(modalState.peixesLiberados, el.dataset.v); telaPrefs(); };
actions.prDesbloq = el => { alterna(modalState.bloqueados, el.dataset.v); telaPrefs(); };
actions.prSalvar = () => {
  const { naoPreparo, peixesRestritos, peixesLiberados, bloqueados } = modalState;
  S.saude.prefs = { naoPreparo, peixesRestritos, peixesLiberados, bloqueados }; flush("kv", "saude"); closeModal(); setStatus("Preferências salvas"); render();
};
