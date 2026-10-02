// Equilíbrio do plano: séries semanais por grupo muscular comparadas a faixas de referência,
// com cores (verde dentro, amarelo no limite, vermelho abaixo) e sugestões de exercícios.
import { S, save, activePlan, planLetters, getEx, allExercises } from "../store.js";
import { ui, actions, go, rerenderKeepScroll } from "../ui.js";
import { esc, fmtNum, DIAS_CURTO } from "../util.js";
import { GRUPOS, defaultRx } from "../data/exercises.js";
import { hasLombar, lombarTag } from "./plano.js";

// Faixas de séries semanais por grupo (referência geral para hipertrofia). Grupos menores recebem
// trabalho indireto dos compostos, por isso têm faixa menor.
const MAIORES = ["peito", "costas", "ombros", "quadriceps", "posterior", "gluteos"];
const MENORES = ["biceps", "triceps", "panturrilha", "core"];
const FAIXAS = {
  iniciante: { maior: [8, 14], menor: [4, 10] },
  intermediario: { maior: [10, 20], menor: [6, 14] },
  avancado: { maior: [12, 22], menor: [8, 16] }
};
// Músculos auxiliares nos exercícios compostos (contam meia série)
const AUX = { peito: ["triceps", "ombros"], costas: ["biceps"], ombros: ["triceps"], quadriceps: ["gluteos"], posterior: ["gluteos"], gluteos: ["posterior"] };

const nivel = () => (S.profile && FAIXAS[S.profile.nivel] ? S.profile.nivel : "intermediario");
const faixa = g => FAIXAS[nivel()][MAIORES.includes(g) ? "maior" : "menor"];
const freq = t => Math.max(1, (t.dias || []).length);

export function analyze(p){
  const sets = {}, byLetter = {};
  [...MAIORES, ...MENORES].forEach(g => { sets[g] = 0; byLetter[g] = {}; });
  let total = 0;
  planLetters(p).forEach(L => {
    const t = p.treinos[L], f = freq(t);
    t.ex.forEach(it => {
      const ex = getEx(it.exId), n = (it.series || 0) * f;
      total += n;
      if (sets[ex.grupo] != null){ sets[ex.grupo] += n; byLetter[ex.grupo][L] = (byLetter[ex.grupo][L] || 0) + n; }
      if (ex.tipo === "c") (AUX[ex.grupo] || []).forEach(g => { sets[g] += n / 2; byLetter[g][L] = (byLetter[g][L] || 0) + n / 2; });
    });
  });
  // percentual sobre o trabalho total dos grupos (inclui as meias séries dos auxiliares, para somar 100%)
  const soma = Object.values(sets).reduce((a, b) => a + b, 0);
  const groups = [...MAIORES, ...MENORES].map(g => {
    const [min, max] = faixa(g), x = sets[g];
    const status = x >= min && x <= max ? "ok" : x > max ? "alto" : x >= min * 0.75 ? "limite" : "baixo";
    return { g, x, min, max, status, pct: soma ? Math.round(x / soma * 100) : 0, byLetter: byLetter[g] };
  });
  return { groups, total };
}
const COR = { ok: "var(--strength)", limite: "var(--walk)", alto: "var(--walk)", baixo: "var(--danger)" };
const TAG = { ok: "", limite: "walk", alto: "walk", baixo: "alert" };
const TXT = { ok: "dentro do indicado", limite: "no limite", alto: "acima do indicado", baixo: "abaixo do indicado" };

// Sugestão: exercícios do grupo que ainda não estão no plano, no treino que já trabalha esse grupo
function suggest(p, a){
  const inPlan = new Set(planLetters(p).flatMap(L => p.treinos[L].ex.map(x => x.exId)));
  const cands = allExercises().filter(e => e.grupo === a.g && !inPlan.has(e.id) && !(hasLombar() && e.lombar === "evitar"))
    .sort((x, y) => (x.lombar === "seguro" ? 0 : 1) - (y.lombar === "seguro" ? 0 : 1) || (MAIORES.includes(a.g) ? (x.tipo === "c" ? 0 : 1) - (y.tipo === "c" ? 0 : 1) : 0))
    .slice(0, 3);
  const Ls = planLetters(p);
  const L = Object.keys(a.byLetter).sort((x, y) => a.byLetter[y] - a.byLetter[x])[0] || Ls.slice().sort((x, y) => p.treinos[x].ex.length - p.treinos[y].ex.length)[0];
  const falta = Math.max(1, Math.ceil(a.min - a.x));
  const series = Math.min(4, Math.max(2, Math.ceil(falta / freq(p.treinos[L]))));
  return { cands, L, series, falta };
}

export function summaryCard(p){
  const { groups } = analyze(p);
  const ok = groups.filter(x => x.status === "ok").length;
  return `<div class="panel" style="margin-top:12px"><div class="between"><h3>Equilíbrio do plano</h3><button class="linkbtn" data-act="goResumo">Ver detalhes</button></div>
    <p class="small muted" style="margin:4px 0 8px">${ok} de ${groups.length} grupos musculares dentro do indicado por semana.</p>
    <div class="chips">${groups.map(a => `<span class="tag ${TAG[a.status]}">${esc(GRUPOS[a.g])}</span>`).join("")}</div></div>`;
}

export function viewResumo(){
  const p = activePlan();
  if (!p) return `<div class="empty">Escolha um plano primeiro.</div>`;
  const { groups, total } = analyze(p);
  const NIV = { iniciante: "iniciante", intermediario: "intermediário", avancado: "avançado" }[nivel()];
  let h = `<div class="between"><h2 style="margin-top:4px">Equilíbrio do plano</h2><button class="linkbtn" data-act="backTreinos">Voltar</button></div>
    <p class="small muted">${esc(p.nome)} · ${fmtNum(total, 0)} séries por semana. Faixas para nível ${NIV}${S.profile && S.profile.nivel ? "" : " (defina seu nível no Perfil)"}.</p>
    <div class="chips" style="margin:8px 0 4px"><span class="tag">Verde: dentro do indicado</span><span class="tag walk">Amarelo: no limite ou acima</span><span class="tag alert">Vermelho: abaixo</span></div>
    <div class="panel" style="margin-top:10px">`;
  groups.forEach(a => {
    const w = Math.min(100, a.x / a.max * 100), mk = a.min / a.max * 100;
    h += `<div style="padding:10px 0;border-bottom:1px solid var(--line)">
      <div class="between"><strong>${esc(GRUPOS[a.g])}</strong><span class="small" style="color:${COR[a.status]};font-weight:600">${TXT[a.status]}</span></div>
      <div style="position:relative;height:10px;background:var(--surface-2);border-radius:5px;margin:6px 0;overflow:hidden" role="img" aria-label="${fmtNum(a.x)} de ${a.min} a ${a.max} séries">
        <i style="position:absolute;left:0;top:0;bottom:0;width:${w}%;background:${COR[a.status]};border-radius:5px"></i>
        <i style="position:absolute;left:${mk}%;top:0;bottom:0;width:2px;background:var(--ink-2)"></i></div>
      <div class="small muted">${fmtNum(a.x)} séries/semana · ${a.pct}% do treino · indicado ${a.min}–${a.max}</div></div>`;
  });
  h += `<p class="small muted" style="margin:10px 0 0">A barra mostra suas séries semanais; o traço marca o mínimo indicado. Exercícios compostos contam meia série para os músculos auxiliares (ex.: supino também trabalha tríceps e ombros). Treinos feitos em mais de um dia por semana contam em dobro.</p></div>`;

  const low = groups.filter(a => a.status === "baixo" || a.status === "limite");
  const high = groups.filter(a => a.status === "alto");
  h += `<h2>Sugestões</h2>`;
  if (!low.length && !high.length) h += `<div class="panel"><p style="margin:0">Seu plano está equilibrado. Todos os grupos estão dentro do indicado.</p></div>`;
  low.forEach(a => {
    const s = suggest(p, a);
    h += `<div class="panel"><div class="between"><h3>${esc(GRUPOS[a.g])}</h3><span class="tag ${TAG[a.status]}">${s.falta === 1 ? "falta ~1 série" : `faltam ~${s.falta} séries`}</span></div>
      <p class="small" style="margin:6px 0 8px">Adicione ${s.series} séries de um exercício de ${esc(GRUPOS[a.g].toLowerCase())} no treino ${s.L}${p.treinos[s.L].foco ? " (" + esc(p.treinos[s.L].foco) + ")" : ""}${freq(p.treinos[s.L]) > 1 ? `, que é feito ${freq(p.treinos[s.L])}× por semana` : ""}.</p>`;
    if (!s.cands.length) h += `<p class="small muted" style="margin:0">Todos os exercícios deste grupo no banco já estão no plano. Aumente as séries dos que você já faz.</p>`;
    else h += `<ul class="pick">${s.cands.map(e => `<li><div style="min-width:0"><div class="nm">${esc(e.nome)}</div>${lombarTag(e) ? `<div style="margin-top:3px">${lombarTag(e)}</div>` : ""}</div><button class="btn ghost sm" data-act="sugAdd" data-id="${esc(e.id)}" data-l="${s.L}" data-n="${s.series}">+ Treino ${s.L}</button></li>`).join("")}</ul>`;
    h += `</div>`;
  });
  high.forEach(a => {
    h += `<div class="panel"><div class="between"><h3>${esc(GRUPOS[a.g])}</h3><span class="tag walk">acima do indicado</span></div>
      <p class="small" style="margin:6px 0 0">São ${fmtNum(a.x)} séries por semana, acima de ${a.max}. Volume alto demais atrapalha a recuperação, principalmente em déficit calórico. Considere tirar 1 série de alguns exercícios deste grupo.</p></div>`;
  });
  h += `<p class="small muted" style="margin-top:14px">Referência geral para ganho de massa muscular. Ajuste com seu educador físico conforme objetivo, recuperação e restrições.</p>`;
  return h;
}

actions.goResumo = () => go("treinos", "resumo");
actions.sugAdd = el => {
  const p = activePlan(), L = el.dataset.l, n = +el.dataset.n, ex = getEx(el.dataset.id), d = defaultRx(ex);
  p.treinos[L].ex.push(Object.assign({ exId: ex.id }, d, { series: n, rx: d.rx.replace(/^\d+/, String(n)) }));
  save("plans", p.id);
  rerenderKeepScroll();
};
