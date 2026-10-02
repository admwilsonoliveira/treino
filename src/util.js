export const $ = s => document.querySelector(s);
export const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const pad = n => String(n).padStart(2, "0");
export const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
export const ddmm = s => s ? s.slice(8, 10) + "/" + s.slice(5, 7) : "";
export const ddmmyyyy = s => s ? s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4) : "";
export const num = v => { if (v === "" || v == null) return null; const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : null; };
export const fmtNum = (n, dec = 1) => { const f = Math.pow(10, dec); return (Math.round(n * f) / f).toString().replace(".", ","); };
export function dur(ms){ if (!(ms > 0)) return "0:00"; const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; return h ? h + ":" + pad(m) + ":" + pad(ss) : m + ":" + pad(ss); }
export const durMin = ms => Math.round(ms / 60000);
export function mondayOf(d){ const x = new Date(d); x.setHours(0, 0, 0, 0); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; }
export const timeOf = iso => { if (!iso) return ""; const d = new Date(iso); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
export const newId = (p = "s") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const clone = o => JSON.parse(JSON.stringify(o));
export function restLabel(s){ return s >= 60 ? (s % 60 ? Math.floor(s / 60) + " min " + (s % 60) + " s" : (s / 60) + " min") : s + " s"; }
export function pace(minPerKm){
  // arredonda para segundos inteiros antes de separar min:s (evita "9:60")
  const total = Math.round(minPerKm * 60);
  return Math.floor(total / 60) + ":" + pad(total % 60);
}
// Normaliza texto para comparar nomes: minúsculas, sem acentos e sem pontuação
export const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
export const yt = q => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
export function isYoutubeUrl(u){
  try{ const h = new URL(u).hostname.replace(/^www\.|^m\./, ""); return h === "youtube.com" || h === "youtu.be"; }catch(e){ return false; }
}
export function ageFrom(birth){
  if (!birth) return null;
  const b = new Date(birth + "T00:00:00"), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a >= 0 && a < 120 ? a : null;
}
export const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const DIAS_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function downloadBlob(filename, data, type){
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
