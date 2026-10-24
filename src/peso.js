// Peso e composição corporal (módulo Saúde): média de 7 dias, ritmo, projeção, composição da perda,
// FFMI, comparação com o SURMOUNT-1, detector de platô e alertas de resultado.
import { S, measurementsList } from "./store.js";
import { ymd, num } from "./util.js";
import { addDias, diasAte, aplicadas } from "./medicacao.js";
import { oficial, alertaPescoco } from "./fita.js";

export const pesagens = () => measurementsList().filter(m => num(m.peso) != null);
const hoje = () => ymd(new Date());

// Média das pesagens dos 7 dias que terminam na data
export function media7(date){
  const jan = pesagens().filter(m => m.date <= date && diasAte(m.date, date) < 7);
  return jan.length ? jan.reduce((s, m) => s + num(m.peso), 0) / jan.length : null;
}
// Uma média por data com pesagem (é a linha principal do gráfico)
export function serieMedia(){
  const datas = [...new Set(pesagens().map(m => m.date))];
  return datas.map(date => ({ date, v: media7(date) }));
}
// Valor da média numa data qualquer (interpola entre as pesagens vizinhas)
export function valorEm(date){
  const s = serieMedia(); if (!s.length || date < s[0].date) return null;
  for (let i = s.length - 1; i >= 0; i--){
    if (s[i].date <= date){
      const b = s[i + 1]; if (!b || s[i].date === date) return s[i].v;
      const f = diasAte(s[i].date, date) / diasAte(s[i].date, b.date);
      return s[i].v + (b.v - s[i].v) * f;
    }
  }
  return null;
}
export const ultimaPesagem = () => pesagens().pop() || null;
export const mediaAtual = () => { const u = ultimaPesagem(); return u ? media7(u.date) : null; };

// Ritmo em kg por semana nas últimas n semanas (negativo = perdendo)
export function ritmo(semanas){
  const u = ultimaPesagem(); if (!u) return null;
  const a = valorEm(addDias(u.date, -7 * semanas)), b = media7(u.date);
  return a == null || b == null ? null : (b - a) / semanas;
}

// Peso de partida: a pesagem até 7 dias antes do início do tratamento (ou a primeira)
export function pesoInicial(){
  const ps = pesagens(); if (!ps.length) return null;
  const ini = S.saude && S.saude.inicioTratamento;
  if (ini){ const antes = ps.filter(m => m.date <= ini && diasAte(m.date, ini) <= 7).pop(); if (antes) return { date: antes.date, peso: num(antes.peso) }; }
  return { date: ps[0].date, peso: num(ps[0].peso) };
}
export function perdaTotal(){
  const i = pesoInicial(), m = mediaAtual(); if (!i || m == null) return null;
  return { kg: m - i.peso, pct: (m - i.peso) / i.peso * 100, desde: i.date };
}

// Quando chega a cada alvo no ritmo das últimas 4 semanas (só se estiver perdendo)
export function projecao(alvos = [85, 80, 75]){
  const r = ritmo(4), m = mediaAtual(), u = ultimaPesagem();
  if (r == null || m == null || !(r < -0.05)) return [];
  return alvos.filter(a => a < m).map(a => ({ alvo: a, date: addDias(u.date, Math.round((a - m) / r * 7)) }));
}

/* ---------- composição da perda (bioimpedância do relógio: usar como tendência) ---------- */
const mgDe = m => num(m.massaGorda) != null ? num(m.massaGorda) : (num(m.gorduraPct) != null ? num(m.peso) * num(m.gorduraPct) / 100 : null);
const bio = () => pesagens().filter(m => mgDe(m) != null);
const mediaDe = (arr, f) => arr.reduce((s, x) => s + f(x), 0) / arr.length;
// Início: média das até 3 primeiras leituras (em 14 dias). Fim: recalculado só a cada 4 semanas,
// com a média das até 3 últimas leituras (em 14 dias) até o fim do último bloco de 28 dias.
export function composicao(){
  const bs = bio(); if (bs.length < 2) return null;
  const ini = bs.filter(m => diasAte(bs[0].date, m.date) <= 14).slice(0, 3);
  const blocos = Math.floor(diasAte(bs[0].date, bs[bs.length - 1].date) / 28); if (blocos < 1) return null;
  const limite = addDias(bs[0].date, blocos * 28);
  const ate = bs.filter(m => m.date <= limite), fim = ate.filter(m => diasAte(m.date, ate[ate.length - 1].date) <= 14).slice(-3);
  const dP = mediaDe(fim, m => num(m.peso)) - mediaDe(ini, m => num(m.peso)), dG = mediaDe(fim, mgDe) - mediaDe(ini, mgDe);
  if (!(dP <= -1)) return null;
  // incerteza aproximada: ±1 ponto de % de gordura em cada ponta (repetibilidade do aparelho)
  const erro = Math.SQRT2 * mediaDe(fim, m => num(m.peso)) * 0.01;
  const frac = dG / dP, fMin = Math.max(0, (dG + erro) / dP), fMax = Math.min(1, (dG - erro) / dP);
  return { de: ini[0].date, ate: fim[fim.length - 1].date, dPeso: dP, dGordura: dG, gordura: Math.min(1, Math.max(0, frac)), faixa: [fMin, fMax], proximo: addDias(bs[0].date, (blocos + 1) * 28) };
}
// FFMI = (peso − massa gorda) ÷ altura²: a última leitura de cada mês
export function ffmiMensal(){
  const alt = S.profile && num(S.profile.altura); if (!alt) return [];
  const porMes = {};
  bio().forEach(m => { porMes[m.date.slice(0, 7)] = m; });
  return Object.entries(porMes).map(([mes, m]) => ({ mes, v: (num(m.peso) - mgDe(m)) / Math.pow(alt / 100, 2) }));
}

/* ---------- você vs. SURMOUNT-1 ---------- */
// Curvas médias APROXIMADAS lidas do gráfico do artigo (Jastreboff et al., NEJM 2022): [semana, % de mudança]
export const SURMOUNT = {
  "5 mg": [[0, 0], [4, -3], [8, -5.5], [12, -7.5], [16, -9.5], [20, -11], [24, -12], [36, -14], [48, -15], [60, -15.3], [72, -15]],
  "10 mg": [[0, 0], [4, -3.2], [8, -6], [12, -8.5], [16, -10.8], [20, -12.8], [24, -14.5], [36, -17.5], [48, -19], [60, -19.6], [72, -19.5]],
  "15 mg": [[0, 0], [4, -3.2], [8, -6], [12, -8.8], [16, -11.3], [20, -13.5], [24, -15.5], [36, -18.8], [48, -20.5], [60, -21], [72, -20.9]]
};
export function suaCurva(){
  const i = pesoInicial(), ini = S.saude && S.saude.inicioTratamento;
  if (!i || !ini) return [];
  return serieMedia().filter(p => p.date >= i.date).map(p => ({ x: Math.max(0, diasAte(ini, p.date) / 7), y: (p.v - i.peso) / i.peso * 100 }));
}

/* ---------- faixas de dose (fundo do gráfico) ---------- */
export function faixasDose(){
  const ds = aplicadas(); const out = [];
  ds.forEach((d, i) => {
    const mg = num(d.doseMg), fim = ds[i + 1] ? ds[i + 1].date : addDias(hoje(), 1);
    const ult = out[out.length - 1];
    if (ult && ult.mg === mg) ult.ate = fim; else out.push({ de: d.date, ate: fim, mg });
  });
  return out;
}

/* ---------- eventos ---------- */
export const TIPOS_EVENTO = [["mudanca_dose", "Mudança de dose"], ["inicio_suplemento", "Início de suplemento"], ["parou_de_fumar", "Parou de fumar"], ["doenca", "Doença"], ["viagem", "Viagem"], ["festa", "Festa"], ["outro", "Outro"]];
export const nomeEvento = k => (TIPOS_EVENTO.find(x => x[0] === k) || [, "Evento"])[1];
export const eventosList = () => Object.values(S.eventos).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
export function notaEvento(e){
  const d = (e.descricao || "").toLowerCase();
  if (e.tipo === "inicio_suplemento" && d.includes("creatina")) return "A creatina retém água: nas primeiras semanas o peso e o \"músculo\" da bioimpedância sobem um pouco. Ela também eleva a creatinina no sangue; avise o médico ao avaliar a função dos rins.";
  if (e.tipo === "parou_de_fumar") return "Parar de fumar continua sendo a decisão mais importante para a sua saúde. O gráfico mostra o ganho médio esperado depois de parar, para não confundir com falha do tratamento.";
  return "";
}
// Ganho médio esperado depois de parar de fumar (Aubin et al., BMJ 2012): [dias, kg]
const GANHO_FUMO = [[0, 0], [30, 1.1], [90, 2.9], [365, 4.7]];
export function ganhoFumo(dias){
  for (let i = 1; i < GANHO_FUMO.length; i++){ const [d1, k1] = GANHO_FUMO[i - 1], [d2, k2] = GANHO_FUMO[i]; if (dias <= d2) return k1 + (k2 - k1) * (dias - d1) / (d2 - d1); }
  return GANHO_FUMO[GANHO_FUMO.length - 1][1];
}

/* ---------- detector de platô (2 níveis) ---------- */
function cinturaVariacao(){
  const fs = Object.values(S.fita || {}).filter(f => f.jejum && f.leituras && f.leituras.cintura_umbigo).sort((a, b) => a.date.localeCompare(b.date));
  const rec = fs.filter(f => diasAte(f.date, hoje()) <= 35);
  if (rec.length < 2 || diasAte(rec[0].date, rec[rec.length - 1].date) < 14) return null;
  const v = f => oficial(f.leituras.cintura_umbigo);
  return v(rec[rec.length - 1]) - v(rec[0]);
}
// nivel: "plato" | "desaceleracao" | "oscilacao" | "ok" | null (poucos dados)
export function plato(){
  const u = ultimaPesagem(), m = mediaAtual(); if (!u || m == null) return null;
  const r4 = ritmo(4); if (r4 == null) return null;
  const eventosRecentes = eventosList().filter(e => diasAte(e.date, u.date) >= 0 && diasAte(e.date, u.date) <= 28 && e.tipo !== "mudanca_dose").length > 0;
  const base = { eventosRecentes };
  const v12 = valorEm(addDias(u.date, -84));
  if (v12 != null && (v12 - m) / v12 * 100 < 5) return Object.assign(base, { nivel: "plato", titulo: "Platô confirmado", msg: "Menos de 5% de perda em 12 semanas: leve à consulta médica." });
  const cint = cinturaVariacao();
  if (-r4 / m * 100 < 0.25 && (cint == null || cint > -0.5))
    return Object.assign(base, { nivel: "desaceleracao", semCintura: cint == null, titulo: "Ritmo desacelerou", msg: "Nas últimas 4 semanas a média caiu menos de 0,25% do peso por semana. Revise proteína, registro alimentar e sono.",
      contexto: "Nos estudos, o tempo mediano até o platô foi de cerca de 26 semanas de tratamento. Uma desaceleração nessa fase é esperada." });
  const r1 = ritmo(1);
  if (r1 != null && r1 >= -0.1) return Object.assign(base, { nivel: "oscilacao", titulo: "Peso parado nesta semana", msg: "Oscilações de até 3 semanas são normais: retenção de água por treino novo, glicogênio, sal, intestino, creatina ou o dia da dose. Olhe a tendência de 4 semanas." });
  return Object.assign(base, { nivel: "ok" });
}

// Alertas de resultado do peso (aparecem no Hoje, depois dos de segurança)
export function alertasPeso(){
  if (!(S.saude && S.saude.ativo)) return [];
  const out = [], u = ultimaPesagem();
  if (u && diasAte(u.date, hoje()) > 7) out.push({ titulo: "Mais de 7 dias sem pesagem", msg: "Pausas longas na pesagem estão associadas a reganho. Um registro já ajuda." });
  const p = plato();
  if (p && (p.nivel === "plato" || p.nivel === "desaceleracao")) out.push({ titulo: p.titulo, msg: p.msg });
  const pe = alertaPescoco(); if (pe) out.push(pe);
  return out;
}
