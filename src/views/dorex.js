// "Algum exercício incomodou?": usado no check-out do treino (dor depois ≥ 2) e na edição de treinos antigos.
// Grava em s.post.dorEx = [{ exId, kg, rir, nota }] e alimenta o ranking em Evolução → Dor.
import { done, getEx } from "../store.js";
import { actions, inputs } from "../ui.js";
import { esc, num, fmtNum, ddmm, $ } from "../util.js";

export const DOR_MIN = 2; // a partir de 2/10 depois do treino o app pergunta
let alvo = null;          // { sessao, lista } que o bloco aberto está editando

// Exercícios com séries registradas, na ordem do treino
function exerciciosDe(s){
  const ordem = ((s.plano && s.plano.ex) || []).map(x => x.exId);
  Object.keys(s.sets || {}).forEach(id => { if (!ordem.includes(id)) ordem.push(id); });
  return ordem.filter(id => ((s.sets || {})[id] || []).some(x => num(x.kg) != null || num(x.reps) != null));
}
const cargaDe = (s, id) => { const ks = ((s.sets || {})[id] || []).map(x => num(x.kg)).filter(x => x != null); return ks.length ? Math.max(...ks) : null; };

export function dorExHtml(s, lista){
  alvo = { sessao: s, lista };
  const ids = exerciciosDe(s);
  if (!ids.length) return `<p class="small muted">Este treino não tem séries registradas para marcar.</p>`;
  let h = `<span class="lab">Algum exercício incomodou?</span><div class="chips">${ids.map(id => `<button type="button" class="chip" data-act="dxTog" data-v="${esc(id)}" aria-pressed="${lista.some(x => x.exId === id)}">${esc(getEx(id).nome)}</button>`).join("")}</div>`;
  lista.forEach(x => {
    h += `<div class="infobox" style="margin-top:10px"><strong>${esc(getEx(x.exId).nome)}</strong>${x.kg != null ? ` <span class="muted">· ${fmtNum(x.kg)} kg</span>` : ""}
      <div class="small" style="margin-top:8px">Quantas repetições ainda daria para fazer (RIR)?</div>
      <div class="scale" style="--n:5;margin-top:4px">${[0, 1, 2, 3, 4].map(v => `<button type="button" data-act="dxRir" data-ex="${esc(x.exId)}" data-v="${v}" aria-pressed="${x.rir === v}">${v === 4 ? "4+" : v}</button>`).join("")}</div>
      <input class="txt" style="margin-top:8px" type="text" maxlength="120" placeholder="Postura (opcional): ex.: quadril saiu do banco" data-act="dxNota" data-ex="${esc(x.exId)}" value="${esc(x.nota || "")}"></div>`;
  });
  return h;
}
const redesenha = () => { const box = $("#dorex"); if (box && alvo) box.innerHTML = dorExHtml(alvo.sessao, alvo.lista); };
actions.dxTog = el => {
  if (!alvo) return;
  const id = el.dataset.v, i = alvo.lista.findIndex(x => x.exId === id);
  if (i >= 0) alvo.lista.splice(i, 1); else alvo.lista.push({ exId: id, kg: cargaDe(alvo.sessao, id), rir: null, nota: "" });
  redesenha();
};
actions.dxRir = el => { const x = alvo && alvo.lista.find(y => y.exId === el.dataset.ex); if (!x) return; x.rir = +el.dataset.v; redesenha(); };
inputs.dxNota = el => { const x = alvo && alvo.lista.find(y => y.exId === el.dataset.ex); if (x) x.nota = el.value.trim(); };
export const limpa = lista => lista.map(x => Object.assign({}, x, { nota: x.nota || null }));

/* ---------- ranking (Evolução → Dor) ---------- */
export function rankingDor(){
  const por = {};
  done().filter(s => s.type === "treino" && s.post && Array.isArray(s.post.dorEx)).forEach(s => s.post.dorEx.forEach(x => {
    const r = por[x.exId] = por[x.exId] || { exId: x.exId, vezes: 0, dores: [], cargas: [], ultima: "", notas: [] };
    r.vezes++; if (s.post.dor != null) r.dores.push(s.post.dor); if (x.kg != null) r.cargas.push(x.kg);
    if (s.date > r.ultima) r.ultima = s.date; if (x.nota) r.notas.push(x.nota);
  }));
  const media = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  return Object.values(por).map(r => Object.assign(r, { dorMedia: media(r.dores), cargaMedia: media(r.cargas) }))
    .sort((a, b) => b.vezes - a.vezes || (b.dorMedia || 0) - (a.dorMedia || 0));
}
export function rankingHtml(){
  const rk = rankingDor();
  if (!rk.length) return `<div class="panel" style="margin-top:12px"><h3>Exercícios que incomodaram</h3><p class="small muted" style="margin:6px 0 0">Quando a dor depois do treino for ${DOR_MIN} ou mais, o app pergunta qual exercício incomodou. Dá para marcar treinos antigos em Registros → Editar.</p></div>`;
  return `<div class="panel" style="margin-top:12px"><h3>Exercícios que incomodaram</h3><div class="scroll-x" style="margin-top:8px"><table><thead><tr><th>Exercício</th><th>Vezes</th><th>Dor média</th><th>Carga</th><th>Última</th></tr></thead><tbody>
    ${rk.map(r => `<tr><td style="white-space:normal">${esc(getEx(r.exId).nome)}${r.notas.length ? `<div class="small muted">${esc(r.notas[r.notas.length - 1])}</div>` : ""}</td><td>${r.vezes}</td><td>${r.dorMedia != null ? fmtNum(r.dorMedia) : "–"}</td><td>${r.cargaMedia != null ? fmtNum(r.cargaMedia) + " kg" : "–"}</td><td>${ddmm(r.ultima)}</td></tr>`).join("")}</tbody></table></div>
    <p class="small muted" style="margin:8px 0 0">Exercício que incomodou nos últimos 14 dias não recebe sugestão de aumento de carga. Leve esta lista ao professor ou fisioterapeuta.</p></div>`;
}

