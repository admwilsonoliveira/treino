// Aba Caminhada: check-in, cronômetro, GPS com mapa, check-out e histórico.
import { S, flush, setStatus, active, done, kcalOf, kcalFor, dorLabel } from "../store.js";
import { ui, views, actions, changes, render, go, openModal, closeModal, modalState, scaleHtml, rangeHtml } from "../ui.js";
import { esc, num, fmtNum, ymd, ddmm, ddmmyyyy, durMin, newId, pace, timeOf, $ } from "../util.js";
import { endTimeFieldHtml, readEndTime } from "./treinos.js";
import { iniciarGps, pararGps, gpsEstado, onGps, abrirConfigLocalizacao } from "../gps.js";
import { desenharMapa } from "../mapa.js";
import { isNative } from "../native.js";

export const gpsLigado = () => S.settings.walk.gps !== false;
let mapaVivo = null, desligarOuvinte = null;

function limparMapaVivo(){
  if (desligarOuvinte){ desligarOuvinte(); desligarOuvinte = null; }
  if (mapaVivo){ try{ mapaVivo.remover(); }catch(e){} mapaVivo = null; }
}

function statusGpsHtml(){
  if (gpsEstado.erro === "permissao") return `⚠️ Sem permissão de localização. ${isNative ? `<button class="linkbtn" data-act="gpsConfig">Abrir configurações</button>` : "Permita a localização no navegador."}`;
  if (gpsEstado.erro === "indisponivel") return "⚠️ GPS indisponível neste aparelho.";
  if (!gpsEstado.ativo) return "GPS desligado nesta caminhada.";
  if (gpsEstado.precisao == null) return "📡 Procurando sinal do GPS…";
  return gpsEstado.precisao <= 25 ? `✅ Sinal do GPS bom (±${Math.round(gpsEstado.precisao)} m)` : `📡 Sinal fraco (±${Math.round(gpsEstado.precisao)} m), aguardando melhorar…`;
}
function atualizarAoVivo(){
  const s = active("caminhada"); if (!s) return;
  const km = s.gpsKm || 0, min = (Date.now() - new Date(s.start).getTime()) / 60000;
  const el = $("#gpsKm"); if (el) el.textContent = fmtNum(km, 2);
  const ep = $("#gpsPace"); if (ep) ep.textContent = km >= 0.05 ? pace(min / km) : "–";
  const es = $("#gpsStatus"); if (es) es.innerHTML = statusGpsHtml();
  if (mapaVivo && s.rota) mapaVivo.atualizar(s.rota, true);
}
setInterval(() => { if (active("caminhada") && $("#gpsPace")) atualizarAoVivo(); }, 5000);

views.caminhada = {
  html(){
    limparMapaVivo();
    const aw = active("caminhada"), w = S.settings.walk;
    let h = "";
    if (aw){
      h += `<div class="panel live walkc"><h3>Caminhada em andamento</h3>
        <div class="stats" style="margin-top:8px">
          <div class="stat"><div class="v elapsed" data-since="${esc(aw.start)}">0:00</div><div class="l">tempo</div></div>
          <div class="stat"><div class="v" id="gpsKm">${aw.gps ? fmtNum(aw.gpsKm || 0, 2) : "–"}</div><div class="l">km${aw.gps ? " (GPS)" : ""}</div></div>
          <div class="stat"><div class="v" id="gpsPace">–</div><div class="l">min/km</div></div>
        </div>`;
      if (aw.gps){
        h += `<div class="small" id="gpsStatus" style="margin-top:10px">${statusGpsHtml()}</div>
          <div id="mapaVivo" style="height:220px;border-radius:12px;margin-top:10px;overflow:hidden;background:var(--surface-2)"></div>
          ${isNative ? "" : `<p class="small muted" style="margin:8px 0 0">No navegador, o GPS só grava com a tela ligada e o app aberto. No app Android ele continua com a tela travada.</p>`}`;
      }
      h += `<div class="small muted" style="margin-top:10px">Meta: ${fmtNum(w.km)} km em ritmo confortável, conseguindo conversar em frases completas. Check-in: ${dorLabel().toLowerCase()} ${aw.pre && aw.pre.dor != null ? aw.pre.dor : "–"}/10.</div>
        <div class="row" style="margin-top:14px"><button class="btn walk" data-act="finishWalk">Fazer check-out e finalizar</button></div>
        <div class="row" style="margin-top:10px"><button class="btn danger" data-act="cancelWalk">Descartar esta caminhada</button></div></div>`;
    } else {
      h += `<div class="panel"><h3>Caminhada de ${fmtNum(w.km)} km</h3><p class="small muted" style="margin:6px 0 12px">Faça o check-in ao sair e o check-out ao voltar. ${gpsLigado() ? "O GPS grava o percurso, a distância e o ritmo, mesmo com o celular no bolso." : "O tempo continua contando com o celular no bolso."}</p><button class="btn walk block" data-act="startWalk">Fazer check-in e iniciar</button></div>`;
    }
    const ws = done().filter(s => s.type === "caminhada").reverse();
    h += `<h2>Histórico</h2>`;
    if (!ws.length) h += `<div class="empty">Sua primeira caminhada registrada aparece aqui, com tempo e ritmo.</div>`;
    else {
      h += `<div class="panel scroll-x"><table><thead><tr><th>Data</th><th>Horário</th><th>Tempo</th><th>Km</th><th>Ritmo</th><th>kcal</th><th>Dor</th><th></th></tr></thead><tbody>`;
      ws.slice(0, 30).forEach(s => {
        const ms = new Date(s.end) - new Date(s.start), km = num(s.km), kc = kcalFor(s);
        const pc = km ? (ms / 60000) / km : null;
        h += `<tr><td>${ddmm(s.date)}</td><td>${timeOf(s.start)}–${timeOf(s.end)}</td><td>${durMin(ms)} min</td><td>${km ? fmtNum(km, 2) : "–"}</td><td>${pc ? pace(pc) + " /km" : "–"}</td><td>${kc != null ? "~" + kc : "–"}</td><td>${s.pre && s.pre.dor != null ? s.pre.dor : "–"} → ${s.post && s.post.dor != null ? s.post.dor : "–"}</td>
          <td>${s.rota && s.rota.length > 1 ? `<button class="linkbtn" data-act="verRota" data-id="${esc(s.id)}">Mapa</button>` : ""}</td></tr>`;
      });
      h += `</tbody></table></div>`;
    }
    return h;
  },
  async after(){
    const aw = active("caminhada");
    if (!aw || !aw.gps) return;
    atualizarAoVivo();
    desligarOuvinte = onGps(atualizarAoVivo);
    const el = $("#mapaVivo");
    const m = await desenharMapa(el, aw.rota || []);
    // a tela pode ter mudado enquanto o mapa carregava
    if (m && document.body.contains(el)) mapaVivo = m; else if (m) m.remover();
  }
};

actions.startWalk = () => {
  if (active("caminhada")) return go("caminhada");
  openModal(`<h3>Check-in da caminhada</h3>
  <div class="field"><span class="lab">${dorLabel()} agora (0 a 10)</span>${rangeHtml("dor", 0)}</div>
  <div class="field"><span class="lab">Energia (1 a 5)</span>${scaleHtml("energia", 5, 1)}</div>
  <label class="small" style="display:flex;gap:10px;align-items:center;margin-top:16px"><input type="checkbox" id="cw-gps" ${gpsLigado() ? "checked" : ""} style="width:22px;height:22px;accent-color:var(--walk)"> Gravar percurso com GPS</label>
  <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn walk" data-act="confirmStartWalk">Iniciar caminhada</button></div>`,
  { dor: 0, energia: null });
};
actions.confirmStartWalk = async () => {
  const d = new Date(), id = newId(), usarGps = $("#cw-gps").checked;
  S.sessions[id] = { kind: "sessao", id, type: "caminhada", date: ymd(d), start: d.toISOString(), status: "andamento", pre: { dor: modalState.dor, energia: modalState.energia }, gps: usarGps };
  closeModal(); flush("sessions", id);
  if (usarGps) iniciarGps(S.sessions[id]);
  go("caminhada");
};
actions.gpsConfig = () => abrirConfigLocalizacao();
actions.cancelWalk = async () => {
  const s = active("caminhada"); if (!s) return;
  if (!confirm("Descartar esta caminhada? Os dados dela serão apagados.")) return;
  await pararGps();
  delete S.sessions[s.id]; flush("sessions", s.id); render();
};
actions.finishWalk = () => {
  const s = active("caminhada");
  const kmGps = s.gps && s.gpsKm ? Math.round(s.gpsKm * 100) / 100 : null;
  openModal(`<h3>Check-out da caminhada</h3>
  <div class="field"><label class="lab" for="km">Distância (km)</label><input id="km" class="txt" type="text" inputmode="decimal" value="${esc(fmtNum(kmGps != null ? kmGps : S.settings.walk.km, 2))}">
    ${kmGps != null ? `<div class="help">Medido pelo GPS. Corrija se precisar.</div>` : ""}</div>
  <div class="field"><span class="lab">${dorLabel()} agora (0 a 10)</span>${rangeHtml("dor", 0)}</div>
  <div class="field"><label class="lab" for="obs">Observação (opcional)</label><input id="obs" class="txt" type="text" maxlength="200"></div>
  ${endTimeFieldHtml(s)}
  <div class="err" id="cw-err"></div>
  <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn walk" data-act="confirmFinishWalk">Finalizar caminhada</button></div>`,
  { dor: 0 });
};
actions.confirmFinishWalk = async () => {
  const s = active("caminhada"); if (!s) return closeModal();
  const km = num($("#km").value);
  if (!(km > 0 && km < 100)){ $("#cw-err").textContent = "Informe a distância em km (ex.: 5 ou 4,8)."; return; }
  await pararGps();
  s.end = readEndTime(s); s.status = "concluido"; s.km = km;
  s.post = { dor: modalState.dor, obs: $("#obs").value.trim() };
  s.kcal = kcalOf(s);
  closeModal(); flush("sessions", s.id); render(); setStatus("Caminhada concluída" + (s.kcal ? ` · cerca de ${s.kcal} kcal` : ""));
};

/* ---------- mapa de uma caminhada concluída ---------- */
let mapaModal = null;
actions.verRota = async el => {
  const s = S.sessions[el.dataset.id]; if (!s || !s.rota) return;
  const ms = new Date(s.end) - new Date(s.start), km = num(s.km);
  openModal(`<div class="between"><h3>Caminhada de ${ddmmyyyy(s.date)}</h3><button class="linkbtn" data-act="fecharRota">Fechar</button></div>
    <p class="small muted" style="margin:4px 0 10px">${timeOf(s.start)} às ${timeOf(s.end)} · ${durMin(ms)} min · ${km ? fmtNum(km, 2) + " km" : ""}${km ? " · " + pace((ms / 60000) / km) + " /km" : ""}</p>
    <div id="mapaModal" style="height:340px;border-radius:12px;overflow:hidden;background:var(--surface-2)"></div>
    <p class="small muted" style="margin:8px 0 0">Ponto verde: início. Ponto vermelho: fim.</p>`);
  if (mapaModal){ try{ mapaModal.remover(); }catch(e){} }
  mapaModal = await desenharMapa($("#mapaModal"), s.rota);
};
actions.fecharRota = () => { if (mapaModal){ try{ mapaModal.remover(); }catch(e){} mapaModal = null; } closeModal(); };
