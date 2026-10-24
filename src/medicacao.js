// Medicação (módulo Saúde): agenda da próxima dose, regras da bula, rodízio do local,
// curva estimada do nível e alertas de segurança a partir dos sintomas registrados.
// O app registra, calcula e avisa. Nunca sugere mudar a dose.
import { S, measurementsList } from "./store.js";
import { ymd, num, pad } from "./util.js";

export const MEDICAMENTOS = [["tirzepatida", "Tirzepatida (Mounjaro)"], ["semaglutida", "Semaglutida (Ozempic/Wegovy)"], ["outro", "Outro"]];
export const LOCAIS = [["abdomen_esq", "Abdômen esq."], ["abdomen_dir", "Abdômen dir."], ["coxa_esq", "Coxa esq."], ["coxa_dir", "Coxa dir."], ["braco_esq", "Braço esq."], ["braco_dir", "Braço dir."]];
export const STATUS_DOSE = [["aplicada", "Aplicada"], ["esquecida", "Esquecida"], ["pulada", "Pulada"]];
export const nomeLocal = k => (LOCAIS.find(x => x[0] === k) || [, ""])[1];
export const nomeMed = k => (MEDICAMENTOS.find(x => x[0] === k) || [, "Medicação"])[1];

// As regras de bula (96 h, 72 h) e a curva valem só para a tirzepatida, por enquanto
export const regrasTirzepatida = () => !!(S.saude && S.saude.medicamento === "tirzepatida");

/* ---------- datas ---------- */
const DIA = 864e5;
const meioDia = s => new Date(s + "T12:00:00").getTime();
export const addDias = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return ymd(d); };
export const diasAte = (de, ate) => Math.round((meioDia(ate) - meioDia(de)) / DIA);
export const instante = x => new Date(x.date + "T" + (x.hora || "12:00") + ":00").getTime();
function proximoDiaFixo(aPartirDe, dia){ let s = aPartirDe; while (new Date(s + "T12:00:00").getDay() !== dia) s = addDias(s, 1); return s; }

export const dosesList = () => Object.values(S.doses).sort((a, b) => instante(a) - instante(b));
export const aplicadas = () => dosesList().filter(x => x.status === "aplicada" && num(x.doseMg) > 0);

/* ---------- agenda ---------- */
// estado: "aguardando" | "hoje" | "atrasada" (ainda pode aplicar, até 96 h) | "sem_config"
export function agenda(hoje = ymd(new Date())){
  const sd = S.saude || {};
  if (sd.diaFixo == null) return { estado: "sem_config" };
  const regs = dosesList(), ult = regs[regs.length - 1] || null, ultAplic = aplicadas().pop() || null;
  // próximo dia fixo depois do último registro (aplicada, esquecida ou pulada)
  let prog = proximoDiaFixo(ult ? addDias(ult.date, 1) : hoje, sd.diaFixo);
  // intervalo mínimo de 72 h depois da última dose aplicada (vale também ao trocar o dia fixo)
  if (ultAplic && diasAte(ultAplic.date, prog) < 3) prog = addDias(prog, 7);
  const puladas = [];
  // dose esquecida: dá para aplicar até 4 dias (96 h) depois do dia programado; depois disso, pula
  const prazoDias = regrasTirzepatida() ? 4 : 0;
  while (diasAte(prog, hoje) > prazoDias && regrasTirzepatida()){ puladas.push(prog); prog = addDias(prog, 7); }
  const dias = diasAte(hoje, prog);
  return { estado: dias > 0 ? "aguardando" : dias === 0 ? "hoje" : "atrasada", programada: prog, dias, prazo: addDias(prog, prazoDias), puladas, ultima: ultAplic };
}

// Aviso (não bloqueia) quando a dose fica a menos de 72 h da anterior
export function avisoIntervalo(date, hora, ignorarId){
  const t = instante({ date, hora });
  const ant = aplicadas().filter(x => x.id !== ignorarId && instante(x) <= t).pop();
  if (!ant) return null;
  const h = (t - instante(ant)) / 3600000;
  return h < 72 ? { horas: Math.round(h), anterior: ant } : null;
}

// Rodízio: o local menos usado nas últimas 4 aplicações (empate: o usado há mais tempo)
export function sugerirLocal(){
  const ult = aplicadas().filter(x => x.local).slice(-4);
  const conta = k => ult.filter(x => x.local === k).length, ultimoUso = k => { const i = ult.map(x => x.local).lastIndexOf(k); return i; };
  return LOCAIS.map(x => x[0]).sort((a, b) => conta(a) - conta(b) || ultimoUso(a) - ultimoUso(b))[0];
}

/* ---------- curva estimada (modelo de 1 compartimento, absorção de 1ª ordem — Bateman) ---------- */
const KE = Math.log(2) / (5 * 24), KA = 0.13; // meia-vida ≈ 5 dias; pico ≈ 24 h após a aplicação
const nivelEm = (doses, t) => doses.reduce((s, x) => {
  const h = (t - x.t) / 3600000;
  return h < 0 ? s : s + x.mg * KA / (KA - KE) * (Math.exp(-KE * h) - Math.exp(-KA * h));
}, 0);
let picoRef = null;
// 100% = pico teórico de 5 mg por semana em equilíbrio
function pico(){
  if (picoRef) return picoRef;
  const ds = Array.from({ length: 30 }, (_, i) => ({ t: i * 7 * DIA, mg: 5 }));
  let max = 0; for (let h = 29 * 168; h < 30 * 168; h++) max = Math.max(max, nivelEm(ds, h * 3600000));
  return (picoRef = max);
}
export function nivelAtual(t = Date.now()){
  if (!regrasTirzepatida()) return null;
  const ds = aplicadas().map(x => ({ t: instante(x), mg: num(x.doseMg) }));
  return ds.length ? nivelEm(ds, t) / pico() * 100 : null;
}
// Últimas 8 semanas + 7 dias projetados (a projeção supõe a próxima dose no dia programado, com a dose atual)
export function curva(agora = Date.now()){
  const ds = aplicadas().map(x => ({ t: instante(x), mg: num(x.doseMg) }));
  const ini = agora - 56 * DIA, fim = agora + 7 * DIA, ag = agenda(ymd(new Date(agora)));
  const proj = ds.slice();
  const doseAtual = num((S.saude || {}).doseAtualMg);
  let projDose = null;
  if (ag.programada && doseAtual > 0){
    const t = new Date(ag.programada + "T" + ((S.saude || {}).horaLembrete || "08:00") + ":00").getTime();
    if (t > agora && t <= fim){ proj.push({ t, mg: doseAtual }); projDose = { t, mg: doseAtual }; }
  }
  const p = pico(), real = [], futuro = [];
  for (let t = ini; t <= fim; t += 6 * 3600000){
    if (t <= agora) real.push({ x: t, y: nivelEm(ds, t) / p * 100 });
    else futuro.push({ x: t, y: nivelEm(proj, t) / p * 100 });
  }
  if (real.length) futuro.unshift(real[real.length - 1]);
  // peso: média de 7 dias nas datas com pesagem
  const ms = measurementsList().filter(m => num(m.peso) != null);
  const peso = ms.filter(m => meioDia(m.date) >= ini).map(m => {
    const jan = ms.filter(x => x.date <= m.date && diasAte(x.date, m.date) < 7);
    return { x: meioDia(m.date), y: jan.reduce((s, x) => s + num(x.peso), 0) / jan.length };
  });
  return { real, futuro, doses: ds.filter(x => x.t >= ini).map(x => ({ x: x.t, y: nivelEm(ds, x.t) / p * 100, mg: x.mg })), projDose, peso, ini, fim, agora };
}

/* ---------- sintomas e alertas de segurança (bula) ---------- */
export const TIPOS_SINTOMA = [
  ["nausea", "Náusea"], ["vomito", "Vômito"], ["intestino_preso", "Intestino preso"], ["diarreia", "Diarreia"], ["refluxo_azia", "Refluxo ou azia"],
  ["dor_abdominal", "Dor abdominal"], ["tontura", "Tontura ao levantar"], ["hipoglicemia", "Tremor, suor frio ou fraqueza"],
  ["fadiga", "Cansaço"], ["dor_cabeca", "Dor de cabeça"], ["queda_cabelo", "Queda de cabelo"], ["reacao_local", "Reação no local"], ["outro", "Outro"]
];
// Perguntas extras que identificam sinais de alerta
export const SINAIS = {
  dor_abdominal: [["persistente", "Forte e não passa"], ["costas", "Vai para as costas"], ["direita", "No lado direito, em cima (piora depois de comer)"], ["febre", "Com febre"], ["amarelo", "Pele ou olhos amarelados"]],
  vomito: [["mais24", "Há mais de 24 horas"], ["repetido", "Várias vezes no dia"], ["urina", "Urina escura"], ["tontura", "Tontura ao levantar"]],
  diarreia: [["mais24", "Há mais de 24 horas"], ["urina", "Urina escura"], ["tontura", "Tontura ao levantar"]],
  hipoglicemia: [["jejum", "Aconteceu no treino em jejum"]]
};
export const nomeSintoma = k => (TIPOS_SINTOMA.find(x => x[0] === k) || [, k])[1];
export const sintomasList = () => Object.values(S.sintomas).sort((a, b) => instante(a) - instante(b));

const ALERTAS = {
  pancreatite: { titulo: "Possível pancreatite", msg: "Procure atendimento agora e não aplique a próxima dose sem falar com o médico." },
  vesicula: { titulo: "Possível problema na vesícula", msg: "É mais comum com perda rápida de peso. Procure o médico." },
  desidratacao: { titulo: "Risco de desidratação", msg: "Pode afetar os rins. Hidrate-se e contate o médico se não melhorar." },
  hipoglicemia: { titulo: "Possível hipoglicemia", msg: "Pare o que estiver fazendo, coma algo com açúcar e registre. Comente com o médico." },
  vomito_forte: { titulo: "Sintoma forte", msg: "Náusea ou vômito intenso por mais de um dia: contate seu médico." }
};
// Alertas ativos: sintomas dos últimos 7 dias. Não podem ser silenciados.
export function alertasSeguranca(hoje = ymd(new Date())){
  if (!(S.saude && S.saude.ativo)) return [];
  const rec = sintomasList().filter(x => diasAte(x.date, hoje) >= 0 && diasAte(x.date, hoje) <= 6);
  const sn = x => x.sinais || {}, it = x => num(x.intensidade) || 0;
  const ativos = {};
  const marca = (k, x) => { if (!ativos[k] || ativos[k].date < x.date) ativos[k] = { k, date: x.date }; };
  rec.forEach(x => {
    if (x.tipo === "dor_abdominal"){
      if (sn(x).persistente && it(x) >= 7) marca("pancreatite", x);
      if (sn(x).direita || sn(x).amarelo || sn(x).febre) marca("vesicula", x);
    }
    if ((x.tipo === "vomito" || x.tipo === "diarreia") && (sn(x).mais24 || sn(x).urina || sn(x).tontura)) marca("desidratacao", x);
    if (x.tipo === "tontura") marca("desidratacao", x);
    if (x.tipo === "hipoglicemia") marca("hipoglicemia", x);
    if (x.tipo === "vomito" && sn(x).repetido) marca("vomito_forte", x);
  });
  // náusea ou vômito com intensidade ≥ 7 em 2 dias diferentes dos últimos 3
  const fortes = new Set(rec.filter(x => (x.tipo === "nausea" || x.tipo === "vomito") && it(x) >= 7 && diasAte(x.date, hoje) <= 2).map(x => x.date));
  if (fortes.size >= 2) marca("vomito_forte", { date: [...fortes].sort().pop() });
  const ordem = ["pancreatite", "vesicula", "desidratacao", "hipoglicemia", "vomito_forte"];
  return ordem.filter(k => ativos[k]).map(k => Object.assign({}, ALERTAS[k], ativos[k]));
}

// Checklist semanal (domingo)
export const CHECKLIST = [["nausea", "Náusea"], ["intestino_preso", "Intestino preso"], ["refluxo_azia", "Refluxo ou azia"], ["queda_cabelo", "Queda de cabelo"], ["tontura", "Tontura ou pressão baixa"], ["dor_abdominal", "Dor abdominal"]];
export function checklistPendente(hoje = new Date()){
  if (!(S.saude && S.saude.ativo) || hoje.getDay() !== 0) return false;
  return (S.saude.ultimoChecklist || "") !== ymd(hoje);
}

export const horaAgora = () => { const d = new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
