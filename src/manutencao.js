// Modo manutenção (desligado por padrão) e registro das decisões médicas sobre a dose.
// O app não decide nada: só mostra a faixa-alvo, avisa quando a média sobe e lembra de levar à consulta.
import { S } from "./store.js";
import { fmtNum, ymd } from "./util.js";
import { addDias, diasAte } from "./medicacao.js";
import { mediaAtual, ultimaPesagem, valorEm } from "./peso.js";

const hoje = () => ymd(new Date());
export const FAIXA_PCT = 2, GATILHO_KG = 1.5, MESES_PERTO = 3;
export const manutencao = () => Object.assign({ ativo: false, pesoRef: null, desde: null }, (S.saude && S.saude.manutencao) || {});
export const faixaAlvo = (m = manutencao()) => m.pesoRef ? { min: m.pesoRef * (1 - FAIXA_PCT / 100), max: m.pesoRef * (1 + FAIXA_PCT / 100), ref: m.pesoRef } : null;

export const DECISOES = [["manter", "Manter a dose"], ["reduzir", "Reduzir a dose"], ["suspender", "Suspender"], ["aumentar", "Aumentar a dose"], ["outra", "Outra"]];
export const nomeDecisao = k => (DECISOES.find(d => d[0] === k) || [, "Decisão"])[1];
export const decisoesList = () => ((S.saude && S.saude.decisoesDose) || []).slice().sort((a, b) => a.date.localeCompare(b.date));

// depois de reduzir ou suspender: acompanhamento mais próximo por 3 meses
export function acompanhamentoProximo(){
  const d = decisoesList().filter(x => x.decisao === "reduzir" || x.decisao === "suspender").pop();
  if (!d) return null;
  const ate = addDias(d.date, MESES_PERTO * 30);
  if (hoje() > ate) return null;
  return { decisao: d, ate, pesoNaDecisao: valorEm(d.date) };
}

export const PLANO_ACAO = ["Revise a proteína: chegue ao piso todos os dias.", "Registre a alimentação por 2 semanas, mesmo o que parecer pouco.", "Volte a contar os passos e mantenha as caminhadas.", "Cuide do sono (7 h ou mais).", "Leve a curva à próxima consulta."];

export function alertasManutencao(){
  const out = [], m = manutencao(), media = mediaAtual(), ap = acompanhamentoProximo();
  if (m.ativo && m.pesoRef && media != null && media > m.pesoRef + GATILHO_KG)
    out.push({ titulo: `Peso ${fmtNum(media - m.pesoRef)} kg acima da referência`, msg: `A média de 7 dias (${fmtNum(media)} kg) passou de ${fmtNum(m.pesoRef + GATILHO_KG)} kg. Plano de ação: ${PLANO_ACAO.join(" ")}`, act: "goPeso" });
  if (ap){
    const u = ultimaPesagem(), semPeso = !u || diasAte(u.date, hoje()) > 4;
    if (semPeso) out.push({ titulo: "Acompanhamento mais próximo", msg: `Até ${ap.ate.slice(8, 10)}/${ap.ate.slice(5, 7)}, depois da decisão de ${nomeDecisao(ap.decisao.decisao).toLowerCase()}: pese-se pelo menos 2 vezes por semana.`, act: "goPeso" });
    else if (ap.pesoNaDecisao != null && media != null && media > ap.pesoNaDecisao + 1 && !(m.ativo && media > (m.pesoRef || Infinity) + GATILHO_KG))
      out.push({ titulo: "Peso subindo depois da mudança de dose", msg: `A média está ${fmtNum(media - ap.pesoNaDecisao)} kg acima do dia da decisão. Leve à consulta; não mude a dose por conta própria.`, act: "goPeso" });
  }
  return out;
}
