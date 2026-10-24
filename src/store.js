// Estado do app em memória + gravação no aparelho.
import * as db from "./db.js";
import { EX_BASE_BY_ID, EXERCISES } from "./data/exercises.js";
import { LETTERS } from "./data/templates.js";
import { $, num, clone } from "./util.js";

export const S = {
  profile: null,          // perfil do usuário
  settings: null,         // preferências (plano ativo, caminhada)
  sessions: {},           // treinos e caminhadas
  measurements: {},       // pesagens e bioimpedância
  plans: {},              // planos de treino
  exOverrides: {},        // exercícios criados pelo usuário e ajustes nos do banco (ex.: link de vídeo)
  fotos: {},              // foto do aparelho de cada exercício: { id: exId, data, thumb, atualizado }
  // módulo Saúde (só existe para quem ativou; ver saude.js)
  saude: null,            // configuração e consentimento (kv "saude")
  doses: {}, sintomas: {}, eventos: {}, fita: {}, exames: {}, dobras: {},
  testes: {}              // testes funcionais (sentar e levantar, preensão)
};

export const DEFAULT_SETTINGS = { id: "settings", activePlanId: null, restPadrao: 60, walk: { ativo: true, km: 5, dias: [1, 2, 3, 4, 5], hora: "18:00" },
  lembretes: { treino: { ativo: false, hora: "" }, caminhada: { ativo: false, antes: 15 } } };
// Funções chamadas quando plano ou configurações mudam (ex.: reagendar lembretes no app Android)
export const dataHooks = [];
// Funções chamadas a cada alteração gravada (ex.: backup automático no Google Drive)
export const changeHooks = [];
export const INATIVO_MS = 3 * 3600 * 1000; // treino sem atividade por 3 h é encerrado como incompleto

// Descanso do exercício: o ajustado pelo usuário ou o padrão das configurações
export const restOf = it => (it && it.rest > 0 ? it.rest : (S.settings && S.settings.restPadrao) || 60);
// v2: backup passa a levar o módulo Saúde
export const BACKUP_VERSION = 2;

export async function loadAll(){
  const all = await Promise.all(db.STORES.map(n => db.getAll(n)));
  const by = Object.fromEntries(db.STORES.map((n, i) => [n, all[i] || []]));
  const { kv, sessions, measurements, plans, exercises, fotos } = by;
  S.profile = kv.find(x => x.id === "profile") || null;
  S.saude = kv.find(x => x.id === "saude") || null;
  db.SAUDE_STORES.forEach(n => { S[n] = Object.fromEntries(by[n].map(x => [x.id, x])); });
  S.settings = Object.assign(clone(DEFAULT_SETTINGS), kv.find(x => x.id === "settings") || {});
  S.sessions = Object.fromEntries(sessions.map(x => [x.id, x]));
  S.measurements = Object.fromEntries(measurements.map(x => [x.id, x]));
  S.plans = Object.fromEntries(plans.map(x => [x.id, x]));
  S.exOverrides = Object.fromEntries(exercises.map(x => [x.id, x]));
  S.fotos = Object.fromEntries((fotos || []).map(x => [x.id, x]));
  S.testes = Object.fromEntries((by.testes || []).map(x => [x.id, x]));
  migrate();
}

// Ajustes de formato dos dados entre versões (rodam uma vez por aparelho)
function migrate(){
  const v = S.settings.dataVersion || 1;
  if (v < 2){
    // v2: descanso padrão passou a ser uma configuração (60 s); os descansos dos modelos antigos saem dos planos
    Object.values(S.plans).forEach(p => { Object.values(p.treinos || {}).forEach(t => (t.ex || []).forEach(it => { delete it.rest; })); flush("plans", p.id); });
    Object.values(S.sessions).forEach(s => {
      if (s.status === "andamento" && s.plano){ s.plano.ex.forEach(it => { delete it.rest; }); flush("sessions", s.id); }
    });
  }
  if (v < 3){
    // v3: calorias da musculação recalculadas com 2,8 MET; o valor antigo fica guardado
    Object.values(S.sessions).forEach(s => {
      if (s.type !== "treino" || s.kcal == null || s.kcalOriginal != null) return;
      s.kcalOriginal = s.kcal; s.kcal = kcalOf(s); flush("sessions", s.id);
    });
  }
  if (v < 3){ S.settings.dataVersion = 3; if (S.profile) flush("kv", "settings"); }
}

/* ---------- treino esquecido ---------- */
export function autoCloseStale(){
  const s = active("treino"); if (!s) return null;
  const last = new Date(s.lastActivity || s.start).getTime();
  if (Date.now() - last < INATIVO_MS) return null;
  s.end = new Date(last).toISOString(); s.status = "incompleto";
  s.kcal = kcalOf(s);
  flush("sessions", s.id);
  return s;
}

/* ---------- calorias (estimativa por MET × peso × horas) ---------- */
export function weightAt(date){
  const ms = measurementsList().filter(m => num(m.peso) != null);
  const before = ms.filter(m => m.date <= date).pop();
  return before ? num(before.peso) : (ms[0] ? num(ms[0].peso) : (S.profile ? num(S.profile.pesoInicial) : null));
}
// Compêndio de Atividades Físicas: caminhada conforme a velocidade. Musculação: 2,8 MET (desde 24/10/2026;
// antes 3,5, que superestimava treinos com descansos longos — o valor antigo fica em s.kcalOriginal)
export const MUSC_MET = 2.8;
const WALK_MET = [[3.2, 2.8], [4.0, 3.0], [4.8, 3.5], [5.6, 4.3], [6.4, 5.0], [7.2, 7.0]];
export function walkMet(kmh){
  if (!(kmh > 0)) return 3.5;
  if (kmh <= WALK_MET[0][0]) return WALK_MET[0][1];
  for (let i = 1; i < WALK_MET.length; i++){
    const [v1, m1] = WALK_MET[i - 1], [v2, m2] = WALK_MET[i];
    if (kmh <= v2) return m1 + (m2 - m1) * (kmh - v1) / (v2 - v1);
  }
  return WALK_MET[WALK_MET.length - 1][1];
}
export function kcalOf(s){
  if (!s.end || !s.start) return null;
  const h = (new Date(s.end) - new Date(s.start)) / 3600000, kg = weightAt(s.date);
  if (!(h > 0) || !kg) return null;
  const met = s.type === "caminhada" ? walkMet(num(s.km) / h) : MUSC_MET;
  return Math.round(met * kg * Math.min(h, 4));
}
export const kcalFor = s => (s.kcal != null ? s.kcal : kcalOf(s));
// Calorias "a mais" que a atividade gastou além do repouso (MET − 1), para somar ao metabolismo sem contar o repouso duas vezes
export function kcalLiquidaOf(s){
  if (!s.end || !s.start) return null;
  const h = (new Date(s.end) - new Date(s.start)) / 3600000, kg = weightAt(s.date);
  if (!(h > 0) || !kg) return null;
  const met = s.type === "caminhada" ? walkMet(num(s.km) / h) : MUSC_MET;
  return Math.round((met - 1) * kg * Math.min(h, 4));
}

/* ---------- IMC ---------- */
export function imc(peso, alturaCm){ return peso && alturaCm ? peso / Math.pow(alturaCm / 100, 2) : null; }
export function imcClasse(v){
  if (v == null) return "";
  return v < 18.5 ? "abaixo do peso" : v < 25 ? "peso adequado" : v < 30 ? "sobrepeso" : v < 35 ? "obesidade grau I" : v < 40 ? "obesidade grau II" : "obesidade grau III";
}

/* ---------- gravação ---------- */
const MAP = { sessions: "sessions", measurements: "measurements", plans: "plans", exercises: "exOverrides", fotos: "fotos",
  doses: "doses", sintomas: "sintomas", eventos: "eventos", fita: "fita", exames: "exames", dobras: "dobras", testes: "testes" };
const timers = {}, chains = {};
function objFor(store, id){
  if (store === "kv") return id === "profile" ? S.profile : id === "saude" ? S.saude : S.settings;
  return S[MAP[store]][id];
}
export function save(store, id, delay = 600){
  const k = store + ":" + id;
  clearTimeout(timers[k]); setStatus("Salvando…");
  timers[k] = setTimeout(() => flush(store, id), delay);
}
// quiet = true: grava sem disparar os avisos de alteração (usado pelo próprio backup, para não entrar em ciclo)
export function flush(store, id, quiet = false){
  const k = store + ":" + id;
  clearTimeout(timers[k]); delete timers[k];
  const run = async () => {
    const o = objFor(store, id);
    try{
      if (o) await db.put(store, o); else await db.del(store, id);
      setStatus("Salvo");
      if (!quiet){
        if (store === "plans" || (store === "kv" && (id === "settings" || id === "saude"))) dataHooks.forEach(f => { try{ f(); }catch(e){} });
        changeHooks.forEach(f => { try{ f(store, id); }catch(e){} });
      }
    }catch(e){
      setStatus(e && e.name === "QuotaExceededError" ? "Espaço cheio no aparelho" : "Não foi possível salvar. Tente de novo.");
    }
  };
  chains[k] = (chains[k] || Promise.resolve()).then(run, run);
  return chains[k];
}
export function flushPending(){ return Promise.all(Object.keys(timers).map(k => { const i = k.indexOf(":"); return flush(k.slice(0, i), k.slice(i + 1)); })); }

let statusTimer;
export function setStatus(t){
  const el = $("#status"); if (!el) return;
  el.textContent = t; clearTimeout(statusTimer);
  if (t === "Salvo") statusTimer = setTimeout(() => { el.textContent = ""; }, 2000);
}

/* ---------- restrições de saúde do perfil ---------- */
export const hasRestr = k => !!(S.profile && (S.profile.restricoes || []).includes(k));
// Quem marcou hérnia/dor lombar responde sobre dor lombar e dor irradiada; os demais, sobre dor em geral
export const dorLabel = () => (hasRestr("lombar") ? "Dor lombar" : "Dor ou desconforto");

/* ---------- exercícios ---------- */
export function getEx(id){
  const base = EX_BASE_BY_ID[id], ov = S.exOverrides[id];
  if (!base && !ov) return { id, nome: id.replace(/_/g, " "), grupo: "core", equip: "corpo", lombar: "cuidado", tipo: "i", nota: "", missing: true };
  return Object.assign({}, base || {}, ov || {});
}
export function allExercises(){
  const custom = Object.values(S.exOverrides).filter(x => x.custom).map(x => getEx(x.id));
  return EXERCISES.map(e => getEx(e.id)).concat(custom);
}

/* ---------- plano ---------- */
export const activePlan = () => (S.settings && S.plans[S.settings.activePlanId]) || null;
export function planLetters(p){ return p ? LETTERS.filter(L => p.treinos[L]) : []; }
export function treinoForDay(p, wd){
  if (!p) return null;
  return planLetters(p).find(L => (p.treinos[L].dias || []).includes(wd)) || null;
}

/* ---------- sessões ---------- */
export const list = () => Object.values(S.sessions).sort((a, b) => (a.start || "").localeCompare(b.start || ""));
export const active = type => list().filter(s => s.type === type && s.status === "andamento").pop() || null;
// Registros encerrados: concluídos e incompletos (treino esquecido, encerrado automaticamente)
export const done = () => list().filter(s => s.status === "concluido" || s.status === "incompleto");
export function lastSetsFor(exId, excludeId){
  const arr = done().filter(s => s.id !== excludeId && s.type === "treino" && s.sets && s.sets[exId] && s.sets[exId].some(x => num(x.kg) != null || num(x.reps) != null));
  const s = arr.pop(); return s ? { date: s.date, sets: s.sets[exId] } : null;
}
export function metricsFor(exId){
  const out = [];
  done().forEach(s => {
    if (s.type !== "treino" || !s.sets || !s.sets[exId]) return;
    let max = 0, vol = 0, reps = 0;
    s.sets[exId].forEach(x => { const kg = num(x.kg), r = num(x.reps); if (kg != null && r != null && r > 0){ if (kg > max) max = kg; vol += kg * r; } if (r) reps += r; });
    if (max > 0 || reps > 0) out.push({ date: s.date, max, vol, reps, sets: s.sets[exId] });
  });
  return out;
}
export function exercisesWithHistory(){
  const ids = new Set();
  done().forEach(s => { if (s.type === "treino" && s.sets) Object.keys(s.sets).forEach(id => ids.add(id)); });
  return [...ids];
}

/* ---------- medidas ---------- */
export const measurementsList = () => Object.values(S.measurements).sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.id || "").localeCompare(b.id || ""));
export function latestWeight(){
  const m = measurementsList().filter(x => num(x.peso) != null).pop();
  return m ? num(m.peso) : (S.profile ? num(S.profile.pesoInicial) : null);
}

/* ---------- backup ---------- */
// fotos: true inclui as fotos dos aparelhos (backup em arquivo); o backup do Drive as envia num arquivo separado
export function exportData({ fotos = false } = {}){
  const d = {
    app: "treino-app", versao: BACKUP_VERSION, exportadoEm: new Date().toISOString(),
    kv: [S.profile, S.settings, S.saude].filter(Boolean),
    sessions: Object.values(S.sessions), measurements: Object.values(S.measurements),
    plans: Object.values(S.plans), exercises: Object.values(S.exOverrides), testes: Object.values(S.testes)
  };
  if (S.saude) db.SAUDE_STORES.forEach(n => { d[n] = Object.values(S[n]); });
  if (fotos) d.fotos = Object.values(S.fotos);
  return d;
}
export function validateBackup(d){
  if (!d || d.app !== "treino-app" || !Array.isArray(d.sessions) || !Array.isArray(d.plans)) return "Este arquivo não é um backup deste app.";
  if (d.versao > BACKUP_VERSION) return "Este backup foi feito por uma versão mais nova do app. Atualize o app antes de restaurar.";
  return null;
}
// modo "substituir": o backup toma o lugar do que está no app; "mesclar": só acrescenta o que falta (pelo id)
export async function restoreData(d, modo = "substituir"){
  await flushPending();
  const dados = { kv: d.kv || [], sessions: d.sessions || [], measurements: d.measurements || [], plans: d.plans || [], exercises: d.exercises || [] };
  if (Array.isArray(d.fotos)) dados.fotos = d.fotos; // só substitui as fotos se o backup trouxer fotos
  if (Array.isArray(d.testes)) dados.testes = d.testes;
  db.SAUDE_STORES.forEach(n => { if (Array.isArray(d[n])) dados[n] = d[n]; });
  if (modo === "mesclar") await db.mergeAll(dados);
  else {
    // backup sem o módulo Saúde (feito antes dele existir) não apaga a saúde deste aparelho
    if (S.saude && !dados.kv.some(x => x && x.id === "saude")) dados.kv = dados.kv.concat([S.saude]);
    await db.replaceAll(dados);
  }
  await loadAll();
}
// Números de referência para conferir que nada sumiu depois de atualizações e restaurações
export function conferencia(){
  const d = done(), treinos = d.filter(s => s.type === "treino");
  return {
    treinos: treinos.length, caminhadas: d.filter(s => s.type === "caminhada").length,
    series: treinos.reduce((n, s) => n + Object.values(s.sets || {}).reduce((m, arr) => m + (arr || []).length, 0), 0),
    pesagens: Object.keys(S.measurements).length
  };
}
