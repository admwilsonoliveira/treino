// Fila única de alertas do Hoje: os de segurança da medicação ficam sempre no topo (sem fechar, fora da conta);
// os demais entram por prioridade e aparecem no máximo 3 no total.
import { S, activePlan, planLetters, done } from "./store.js";
import { mondayOf, ymd } from "./util.js";
import { alertasSeguranca, agenda } from "./medicacao.js";
import { alertasAlimentacao } from "./nutricao.js";
import { alertaForca, alertaDuracao, sessoesSemana } from "./forca.js";
import { alertasPeso } from "./peso.js";
import { alertaPendente } from "./exames.js";
import { humorBaixo, alertaStopBang, alertaApneia, alertaAlcool } from "./habitos.js";
import { analise } from "./vitaminas.js";
import { bancoPronto } from "./alimentos.js";

export const MAX_ALERTAS = 3;

// Menos de 3 treinos de força na semana: a partir de quinta, enquanto ainda dá tempo de cumprir
export function alertaTreinosSemana(date = new Date()){
  const p = activePlan(); if (!p) return null;
  const diasPlano = new Set(planLetters(p).flatMap(L => p.treinos[L].dias || [])).size, meta = Math.min(3, diasPlano);
  const idx = (date.getDay() + 6) % 7; // segunda = 0
  if (!meta || idx < 3) return null;
  const feitos = sessoesSemana(date), faltam = meta - feitos, restam = 7 - idx; // inclui hoje
  const hojeFeito = done().some(s => s.type === "treino" && s.date === ymd(date));
  if (faltam <= 0 || faltam > restam - (hojeFeito ? 1 : 0)) return null;
  return { titulo: `${feitos} de ${meta} treinos de força na semana`, msg: `Ainda dá tempo: ${faltam === 1 ? "falta 1" : "faltam " + faltam} até domingo. O treino de força é o que protege o músculo durante a perda de peso.` };
}

// nutriente baixo também no exame (o cartão semanal das vitaminas cobre os demais)
function alertaNutriente(){
  if (!(S.saude && S.saude.ativo) || !bancoPronto()) return null;
  const r = analise(); if (!r.ok) return null;
  const x = r.itens.filter(i => i.exame && i.pct != null && i.pct < 50).sort((a, b) => a.pct - b.pct)[0];
  return x ? { titulo: `${x.nome} baixo`, msg: `Abaixo de 50% da referência na semana e também baixo no seu exame. Veja alimentos que ajudam em Vitaminas da semana.`, act: "goVitaminas" } : null;
}
function alertaDose(){
  if (!(S.saude && S.saude.ativo)) return null;
  const ag = agenda();
  return ag.estado === "atrasada" ? { titulo: "Dose atrasada", msg: "A dose programada ainda não foi registrada. Se já aplicou, registre; se esqueceu, veja o prazo na Medicação.", act: "goMedicacao" } : null;
}

export function filaAlertas(){
  const saude = !!(S.saude && S.saude.ativo);
  const peso = alertasPeso(), alim = alertasAlimentacao();
  const porTitulo = (lista, t) => lista.find(a => a.titulo === t) || null;
  const pausa = peso.find(a => a.titulo.startsWith("Mais de 7 dias")), pescoco = peso.find(a => a.ok === "pescocoVisto"), plato = peso.find(a => a !== pausa && a !== pescoco);
  const fila = [
    saude && humorBaixo(),
    alertaDose(),
    porTitulo(alim, "Proteína baixa"),
    alertaForca(),
    alertaTreinosSemana(),
    plato, pausa,
    porTitulo(alim, "Ingestão muito baixa"),
    porTitulo(alim, "Hidratação baixa"),
    alertaNutriente(),
    saude && alertaStopBang(), saude && alertaApneia(), pescoco, saude && alertaAlcool(),
    saude && alertaPendente() && Object.assign({ act: "goExames" }, alertaPendente()),
    alertaDuracao()
  ].filter(Boolean);
  // remove repetidos pelo título (ex.: apneia e pescoço no mesmo mês)
  const vistos = new Set();
  return fila.filter(a => !vistos.has(a.titulo) && vistos.add(a.titulo)).slice(0, Math.max(0, MAX_ALERTAS - alertasSeguranca().length));
}
