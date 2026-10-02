// Importação de plano de treino por planilha (.xlsx ou .csv) e modelo para download.
import { S, allExercises, getEx, save } from "./store.js";
import { ui, actions, openModal, closeModal, go } from "./ui.js";
import { esc, norm, newId, DIAS_CURTO, downloadBlob } from "./util.js";
import { TEMPLATES, LETTERS, SPLITS, WARMUP_GERAL, WARMUP_COLUNA } from "./data/templates.js";
import { GRUPOS, LOMBAR, defaultRx } from "./data/exercises.js";
import { addPlanAndActivate, createCustomEx, hasLombar } from "./views/plano.js";

const HEAD = ["Treino", "Dias", "Foco", "Exercício", "Séries", "Repetições", "Intensidade (RIR)", "Descanso (s)", "Observação", "Link do vídeo"];
const loadXLSX = () => import("xlsx");

/* ---------- modelo ---------- */
export async function downloadTemplate(){
  const XLSX = await loadXLSX();
  const tpl = TEMPLATES[0], rows = [HEAD];
  LETTERS.filter(L => tpl.treinos[L]).forEach(L => {
    const t = tpl.treinos[L];
    t.ex.forEach((it, i) => {
      rows.push([L, i === 0 ? t.dias.map(d => DIAS_CURTO[d]).join(", ") : "", i === 0 ? t.foco : "", getEx(it.exId).nome, it.series, it.rx.replace(/^\d+(–\d+)?\s*×\s*/, ""), it.rir, it.rest, "", ""]);
    });
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [6, 14, 30, 34, 8, 18, 18, 13, 30, 30].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Treino");
  const instr = [
    ["Como preencher"],
    ["1. Uma linha por exercício. Apague os exemplos e escreva o seu treino."],
    ["2. Treino: letra A, B, C, D ou E. Use A a C para ABC, A a D para ABCD, A a E para ABCDE."],
    ["3. Dias e Foco: basta preencher na primeira linha de cada treino. Dias: Seg, Ter, Qua, Qui, Sex, Sáb, Dom (separados por vírgula)."],
    ["4. Exercício: use o nome da aba \"Exercícios do app\" para o app reconhecer. Nomes diferentes viram exercícios novos."],
    ["5. Séries: número (ex.: 3). Repetições: ex.: 8-12. Descanso: em segundos (ex.: 90)."],
    ["6. Link do vídeo: opcional, link do YouTube."],
    ["7. Salve como .xlsx (ou .csv) e envie pelo app em Treinos > Planos > Enviar planilha."]
  ];
  const wsI = XLSX.utils.aoa_to_sheet(instr); wsI["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, wsI, "Instruções");
  const exRows = [["Exercício", "Grupo", "Para a lombar"]].concat(allExercises().map(e => [e.nome, GRUPOS[e.grupo] || "", (LOMBAR[e.lombar] || {}).label || ""]));
  const wsE = XLSX.utils.aoa_to_sheet(exRows); wsE["!cols"] = [{ wch: 40 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsE, "Exercícios do app");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob("modelo-treino.xlsx", new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}

/* ---------- leitura ---------- */
export function pickSpreadsheet(){
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";
  inp.addEventListener("change", () => { if (inp.files[0]) handleFile(inp.files[0]); });
  inp.click();
}
function parseCsv(text){
  text = text.replace(/^﻿/, "");
  const first = text.split(/\r?\n/)[0] || "";
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (q){
      if (c === '"' && text[i + 1] === '"'){ cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep){ row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r"){ if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length){ row.push(cell); rows.push(row); }
  return rows;
}
async function readRows(file){
  if (/\.csv$/i.test(file.name)) return parseCsv(await file.text());
  const XLSX = await loadXLSX();
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const name = wb.SheetNames.find(n => norm(n) === "treino") || wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: false });
}
const DAY_KEYS = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
function parseDias(s){
  const out = [];
  norm(s).split(" ").forEach(tok => { const d = DAY_KEYS[tok.slice(0, 3)]; if (d != null && !out.includes(d)) out.push(d); });
  return out.sort();
}
function parseRest(s, fallback){
  const t = norm(s); if (!t) return fallback;
  const n = parseFloat(t.replace(",", "."));
  if (!isFinite(n) || n <= 0) return fallback;
  return /min/.test(t) || n <= 5 ? Math.round(n * 60) : Math.round(n);
}
function matchExercise(name, list){
  const n = norm(name), noParen = s => norm(String(s).replace(/\(.*?\)/g, ""));
  return list.find(e => norm(e.nome) === n || e.id === name.trim())
    || list.find(e => noParen(e.nome) === noParen(name))
    || null;
}

export function parsePlanRows(rows){
  const hi = rows.findIndex(r => r.some(c => norm(c) === "exercicio"));
  if (hi < 0) return { error: "Não encontrei a coluna \"Exercício\". Use o modelo do app." };
  const h = rows[hi].map(norm), col = keys => h.findIndex(x => keys.some(k => x.startsWith(k)));
  const C = { treino: col(["treino"]), dias: col(["dia"]), foco: col(["foco"]), ex: col(["exercicio"]), series: col(["serie"]), reps: col(["repet"]), rir: col(["intensidade", "rir"]), rest: col(["descanso"]), obs: col(["observ"]), video: col(["link", "video"]) };
  if (C.treino < 0) return { error: "Não encontrei a coluna \"Treino\" (A, B, C, D ou E)." };
  const list = allExercises(), treinos = {}, unknown = new Map(), warnings = [];
  let lastL = null;
  rows.slice(hi + 1).forEach((r, k) => {
    const get = i => i >= 0 && r[i] != null ? String(r[i]).trim() : "";
    const nome = get(C.ex);
    const Lraw = get(C.treino).toUpperCase().replace(/^TREINO\s*/, "").charAt(0);
    const L = LETTERS.includes(Lraw) ? Lraw : (Lraw ? null : lastL);
    if (!nome && !Lraw) return;
    if (!L){ warnings.push(`Linha ${hi + k + 2}: treino "${get(C.treino)}" ignorado (use A a E).`); return; }
    lastL = L;
    const t = treinos[L] = treinos[L] || { foco: "", dias: [], ex: [] };
    if (get(C.foco) && !t.foco) t.foco = get(C.foco);
    if (get(C.dias)) parseDias(get(C.dias)).forEach(d => { if (!t.dias.includes(d)) t.dias.push(d); });
    if (!nome) return;
    let ex = matchExercise(nome, list);
    if (!ex){ const key = norm(nome); if (!unknown.has(key)) unknown.set(key, nome); ex = { id: "?" + key, nome, tipo: "c" }; }
    const d = defaultRx(ex);
    const series = Math.min(10, Math.max(1, parseInt(get(C.series), 10) || d.series));
    const repsTxt = get(C.reps).replace(/-/g, "–");
    const rx = repsTxt ? (/[×x]/i.test(repsTxt) ? repsTxt.replace(/\s*x\s*/i, " × ") : `${series} × ${repsTxt}`) : `${series} × ${d.rx.split("× ")[1]}`;
    const item = { exId: ex.id, series, rx, rir: get(C.rir) || d.rir, rest: parseRest(get(C.rest), d.rest) };
    if (get(C.obs)) item.nota = get(C.obs);
    const video = get(C.video); if (video) item._video = video;
    t.ex.push(item);
  });
  const Ls = LETTERS.filter(L => treinos[L]);
  if (!Ls.length) return { error: "A planilha não tem nenhum exercício preenchido." };
  const maxIdx = LETTERS.indexOf(Ls[Ls.length - 1]);
  const split = maxIdx <= 2 ? "ABC" : maxIdx === 3 ? "ABCD" : "ABCDE";
  LETTERS.slice(0, SPLITS[split]).forEach(L => { if (!treinos[L]){ treinos[L] = { foco: "", dias: [], ex: [] }; warnings.push(`O treino ${L} ficou vazio. Você pode completá-lo no app.`); } });
  return { split, treinos, unknown: [...unknown.values()], warnings };
}

async function handleFile(file){
  let res;
  try{ res = parsePlanRows(await readRows(file)); }
  catch(e){ res = { error: "Não foi possível ler este arquivo. Salve como .xlsx ou .csv e tente de novo." }; }
  if (res.error){ openModal(`<h3>Importar planilha</h3><p style="margin-top:10px">${esc(res.error)}</p><div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Fechar</button><button class="btn strength" data-act="downloadTemplate">Baixar modelo</button></div>`); return; }
  pending = { res, fileName: file.name.replace(/\.[^.]+$/, "") };
  let h = `<h3>Conferir planilha</h3><p class="small muted" style="margin-top:6px">Divisão ${res.split}. Confira antes de criar o plano.</p><ul class="pick">`;
  LETTERS.filter(L => res.treinos[L]).forEach(L => {
    const t = res.treinos[L];
    h += `<li><div><div class="nm">Treino ${L}${t.foco ? ": " + esc(t.foco) : ""}</div><div class="small muted">${t.ex.length} exercício${t.ex.length === 1 ? "" : "s"} · ${t.dias.length ? t.dias.map(d => DIAS_CURTO[d]).join(", ") : "sem dia definido"}</div></div></li>`;
  });
  h += `</ul>`;
  if (res.unknown.length) h += `<div class="infobox" style="margin-top:12px"><strong>${res.unknown.length} exercício${res.unknown.length === 1 ? "" : "s"} não ${res.unknown.length === 1 ? "está" : "estão"} no banco do app</strong> e ${res.unknown.length === 1 ? "será criado" : "serão criados"} como novo${res.unknown.length === 1 ? "" : "s"}: ${res.unknown.map(esc).join(", ")}.${hasLombar() ? " Confira se são seguros para a sua lombar." : ""}</div>`;
  if (res.warnings.length) h += `<ul class="small muted" style="margin:12px 0 0;padding-left:18px">${res.warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul>`;
  h += `<div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Cancelar</button><button class="btn strength" data-act="confirmImport">Criar plano</button></div>`;
  openModal(h);
}
let pending = null;
actions.confirmImport = () => {
  if (!pending) return closeModal();
  const { res, fileName } = pending; pending = null;
  const created = {};
  res.unknown.forEach(nome => { created[norm(nome)] = createCustomEx({ nome }).id; });
  LETTERS.forEach(L => {
    const t = res.treinos[L]; if (!t) return;
    t.ex.forEach(it => {
      if (it.exId.startsWith("?")) it.exId = created[it.exId.slice(1)];
      if (it._video){
        const ov = S.exOverrides[it.exId] || { id: it.exId };
        if (/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(it._video)){ ov.video = it._video; S.exOverrides[it.exId] = ov; }
        delete it._video;
      }
    });
  });
  Object.keys(S.exOverrides).forEach(id => save("exercises", id, 100));
  const plan = { id: newId("p"), nome: fileName || "Plano da planilha", split: res.split, warmup: hasLombar() ? WARMUP_COLUNA.slice() : WARMUP_GERAL.slice(), treinos: res.treinos, criado: new Date().toISOString() };
  addPlanAndActivate(plan);
  closeModal();
  if (ui.afterPlanCreated) return ui.afterPlanCreated();
  go("treinos", "plano");
};
