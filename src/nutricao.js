// Registro alimentar (módulo Saúde): totais do dia, metas (proteína com piso/alvo/teto, fibra, água,
// açúcar adicionado, sódio), alertas e resumo semanal. O app mostra; não prescreve dieta.
// Cada item de refeição guarda uma cópia dos valores (n) no momento do registro.
import { S } from "./store.js";
import { ymd, num } from "./util.js";
import { NUTRIENTES } from "./alimentos.js";
import { addDias, diasAte, dosesList } from "./medicacao.js";
import { mediaAtual } from "./peso.js";
import { sessoesSemana } from "./forca.js";

export const TIPOS_REFEICAO = [["cafe", "Café da manhã"], ["lanche_manha", "Lanche da manhã"], ["almoco", "Almoço"], ["lanche_tarde", "Lanche da tarde"], ["jantar", "Jantar"], ["ceia", "Ceia"], ["pre_treino", "Pré-treino"], ["pos_treino", "Pós-treino"]];
export const nomeTipo = k => (TIPOS_REFEICAO.find(t => t[0] === k) || [, "Refeição"])[1];
export function tipoPelaHora(hora){
  const h = parseInt(String(hora || "").slice(0, 2), 10);
  if (!isFinite(h)) return "almoco";
  return h < 4 ? "ceia" : h < 10 ? "cafe" : h < 11.5 ? "lanche_manha" : h < 15 ? "almoco" : h < 18.5 ? "lanche_tarde" : h < 22 ? "jantar" : "ceia";
}

export const refeicoesDo = date => Object.values(S.refeicoes || {}).filter(r => r.date === date).sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
export const aguaDo = date => Object.values(S.agua || {}).filter(a => a.date === date).sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
export const diasComRegistro = () => [...new Set(Object.values(S.refeicoes || {}).map(r => r.date))].sort();

// soma dos itens; para cada nutriente, quantos itens tinham dado (cobertura)
export function totaisDe(refeicoes){
  const t = {}, cob = {};
  let itens = 0;
  refeicoes.forEach(r => (r.itens || []).forEach(it => {
    itens++;
    NUTRIENTES.forEach(([k]) => { const v = num((it.n || {})[k]); if (v != null){ t[k] = (t[k] || 0) + v; cob[k] = (cob[k] || 0) + 1; } });
  }));
  return { t, cob, itens };
}
export const totalDia = date => totaisDe(refeicoesDo(date));
export const proteinaDaRefeicao = r => (r.itens || []).reduce((s, it) => s + (num((it.n || {}).prot) || 0), 0);

/* ---------- metas ---------- */
export function metas(){
  const sd = S.saude || {}, m = sd.metasAlimentares || {}, peso = mediaAtual() || num(S.profile && S.profile.pesoInicial) || 80;
  // padrão por peso (1,2 / 1,4 / 1,6 g por kg); o usuário ajusta nas configurações
  const prot = m.proteina || { piso: Math.round(peso * 1.2 / 5) * 5, alvo: Math.round(peso * 1.4 / 5) * 5, teto: Math.round(peso * 1.6 / 5) * 5 };
  const mlKg = num(m.aguaMlKg) || 35;
  return { prot, agua: Math.round(peso * mlKg / 50) * 50, aguaMlKg: mlKg, fibra: [25, 38], acucarAd: 25, sodio: 2300, protPorRefeicao: 30, refeicoesComProt: 3, kcalBaixa: 1500, personalizada: !!m.proteina };
}
export const aguaTotal = date => aguaDo(date).reduce((s, a) => s + (num(a.ml) || 0), 0);
export const refeicoesComProteina = (date, min = 30) => refeicoesDo(date).filter(r => proteinaDaRefeicao(r) >= min).length;

/* ---------- alertas e avisos ---------- */
const hoje = () => ymd(new Date());
// proteína abaixo do piso por 3 dias seguidos com registro (ontem, anteontem e o dia anterior; hoje ainda está aberto)
export function proteinaBaixa3Dias(){
  const m = metas(), dias = [1, 2, 3].map(i => addDias(hoje(), -i));
  return dias.every(d => refeicoesDo(d).length && (totalDia(d).t.prot || 0) < m.prot.piso);
}
// média de kcal dos últimos 7 dias com registro (precisa de pelo menos 4 dias)
export function kcalMedia7(){
  const dias = [1, 2, 3, 4, 5, 6, 7].map(i => addDias(hoje(), -i)).filter(d => refeicoesDo(d).length);
  if (dias.length < 4) return null;
  return dias.reduce((s, d) => s + (totalDia(d).t.kcal || 0), 0) / dias.length;
}
// água média dos últimos 7 dias em que houve algum registro de água
export function aguaMedia7(){
  const dias = [1, 2, 3, 4, 5, 6, 7].map(i => addDias(hoje(), -i)).filter(d => aguaDo(d).length);
  if (dias.length < 4) return null;
  return dias.reduce((s, d) => s + aguaTotal(d), 0) / dias.length;
}
export function aguaBaixa2Dias(){
  const m = metas(); return [1, 2].map(i => addDias(hoje(), -i)).every(d => aguaDo(d).length && aguaTotal(d) < m.agua * 0.5);
}
export function alertasAlimentacao(){
  if (!(S.saude && S.saude.ativo) || !Object.keys(S.refeicoes || {}).length) return [];
  const out = [], m = metas();
  if (proteinaBaixa3Dias()) out.push({ titulo: "Proteína baixa", msg: `Abaixo de ${m.prot.piso} g por 3 dias seguidos: risco de perder músculo. Proteína e treino de força juntos é que protegem.` });
  const k = kcalMedia7(); if (k != null && k < m.kcalBaixa) out.push({ titulo: "Ingestão muito baixa", msg: `Média de ${Math.round(k)} kcal nos últimos dias registrados. Ingestão muito baixa pode acelerar a perda de músculo. Leve ao seu médico.` });
  const a = aguaMedia7(); if (a != null && a < m.agua * 0.7) out.push({ titulo: "Hidratação baixa", msg: `Média de ${(a / 1000).toFixed(1).replace(".", ",")} L por dia (meta ${(m.agua / 1000).toFixed(1).replace(".", ",")} L). A tirzepatida reduz a sede: beba mesmo sem vontade.` });
  return out;
}
// dia da dose e o dia seguinte: refeições menores e com menos gordura (mais risco de náusea)
export function diaDeDose(date = hoje()){
  return dosesList().some(d => d.status === "aplicada" && (d.date === date || addDias(d.date, 1) === date));
}

/* ---------- resumo da semana: proteína × treino de força ---------- */
export function semanaProteinaTreino(){
  const m = metas(), dias = [0, 1, 2, 3, 4, 5, 6].map(i => addDias(hoje(), -i));
  const registrados = dias.filter(d => refeicoesDo(d).length);
  return { diasRegistrados: registrados.length, diasNoPiso: registrados.filter(d => (totalDia(d).t.prot || 0) >= m.prot.piso).length, sessoesForca: sessoesSemana() };
}

/* ---------- recentes e favoritos automáticos ---------- */
export function alimentosRecentes(n = 10){
  const vistos = [], lista = Object.values(S.refeicoes || {}).sort((a, b) => (b.date + (b.hora || "")).localeCompare(a.date + (a.hora || "")));
  for (const r of lista) for (const it of r.itens || []){ if (!vistos.includes(it.alimentoId)) vistos.push(it.alimentoId); if (vistos.length >= n) return vistos; }
  return vistos;
}
// depois de 2 semanas de registro, os 20 alimentos mais usados viram favoritos (uma vez)
export function favoritosAutomaticos(){
  const sd = S.saude; if (!sd || sd.favAutoFeito) return false;
  const dias = diasComRegistro(); if (!dias.length || diasAte(dias[0], hoje()) < 14) return false;
  const conta = {};
  Object.values(S.refeicoes || {}).forEach(r => (r.itens || []).forEach(it => { conta[it.alimentoId] = (conta[it.alimentoId] || 0) + 1; }));
  const top = Object.entries(conta).sort((a, b) => b[1] - a[1]).slice(0, 20).map(x => x[0]);
  sd.favAlimentos = [...new Set((sd.favAlimentos || []).concat(top))]; sd.favAutoFeito = new Date().toISOString();
  return true;
}
