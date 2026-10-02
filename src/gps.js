// GPS da caminhada: grava o percurso, a distância e o ritmo.
// - App Android: plugin background-geolocation (serviço em primeiro plano), continua com a tela travada.
// - Navegador: geolocation.watchPosition, que só funciona com a tela ligada e o app aberto.
// O percurso fica na sessão: s.rota = [[lat, lon, segundos desde o início], ...] e s.gpsKm.
import { registerPlugin } from "@capacitor/core";
import { S, save, flush, active } from "./store.js";
import { isNative } from "./native.js";

const BG = isNative ? registerPlugin("BackgroundGeolocation") : null;
const PRECISAO_MAX = 25;  // m: descarta leituras imprecisas
const PASSO_MIN = 4;      // m: ignora "tremidas" do sinal parado
const VEL_MAX = 7;        // m/s: descarta saltos impossíveis caminhando

let watcherId = null, sessaoId = null, ultimo = null, ouvintes = [], ultimaGravacao = 0;
export const gpsEstado = { ativo: false, precisao: null, erro: "" };

export function distanciaM(a, b){
  const R = 6371000, rad = x => x * Math.PI / 180;
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export function distanciaRotaKm(rota){
  let d = 0; for (let i = 1; i < (rota || []).length; i++) d += distanciaM(rota[i - 1], rota[i]);
  return d / 1000;
}
// Tempo de cada quilômetro (parciais), interpolando o momento exato em que cada km foi completado.
// Retorna [{ km: 1, seg: 712 }, ..., { km: 0.98 (trecho final), seg: ... , parcial: true }]
export function parciais(rota){
  const out = []; if (!rota || rota.length < 2) return out;
  let acum = 0, alvo = 1000, tAnterior = rota[0][2];
  for (let i = 1; i < rota.length; i++){
    const d = distanciaM(rota[i - 1], rota[i]);
    while (acum + d >= alvo){
      const f = d ? (alvo - acum) / d : 0, t = rota[i - 1][2] + f * (rota[i][2] - rota[i - 1][2]);
      out.push({ km: 1, seg: Math.round(t - tAnterior) }); tAnterior = t; alvo += 1000;
    }
    acum += d;
  }
  const resto = acum - (alvo - 1000), tFim = rota[rota.length - 1][2];
  if (resto >= 100) out.push({ km: Math.round(resto / 10) / 100, seg: Math.round(tFim - tAnterior), parcial: true });
  return out;
}
export const onGps = fn => { ouvintes.push(fn); return () => { ouvintes = ouvintes.filter(f => f !== fn); }; };
const avisar = () => ouvintes.forEach(f => { try{ f(); }catch(e){} });

function receber(lat, lon, acc, tempo){
  gpsEstado.precisao = acc; gpsEstado.erro = "";
  const s = S.sessions[sessaoId];
  if (!s || s.status !== "andamento"){ pararGps(); return; }
  if (acc != null && acc > PRECISAO_MAX){ avisar(); return; }
  const t = Math.round((tempo - new Date(s.start).getTime()) / 1000);
  const p = [Math.round(lat * 1e6) / 1e6, Math.round(lon * 1e6) / 1e6, Math.max(0, t)];
  s.rota = s.rota || [];
  if (ultimo){
    const d = distanciaM(ultimo, p), dt = Math.max(1, p[2] - ultimo[2]);
    if (d < PASSO_MIN) { avisar(); return; }
    if (d / dt > VEL_MAX) { avisar(); return; }
    s.gpsKm = Math.round(((s.gpsKm || 0) + d / 1000) * 1000) / 1000;
  }
  s.rota.push(p); ultimo = p;
  // grava no aparelho no máximo a cada 15 s (os pontos chegam a cada poucos segundos)
  if (Date.now() - ultimaGravacao > 15000){ ultimaGravacao = Date.now(); flush("sessions", s.id); }
  avisar();
}

export async function iniciarGps(s){
  if (watcherId != null) await pararGps();
  sessaoId = s.id; s.gps = true;
  ultimo = (s.rota && s.rota.length) ? s.rota[s.rota.length - 1] : null;
  gpsEstado.ativo = true; gpsEstado.erro = ""; gpsEstado.precisao = null;
  if (isNative){
    watcherId = await BG.addWatcher({
      backgroundTitle: "Caminhada em andamento",
      backgroundMessage: "Gravando o percurso com GPS",
      requestPermissions: true, stale: false, distanceFilter: 3
    }, (loc, err) => {
      if (err){
        gpsEstado.erro = err.code === "NOT_AUTHORIZED" ? "permissao" : (err.message || "erro");
        avisar(); return;
      }
      if (loc) receber(loc.latitude, loc.longitude, loc.accuracy, loc.time || Date.now());
    });
  } else if ("geolocation" in navigator){
    watcherId = navigator.geolocation.watchPosition(
      pos => receber(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.timestamp),
      err => { gpsEstado.erro = err.code === 1 ? "permissao" : "sinal"; avisar(); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
  } else {
    gpsEstado.erro = "indisponivel"; gpsEstado.ativo = false;
  }
  avisar();
}

export async function pararGps(){
  const id = watcherId; watcherId = null; gpsEstado.ativo = false;
  try{
    if (id != null){ if (isNative) await BG.removeWatcher({ id }); else navigator.geolocation.clearWatch(id); }
  }catch(e){}
  const s = S.sessions[sessaoId];
  if (s) save("sessions", s.id, 0);
  sessaoId = null; ultimo = null;
  avisar();
}
export function abrirConfigLocalizacao(){ if (BG) BG.openSettings().catch(() => {}); }

// Ao abrir o app com uma caminhada em andamento que usava GPS, retoma a gravação
export function retomarGps(){
  const s = active("caminhada");
  if (s && s.gps && watcherId == null) iniciarGps(s);
}
