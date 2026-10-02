// Avaliação física (pré-diagnóstico informativo): cartão no Perfil e tela completa.
import { S } from "../store.js";
import { actions, go } from "../ui.js";
import { esc, fmtNum, ddmmyyyy } from "../util.js";
import { diagnostico } from "../diagnostico.js";

const COR = { ok: "var(--strength)", atencao: "var(--walk)", alerta: "var(--danger)" };
const valor = i => (i.sinal && i.v > 0 ? "+" : "") + fmtNum(i.v, i.fmt) + (i.un ? ` <span class="small muted">${esc(i.un)}</span>` : "");

export function avaliacaoCardHtml(){
  const d = diagnostico(); if (!d) return "";
  const chave = ["IMC", "Gordura corporal", "Cintura ÷ altura", "Gasto diário estimado"];
  const itens = d.itens.filter(i => chave.includes(i.k)).slice(0, 3);
  let h = `<h2>Avaliação física</h2><div class="panel"><div class="stats" style="margin-top:0;grid-template-columns:repeat(${Math.max(1, itens.length)},1fr)">`;
  itens.forEach(i => { h += `<div class="stat" style="border-top:4px solid ${COR[i.nivel] || "var(--line)"}"><div class="v" style="font-size:24px">${fmtNum(i.v, i.fmt)}</div><div class="l">${esc(i.k)}${i.txt ? ": " + esc(i.txt) : ""}</div></div>`; });
  h += `</div>`;
  const alerta = d.alertas.find(a => a.nivel === "alerta");
  if (alerta) h += `<div class="warnbox show">${esc(alerta.txt)}</div>`;
  return h + `<button class="btn ghost block" style="margin-top:12px" data-act="goAvaliacao">Ver avaliação completa</button></div>`;
}

export function avaliacaoHtml(){
  const d = diagnostico(), p = S.profile;
  let h = `<div class="between"><h2 style="margin-top:4px">Avaliação física</h2><button class="linkbtn" data-act="goPerfil">Voltar</button></div>`;
  if (!d) return h + `<div class="empty">Complete seu perfil primeiro.</div>`;
  h += `<p class="small muted">Com base no seu perfil${d.data ? " e na pesagem de " + ddmmyyyy(d.data) : ""}. Valores informativos: não substituem avaliação profissional.</p>`;
  d.alertas.filter(a => a.nivel !== "info").forEach(a => { h += `<div class="warnbox show" style="${a.nivel === "atencao" ? "background:var(--walk-soft);color:var(--ink)" : ""}">${esc(a.txt)}</div>`; });

  h += `<div class="panel" style="margin-top:12px">`;
  d.itens.forEach(i => {
    h += `<div style="padding:10px 0;border-bottom:1px solid var(--line);display:flex;gap:12px;align-items:flex-start">
      <i style="flex:0 0 6px;align-self:stretch;border-radius:3px;background:${i.nivel ? COR[i.nivel] : "var(--line)"}"></i>
      <div style="flex:1"><div class="between"><span>${esc(i.k)}</span><strong style="font-family:var(--display);font-size:22px">${valor(i)}</strong></div>
      ${i.txt ? `<div class="small" style="color:${i.nivel && i.nivel !== "ok" ? COR[i.nivel] : "var(--ink-2)"}">${esc(i.txt)}</div>` : ""}
      ${i.ref ? `<div class="small muted">${esc(i.ref)}</div>` : ""}</div></div>`;
  });
  h += `</div>`;

  // Meta
  if (p.metaPeso || p.metaGordura){
    h += `<h2>Meta</h2><div class="panel">`;
    if (p.metaPeso && d.falta != null){
      h += `<p style="margin:0"><strong>${fmtNum(p.metaPeso)} kg</strong>${p.metaData ? " até " + ddmmyyyy(p.metaData) : ""}: ${Math.abs(d.falta) < 0.5 ? "meta atingida! 🎉" : `faltam <strong>${fmtNum(Math.abs(d.falta))} kg</strong>.`}</p>`;
      if (d.ritmoNecessario != null) h += `<p class="small muted" style="margin:6px 0 0">Para chegar no prazo: ${fmtNum(Math.abs(d.ritmoNecessario), 2)} kg por semana.</p>`;
      if (d.ritmo != null) h += `<p class="small muted" style="margin:4px 0 0">Ritmo atual: ${d.ritmo > 0 ? "+" : ""}${fmtNum(d.ritmo, 2)} kg por semana${d.previsao ? `. Mantendo esse ritmo, você chega à meta por volta de <strong>${ddmmyyyy(d.previsao)}</strong>` : ""}.</p>`;
      else h += `<p class="small muted" style="margin:4px 0 0">Registre o peso pelo menos uma vez por semana para o app calcular seu ritmo e prever quando chega à meta.</p>`;
    }
    if (p.metaGordura){
      h += `<p style="margin:${p.metaPeso ? "12px" : "0"} 0 0">Meta de gordura: <strong>${fmtNum(p.metaGordura)}%</strong>.`;
      h += d.pesoAlvoGordura ? ` Mantendo sua massa magra atual, isso corresponde a cerca de <strong>${fmtNum(d.pesoAlvoGordura)} kg</strong>.</p>` : ` Registre o % de gordura para calcular o peso correspondente.</p>`;
    }
    if (d.deficitDia) h += `<p class="small muted" style="margin:10px 0 0">Seu ritmo atual equivale a um déficit médio de cerca de ${d.deficitDia} kcal por dia em relação ao que você gasta (estimativa).</p>`;
    h += `</div>`;
  }
  const infos = d.alertas.filter(a => a.nivel === "info");
  if (infos.length) h += `<h2>Para melhorar a avaliação</h2><div class="panel">${infos.map(a => `<p class="small" style="margin:0 0 8px">• ${esc(a.txt)}</p>`).join("")}<button class="btn strength block" data-act="addMedida">Registrar medida</button></div>`;
  h += `<p class="small muted" style="margin-top:16px">Referências: IMC (OMS); relação cintura/altura (corte 0,5); faixas de % de gordura do American Council on Exercise; gasto em repouso por Katch-McArdle (com % de gordura) ou Mifflin-St Jeor. São estimativas para acompanhar a evolução, não diagnóstico médico.</p>`;
  return h;
}
actions.goAvaliacao = () => go("perfil", "avaliacao");
actions.goPerfil = () => go("perfil");
