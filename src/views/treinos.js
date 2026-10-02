// Aba Treinos: ver o plano, fazer check-in, registrar séries e check-out.
import { S, save, flush, setStatus, activePlan, planLetters, treinoForDay, active, lastSetsFor, getEx, restOf, kcalOf, hasRestr, dorLabel } from "../store.js";
import { ui, views, actions, inputs, changes, render, go, rerenderKeepScroll, openModal, closeModal, modalState, scaleHtml, rangeHtml, startRest, stopRest } from "../ui.js";
import { esc, num, fmtNum, ymd, ddmm, restLabel, yt, newId, timeOf, pad, $ } from "../util.js";
import { viewPlanos, viewPlanoEditor, templatesHtml, videoUrl, lombarTag } from "./plano.js";
import { viewResumo, summaryCard } from "./equilibrio.js";
import { semanaInfo, seriesNaSemana } from "../programa.js";
import { sugestao } from "../progressao.js";

// Faixa da semana do programa de 12 semanas (deload em destaque)
export function semanaHtml(info, compacto = false){
  if (!info || info.antes || !info.fase) return "";
  const f = info.fase;
  return `<div class="${f.deload ? "infobox" : "small"}" style="${f.deload ? "background:var(--walk-soft);margin-top:10px" : "margin-top:8px"}"><strong>Semana ${info.semana} de 12${info.ciclo > 1 ? " (ciclo " + info.ciclo + ")" : ""} · ${esc(f.nome)}</strong> · ${esc(f.rir)}${compacto ? "" : `<div class="small" style="margin-top:2px">${esc(f.nota)}</div>`}</div>`;
}
const SUG_COR = { subir: "var(--strength)", deload: "var(--walk)", bloqueado: "var(--danger)", abaixo: "var(--walk)", limite: "var(--ink-2)", manter: "var(--ink-2)", reps: "var(--strength)" };
function sugHtml(sg){ return sg ? `<div class="small" style="margin-top:6px;border-left:3px solid ${SUG_COR[sg.tipo]};padding-left:8px">${sg.tipo === "subir" ? "⬆️ " : sg.tipo === "bloqueado" ? "⛔ " : "💡 "}${esc(sg.texto)}</div>` : ""; }
const planoDaSessao = s => S.plans[s.planId] || activePlan();
// Valor sugerido para cada série: a carga da sugestão (subir/deload) ou a da última vez
function sugeridoPara(last, sg, i){
  const ph = last && last.sets[i] ? last.sets[i] : (last && last.sets.length ? last.sets[last.sets.length - 1] : null);
  let kg = ph && num(ph.kg) != null ? num(ph.kg) : null, reps = ph && num(ph.reps) != null ? num(ph.reps) : null;
  if (sg && (sg.tipo === "subir" || sg.tipo === "deload") && sg.kg){ kg = sg.kg; if (sg.reps) reps = sg.reps; }
  return { kg, reps };
}

function setsSummary(sets, ex){
  const parts = sets.filter(x => num(x.reps) != null || num(x.kg) != null).map(x => (ex.load === false ? "" : (num(x.kg) != null ? fmtNum(num(x.kg)) + " kg × " : "")) + (num(x.reps) != null ? num(x.reps) : "–"));
  return parts.length ? esc(parts.join(", ")) : "sem registro";
}
export { setsSummary };
function ensureSets(s, it, n = it.series){
  if (!s.sets) s.sets = {};
  if (!s.sets[it.exId]) s.sets[it.exId] = Array.from({ length: n }, () => ({ kg: "", reps: "", ok: false }));
  return s.sets[it.exId];
}
const itemFor = (s, exId) => (s.plano.ex || []).find(x => x.exId === exId);
// Registra a última interação: treino sem atividade por 3 h é encerrado como incompleto
function touch(s){ s.lastActivity = new Date().toISOString(); save("sessions", s.id); }

views.treinos = {
  html(){
    if (ui.sub === "planos") return viewPlanos();
    if (ui.sub === "plano") return viewPlanoEditor();
    if (ui.sub === "resumo") return viewResumo();
    const at = active("treino");
    if (at) return viewAtivo(at);
    const p = activePlan();
    if (!p) return `<h2 style="margin-top:4px">Escolha um plano de treino</h2>` + templatesHtml();
    const Ls = planLetters(p);
    if (!ui.treino || !p.treinos[ui.treino]) ui.treino = treinoForDay(p, new Date().getDay()) || Ls[0];
    const L = ui.treino, t = p.treinos[L];
    let h = `<div class="between" style="margin-bottom:10px"><div class="small muted">${esc(p.nome)}</div><div class="row" style="gap:14px"><button class="linkbtn" data-act="goPlanos2">Planos</button><button class="linkbtn" data-act="goEditor">Editar plano</button></div></div>`;
    h += `<div class="seg" role="group" aria-label="Escolha o treino" style="--n:${Ls.length}">`;
    Ls.forEach(k => { h += `<button type="button" data-act="pickTreino" data-t="${k}" aria-pressed="${k === L}">${k}<span>${(p.treinos[k].dias || []).map(d => ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d]).join(", ") || "livre"}</span></button>`; });
    h += `</div>`;
    const info = semanaInfo(p);
    h += `<div class="panel" style="margin-top:12px"><h3>Treino ${L}${t.foco ? ": " + esc(t.foco) : ""}</h3>${semanaHtml(info)}`;
    if (!t.ex.length) h += `<p class="small muted" style="margin:6px 0 12px">Este treino ainda não tem exercícios.</p><button class="btn strength block" data-act="goEditor">Adicionar exercícios</button></div>`;
    else h += `<p class="small muted" style="margin:6px 0 12px">Comece pelo aquecimento. O check-in leva 10 segundos.</p><button class="btn strength block" data-act="startTreino" data-t="${L}">Fazer check-in e iniciar treino ${L}</button></div>`;
    h += summaryCard(p);
    if (t.ex.length){
      h += `<h2>Exercícios</h2>`;
      t.ex.forEach(it => {
        const ex = getEx(it.exId), last = lastSetsFor(it.exId), sg = sugestao(it, ex, null, info), ns = seriesNaSemana(it, ex, info);
        h += `<div class="ex"><div class="ex-head"><div><h3>${esc(ex.nome)}</h3><div class="rx">${esc(it.rx)}, ${esc(it.rir)}, descanso ${restLabel(restOf(it))}${ns !== it.series ? ` · <strong>nesta semana: ${ns} séries</strong>` : ""}</div></div><a class="vlink" href="${esc(videoUrl(ex))}" target="_blank" rel="noopener">Ver vídeo</a></div>
          ${lombarTag(ex) ? `<div style="margin-top:6px">${lombarTag(ex)}</div>` : ""}<p class="note">${esc(it.nota != null ? it.nota : ex.nota)}</p>${last ? `<div class="last">Última vez (${ddmm(last.date)}): ${setsSummary(last.sets, ex)}</div>` : ""}${sugHtml(sg)}</div>`;
      });
    }
    return h;
  }
};
actions.goPlanos2 = () => go("treinos", "planos");
actions.goEditor = () => { ui.editL = ui.treino; go("treinos", "plano"); };
actions.pickTreino = el => { ui.treino = el.dataset.t; render(); };
actions.openTreino = el => { ui.treino = el.dataset.t; go("treinos"); };

/* ---------- treino em andamento ---------- */
function viewAtivo(s){
  const info = semanaInfo(planoDaSessao(s), new Date(s.start));
  let h = `<div class="panel live"><div class="today-head"><div class="big-letter">${esc(s.treino)}</div><div style="flex:1"><h3>Treino ${esc(s.treino)} em andamento</h3><div class="elapsed" data-since="${esc(s.start)}">0:00</div><div class="small muted">Check-in: ${dorLabel().toLowerCase()} ${s.pre && s.pre.dor != null ? s.pre.dor : "–"}/10, energia ${s.pre && s.pre.energia ? s.pre.energia : "–"}/5</div></div></div>${semanaHtml(info)}</div>`;
  const wu = s.warmup || [], items = s.plano.warmup || [];
  if (items.length){
    h += `<h2>Aquecimento</h2><div class="panel warm"><ul>`;
    items.forEach((w, i) => { h += `<li><input type="checkbox" id="wu${i}" data-act="wu" data-i="${i}" ${wu[i] ? "checked" : ""}><label for="wu${i}">${esc(w.t)}</label>${w.v ? `<a class="vlink inline" href="${yt(w.v)}" target="_blank" rel="noopener">vídeo</a>` : ""}</li>`; });
    h += `</ul></div>`;
  }
  h += `<h2>Exercícios</h2>`;
  s.plano.ex.forEach(it => {
    const ex = getEx(it.exId), sets = ensureSets(s, it, seriesNaSemana(it, ex, info)), last = lastSetsFor(it.exId, s.id), unit = ex.load === false ? "" : (ex.unit || "kg");
    const sg = sugestao(it, ex, s, info);
    h += `<div class="ex" id="ex-${esc(it.exId)}"><div class="ex-head"><div><h3>${esc(ex.nome)}</h3><div class="rx">${esc(it.rx)}, ${esc(it.rir)}</div></div><a class="vlink" href="${esc(videoUrl(ex))}" target="_blank" rel="noopener">Ver vídeo</a></div><p class="note">${esc(it.nota != null ? it.nota : ex.nota)}</p>`;
    if (last) h += `<div class="last">Última vez (${ddmm(last.date)}): ${setsSummary(last.sets, ex)}</div>`;
    h += sugHtml(sg);
    h += `<div class="set-cols"><span>Série</span><span>${ex.load === false ? "" : "Carga (" + esc(unit) + ")"}</span><span>${ex.tipo === "core" && ex.load === false ? "Reps ou s" : "Repetições"}</span><span></span></div><div class="sets">`;
    sets.forEach((x, i) => {
      const ph = sugeridoPara(last, sg, i);
      h += `<div class="set"><label for="r-${esc(it.exId)}-${i}">Série ${i + 1}</label>`;
      h += ex.load === false ? `<span></span>` : `<input type="text" inputmode="decimal" aria-label="Carga série ${i + 1}" data-act="kg" data-ex="${esc(it.exId)}" data-i="${i}" value="${esc(x.kg ? String(x.kg).replace(".", ",") : "")}" placeholder="${ph.kg != null ? fmtNum(ph.kg) : ""}">`;
      h += `<input type="text" inputmode="numeric" id="r-${esc(it.exId)}-${i}" aria-label="Repetições série ${i + 1}" data-act="reps" data-ex="${esc(it.exId)}" data-i="${i}" value="${esc(x.reps)}" placeholder="${ph.reps != null ? ph.reps : ""}">`;
      h += `<button type="button" class="chk ${x.ok ? "on" : ""}" aria-pressed="${!!x.ok}" aria-label="Concluir série ${i + 1}" data-act="ok" data-ex="${esc(it.exId)}" data-i="${i}">✓</button></div>`;
    });
    h += `</div><div class="row" style="justify-content:space-between"><button class="linkbtn" data-act="addSet" data-ex="${esc(it.exId)}">Adicionar série</button><button class="linkbtn" data-act="rest" data-s="${restOf(it)}">Descanso ${restLabel(restOf(it))}</button></div></div>`;
  });
  h += `<div class="row" style="margin-top:18px"><button class="btn strength" data-act="finishTreino">Fazer check-out e finalizar</button></div><div class="row" style="margin-top:10px"><button class="btn danger" data-act="cancel" data-id="${esc(s.id)}">Descartar este treino</button></div>`;
  return h;
}

/* ---------- check-in ---------- */
actions.startTreino = el => {
  const L = el.dataset.t;
  openModal(`<h3>Check-in do treino ${L}</h3><p class="small muted" style="margin:6px 0 0">Ajuda a enxergar como seu corpo responde ao treino.</p>
  <div class="field"><span class="lab">${dorLabel()} agora (0 a 10)</span>${rangeHtml("dor", 0)}</div>
  <div class="field"><span class="lab">Energia (1 a 5)</span>${scaleHtml("energia", 5, 1)}</div>
  <div class="field"><label class="lab" for="sono">Horas de sono (opcional)</label><input id="sono" class="txt" type="text" inputmode="decimal" placeholder="Ex.: 7,5"></div>
  <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn strength" data-act="confirmStartTreino">Iniciar treino ${L}</button></div>`,
  { t: L, dor: 0, energia: null });
};
actions.confirmStartTreino = () => {
  const p = activePlan(), L = modalState.t, t = p.treinos[L], d = new Date(), id = newId();
  S.sessions[id] = {
    kind: "sessao", id, type: "treino", planId: p.id, treino: L, foco: t.foco || "",
    plano: { ex: JSON.parse(JSON.stringify(t.ex)), warmup: JSON.parse(JSON.stringify(p.warmup || [])) },
    date: ymd(d), start: d.toISOString(), status: "andamento",
    pre: { dor: modalState.dor, energia: modalState.energia, sono: num($("#sono").value) }, warmup: [], sets: {}
  };
  closeModal(); flush("sessions", id); go("treinos");
};

/* ---------- check-out ---------- */
// Pergunta de segurança obrigatória no check-out, conforme o perfil
function SAFETY(){
  if (hasRestr("lombar")) return {
    q: "Sentiu dor descendo para a perna, formigamento ou choque?",
    warn: "Pare os exercícios de perna e de dobradiça de quadril até ser avaliado. Procure seu médico ou fisioterapeuta nos próximos dias. Se houver dormência na região genital ou alteração para urinar ou evacuar, vá ao pronto-socorro imediatamente.",
    err: "Responda se sentiu dor descendo para a perna. Essa resposta é importante para a sua segurança."
  };
  return {
    q: "Sentiu alguma dor forte, pontada ou desconforto fora do normal?",
    warn: "Evite o exercício que causou a dor nos próximos treinos e observe. Se a dor for forte ou continuar por mais de 2 a 3 dias, procure um médico ou fisioterapeuta. Dor no peito, falta de ar fora do comum, tontura ou desmaio: procure atendimento de urgência imediatamente.",
    err: "Responda se sentiu alguma dor fora do normal. Essa resposta é importante para a sua segurança."
  };
}
export function endTimeFieldHtml(s){
  const ms = Date.now() - new Date(s.start).getTime();
  if (ms < 3 * 3600 * 1000) return "";
  const guess = new Date(new Date(s.start).getTime() + 75 * 60000);
  return `<div class="infobox" style="margin-top:12px">Este registro começou em ${ddmm(s.date)} às ${timeOf(s.start)}. Se esqueceu de finalizar, informe o horário em que terminou.</div>
    <div class="field"><label class="lab" for="endTime">Horário de término</label><input id="endTime" class="txt" type="time" value="${pad(guess.getHours())}:${pad(guess.getMinutes())}"></div>`;
}
export function readEndTime(s){
  const el = $("#endTime");
  if (!el || !el.value) return new Date().toISOString();
  const [hh, mm] = el.value.split(":").map(Number), st = new Date(s.start), end = new Date(st);
  end.setHours(hh, mm, 0, 0);
  if (end <= st) end.setDate(end.getDate() + 1);
  return (end > new Date() ? new Date() : end).toISOString();
}
actions.finishTreino = () => {
  const s = active("treino");
  openModal(`<h3>Check-out do treino</h3>
  <div class="field"><span class="lab">${dorLabel()} agora (0 a 10)</span>${rangeHtml("dor", 0)}</div>
  <div class="field"><span class="lab">${SAFETY().q}</span><div class="yn" role="group"><button type="button" data-act="yn" data-v="nao" aria-pressed="false">Não</button><button type="button" data-act="yn" data-v="sim" aria-pressed="false">Sim</button></div>
  <div class="warnbox" id="warn">${SAFETY().warn}</div></div>
  <div class="field"><span class="lab">Como foi o treino (1 a 5)</span>${scaleHtml("sens", 5, 1)}</div>
  <div class="field"><label class="lab" for="obs">Observação (opcional)</label><input id="obs" class="txt" type="text" maxlength="200" placeholder="Ex.: leg press pesado hoje, lombar tranquila"></div>
  ${endTimeFieldHtml(s)}
  <div class="err" id="co-err"></div>
  <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn strength" data-act="confirmFinishTreino">Finalizar treino</button></div>`,
  { dor: 0, irradiada: null, sens: null });
};
actions.yn = el => {
  modalState.irradiada = el.dataset.v === "sim";
  el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false"));
  $("#warn").classList.toggle("show", modalState.irradiada);
  $("#co-err").textContent = "";
};
actions.confirmFinishTreino = () => {
  const s = active("treino"); if (!s) return closeModal();
  if (modalState.irradiada == null){ $("#co-err").textContent = SAFETY().err; return; }
  s.end = readEndTime(s); s.status = "concluido";
  // irradiada: dor descendo para a perna (quem tem hérnia lombar); dorAguda: dor forte/fora do normal (demais)
  s.post = Object.assign({ dor: modalState.dor, sens: modalState.sens, obs: $("#obs").value.trim() }, hasRestr("lombar") ? { irradiada: modalState.irradiada } : { dorAguda: modalState.irradiada });
  s.kcal = kcalOf(s);
  closeModal(); flush("sessions", s.id); stopRest();
  go("hoje");
  setStatus(s.post.irradiada ? "Treino salvo. Procure avaliação pela dor na perna." : s.post.dorAguda ? "Treino salvo. Observe a dor e procure avaliação se continuar." : "Treino concluído" + (s.kcal ? ` · cerca de ${s.kcal} kcal` : ""));
};

/* ---------- séries ---------- */
actions.ok = el => {
  const s = active("treino"); if (!s) return;
  const it = itemFor(s, el.dataset.ex), ex = getEx(el.dataset.ex), i = +el.dataset.i, sets = ensureSets(s, it), x = sets[i];
  x.ok = !x.ok;
  if (x.ok){
    // série vazia: preenche com o valor sugerido (o da sugestão de carga ou o da última vez)
    const last = lastSetsFor(it.exId, s.id), sg = sugestao(it, ex, s, semanaInfo(planoDaSessao(s), new Date(s.start))), ph = sugeridoPara(last, sg, i), row = el.parentElement;
    if (x.kg === "" && ph.kg != null && ex.load !== false){ x.kg = String(ph.kg); const ik = row.querySelector('[data-act="kg"]'); if (ik) ik.value = fmtNum(ph.kg); }
    if (x.reps === "" && ph.reps != null){ x.reps = String(ph.reps); const ir = row.querySelector('[data-act="reps"]'); if (ir) ir.value = ph.reps; }
    startRest(restOf(it), ex.nome);
  }
  el.classList.toggle("on", x.ok); el.setAttribute("aria-pressed", String(x.ok));
  touch(s);
};
actions.addSet = el => {
  const s = active("treino"); if (!s) return;
  ensureSets(s, itemFor(s, el.dataset.ex)).push({ kg: "", reps: "", ok: false });
  touch(s); rerenderKeepScroll();
};
function onSetInput(el){
  const s = active("treino"); if (!s) return;
  const sets = ensureSets(s, itemFor(s, el.dataset.ex));
  sets[+el.dataset.i][el.dataset.act] = el.value.trim().replace(",", ".");
  touch(s);
}
inputs.kg = onSetInput;
inputs.reps = onSetInput;
changes.wu = el => {
  const s = active("treino"); if (!s) return;
  s.warmup = s.warmup || []; s.warmup[+el.dataset.i] = el.checked; touch(s);
};

/* ---------- descartar / apagar ---------- */
actions.cancel = actions.del = el => {
  const id = el.dataset.id; if (!S.sessions[id]) return;
  const msg = el.dataset.act === "cancel" ? "Descartar este registro em andamento? Os dados dele serão apagados." : "Apagar este registro? Isso não pode ser desfeito.";
  if (!confirm(msg)) return;
  delete S.sessions[id]; flush("sessions", id);
  if (el.dataset.act === "cancel") stopRest();
  rerenderKeepScroll();
};
