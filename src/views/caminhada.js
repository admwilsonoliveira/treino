// Aba Caminhada: check-in, cronômetro, check-out e histórico.
import { S, flush, setStatus, active, done } from "../store.js";
import { views, actions, render, go, openModal, closeModal, modalState, scaleHtml, rangeHtml } from "../ui.js";
import { esc, num, fmtNum, ymd, ddmm, durMin, newId, pace, $ } from "../util.js";
import { endTimeFieldHtml, readEndTime } from "./treinos.js";

views.caminhada = {
  html(){
    const aw = active("caminhada"), w = S.settings.walk;
    let h = "";
    if (aw){
      h += `<div class="panel live walkc"><h3>Caminhada em andamento</h3><div class="elapsed" style="font-size:44px;margin-top:6px" data-since="${esc(aw.start)}">0:00</div><div class="small muted">Meta: ${fmtNum(w.km)} km em ritmo confortável, conseguindo conversar em frases completas. Check-in: dor lombar ${aw.pre && aw.pre.dor != null ? aw.pre.dor : "–"}/10.</div><div class="row" style="margin-top:14px"><button class="btn walk" data-act="finishWalk">Fazer check-out e finalizar</button></div><div class="row" style="margin-top:10px"><button class="btn danger" data-act="cancel" data-id="${esc(aw.id)}">Descartar esta caminhada</button></div></div>`;
    } else {
      h += `<div class="panel"><h3>Caminhada de ${fmtNum(w.km)} km</h3><p class="small muted" style="margin:6px 0 12px">Faça o check-in ao sair e o check-out ao voltar. Você pode deixar o celular no bolso: o tempo continua contando.</p><button class="btn walk block" data-act="startWalk">Fazer check-in e iniciar</button></div>`;
    }
    const ws = done().filter(s => s.type === "caminhada").reverse();
    h += `<h2>Histórico</h2>`;
    if (!ws.length) h += `<div class="empty">Sua primeira caminhada registrada aparece aqui, com tempo e ritmo.</div>`;
    else {
      h += `<div class="panel scroll-x"><table><thead><tr><th>Data</th><th>Tempo</th><th>Km</th><th>Ritmo</th><th>Dor</th></tr></thead><tbody>`;
      ws.slice(0, 30).forEach(s => {
        const ms = new Date(s.end) - new Date(s.start), km = num(s.km);
        const pc = km ? (ms / 60000) / km : null;
        h += `<tr><td>${ddmm(s.date)}</td><td>${durMin(ms)} min</td><td>${km ? fmtNum(km) : "–"}</td><td>${pc ? pace(pc) + " /km" : "–"}</td><td>${s.pre && s.pre.dor != null ? s.pre.dor : "–"} → ${s.post && s.post.dor != null ? s.post.dor : "–"}</td></tr>`;
      });
      h += `</tbody></table></div>`;
    }
    return h;
  }
};

actions.startWalk = () => {
  if (active("caminhada")) return go("caminhada");
  openModal(`<h3>Check-in da caminhada</h3>
  <div class="field"><span class="lab">Dor lombar agora (0 a 10)</span>${rangeHtml("dor", 0)}</div>
  <div class="field"><span class="lab">Energia (1 a 5)</span>${scaleHtml("energia", 5, 1)}</div>
  <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn walk" data-act="confirmStartWalk">Iniciar caminhada</button></div>`,
  { dor: 0, energia: null });
};
actions.confirmStartWalk = () => {
  const d = new Date(), id = newId();
  S.sessions[id] = { kind: "sessao", id, type: "caminhada", date: ymd(d), start: d.toISOString(), status: "andamento", pre: { dor: modalState.dor, energia: modalState.energia } };
  closeModal(); flush("sessions", id); go("caminhada");
};
actions.finishWalk = () => {
  const s = active("caminhada");
  openModal(`<h3>Check-out da caminhada</h3>
  <div class="field"><label class="lab" for="km">Distância (km)</label><input id="km" class="txt" type="text" inputmode="decimal" value="${esc(fmtNum(S.settings.walk.km))}"></div>
  <div class="field"><span class="lab">Dor lombar agora (0 a 10)</span>${rangeHtml("dor", 0)}</div>
  <div class="field"><label class="lab" for="obs">Observação (opcional)</label><input id="obs" class="txt" type="text" maxlength="200"></div>
  ${endTimeFieldHtml(s)}
  <div class="err" id="cw-err"></div>
  <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn walk" data-act="confirmFinishWalk">Finalizar caminhada</button></div>`,
  { dor: 0 });
};
actions.confirmFinishWalk = () => {
  const s = active("caminhada"); if (!s) return closeModal();
  const km = num($("#km").value);
  if (!(km > 0 && km < 100)){ $("#cw-err").textContent = "Informe a distância em km (ex.: 5 ou 4,8)."; return; }
  s.end = readEndTime(s); s.status = "concluido"; s.km = km;
  s.post = { dor: modalState.dor, obs: $("#obs").value.trim() };
  closeModal(); flush("sessions", s.id); render(); setStatus("Caminhada concluída e salva");
};
