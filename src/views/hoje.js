// Aba Hoje: treino do dia, caminhada e resumo da semana.
import { S, activePlan, planLetters, treinoForDay, active, done } from "../store.js";
import { ui, views } from "../ui.js";
import { esc, num, fmtNum, ymd, mondayOf, DIAS, DIAS_CURTO } from "../util.js";

views.hoje = {
  html(){
    const d = new Date(), wd = d.getDay(), p = activePlan(), t = treinoForDay(p, wd), w = S.settings.walk;
    const isWalkDay = w.dias.includes(wd);
    const at = active("treino"), aw = active("caminhada");
    let h = "";
    if (ui.apkUpdate) h += `<div class="panel" style="margin-bottom:12px;border-color:var(--strength)"><strong>Nova versão do app: ${esc(ui.apkUpdate.versao)}</strong><p class="small muted" style="margin:4px 0 10px">Toque para baixar e depois em "Atualizar". Seus dados continuam no celular.</p><a class="btn strength block" href="${esc(ui.apkUpdate.url)}" target="_blank" rel="noopener">Baixar atualização</a></div>`;
    if (at) h += `<div class="panel live"><div class="small muted">Treino ${esc(at.treino)} em andamento</div><div class="elapsed" data-since="${esc(at.start)}">0:00</div><div class="row" style="margin-top:10px"><button class="btn strength" data-act="goTab" data-tab="treinos">Continuar treino</button></div></div>`;
    if (aw) h += `<div class="panel live walkc"><div class="small muted">Caminhada em andamento</div><div class="elapsed" data-since="${esc(aw.start)}">0:00</div><div class="row" style="margin-top:10px"><button class="btn walk" data-act="goTab" data-tab="caminhada">Ver caminhada</button></div></div>`;

    const todayDone = done().filter(s => s.date === ymd(d));
    const tDone = todayDone.find(s => s.type === "treino"), wDone = todayDone.find(s => s.type === "caminhada");

    h += `<div class="panel" ${at || aw ? 'style="margin-top:12px"' : ""}><div class="today-head">`;
    if (!p){
      h += `<div class="big-letter rest">?</div><div><h3>Nenhum plano de treino</h3><div class="muted small">Escolha um modelo ou monte o seu na aba Treinos.</div></div>`;
    } else if (t){
      const tr = p.treinos[t];
      h += `<div class="big-letter">${t}</div><div><h3>${DIAS[wd]}: treino ${t}</h3><div class="muted small">${esc(tr.foco || "")}${tr.foco ? ". " : ""}${tr.ex.length} exercício${tr.ex.length === 1 ? "" : "s"}.</div>${tDone ? '<div style="margin-top:6px"><span class="tag">Treino concluído</span></div>' : ""}</div>`;
    } else {
      h += `<div class="big-letter rest">–</div><div><h3>${DIAS[wd]}: descanso da musculação</h3><div class="muted small">Recuperação também faz parte do plano.</div></div>`;
    }
    h += `</div>`;
    if (isWalkDay) h += `<div class="small" style="margin-top:12px"><span class="tag walk">Caminhada ${fmtNum(w.km)} km às ${esc(w.hora)}</span>${wDone ? ' <span class="tag">Caminhada feita</span>' : ""}</div>`;
    h += `<div class="row" style="margin-top:14px">`;
    if (!p) h += `<button class="btn strength" data-act="goTab" data-tab="treinos">Escolher plano</button>`;
    else if (t && !at && !tDone) h += `<button class="btn strength" data-act="openTreino" data-t="${t}">Abrir treino ${t}</button>`;
    if (!aw) h += `<button class="btn ${t && !tDone ? "ghost" : "walk"}" data-act="startWalk">Iniciar caminhada</button>`;
    h += `</div></div>`;

    // semana
    const mon = mondayOf(d), nTreinos = p ? new Set(planLetters(p).flatMap(L => p.treinos[L].dias || [])).size : 0;
    h += `<h2>Esta semana</h2><div class="week">`;
    let ts = 0, ws = 0;
    for (let i = 0; i < 7; i++){
      const x = new Date(mon); x.setDate(mon.getDate() + i); const key = ymd(x), wdx = x.getDay();
      const ds = done().filter(s => s.date === key);
      const st = ds.some(s => s.type === "treino"), sw = ds.some(s => s.type === "caminhada");
      if (st) ts++; if (sw) ws++;
      const planS = !!treinoForDay(p, wdx), planW = w.dias.includes(wdx);
      h += `<div class="day ${key === ymd(d) ? "is-today" : ""}"><div class="d">${DIAS_CURTO[wdx]}</div><div class="n">${x.getDate()}</div><div class="dots">${planS || st ? `<span class="dot s ${st ? "on" : "plan"}" title="Musculação"></span>` : ""}${planW || sw ? `<span class="dot w ${sw ? "on" : "plan"}" title="Caminhada"></span>` : ""}</div></div>`;
    }
    h += `</div>`;
    const monthKey = ymd(d).slice(0, 7);
    const km = done().filter(s => s.type === "caminhada" && (s.date || "").slice(0, 7) === monthKey).reduce((a, s) => a + (num(s.km) || 0), 0);
    h += `<div class="stats"><div class="stat"><div class="v">${ts}/${nTreinos}</div><div class="l">treinos na semana</div></div><div class="stat"><div class="v">${ws}/${w.dias.length}</div><div class="l">caminhadas na semana</div></div><div class="stat"><div class="v">${fmtNum(km)}</div><div class="l">km no mês</div></div></div>`;
    h += `<p class="small muted" style="margin-top:14px">Bolinha verde é musculação e amarela é caminhada. Contorno vazio indica o que está planejado.</p>`;
    return h;
  }
};
