// Planos de treino: lista, modelos prontos, editor (ABC/ABCD/ABCDE) e escolha de exercícios.
import { S, save, flush, activePlan, planLetters, getEx, allExercises, restOf } from "../store.js";
import { ui, actions, inputs, changes, render, go, rerenderKeepScroll, openModal, closeModal, modalState } from "../ui.js";
import { esc, num, norm, newId, clone, restLabel, yt, isYoutubeUrl, DIAS_CURTO, $ } from "../util.js";
import { TEMPLATES, LETTERS, SPLITS, emptyTreinos, WARMUP_GERAL } from "../data/templates.js";
import { GRUPOS, EQUIP, LOMBAR, defaultRx } from "../data/exercises.js";
import { downloadTemplate, pickSpreadsheet } from "../importar.js";

export const hasLombar = () => !!(S.profile && (S.profile.restricoes || []).includes("lombar"));

export function videoUrl(ex){ return ex.video && isYoutubeUrl(ex.video) ? ex.video : yt(ex.v || (ex.nome + " execução correta")); }
export function lombarTag(ex){
  if (!hasLombar() || !LOMBAR[ex.lombar]) return "";
  const L = LOMBAR[ex.lombar];
  return `<span class="tag ${L.cls}">${L.label}</span>`;
}

/* ---------- criação de planos ---------- */
export function planFromTemplate(tpl){
  const id = newId("p");
  return { id, nome: tpl.nome, split: tpl.split, warmup: clone(tpl.warmup), treinos: clone(tpl.treinos), criado: new Date().toISOString() };
}
export function emptyPlan(split){
  return { id: newId("p"), nome: "Meu treino " + split, split, warmup: clone(WARMUP_GERAL), treinos: emptyTreinos(split), criado: new Date().toISOString() };
}
export function addPlanAndActivate(p){
  S.plans[p.id] = p; flush("plans", p.id);
  S.settings.activePlanId = p.id; flush("kv", "settings");
  ui.editL = planLetters(p)[0];
}

/* ---------- lista de planos ---------- */
export function viewPlanos(){
  const ap = activePlan();
  let h = `<div class="between"><h2 style="margin-top:4px">Planos de treino</h2><button class="linkbtn" data-act="backTreinos">Voltar</button></div>`;
  const plans = Object.values(S.plans).sort((a, b) => (b.criado || "").localeCompare(a.criado || ""));
  if (plans.length){
    h += `<div class="panel"><ul class="pick">`;
    plans.forEach(p => {
      const isA = ap && ap.id === p.id;
      h += `<li><div><div class="nm">${esc(p.nome)}</div><div class="small muted">Divisão ${esc(p.split)}${isA ? ' · <span class="tag">em uso</span>' : ""}</div></div>
        <div class="row" style="flex-wrap:nowrap">${isA ? "" : `<button class="btn ghost sm" data-act="usePlan" data-id="${esc(p.id)}">Usar</button>`}<button class="btn ghost sm" data-act="editPlanId" data-id="${esc(p.id)}">Editar</button></div></li>`;
    });
    h += `</ul></div>`;
  }
  h += `<h2>Começar um plano novo</h2>`;
  h += templatesHtml();
  return h;
}
export function templatesHtml(){
  let h = "";
  TEMPLATES.forEach(t => {
    h += `<div class="panel"><div class="between"><h3>${esc(t.nome)}</h3><span class="tag">${t.split}</span></div><p class="small muted" style="margin:6px 0 10px">${esc(t.desc)}</p><button class="btn strength block" data-act="useTemplate" data-k="${t.key}">Usar este modelo</button></div>`;
  });
  h += `<div class="panel"><h3>Montar do zero</h3><p class="small muted" style="margin:6px 0 10px">Escolha a divisão e depois os exercícios no banco do app.</p>
    <div class="row">${Object.keys(SPLITS).map(s => `<button class="btn ghost" data-act="newEmpty" data-split="${s}">${s}</button>`).join("")}</div></div>`;
  h += `<div class="panel"><h3>Importar de uma planilha</h3><p class="small muted" style="margin:6px 0 10px">Preencha o modelo no Excel ou no Google Planilhas e envie o arquivo (.xlsx ou .csv).</p>
    <div class="row"><button class="btn ghost" data-act="downloadTemplate">Baixar modelo</button><button class="btn strength" data-act="importSheet">Enviar planilha</button></div></div>`;
  return h;
}
actions.backTreinos = () => go("treinos");
actions.usePlan = el => { S.settings.activePlanId = el.dataset.id; flush("kv", "settings"); go("treinos"); };
actions.editPlanId = el => { S.settings.activePlanId = el.dataset.id; flush("kv", "settings"); ui.editL = null; go("treinos", "plano"); };
actions.useTemplate = el => {
  const t = TEMPLATES.find(x => x.key === el.dataset.k);
  addPlanAndActivate(planFromTemplate(t));
  if (ui.afterPlanCreated) return ui.afterPlanCreated();
  go("treinos", "plano");
};
actions.newEmpty = el => {
  addPlanAndActivate(emptyPlan(el.dataset.split));
  if (ui.afterPlanCreated) return ui.afterPlanCreated();
  go("treinos", "plano");
};
actions.downloadTemplate = () => downloadTemplate();
actions.importSheet = () => pickSpreadsheet();

/* ---------- editor do plano ---------- */
export function viewPlanoEditor(){
  const p = activePlan();
  if (!p) return viewPlanos();
  const Ls = planLetters(p);
  if (!ui.editL || !p.treinos[ui.editL]) ui.editL = Ls[0];
  const L = ui.editL, t = p.treinos[L];
  let h = `<div class="between"><h2 style="margin-top:4px">Editar plano</h2><button class="linkbtn" data-act="backTreinos">Concluir</button></div>`;
  h += `<div class="panel"><div class="field" style="margin-top:0"><label class="lab" for="pl-nome">Nome do plano</label><input id="pl-nome" class="txt" type="text" maxlength="50" value="${esc(p.nome)}" data-act="planNome"></div>
    <div class="field"><span class="lab">Divisão</span><div class="scale" style="--n:3" role="group">${Object.keys(SPLITS).map(s => `<button type="button" data-act="planSplit" data-v="${s}" aria-pressed="${p.split === s}">${s}</button>`).join("")}</div></div></div>`;

  h += `<div class="seg" role="group" aria-label="Treino" style="--n:${Ls.length};margin-top:14px">`;
  Ls.forEach(k => { h += `<button type="button" data-act="editL" data-t="${k}" aria-pressed="${k === L}">${k}<span>${(p.treinos[k].dias || []).map(d => DIAS_CURTO[d]).join(", ") || "sem dia"}</span></button>`; });
  h += `</div>`;

  h += `<div class="panel" style="margin-top:12px">
    <div class="field" style="margin-top:0"><label class="lab" for="pl-foco">Foco do treino ${L}</label><input id="pl-foco" class="txt" type="text" maxlength="60" placeholder="Ex.: Peito e tríceps" value="${esc(t.foco)}" data-act="planFoco"></div>
    <div class="field"><span class="lab">Dias da semana</span><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" class="chip" data-act="planDia" data-v="${d}" aria-pressed="${(t.dias || []).includes(d)}">${DIAS_CURTO[d]}</button>`).join("")}</div></div>
  </div>`;

  h += `<h2>Exercícios do treino ${L}</h2><div class="panel">`;
  if (!t.ex.length) h += `<div class="empty">Nenhum exercício ainda. Toque em "Adicionar exercício".</div>`;
  t.ex.forEach((it, i) => {
    const ex = getEx(it.exId);
    h += `<div class="plan-ex"><div class="ord"><button class="iconbtn" data-act="exUp" data-i="${i}" aria-label="Subir" ${i === 0 ? "disabled" : ""}>↑</button><button class="iconbtn" data-act="exDown" data-i="${i}" aria-label="Descer" ${i === t.ex.length - 1 ? "disabled" : ""}>↓</button></div>
      <div class="body"><div class="nm"><strong>${esc(ex.nome)}</strong></div><div class="small muted">${esc(it.rx)}, ${esc(it.rir)}, descanso ${restLabel(restOf(it))}</div>${lombarTag(ex) ? `<div style="margin-top:4px">${lombarTag(ex)}</div>` : ""}
      <div class="row" style="gap:14px"><button class="linkbtn" data-act="exEdit" data-i="${i}">Ajustar</button><button class="linkbtn danger" data-act="exRemove" data-i="${i}">Remover</button></div></div></div>`;
  });
  h += `<button class="btn strength block" style="margin-top:12px" data-act="openPicker">Adicionar exercício</button></div>`;

  h += `<h2>Aquecimento</h2><div class="panel"><label class="lab small muted" for="pl-warm">Um item por linha. Vale para todos os treinos deste plano.</label>
    <textarea id="pl-warm" class="txt" rows="6" style="margin-top:6px" data-act="planWarm">${esc((p.warmup || []).map(w => w.t).join("\n"))}</textarea></div>`;

  h += `<div class="row" style="margin-top:18px"><button class="btn strength" data-act="goResumo">Ver equilíbrio do plano</button><button class="btn ghost" data-act="goPlanosFromEditor">Ver todos os planos</button></div>
    <div class="row" style="margin-top:10px"><button class="btn danger" data-act="delPlan">Apagar este plano</button></div>`;
  return h;
}
const curPlan = () => activePlan();
const curT = () => curPlan().treinos[ui.editL];
inputs.planNome = el => { curPlan().nome = el.value.trim() || "Meu treino"; save("plans", curPlan().id); };
inputs.planFoco = el => { curT().foco = el.value.trim(); save("plans", curPlan().id); };
inputs.planWarm = el => {
  const p = curPlan(), old = p.warmup || [];
  p.warmup = el.value.split("\n").map(s => s.trim()).filter(Boolean).map(t => { const o = old.find(w => w.t === t); return o ? o : { t }; });
  save("plans", p.id);
};
actions.editL = el => { ui.editL = el.dataset.t; rerenderKeepScroll(); };
actions.planDia = el => {
  const t = curT(), d = +el.dataset.v; t.dias = t.dias || [];
  const i = t.dias.indexOf(d); if (i >= 0) t.dias.splice(i, 1); else t.dias.push(d);
  t.dias.sort(); save("plans", curPlan().id); rerenderKeepScroll();
};
actions.planSplit = el => {
  const p = curPlan(), s = el.dataset.v; if (s === p.split) return;
  const n = SPLITS[s], drop = LETTERS.slice(n).filter(L => p.treinos[L] && p.treinos[L].ex.length);
  if (drop.length && !confirm(`Mudar para ${s} remove o${drop.length > 1 ? "s" : ""} treino${drop.length > 1 ? "s" : ""} ${drop.join(", ")} e seus exercícios deste plano. Os registros já feitos não são apagados. Continuar?`)) return;
  const empty = emptyTreinos(s), nt = {};
  LETTERS.slice(0, n).forEach(L => { if (p.treinos[L]) nt[L] = p.treinos[L]; });
  // treinos novos ganham o primeiro dia da semana ainda livre (seg a sáb)
  LETTERS.slice(0, n).forEach(L => {
    if (nt[L]) return;
    const used = new Set(Object.values(nt).flatMap(t => t.dias || []));
    const free = [1, 2, 3, 4, 5, 6].find(d => !used.has(d));
    nt[L] = Object.assign(empty[L], { dias: free != null ? [free] : [] });
  });
  p.treinos = nt; p.split = s; ui.editL = "A";
  flush("plans", p.id); rerenderKeepScroll();
};
function moveEx(i, d){ const a = curT().ex, j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; save("plans", curPlan().id); rerenderKeepScroll(); }
actions.exUp = el => moveEx(+el.dataset.i, -1);
actions.exDown = el => moveEx(+el.dataset.i, 1);
actions.exRemove = el => { const ex = getEx(curT().ex[+el.dataset.i].exId); if (!confirm(`Remover ${ex.nome} do treino ${ui.editL}?`)) return; curT().ex.splice(+el.dataset.i, 1); save("plans", curPlan().id); rerenderKeepScroll(); };
actions.goPlanosFromEditor = () => go("treinos", "planos");
actions.delPlan = () => {
  const p = curPlan();
  if (!confirm(`Apagar o plano "${p.nome}"? Os treinos já registrados continuam salvos.`)) return;
  delete S.plans[p.id]; flush("plans", p.id);
  const other = Object.values(S.plans)[0];
  S.settings.activePlanId = other ? other.id : null; flush("kv", "settings");
  go("treinos", "planos");
};

/* ---------- ajustar exercício do plano ---------- */
const RESTS = [30, 45, 60, 75, 90, 120, 150, 180, 240];
actions.exEdit = el => {
  const i = +el.dataset.i, it = curT().ex[i], ex = getEx(it.exId);
  openModal(`<h3>${esc(ex.nome)}</h3>
    <div class="grid2">
      <div class="field"><label class="lab" for="ee-series">Séries</label><input id="ee-series" class="txt" type="text" inputmode="numeric" value="${esc(it.series)}"></div>
      <div class="field"><label class="lab" for="ee-rest">Descanso</label><select id="ee-rest" class="txt"><option value="0" ${!(it.rest > 0) ? "selected" : ""}>Padrão (${restLabel(restOf(null))})</option>${RESTS.concat(!(it.rest > 0) || RESTS.includes(it.rest) ? [] : [it.rest]).map(s => `<option value="${s}" ${s === it.rest ? "selected" : ""}>${restLabel(s)}</option>`).join("")}</select></div>
    </div>
    <div class="grid2">
      <div class="field"><label class="lab" for="ee-rx">Repetições</label><input id="ee-rx" class="txt" type="text" maxlength="40" value="${esc(it.rx)}"><div class="help">Ex.: 3 × 8–12</div></div>
      <div class="field"><label class="lab" for="ee-rir">Intensidade</label><input id="ee-rir" class="txt" type="text" maxlength="30" value="${esc(it.rir)}"><div class="help">RIR = repetições que sobram</div></div>
    </div>
    <div class="field"><label class="lab" for="ee-nota">Observação de técnica</label><textarea id="ee-nota" class="txt" maxlength="300">${esc(it.nota != null ? it.nota : ex.nota)}</textarea></div>
    <div class="field"><label class="lab" for="ee-video">Link do vídeo no YouTube</label><input id="ee-video" class="txt" type="url" inputmode="url" placeholder="Cole aqui o link de um vídeo (opcional)" value="${esc(ex.video || "")}">
      <div class="help">Sem link, o botão "Ver vídeo" abre uma busca no YouTube. O link vale para este exercício em todos os planos.</div></div>
    <div class="err" id="ee-err"></div>
    <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn strength" data-act="exEditSave" data-i="${i}">Salvar</button></div>`);
};
actions.exEditSave = el => {
  const it = curT().ex[+el.dataset.i], ex = getEx(it.exId);
  const series = parseInt($("#ee-series").value, 10), video = $("#ee-video").value.trim();
  if (!(series >= 1 && series <= 10)){ $("#ee-err").textContent = "Séries: de 1 a 10."; return; }
  if (video && !isYoutubeUrl(video)){ $("#ee-err").textContent = "O link precisa ser do YouTube (youtube.com ou youtu.be)."; return; }
  it.series = series;
  const rest = parseInt($("#ee-rest").value, 10); if (rest > 0) it.rest = rest; else delete it.rest;
  it.rx = $("#ee-rx").value.trim() || it.rx; it.rir = $("#ee-rir").value.trim();
  const nota = $("#ee-nota").value.trim();
  if (nota !== (ex.nota || "")) it.nota = nota; else delete it.nota;
  setVideo(it.exId, video);
  flush("plans", curPlan().id); closeModal(); rerenderKeepScroll();
};
export function setVideo(exId, video){
  const ov = S.exOverrides[exId] || { id: exId };
  if ((ov.video || "") === video) return;
  if (video) ov.video = video; else delete ov.video;
  S.exOverrides[exId] = ov; flush("exercises", exId);
}

/* ---------- escolher exercícios do banco ---------- */
actions.openPicker = () => {
  openModal(`<div class="between"><h3>Adicionar ao treino ${ui.editL}</h3><button class="linkbtn" data-act="closeModal">Fechar</button></div>
    <div class="field" style="margin-top:10px"><input id="pk-q" class="txt" type="search" placeholder="Buscar exercício" data-act="pickQ" autocomplete="off"></div>
    <div class="chips" style="margin-top:10px"><button type="button" class="chip" data-act="pickG" data-v="" aria-pressed="true">Todos</button>${Object.keys(GRUPOS).map(g => `<button type="button" class="chip" data-act="pickG" data-v="${g}" aria-pressed="false">${GRUPOS[g]}</button>`).join("")}</div>
    ${hasLombar() ? `<label class="small" style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="pk-safe" data-act="pickSafe" checked style="width:20px;height:20px;accent-color:var(--strength)"> Esconder exercícios para evitar com hérnia</label>` : ""}
    <ul class="pick" id="pickList" style="margin-top:8px"></ul>
    <button class="btn ghost block" style="margin-top:12px" data-act="newCustomEx">Criar exercício que não está na lista</button>`,
    { q: "", g: "", safe: hasLombar() });
  renderPickList();
};
function renderPickList(){
  const st = modalState, q = norm(st.q), inPlan = new Set(curT().ex.map(x => x.exId));
  const arr = allExercises().filter(e => (!st.g || e.grupo === st.g) && (!st.safe || e.lombar !== "evitar") && (!q || norm(e.nome).includes(q)));
  const el = $("#pickList"); if (!el) return;
  if (!arr.length){ el.innerHTML = `<li class="muted">Nenhum exercício encontrado.</li>`; return; }
  el.innerHTML = arr.map(e => `<li><div style="min-width:0"><div class="nm">${esc(e.nome)}</div><div class="small muted">${esc(GRUPOS[e.grupo] || "")} · ${esc(EQUIP[e.equip] || "")}</div>${lombarTag(e) ? `<div style="margin-top:3px">${lombarTag(e)}</div>` : ""}</div>
    <div class="row" style="flex-wrap:nowrap;align-items:center"><a class="linkbtn" href="${esc(videoUrl(e))}" target="_blank" rel="noopener">Vídeo</a>${inPlan.has(e.id) ? `<span class="tag gray">no treino</span>` : `<button class="iconbtn add" data-act="pickAdd" data-id="${esc(e.id)}" aria-label="Adicionar ${esc(e.nome)}">+</button>`}</div></li>`).join("");
}
inputs.pickQ = el => { modalState.q = el.value; renderPickList(); };
actions.pickG = el => { modalState.g = el.dataset.v; el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false")); renderPickList(); };
changes.pickSafe = el => { modalState.safe = el.checked; renderPickList(); };
actions.pickAdd = el => {
  const ex = getEx(el.dataset.id), t = curT();
  if (ex.lombar === "evitar" && hasLombar() && !confirm(`${ex.nome} é um exercício para evitar com hérnia lombar. Adicionar mesmo assim?`)) return;
  t.ex.push(Object.assign({ exId: ex.id }, defaultRx(ex)));
  save("plans", curPlan().id);
  renderPickList();
  rerenderBehindModal();
};
function rerenderBehindModal(){ const y = window.scrollY; const app = $("#app"); if (app) { render(); window.scrollTo(0, y); } }

/* ---------- exercício personalizado ---------- */
actions.newCustomEx = () => {
  const q = modalState.q || "";
  openModal(`<h3>Novo exercício</h3>
    <div class="field"><label class="lab" for="cx-nome">Nome</label><input id="cx-nome" class="txt" type="text" maxlength="60" value="${esc(q)}"></div>
    <div class="grid2">
      <div class="field"><label class="lab" for="cx-grupo">Grupo muscular</label><select id="cx-grupo" class="txt">${Object.keys(GRUPOS).map(g => `<option value="${g}">${GRUPOS[g]}</option>`).join("")}</select></div>
      <div class="field"><label class="lab" for="cx-equip">Equipamento</label><select id="cx-equip" class="txt">${Object.keys(EQUIP).map(g => `<option value="${g}">${EQUIP[g]}</option>`).join("")}</select></div>
    </div>
    <div class="grid2">
      <div class="field"><label class="lab" for="cx-tipo">Tipo</label><select id="cx-tipo" class="txt"><option value="c">Composto (várias articulações)</option><option value="i">Isolado</option><option value="core">Core</option></select></div>
      <div class="field"><label class="lab" for="cx-lombar">Para a lombar</label><select id="cx-lombar" class="txt"><option value="seguro">Seguro</option><option value="cuidado" selected>Cuidado</option><option value="evitar">Evitar</option></select></div>
    </div>
    <label class="small" style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="cx-noload" style="width:20px;height:20px;accent-color:var(--strength)"> Sem carga (registrar só repetições ou segundos)</label>
    <div class="field"><label class="lab" for="cx-video">Link do vídeo no YouTube (opcional)</label><input id="cx-video" class="txt" type="url" inputmode="url"></div>
    <div class="field"><label class="lab" for="cx-nota">Observação de técnica (opcional)</label><textarea id="cx-nota" class="txt" maxlength="300"></textarea></div>
    <div class="err" id="cx-err"></div>
    <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="openPicker">Voltar</button><button class="btn strength" data-act="saveCustomEx">Criar e adicionar</button></div>`);
};
export function createCustomEx(data){
  const id = "u_" + (norm(data.nome).replace(/ /g, "_").slice(0, 30) || "ex") + "_" + Math.random().toString(36).slice(2, 6);
  const ex = Object.assign({ id, custom: true, grupo: "outros", equip: "corpo", tipo: "c", lombar: "cuidado", nota: "" }, data, { id });
  S.exOverrides[id] = ex; flush("exercises", id);
  return ex;
}
actions.saveCustomEx = () => {
  const nome = $("#cx-nome").value.trim(), video = $("#cx-video").value.trim();
  if (!nome){ $("#cx-err").textContent = "Informe o nome."; return; }
  if (video && !isYoutubeUrl(video)){ $("#cx-err").textContent = "O link precisa ser do YouTube."; return; }
  const ex = createCustomEx({ nome, grupo: $("#cx-grupo").value, equip: $("#cx-equip").value, tipo: $("#cx-tipo").value, lombar: $("#cx-lombar").value, nota: $("#cx-nota").value.trim(), video: video || undefined, load: $("#cx-noload").checked ? false : undefined });
  curT().ex.push(Object.assign({ exId: ex.id }, defaultRx(ex)));
  save("plans", curPlan().id); closeModal(); rerenderKeepScroll();
};
