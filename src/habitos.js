// Hábitos (módulo Saúde): check-in da noite, correlações, FC de repouso, humor, STOP-Bang, tabagismo e álcool.
// Só registra, calcula e avisa; nunca diagnostica (apneia, humor) nem prescreve.
import { S, measurementsList, imc } from "./store.js";
import { num, fmtNum, ymd, ageFrom } from "./util.js";
import { addDias, diasAte, sintomasList } from "./medicacao.js";
import { diaDeDose, totalDia, refeicoesDo } from "./nutricao.js";
import { ultimoValor } from "./fita.js";
import { ultimo, sinal, fli } from "./exames.js";
import { media7 } from "./peso.js";

const hoje = () => ymd(new Date());
export const habitosList = () => Object.values(S.habitos || {}).sort((a, b) => a.date.localeCompare(b.date));
export const checkinDe = date => (S.habitos || {})["hab-" + date] || null;
// cartão no Hoje a partir das 18 h, se ainda não fez o de hoje
export const checkinPendente = (agora = new Date()) => !!(S.saude && S.saude.ativo) && agora.getHours() >= 18 && !checkinDe(ymd(agora));
export const lembreteCheckin = () => Object.assign({ ativo: true, hora: "21:00" }, (S.saude && S.saude.lembreteCheckin) || {});

export const ESCALAS = {
  sonoQ: ["Péssimo", "Ruim", "Regular", "Bom", "Ótimo"],
  ronco: ["Não", "Às vezes", "Sim"],
  sonolencia: ["Nenhuma", "Pouca", "Muita"],
  estresse: ["Baixo", "", "Médio", "", "Alto"],
  fome: ["Pouca", "", "Normal", "", "Muita"],
  humor: ["Péssimo", "Mal", "Neutro", "Bem", "Ótimo"]
};

/* ---------- humor baixo: ≤ 2 por 7 dias seguidos ---------- */
export function humorBaixo(){
  for (let i = 0; i < 7; i++){ const c = checkinDe(addDias(hoje(), -i)); if (!c || c.humor == null || c.humor > 2) return null; }
  return { titulo: "Como você está?", msg: "Seu humor ficou baixo nos últimos 7 dias. Isso acontece, e conversar ajuda: considere falar com um profissional de saúde mental ou com o seu médico. Se estiver em sofrimento agora, ligue 188 (CVV, 24 horas, gratuito).", humor: true };
}

/* ---------- correlações (depois de 3 semanas de check-in) ---------- */
function pearson(pares){
  const n = pares.length; if (n < 10) return null;
  const mx = pares.reduce((s, p) => s + p[0], 0) / n, my = pares.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  pares.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; });
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
const forca = r => Math.abs(r) < 0.2 ? "sem relação clara" : Math.abs(r) < 0.4 ? "relação fraca" : Math.abs(r) < 0.6 ? "relação moderada" : "relação forte";
const media = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
export const DIAS_PARA_CORRELACAO = 21;

export function correlacoes(){
  const hs = habitosList().filter(h => diasAte(h.date, hoje()) <= 90);
  if (hs.length < DIAS_PARA_CORRELACAO) return { faltam: DIAS_PARA_CORRELACAO - hs.length, itens: [] };
  const itens = [];
  // sono × fome do mesmo dia (o check-in da noite guarda o sono da noite anterior)
  const sf = hs.filter(h => h.sonoH != null && h.fome != null).map(h => [h.sonoH, h.fome]);
  const r1 = pearson(sf);
  if (r1 != null) itens.push({ titulo: "Sono × fome", r: r1, n: sf.length, texto: `${forca(r1)}${Math.abs(r1) >= 0.2 ? (r1 < 0 ? ": dormindo menos, você sente mais fome" : ": dormindo mais, você sente mais fome") : ""}.` });
  // sono × peso do dia seguinte
  const pesoDia = {}; measurementsList().forEach(m => { const p = num(m.peso); if (p != null) pesoDia[m.date] = p; });
  const sp = hs.filter(h => h.sonoH != null && pesoDia[addDias(h.date, 1)] != null && media7(addDias(h.date, 1)) != null)
    .map(h => [h.sonoH, pesoDia[addDias(h.date, 1)] - media7(addDias(h.date, 1))]); // diferença em relação à média, para tirar a tendência de queda
  const r2 = pearson(sp);
  if (r2 != null) itens.push({ titulo: "Sono × peso do dia seguinte", r: r2, n: sp.length, texto: `${forca(r2)}${Math.abs(r2) >= 0.2 ? (r2 < 0 ? ": noites mais curtas vêm com o peso um pouco acima da sua média" : ": noites mais longas vêm com o peso um pouco acima da sua média") : ""}.` });
  // dia da dose (e o seguinte) × fome e náusea
  const dd = hs.filter(h => h.fome != null), comDose = dd.filter(h => diaDeDose(h.date)).map(h => h.fome), semDose = dd.filter(h => !diaDeDose(h.date)).map(h => h.fome);
  if (comDose.length >= 3 && semDose.length >= 5){
    const a = media(comDose), b = media(semDose), nau = d => (sintomasList().find(s => s.tipo === "nausea" && s.date === d) || {}).intensidade || 0;
    const na = media(dd.filter(h => diaDeDose(h.date)).map(h => nau(h.date))), nb = media(dd.filter(h => !diaDeDose(h.date)).map(h => nau(h.date)));
    itens.push({ titulo: "Dia da dose × fome e náusea", n: dd.length, texto: `Fome média ${fmtNum(a)} no dia da dose e no seguinte, ${fmtNum(b)} nos outros dias (escala 1 a 5). Náusea média ${fmtNum(na)} × ${fmtNum(nb)} (0 a 10).` });
  }
  // estresse × calorias do dia
  const ek = hs.filter(h => h.estresse != null && refeicoesDo(h.date).length).map(h => [h.estresse, totalDia(h.date).t.kcal || 0]);
  const r4 = pearson(ek);
  if (r4 != null) itens.push({ titulo: "Estresse × calorias", r: r4, n: ek.length, texto: `${forca(r4)}${Math.abs(r4) >= 0.2 ? (r4 > 0 ? ": em dias de mais estresse você come mais" : ": em dias de mais estresse você come menos") : ""}.` });
  return { faltam: 0, itens };
}

/* ---------- FC de repouso (semanal, opcional) ---------- */
export function fcSemanas(n = 8){
  const out = [];
  for (let i = n - 1; i >= 0; i--){
    const fim = addDias(hoje(), -7 * i), ini = addDias(fim, -6);
    const v = habitosList().filter(h => h.date >= ini && h.date <= fim && num(h.fc) != null).map(h => num(h.fc));
    if (v.length) out.push({ ini, fim, fc: media(v) });
  }
  return out;
}
export function fcTendencia(){
  const s = fcSemanas(8); if (s.length < 4) return null;
  const a = media(s.slice(-2).map(x => x.fc)), b = media(s.slice(0, 2).map(x => x.fc));
  return { atual: a, antes: b, dif: a - b };
}
export const fcPendenteSemana = () => !habitosList().some(h => num(h.fc) != null && diasAte(h.date, hoje()) < 7);

/* ---------- STOP-Bang (Chung et al., 2008) ---------- */
export const STOPBANG = [
  ["S", "Você ronca alto (dá para ouvir de outro cômodo ou com a porta fechada)?"],
  ["T", "Você se sente cansado ou sonolento durante o dia com frequência?"],
  ["O", "Alguém já viu você parar de respirar ou engasgar durante o sono?"],
  ["P", "Você tem pressão alta ou trata pressão alta?"],
  ["B", "IMC acima de 35"], ["A", "Idade acima de 50 anos"], ["N", "Pescoço acima de 40 cm"], ["G", "Sexo masculino"]
];
export const STOPBANG_AUTO = ["B", "A", "N", "G"];
export function stopBangAuto(){
  const p = S.profile || {}, peso = media7((measurementsList().filter(m => num(m.peso) != null).pop() || {}).date || hoje());
  const i = imc(peso, num(p.altura)), idade = ageFrom(p.nascimento), pesc = ultimoValor("pescoco", { soJejum: false });
  return {
    B: i != null ? i > 35 : null, A: idade != null ? idade > 50 : null, N: pesc ? pesc.v > 40 : null, G: p.sexo ? p.sexo === "M" : null,
    info: { imc: i, idade, pescoco: pesc && pesc.v }
  };
}
export const stopBangList = () => ((S.saude && S.saude.stopbang) || []).slice().sort((a, b) => a.date.localeCompare(b.date));
export const stopBangUltimo = () => stopBangList().pop() || null;
// repete a cada 3 meses
export const stopBangDevido = () => { const u = stopBangUltimo(); return !u || diasAte(u.date, hoje()) >= 90; };
export const stopBangRisco = p => p >= 5 ? "alto" : p >= 3 ? "intermediário" : "baixo";
export function alertaStopBang(){
  const u = stopBangUltimo();
  if (u && u.pontos >= 3) return { titulo: `STOP-Bang ${u.pontos}/8`, msg: "Risco de apneia do sono acima do baixo. Converse com o médico sobre fazer uma polissonografia." };
  if (!u) return null;
  if (stopBangDevido()) return { titulo: "Refazer o STOP-Bang", msg: "Já se passaram 3 meses do último questionário de apneia (1 minuto).", act: "goHabitos" };
  return null;
}

// Ronco + sonolência frequentes (≥ 3 dos últimos 7 check-ins) + pescoço > 43 cm reforçam o rastreio de apneia
export function alertaApneia(){
  const ult = habitosList().filter(h => diasAte(h.date, hoje()) < 7);
  const ronco = ult.filter(h => h.ronco >= 1).length, sono = ult.filter(h => h.sonolencia >= 1).length, pesc = ultimoValor("pescoco", { soJejum: false });
  if (ronco < 3 || sono < 3 || !pesc || pesc.v <= 43) return null;
  return { titulo: "Ronco, sonolência e pescoço largo", msg: `Nos últimos 7 dias você marcou ronco ${ronco} vezes e sonolência ${sono} vezes, e o pescoço está em ${fmtNum(pesc.v)} cm. Juntos, esses sinais pedem conversa com o médico sobre apneia do sono.` };
}

/* ---------- tabagismo ---------- */
export const tabagismo = () => Object.assign({ status: null, parouEm: null }, (S.saude && S.saude.tabagismo) || {});
// marcos simples (OMS)
export const MARCOS_FUMO = [
  [1, "1 dia: o monóxido de carbono no sangue já voltou ao normal."],
  [14, "2 semanas: a circulação e o fôlego começam a melhorar."],
  [30, "1 mês: menos tosse e falta de ar nos próximos meses."],
  [90, "3 meses: a função dos pulmões continua melhorando."],
  [365, "1 ano: o risco de doença do coração cai pela metade."]
];
export function diasSemFumar(){
  const t = tabagismo(); if (t.status !== "parou" || !t.parouEm) return null;
  const d = diasAte(t.parouEm, hoje()); if (d < 0) return null;
  const feitos = MARCOS_FUMO.filter(m => d >= m[0]), prox = MARCOS_FUMO.find(m => d < m[0]);
  return { dias: d, marco: feitos.pop() || null, proximo: prox || null };
}

/* ---------- álcool × fígado ---------- */
export function alcoolSemanal(semanas = 4){
  const ini = addDias(hoje(), -7 * semanas + 1), hs = habitosList().filter(h => h.date >= ini && num(h.alcool) != null);
  if (!hs.length) return null;
  return { media: hs.reduce((s, h) => s + num(h.alcool), 0) / semanas, dias: hs.length };
}
export function alertaAlcool(){
  const a = alcoolSemanal(); if (!a || a.media < 1) return null;
  const ggt = ultimo("GGT"), f = fli(), ggtAlta = ggt && sinal(ggt) !== "ok", fliAlto = f && f.valor >= 60;
  if (!ggtAlta && !fliAlto) return null;
  return { titulo: "Álcool e fígado", msg: `Média de ${fmtNum(a.media)} doses por semana nas últimas 4 semanas, com ${[ggtAlta && "GGT acima da referência", fliAlto && "FLI " + fmtNum(f.valor, 0)].filter(Boolean).join(" e ")}. Álcool pesa direto no seu fígado e nos triglicérides.` };
}
