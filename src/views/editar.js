// Editar um treino ou caminhada já registrados (corrigir carga, repetições, horário, km, dor).
// Trabalha numa cópia (rascunho); só grava ao tocar em "Salvar".
import { S, flush, getEx, kcalOf, dorLabel, setStatus } from "../store.js";
import { ui, actions, inputs, go, rerenderKeepScroll } from "../ui.js";
import { esc, num, fmtNum, ddmmyyyy, timeOf, clone, $ } from "../util.js";

export function abrirEdicao(id){
  if (!S.sessions[id]) return;
  const s = clone(S.sessions[id]);
  ui.draft = { s, ini: timeOf(s.start), fim: timeOf(s.end) };
  go("evolucao", "editar");
}

const field = (id, label, value, attrs = "") => `<div class="field"><label class="lab" for="${id}">${label}</label><input id="${id}" class="txt" ${attrs} value="${esc(value)}"></div>`;

export function editarHtml(){
  const D = ui.draft; if (!D) return `<div class="empty">Nada para editar.</div>`;
  const s = D.s, treino = s.type === "treino";
  let h = `<div class="between"><h2 style="margin-top:4px">Editar ${treino ? "treino " + esc(s.treino) : "caminhada"}</h2><button class="linkbtn" data-act="edCancel">Cancelar</button></div>
    <div class="panel">
      ${field("ed-date", "Data", s.date, 'type="date" data-act="edF" data-f="date"')}
      <div class="grid2">${field("ed-ini", "Início", D.ini, 'type="time" data-act="edF" data-f="ini"')}${field("ed-fim", "Fim", D.fim, 'type="time" data-act="edF" data-f="fim"')}</div>
      ${treino ? "" : field("ed-km", "Distância (km)", s.km != null ? fmtNum(s.km) : "", 'type="text" inputmode="decimal" data-act="edF" data-f="km"')}
      <div class="grid2">${field("ed-dorA", dorLabel() + " antes", s.pre && s.pre.dor != null ? s.pre.dor : "", 'type="text" inputmode="numeric" data-act="edF" data-f="dorA"')}${field("ed-dorD", dorLabel() + " depois", s.post && s.post.dor != null ? s.post.dor : "", 'type="text" inputmode="numeric" data-act="edF" data-f="dorD"')}</div>
      ${field("ed-obs", "Observação", (s.post && s.post.obs) || "", 'type="text" maxlength="200" data-act="edF" data-f="obs"')}
    </div>`;
  if (treino){
    // exercícios na ordem do treino, depois os que existirem só nos registros
    const ordem = ((s.plano && s.plano.ex) || []).map(x => x.exId);
    Object.keys(s.sets || {}).forEach(id => { if (!ordem.includes(id)) ordem.push(id); });
    h += `<h2>Séries</h2>`;
    ordem.forEach(id => {
      const ex = getEx(id), sets = (s.sets || {})[id] || [];
      h += `<div class="ex"><h3>${esc(ex.nome)}</h3><div class="set-cols"><span>Série</span><span>${ex.load === false ? "" : "Carga (" + esc(ex.unit || "kg") + ")"}</span><span>Repetições</span><span></span></div><div class="sets">`;
      sets.forEach((x, i) => {
        h += `<div class="set"><label>Série ${i + 1}</label>
          ${ex.load === false ? "<span></span>" : `<input type="text" inputmode="decimal" aria-label="Carga série ${i + 1}" data-act="edS" data-ex="${esc(id)}" data-i="${i}" data-k="kg" value="${esc(x.kg ? String(x.kg).replace(".", ",") : "")}">`}
          <input type="text" inputmode="numeric" aria-label="Repetições série ${i + 1}" data-act="edS" data-ex="${esc(id)}" data-i="${i}" data-k="reps" value="${esc(x.reps)}">
          <button type="button" class="chk" aria-label="Remover série ${i + 1}" data-act="edDelSet" data-ex="${esc(id)}" data-i="${i}">×</button></div>`;
      });
      h += `</div><button class="linkbtn" data-act="edAddSet" data-ex="${esc(id)}">Adicionar série</button></div>`;
    });
  }
  h += `<div class="err" id="ed-err"></div>
    <div class="row" style="margin-top:18px"><button class="btn ghost" data-act="edCancel">Cancelar</button><button class="btn strength" data-act="edSave">Salvar alterações</button></div>`;
  return h;
}

inputs.edF = el => {
  const D = ui.draft, s = D.s, v = el.value.trim(), f = el.dataset.f;
  if (f === "ini" || f === "fim") D[f] = v;
  else if (f === "date") s.date = v;
  else if (f === "km") s.km = num(v);
  else if (f === "dorA"){ s.pre = s.pre || {}; s.pre.dor = v === "" ? null : Math.max(0, Math.min(10, parseInt(v, 10) || 0)); }
  else if (f === "dorD"){ s.post = s.post || {}; s.post.dor = v === "" ? null : Math.max(0, Math.min(10, parseInt(v, 10) || 0)); }
  else if (f === "obs"){ s.post = s.post || {}; s.post.obs = v; }
};
inputs.edS = el => {
  const x = ui.draft.s.sets[el.dataset.ex][+el.dataset.i];
  x[el.dataset.k] = el.value.trim().replace(",", ".");
  if (num(x.reps) != null) x.ok = true;
};
actions.edAddSet = el => { const a = ui.draft.s.sets[el.dataset.ex]; const l = a[a.length - 1] || {}; a.push({ kg: l.kg || "", reps: "", ok: false }); rerenderKeepScroll(); };
actions.edDelSet = el => { ui.draft.s.sets[el.dataset.ex].splice(+el.dataset.i, 1); rerenderKeepScroll(); };
actions.edCancel = () => { ui.draft = null; go("evolucao"); };
actions.edSave = () => {
  const D = ui.draft, s = D.s;
  const toIso = t => { const [h, m] = (t || "").split(":").map(Number); const d = new Date(s.date + "T00:00:00"); d.setHours(h, m, 0, 0); return d; };
  if (!s.date || !D.ini || !D.fim){ $("#ed-err").textContent = "Preencha data, início e fim."; return; }
  const ini = toIso(D.ini); let fim = toIso(D.fim);
  if (fim <= ini) fim = new Date(fim.getTime() + 86400000); // terminou depois da meia-noite
  if (fim - ini > 6 * 3600000){ $("#ed-err").textContent = "Duração acima de 6 horas: confira os horários."; return; }
  if (s.type === "caminhada" && !(s.km > 0)){ $("#ed-err").textContent = "Informe a distância em km."; return; }
  s.start = ini.toISOString(); s.end = fim.toISOString();
  // remove séries totalmente vazias
  Object.keys(s.sets || {}).forEach(id => { s.sets[id] = s.sets[id].filter(x => num(x.kg) != null || num(x.reps) != null); });
  s.kcal = kcalOf(s);
  s.editado = new Date().toISOString();
  S.sessions[s.id] = s; flush("sessions", s.id);
  ui.draft = null; go("evolucao");
  setStatus("Registro de " + ddmmyyyy(s.date) + " atualizado");
};
