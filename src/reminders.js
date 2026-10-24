// Lembretes semanais (app Android): treino nos dias do plano e caminhada nos dias configurados.
// São reagendados sempre que o plano ou as configurações mudam.
import { S, activePlan, planLetters, dataHooks } from "./store.js";
import { isNative, scheduleReminders } from "./native.js";
import { pad, ymd } from "./util.js";

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
  // dia da dose (módulo Saúde): o texto não cita o remédio, porque aparece na tela de bloqueio
  const sd = S.saude, dose = [];
  if (sd && sd.ativo && sd.lembrete !== false && sd.diaFixo != null) dose.push({ weekday: sd.diaFixo, hora: sd.horaLembrete || "08:00", title: "Lembrete de saúde", body: "Hoje é dia da sua aplicação. Registre no app depois de aplicar." });
  // dia de avaliação: 1º sábado do mês às 08:00 (este mês, se ainda não passou e o teste não foi feito; senão o próximo)
  let alvo = primeiroSabado(new Date());
  const feito = Object.values(S.testes || {}).some(t => t.tipo === "sentar_levantar" && t.date.slice(0, 7) === ymd(new Date()).slice(0, 7));
  alvo.setHours(8, 0, 0, 0);
  if (alvo <= new Date() || feito){ const prox = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 1); alvo = primeiroSabado(prox); alvo.setHours(8, 0, 0, 0); }
  const avaliacao = { at: alvo, title: "Dia de avaliação", body: "Teste de sentar e levantar e medidas do mês. Leva poucos minutos." };
  return scheduleReminders({ treinos, walk, dose, avaliacao });
}

function primeiroSabado(d){ const x = new Date(d.getFullYear(), d.getMonth(), 1, 12); while (x.getDay() !== 6) x.setDate(x.getDate() + 1); return x; }

let timer = null;
export function scheduleSoon(){ clearTimeout(timer); timer = setTimeout(scheduleAll, 1500); }
dataHooks.push(scheduleSoon);
