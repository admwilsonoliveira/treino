// Lembretes semanais (app Android): treino nos dias do plano e caminhada nos dias configurados.
// São reagendados sempre que o plano ou as configurações mudam.
import { S, activePlan, planLetters, dataHooks } from "./store.js";
import { isNative, scheduleReminders } from "./native.js";
import { pad } from "./util.js";

function minus(hora, min){
  const [h, m] = String(hora || "").split(":").map(Number);
  if (!isFinite(h) || !isFinite(m)) return null;
  const t = Math.max(0, h * 60 + m - (min || 0));
  return pad(Math.floor(t / 60)) + ":" + pad(t % 60);
}

export function scheduleAll(){
  if (!isNative || !S.settings) return;
  const L = S.settings.lembretes || {}, p = activePlan(), treinos = [], walk = [];
  if (L.treino && L.treino.ativo && L.treino.hora && p){
    planLetters(p).forEach(k => (p.treinos[k].dias || []).forEach(d => {
      if (treinos.some(t => t.weekday === d)) return;
      treinos.push({ weekday: d, hora: L.treino.hora, title: `Hora do treino ${k}`, body: p.treinos[k].foco ? p.treinos[k].foco + ". Bom treino!" : "Bom treino!" });
    }));
  }
  const w = S.settings.walk;
  if (L.caminhada && L.caminhada.ativo && w && w.dias.length){
    const hora = minus(w.hora, L.caminhada.antes);
    w.dias.forEach(d => walk.push({ weekday: d, hora, title: "Caminhada às " + w.hora, body: L.caminhada.antes ? `Daqui a ${L.caminhada.antes} min: ${String(w.km).replace(".", ",")} km.` : `Hora da caminhada de ${String(w.km).replace(".", ",")} km.` }));
  }
  return scheduleReminders({ treinos, walk });
}

let timer = null;
export function scheduleSoon(){ clearTimeout(timer); timer = setTimeout(scheduleAll, 1500); }
dataHooks.push(scheduleSoon);
