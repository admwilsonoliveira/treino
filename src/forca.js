// Painel de força: 1RM estimado (Epley), índice de força dos exercícios-âncora, alerta de queda
// e progressão real. Tudo calculado a partir dos treinos registrados; nenhum registro é alterado.
import { S, done, exercisesWithHistory } from "./store.js";
import { num, ymd, mondayOf } from "./util.js";

export const CALIBRAGEM = 2;   // as 2 primeiras sessões de cada exercício não contam (achando a carga)
export const REPS_MAX = 12;    // acima disso o Epley fica impreciso
const DIA = 864e5;
const t12 = s => new Date(s + "T12:00:00").getTime();
const semanaDe = date => ymd(mondayOf(new Date(date + "T12:00:00")));

export const epley = (kg, reps) => kg * (1 + reps / 30);

// Melhor série de cada treino (maior 1RM estimado), já sem as sessões de calibragem
export function serie1RM(exId){
  const out = [];
  done().forEach(s => {
    if (s.type !== "treino" || !s.sets || !s.sets[exId]) return;
    let best = null;
    s.sets[exId].forEach(x => {
      const kg = num(x.kg), r = num(x.reps);
      if (!(kg > 0 && r > 0)) return;
      const v = epley(kg, r);
      if (!best || v > best.v) best = { v, kg, reps: r };
    });
    if (best) out.push(Object.assign({ date: s.date, impreciso: best.reps > REPS_MAX }, best));
  });
  return out.slice(CALIBRAGEM);
}
// Média das sessões das últimas 4 semanas que terminam na data
function media4(ser, date){
  const fim = t12(date), jan = ser.filter(p => t12(p.date) <= fim && fim - t12(p.date) < 28 * DIA);
  return jan.length ? jan.reduce((a, p) => a + p.v, 0) / jan.length : null;
}
export const tendencia = exId => { const ser = serie1RM(exId); return ser.map(p => ({ date: p.date, v: media4(ser, p.date) })); };

/* ---------- exercícios-âncora ---------- */
// Sugestão: um exercício de cada grupo (pernas, puxada, peito, remada), o primeiro que tiver histórico
const SUGESTAO = [["leg_press_horizontal", "leg_press", "leg_press_unilateral"], ["puxada_frontal", "puxada_neutra"], ["peck_deck", "supino_maquina", "supino_halter", "supino_inclinado"], ["remada_baixa", "remada_apoiada", "remada_maquina", "remada_unilateral"]];
export function ancoras(){
  const salvo = S.settings && S.settings.forcaAncoras;
  if (Array.isArray(salvo) && salvo.length) return salvo;
  const hist = exercisesWithHistory();
  return SUGESTAO.map(g => g.find(id => hist.includes(id))).filter(Boolean);
}
export const ancorasSugeridas = () => !(S.settings && Array.isArray(S.settings.forcaAncoras) && S.settings.forcaAncoras.length);

/* ---------- índice de força ---------- */
// Por semana: média, entre os âncoras, da tendência de 4 semanas ÷ o primeiro valor depois da calibragem (= 100)
export function indiceForca(){
  const ids = ancoras(), sers = ids.map(id => ({ id, ser: serie1RM(id) })).filter(x => x.ser.length);
  if (!sers.length) return [];
  const datas = sers.flatMap(x => x.ser.map(p => p.date)).sort();
  const semanas = [...new Set(datas.map(semanaDe))].sort();
  return semanas.map(w => {
    const fimSemana = ymd(new Date(t12(w) + 6 * DIA));
    const rs = sers.map(x => { const m = media4(x.ser, fimSemana); return m != null && x.ser[0].date <= fimSemana ? m / x.ser[0].v * 100 : null; }).filter(v => v != null);
    return rs.length ? { semana: w, v: rs.reduce((a, b) => a + b, 0) / rs.length, n: rs.length } : null;
  }).filter(Boolean);
}
// Variação do índice nas últimas 4 semanas (só com pelo menos 4 semanas de índice)
export function variacao4(){
  const ix = indiceForca(); if (ix.length < 2) return null;
  const u = ix[ix.length - 1], alvo = t12(u.semana) - 28 * DIA;
  const ant = ix.filter(p => t12(p.semana) <= alvo).pop();
  return ant ? { de: ant.v, ate: u.v, pct: (u.v - ant.v) / ant.v * 100 } : null;
}
export function alertaForca(){
  const v = variacao4();
  return v && v.pct < -10 ? { titulo: "Força caindo", msg: "O índice de força caiu mais de 10% em 4 semanas. Possível perda de força ou músculo: revise proteína, sono e duração dos treinos." } : null;
}

/* ---------- sessões de força na semana ---------- */
export function sessoesSemana(date = new Date()){
  const w = ymd(mondayOf(date));
  return done().filter(s => s.type === "treino" && semanaDe(s.date) === w).length;
}

/* ---------- progressão real (janelas de 4 semanas, sem a calibragem) ---------- */
export function progressao(){
  const hoje = Date.now();
  return exercisesWithHistory().map(id => {
    const ser = serie1RM(id); if (ser.length < 2) return null;
    const rec = ser.filter(p => hoje - t12(p.date) < 28 * DIA), ant = ser.filter(p => hoje - t12(p.date) >= 28 * DIA && hoje - t12(p.date) < 56 * DIA);
    const m = a => a.length ? a.reduce((s, p) => s + p.v, 0) / a.length : null;
    return { id, atual: m(rec), anterior: m(ant), n: ser.length, impreciso: ser.some(p => p.impreciso) };
  }).filter(x => x && x.atual != null);
}

/* ---------- treinos longos (déficit calórico: 60–70 min) ---------- */
export const LIMITE_MIN = 70;
export const duracaoMin = s => s.start && s.end ? (new Date(s.end) - new Date(s.start)) / 60000 : null;
export function alertaDuracao(){
  const lim = Date.now() - 14 * DIA;
  const longos = done().filter(s => s.type === "treino" && new Date(s.start).getTime() >= lim && duracaoMin(s) > LIMITE_MIN);
  return longos.length >= 3 ? { titulo: "Treinos longos", msg: `${longos.length} treinos passaram de ${LIMITE_MIN} min nas últimas 2 semanas. Em déficit calórico, 60 a 70 min com séries perto da falha rendem mais.` } : null;
}
