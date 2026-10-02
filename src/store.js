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
  exOverrides: {}         // exercícios criados pelo usuário e ajustes nos do banco (ex.: link de vídeo)
};

export const DEFAULT_SETTINGS = { id: "settings", activePlanId: null, walk: { ativo: true, km: 5, dias: [1, 2, 3, 4, 5], hora: "18:00" } };
export const BACKUP_VERSION = 1;

export async function loadAll(){
  const [kv, sessions, measurements, plans, exercises] = await Promise.all(db.STORES.map(n => db.getAll(n)));
  S.profile = kv.find(x => x.id === "profile") || null;
  S.settings = Object.assign(clone(DEFAULT_SETTINGS), kv.find(x => x.id === "settings") || {});
  S.sessions = Object.fromEntries(sessions.map(x => [x.id, x]));
  S.measurements = Object.fromEntries(measurements.map(x => [x.id, x]));
  S.plans = Object.fromEntries(plans.map(x => [x.id, x]));
  S.exOverrides = Object.fromEntries(exercises.map(x => [x.id, x]));
}

/* ---------- gravação ---------- */
const MAP = { sessions: "sessions", measurements: "measurements", plans: "plans", exercises: "exOverrides" };
const timers = {}, chains = {};
function objFor(store, id){
  if (store === "kv") return id === "profile" ? S.profile : S.settings;
  return S[MAP[store]][id];
}
export function save(store, id, delay = 600){
  const k = store + ":" + id;
  clearTimeout(timers[k]); setStatus("Salvando…");
  timers[k] = setTimeout(() => flush(store, id), delay);
}
export function flush(store, id){
  const k = store + ":" + id;
  clearTimeout(timers[k]); delete timers[k];
  const run = async () => {
    const o = objFor(store, id);
    try{
      if (o) await db.put(store, o); else await db.del(store, id);
      setStatus("Salvo");
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
export const done = () => list().filter(s => s.status === "concluido");
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
export function exportData(){
  return {
    app: "treino-app", versao: BACKUP_VERSION, exportadoEm: new Date().toISOString(),
    kv: [S.profile, S.settings].filter(Boolean),
    sessions: Object.values(S.sessions), measurements: Object.values(S.measurements),
    plans: Object.values(S.plans), exercises: Object.values(S.exOverrides)
  };
}
export function validateBackup(d){
  if (!d || d.app !== "treino-app" || !Array.isArray(d.sessions) || !Array.isArray(d.plans)) return "Este arquivo não é um backup deste app.";
  if (d.versao > BACKUP_VERSION) return "Este backup foi feito por uma versão mais nova do app. Atualize o app antes de restaurar.";
  return null;
}
export async function restoreData(d){
  await flushPending();
  await db.replaceAll({ kv: d.kv || [], sessions: d.sessions || [], measurements: d.measurements || [], plans: d.plans || [], exercises: d.exercises || [] });
  await loadAll();
}
