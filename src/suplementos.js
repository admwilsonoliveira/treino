// Suplementos (módulo Saúde): cadastro (pelo rótulo ou código de barras) e registro do consumo com horário e dose.
// O app só registra: nunca sugere suplemento nem dose (mesma regra da medicação).
// Cadastro (store "suplementos"): { id, nome, marca, forma, dose, unidade, comp: { nutriente: valor por dose }, ean, lembrete: { ativo, hora }, criado }
// Consumo (store "supUso"):       { id, date, hora, supId, nome, dose, unidade, n: { nutriente: valor na dose tomada } }
import { S } from "./store.js";
import { num, fmtNum, ymd } from "./util.js";
import { addDias, diasAte } from "./medicacao.js";

export const FORMAS = [["po", "Pó"], ["capsula", "Cápsula"], ["comprimido", "Comprimido"], ["gotas", "Gotas"], ["liquido", "Líquido"], ["outro", "Outro"]];
export const UNIDADES = ["g", "mg", "mcg", "UI", "cápsula", "comprimido", "gotas", "ml", "scoop"];
// nutrientes que aparecem no cadastro (por dose); vitamina D é digitada em UI e guardada em µg (1 µg = 40 UI)
export const COMPOSICAO = [["prot", "Proteína", "g"], ["vitD", "Vitamina D", "UI"], ["b12", "Vitamina B12", "µg"], ["folato", "Folato / ácido fólico", "µg"], ["calcio", "Cálcio", "mg"],
  ["ferro", "Ferro", "mg"], ["magnesio", "Magnésio", "mg"], ["zinco", "Zinco", "mg"], ["vitC", "Vitamina C", "mg"], ["vitA", "Vitamina A", "µg"], ["vitE", "Vitamina E", "mg"],
  ["vitK", "Vitamina K", "µg"], ["b6", "Vitamina B6", "mg"], ["selenio", "Selênio", "µg"], ["omega3", "Ômega-3 (EPA + DHA)", "g"], ["kcal", "Calorias", "kcal"]];
export const UI_POR_UG_VITD = 40;
const hoje = () => ymd(new Date());

export const suplementosList = () => Object.values(S.suplementos || {}).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
export const usosList = () => Object.values(S.supUso || {}).sort((a, b) => (a.date + (a.hora || "")).localeCompare(b.date + (b.hora || "")));
export const usosDo = date => usosList().filter(u => u.date === date);
export const nomeSup = s => s ? s.nome + (s.marca ? " (" + s.marca + ")" : "") : "";
export const fmtDose = (d, un) => (d != null ? fmtNum(d, d < 10 ? 2 : 0) : "") + " " + (un || "");
// "em uso": cadastrado nos últimos 30 dias ou com registro nos últimos 30 dias
export const emUso = s => usosList().some(u => u.supId === s.id && diasAte(u.date, hoje()) <= 30) || diasAte((s.criado || "").slice(0, 10) || hoje(), hoje()) <= 30;

// nutrientes de uma dose (proporcional à dose padrão do cadastro)
export function nutrientesDaDose(s, dose){
  const f = s.dose > 0 ? dose / s.dose : 1, out = {};
  Object.entries(s.comp || {}).forEach(([k, v]) => { const n = num(v); if (n != null) out[k] = n * f; });
  return out;
}

// média diária de cada nutriente vinda dos suplementos nos dias fim-6..fim (para "com suplementos")
export function mediaSuplementos(fim = hoje(), dias = 7){
  const ini = addDias(fim, -(dias - 1)), t = {};
  usosList().filter(u => u.date >= ini && u.date <= fim).forEach(u => Object.entries(u.n || {}).forEach(([k, v]) => { t[k] = (t[k] || 0) + v; }));
  Object.keys(t).forEach(k => { t[k] /= dias; });
  return t;
}

// resumo por suplemento num período: dias com registro, doses, dose média e horários mais comuns
export function resumoPeriodo(ini, fim){
  const us = usosList().filter(u => u.date >= ini && u.date <= fim), por = {};
  us.forEach(u => {
    const r = por[u.supId || u.nome] = por[u.supId || u.nome] || { nome: u.nome, unidade: u.unidade, dias: new Set(), vezes: 0, total: 0, horas: {} };
    r.dias.add(u.date); r.vezes++; r.total += num(u.dose) || 0; if (u.hora) r.horas[u.hora.slice(0, 2)] = (r.horas[u.hora.slice(0, 2)] || 0) + 1;
  });
  const totalDias = diasAte(ini, fim) + 1;
  return Object.values(por).map(r => ({ nome: r.nome, unidade: r.unidade, dias: r.dias.size, totalDias, vezes: r.vezes, doseMedia: r.vezes ? r.total / r.vezes : null,
    horario: Object.entries(r.horas).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([h]) => h + "h").join(", ") })).sort((a, b) => b.dias - a.dias);
}
// texto curto para o médico e o coach: "Creatina 3 g (28 de 30 dias, ~8h)"
export const textoEmUso = (dias = 30) => resumoPeriodo(addDias(hoje(), -(dias - 1)), hoje()).map(r => `${r.nome} ${fmtDose(r.doseMedia, r.unidade).trim()} (${r.dias} de ${r.totalDias} dias${r.horario ? ", ~" + r.horario : ""})`);
