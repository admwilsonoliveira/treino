// Sugestão de carga por exercício (dupla progressão), com travas de segurança:
// - quando TODAS as séries chegam ao topo da faixa de repetições, sobe a carga no menor degrau do equipamento;
// - a subida nunca passa de +5% (regra do app);
// - sem subida se a dor no fim do treino anterior foi 4 ou mais, se houve dor irradiada/forte,
//   ou se a dor no check-in de hoje é 4 ou mais;
// - em semana de deload, sugere carga mais leve.
import { done, lastSetsFor } from "./store.js";
import { num, fmtNum } from "./util.js";

const DEGRAU = { halter: 1, maquina: 2.5, cabo: 2.5, barra: 2, kettlebell: 4, elastico: 0, corpo: 0 };
const LIMITE = 0.05;

export function faixaReps(rx){
  const s = String(rx || "").split("×").pop();
  if (/\b(m|s|seg|min)\b/i.test(s)) return null; // distância ou tempo (carries, prancha)
  const m = s.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (m) return [+m[1], +m[2]];
  const u = s.match(/(\d+)/);
  return u ? [+u[1], +u[1]] : null;
}

function bloqueio(sessaoAtual){
  if (sessaoAtual && sessaoAtual.pre && sessaoAtual.pre.dor >= 4) return `dor de ${sessaoAtual.pre.dor}/10 no check-in de hoje`;
  const ant = done().filter(s => s.type === "treino" && (!sessaoAtual || s.id !== sessaoAtual.id) && s.post).pop();
  if (!ant) return null;
  if (ant.post.irradiada) return "dor descendo para a perna no último treino";
  if (ant.post.dorAguda) return "dor forte no último treino";
  if (ant.post.dor >= 4) return `dor de ${ant.post.dor}/10 no fim do último treino`;
  return null;
}

// Retorna { tipo: "subir" | "manter" | "abaixo" | "limite" | "bloqueado" | "deload" | "reps", texto, kg? } ou null
export function sugestao(it, ex, sessaoAtual, semana){
  const last = lastSetsFor(it.exId, sessaoAtual && sessaoAtual.id);
  if (!last) return null;
  const faixa = faixaReps(it.rx);
  const sets = last.sets.map(x => ({ kg: num(x.kg), reps: num(x.reps) })).filter(x => x.reps != null && (ex.load === false || x.kg != null));
  if (!sets.length || !faixa) return null;
  const [baixo, topo] = faixa;
  const kg = ex.load === false ? null : Math.max(...sets.map(x => x.kg));
  const un = ex.unit || "kg";

  if (semana && semana.fase && semana.fase.deload){
    return kg ? { tipo: "deload", kg: Math.round(kg * 0.85 / 0.5) * 0.5, texto: `Semana de deload: use cerca de ${fmtNum(Math.round(kg * 0.85 / 0.5) * 0.5)} ${un} (15% mais leve), sem chegar perto da falha.` }
      : { tipo: "deload", texto: "Semana de deload: faça menos repetições, sem chegar perto da falha." };
  }
  const motivo = bloqueio(sessaoAtual);
  if (motivo) return { tipo: "bloqueado", kg, texto: `Sem aumento de carga hoje (${motivo}). Mantenha${kg ? " " + fmtNum(kg) + " " + un : ""} ou reduza.` };

  const todasNoTopo = sets.every(x => x.reps >= topo);
  const algumaAbaixo = sets.some(x => x.reps < baixo);
  if (ex.load === false){
    if (todasNoTopo) return { tipo: "reps", texto: `Todas as séries chegaram a ${topo}. Pode passar para uma variação um pouco mais difícil ou fazer mais devagar.` };
    return { tipo: "manter", texto: `Tente +1 repetição nas séries abaixo de ${topo}.` };
  }
  if (!kg) return { tipo: "manter", texto: `Tente +1 repetição nas séries abaixo de ${topo}.` };
  if (todasNoTopo){
    const passo = DEGRAU[ex.equip] != null ? DEGRAU[ex.equip] : 2.5;
    if (!passo) return { tipo: "manter", kg, texto: `Todas as séries chegaram a ${topo}. Aumente a dificuldade do exercício.` };
    const alvo = kg + passo, pct = passo / kg;
    if (pct > LIMITE) return { tipo: "limite", kg, texto: `Você chegou a ${topo} repetições em todas as séries. O próximo peso disponível (${fmtNum(alvo)} ${un}) seria +${Math.round(pct * 100)}%, e o app não sugere saltos acima de 5% por segurança. Faça 1 ou 2 repetições a mais com ${fmtNum(kg)} ${un}; quando passar da faixa com folga, combine a troca de carga com seu professor.` };
    return { tipo: "subir", kg: alvo, reps: baixo, texto: `Todas as séries chegaram a ${topo}. Suba para ${fmtNum(alvo)} ${un} (+${fmtNum(pct * 100, 1)}%) e volte a ${baixo} repetições.` };
  }
  if (algumaAbaixo) return { tipo: "abaixo", kg, texto: `Na última vez alguma série ficou abaixo de ${baixo} repetições. Mantenha ${fmtNum(kg)} ${un} (ou reduza um pouco) até completar a faixa.` };
  return { tipo: "manter", kg, texto: `Mantenha ${fmtNum(kg)} ${un} e tente +1 repetição nas séries abaixo de ${topo}. Em déficit calórico, manter a carga já é um bom resultado.` };
}
