// Aba Perfil: dados do usuário, medidas corporais (peso e bioimpedância), plano ativo, caminhada e backup.
import { S, save, flush, setStatus, measurementsList, latestWeight, activePlan, exportData, validateBackup, restoreData, imc, imcClasse, restOf, conferencia } from "../store.js";
import { ui, views, actions, changes, render, go, openModal, closeModal, modalState } from "../ui.js";
import { esc, num, fmtNum, ymd, ddmm, ddmmyyyy, ageFrom, newId, restLabel, DIAS_CURTO, downloadBlob, $ } from "../util.js";
import { requestPersist } from "../db.js";
import { isNative, notifStatus, ensureNotifPermission, openExactAlarmSettings, testNotification } from "../native.js";
import { APK_URL } from "../update.js";
import { TEMAS, aplicarTema } from "../tema.js";
import { saudePanelHtml, saudePanelAfter } from "./saude.js";
import { nuvemPanelHtml } from "./nuvem.js";
import { avaliacaoHtml, avaliacaoCardHtml } from "./avaliacao.js";

export const RESTRICOES = [
  { k: "lombar", t: "Hérnia ou dor lombar" }, { k: "cervical", t: "Hérnia ou dor cervical" },
  { k: "joelho", t: "Joelho" }, { k: "ombro", t: "Ombro" }, { k: "hipertensao", t: "Pressão alta" }, { k: "cardiaco", t: "Problema cardíaco" }
];
export const NIVEIS = { iniciante: "Iniciante (menos de 6 meses)", intermediario: "Intermediário (6 meses a 2 anos)", avancado: "Avançado (mais de 2 anos)" };

/* ---------- formulário de perfil (usado também no primeiro acesso) ---------- */
export function profileFormHtml(p = {}, withWeight = true){
  const r = p.restricoes || [];
  return `
  <div class="field"><label class="lab" for="pf-nome">Seu nome</label><input id="pf-nome" class="txt" type="text" maxlength="40" autocomplete="given-name" value="${esc(p.nome)}"></div>
  <div class="field"><label class="lab" for="pf-nasc">Data de nascimento</label><input id="pf-nasc" class="txt" type="date" value="${esc(p.nascimento)}"></div>
  <div class="field"><span class="lab">Sexo</span><div class="yn" role="group">
    <button type="button" data-act="pfSexo" data-v="M" aria-pressed="${p.sexo === "M"}">Masculino</button>
    <button type="button" data-act="pfSexo" data-v="F" aria-pressed="${p.sexo === "F"}">Feminino</button></div></div>
  <div class="grid2">
    <div class="field"><label class="lab" for="pf-alt">Altura (cm)</label><input id="pf-alt" class="txt" type="text" inputmode="numeric" placeholder="Ex.: 178" value="${esc(p.altura)}"></div>
    ${withWeight ? `<div class="field"><label class="lab" for="pf-peso">Peso atual (kg)</label><input id="pf-peso" class="txt" type="text" inputmode="decimal" placeholder="Ex.: 89,5" value=""></div>` : `<div></div>`}
  </div>
  <div class="grid2">
    <div class="field"><label class="lab" for="pf-meta">Meta de peso (kg)</label><input id="pf-meta" class="txt" type="text" inputmode="decimal" placeholder="Opcional" value="${p.metaPeso != null ? esc(fmtNum(p.metaPeso)) : ""}"></div>
    <div class="field"><label class="lab" for="pf-metadata">Prazo da meta</label><input id="pf-metadata" class="txt" type="date" value="${esc(p.metaData)}"></div>
  </div>
  <div class="grid2">
    <div class="field"><label class="lab" for="pf-metagord">Meta de gordura (%)</label><input id="pf-metagord" class="txt" type="text" inputmode="decimal" placeholder="Opcional" value="${p.metaGordura != null ? esc(fmtNum(p.metaGordura)) : ""}"></div>
    <div></div>
  </div>
  <div class="field"><span class="lab">Tempo de treino</span>
    <div class="scale" role="group" style="--n:3">${Object.keys(NIVEIS).map(k => `<button type="button" data-act="pfNivel" data-v="${k}" aria-pressed="${p.nivel === k}">${NIVEIS[k].split(" (")[0]}</button>`).join("")}</div></div>
  <div class="field"><span class="lab">Lesões ou condições de saúde</span>
    <div class="chips" role="group">${RESTRICOES.map(x => `<button type="button" class="chip" data-act="pfRestr" data-v="${x.k}" aria-pressed="${r.includes(x.k)}">${x.t}</button>`).join("")}</div>
    <div class="help">Com "hérnia ou dor lombar" marcada, o app destaca os exercícios mais seguros para a coluna.</div></div>
  <div class="err" id="pf-err"></div>`;
}
actions.pfSexo = el => { modalOrForm().sexo = el.dataset.v; pressOne(el); };
actions.pfNivel = el => { modalOrForm().nivel = el.dataset.v; pressOne(el); };
actions.pfRestr = el => {
  const st = modalOrForm(); st.restricoes = st.restricoes || [];
  const k = el.dataset.v, i = st.restricoes.indexOf(k);
  if (i >= 0) st.restricoes.splice(i, 1); else st.restricoes.push(k);
  el.setAttribute("aria-pressed", String(i < 0));
};
function pressOne(el){ el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false")); }
// O formulário de perfil guarda escolhas de botões num objeto temporário
export const formState = { profile: {} };
function modalOrForm(){ return formState.profile; }

export function readProfileForm(withWeight = true){
  const st = formState.profile;
  const p = {
    id: "profile",
    nome: $("#pf-nome").value.trim(),
    nascimento: $("#pf-nasc").value || null,
    sexo: st.sexo || null,
    altura: num($("#pf-alt").value),
    metaPeso: num($("#pf-meta").value),
    metaData: $("#pf-metadata").value || null,
    metaGordura: num($("#pf-metagord").value),
    nivel: st.nivel || null,
    restricoes: (st.restricoes || []).slice()
  };
  const peso = withWeight ? num($("#pf-peso").value) : null;
  let err = "";
  if (!p.nome) err = "Informe seu nome.";
  else if (!p.nascimento || ageFrom(p.nascimento) == null || ageFrom(p.nascimento) < 10) err = "Informe uma data de nascimento válida.";
  else if (!p.sexo) err = "Escolha o sexo. Ele é usado nos cálculos de gordura e gasto calórico.";
  else if (!(p.altura >= 100 && p.altura <= 230)) err = "Informe a altura em centímetros (ex.: 178).";
  else if (withWeight && !(peso >= 30 && peso <= 300)) err = "Informe o peso atual em kg (ex.: 89,5).";
  else if (p.metaPeso != null && !(p.metaPeso >= 30 && p.metaPeso <= 300)) err = "A meta de peso parece inválida.";
  else if (p.metaGordura != null && !(p.metaGordura >= 5 && p.metaGordura <= 50)) err = "A meta de gordura deve ficar entre 5% e 50%.";
  $("#pf-err").textContent = err;
  return err ? null : { profile: p, peso };
}

/* ---------- medidas ---------- */
const MED_FIELDS = [
  { k: "peso", t: "Peso", u: "kg", ph: "89,5" },
  { k: "gorduraPct", t: "Gordura corporal", u: "%", ph: "27,5" },
  { k: "massaGorda", t: "Massa gorda", u: "kg", ph: "24,6" },
  { k: "musculo", t: "Músculo esquelético", u: "kg", ph: "36,2" },
  { k: "agua", t: "Água corporal", u: "%", ph: "52" },
  { k: "cintura", t: "Cintura", u: "cm", ph: "98" }
];
export function bioFieldsHtml(m = {}){
  return `<div class="grid2">${MED_FIELDS.filter(f => f.k !== "peso").map(f => `<div class="field"><label class="lab" for="md-${f.k}">${f.t} (${f.u})</label><input id="md-${f.k}" class="txt" type="text" inputmode="decimal" placeholder="Ex.: ${f.ph}" value="${m[f.k] != null ? esc(fmtNum(m[f.k])) : ""}"></div>`).join("")}</div>`;
}
export function readBioFields(){
  const out = {};
  MED_FIELDS.filter(f => f.k !== "peso").forEach(f => { const el = $("#md-" + f.k); const v = el ? num(el.value) : null; if (v != null) out[f.k] = v; });
  return out;
}
function modalMedida(id){
  const agora = new Date(), m = id ? S.measurements[id] : { date: ymd(agora), hora: String(agora.getHours()).padStart(2, "0") + ":" + String(agora.getMinutes()).padStart(2, "0") };
  openModal(`<h3>${id ? "Editar medida" : "Nova medida"}</h3>
    <p class="small muted" style="margin-top:6px">Só o peso é obrigatório. Os outros campos vêm da balança de bioimpedância, se você tiver.</p>
    <div class="grid2">
      <div class="field"><label class="lab" for="md-date">Data</label><input id="md-date" class="txt" type="date" value="${esc(m.date)}"></div>
      <div class="field"><label class="lab" for="md-peso">Peso (kg)</label><input id="md-peso" class="txt" type="text" inputmode="decimal" placeholder="Ex.: 89,5" value="${m.peso != null ? esc(fmtNum(m.peso)) : ""}"></div>
    </div>
    <div class="grid2">
      <div class="field"><label class="lab" for="md-hora">Hora</label><input id="md-hora" class="txt" type="time" value="${esc(m.hora || "")}"></div>
      <div class="field"><span class="lab">Condição</span>
        <label class="small" style="display:flex;gap:8px;align-items:center;min-height:30px"><input type="checkbox" id="md-jejum" ${m.jejum ? "checked" : ""} style="width:20px;height:20px;accent-color:var(--strength)"> Em jejum</label>
        <label class="small" style="display:flex;gap:8px;align-items:center;min-height:30px"><input type="checkbox" id="md-banheiro" ${m.posBanheiro ? "checked" : ""} style="width:20px;height:20px;accent-color:var(--strength)"> Depois do banheiro</label></div>
    </div>
    <p class="small muted" style="margin:8px 0 0">O ideal: todo dia, ao acordar, em jejum e depois do banheiro. O app usa a média de 7 dias, então a oscilação do dia a dia não atrapalha.</p>
    ${bioFieldsHtml(m)}
    <div class="err" id="md-err"></div>
    <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn strength" data-act="saveMedida" data-id="${esc(id || "")}">Salvar</button></div>
    ${id ? `<div class="row" style="margin-top:10px"><button class="btn danger" data-act="delMedida" data-id="${esc(id)}">Apagar esta medida</button></div>` : ""}`);
}
actions.addMedida = () => modalMedida(null);
actions.editMedida = el => modalMedida(el.dataset.id);
actions.saveMedida = el => {
  const date = $("#md-date").value, peso = num($("#md-peso").value);
  if (!date){ $("#md-err").textContent = "Informe a data."; return; }
  if (!(peso >= 30 && peso <= 300)){ $("#md-err").textContent = "Informe o peso em kg."; return; }
  const id = el.dataset.id || newId("m");
  // mantém os campos que este formulário não mostra (jejum, hora, fonte, marcações da importação)
  const antes = Object.assign({}, S.measurements[id] || {});
  MED_FIELDS.forEach(f => { delete antes[f.k]; });
  S.measurements[id] = Object.assign(antes, { id, date, peso, hora: $("#md-hora").value || null, jejum: $("#md-jejum").checked, posBanheiro: $("#md-banheiro").checked }, readBioFields());
  flush("measurements", id); closeModal(); render();
};
actions.delMedida = el => {
  if (!confirm("Apagar esta medida? Isso não pode ser desfeito.")) return;
  delete S.measurements[el.dataset.id]; flush("measurements", el.dataset.id); closeModal(); render();
};

/* ---------- editar perfil ---------- */
actions.editPerfil = () => {
  formState.profile = { sexo: S.profile.sexo, nivel: S.profile.nivel, restricoes: (S.profile.restricoes || []).slice() };
  openModal(`<h3>Editar perfil</h3>${profileFormHtml(S.profile, false)}
    <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn strength" data-act="savePerfil">Salvar</button></div>`);
};
actions.savePerfil = () => {
  const r = readProfileForm(false); if (!r) return;
  S.profile = Object.assign({}, S.profile, r.profile);
  flush("kv", "profile"); closeModal(); render();
};

/* ---------- caminhada ---------- */
actions.editWalk = () => {
  const w = S.settings.walk;
  modalState.dias = w.dias.slice();
  openModal(`<h3>Meta de caminhada</h3>
    <div class="field"><span class="lab">Dias da semana</span><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" class="chip" data-act="walkDia" data-v="${d}" aria-pressed="${w.dias.includes(d)}">${DIAS_CURTO[d]}</button>`).join("")}</div></div>
    <div class="grid2">
      <div class="field"><label class="lab" for="wk-km">Distância (km)</label><input id="wk-km" class="txt" type="text" inputmode="decimal" value="${esc(fmtNum(w.km))}"></div>
      <div class="field"><label class="lab" for="wk-hora">Horário</label><input id="wk-hora" class="txt" type="time" value="${esc(w.hora)}"></div>
    </div>
    <label class="small" style="display:flex;gap:10px;align-items:center;margin-top:16px"><input type="checkbox" id="wk-gps" ${w.gps !== false ? "checked" : ""} style="width:22px;height:22px;accent-color:var(--walk)"> Gravar o percurso com GPS (padrão)</label>
    <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn walk" data-act="saveWalk">Salvar</button></div>`, { dias: w.dias.slice() });
};
actions.walkDia = el => {
  const d = +el.dataset.v, i = modalState.dias.indexOf(d);
  if (i >= 0) modalState.dias.splice(i, 1); else modalState.dias.push(d);
  el.setAttribute("aria-pressed", String(i < 0));
};
actions.saveWalk = () => {
  const km = num($("#wk-km").value);
  S.settings.walk = Object.assign({}, S.settings.walk, { ativo: modalState.dias.length > 0, km: km > 0 ? km : 5, dias: modalState.dias.slice().sort(), hora: $("#wk-hora").value || "18:00", gps: $("#wk-gps").checked });
  flush("kv", "settings"); closeModal(); render();
};

/* ---------- backup ---------- */
actions.backupExport = () => {
  downloadBlob("treino-backup-" + ymd(new Date()) + ".json", JSON.stringify(exportData({ fotos: true }), null, 1), "application/json");
  S.settings.ultimoBackup = new Date().toISOString(); flush("kv", "settings");
  setStatus("Backup salvo em Downloads"); render();
};
actions.backupImport = () => $("#backupFile").click();
export async function onBackupFile(file){
  let d;
  try{ d = JSON.parse(await file.text()); }catch(e){ alert("Não foi possível ler o arquivo. Escolha um arquivo .json de backup deste app."); return; }
  const err = validateBackup(d); if (err){ alert(err); return; }
  const n = d.sessions.length;
  openModal(`<h3>Restaurar backup</h3>
    <p class="small" style="margin-top:8px">Backup de ${ddmmyyyy((d.exportadoEm || "").slice(0, 10))} com ${n} registro${n === 1 ? "" : "s"} de treino e caminhada.</p>
    <div class="infobox" style="margin-top:12px"><strong>Mesclar</strong> acrescenta só o que falta e não apaga nada do que está no app.<br><strong>Substituir tudo</strong> troca o que está no app pelo backup (use em celular novo).</div>
    <div class="row" style="margin-top:20px"><button class="btn strength" data-act="restaurarModo" data-v="mesclar">Mesclar</button><button class="btn ghost" data-act="restaurarModo" data-v="substituir">Substituir tudo</button></div>
    <div class="row" style="margin-top:10px"><button class="btn ghost" data-act="closeModal">Cancelar</button></div>`, { backup: d });
}
actions.restaurarModo = async el => {
  const d = modalState.backup, modo = el.dataset.v; if (!d) return;
  if (modo === "substituir" && !confirm("Tudo o que está no app agora será substituído pelo backup. Continuar?")) return;
  closeModal();
  await restoreData(d, modo);
  setStatus(modo === "mesclar" ? "Backup mesclado" : "Backup restaurado"); go("hoje");
};

/* ---------- view ---------- */
views.perfil = {
  html(){
    if (ui.sub === "avaliacao") return avaliacaoHtml();
    const p = S.profile, idade = ageFrom(p.nascimento), peso = latestWeight();
    const restr = (p.restricoes || []).map(k => (RESTRICOES.find(x => x.k === k) || {}).t).filter(Boolean);
    let h = `<div class="panel"><div class="between"><h3>${esc(p.nome)}</h3><button class="linkbtn" data-act="editPerfil">Editar</button></div>
      <div class="stats" style="margin-top:10px">
        <div class="stat"><div class="v">${idade != null ? idade : "–"}</div><div class="l">anos</div></div>
        <div class="stat"><div class="v">${p.altura ? fmtNum(p.altura / 100, 2) : "–"}</div><div class="l">metros</div></div>
        <div class="stat"><div class="v">${peso != null ? fmtNum(peso) : "–"}</div><div class="l">kg (último)</div></div>
      </div>
      ${(() => { const v = imc(peso, p.altura); return v ? `<p style="margin:12px 0 0"><strong>IMC ${fmtNum(v)}</strong> <span class="muted">(${imcClasse(v)})</span></p>` : ""; })()}
      <p class="small" style="margin:8px 0 0">${p.metaPeso ? `Meta: <strong>${fmtNum(p.metaPeso)} kg</strong>${p.metaData ? " até " + ddmmyyyy(p.metaData) : ""}.` : "Sem meta de peso definida."}
      ${p.nivel ? " " + esc(NIVEIS[p.nivel].split(" (")[0]) + "." : ""}</p>
      ${restr.length ? `<div class="chips" style="margin-top:8px">${restr.map(t => `<span class="tag alert">${esc(t)}</span>`).join("")}</div>` : ""}
    </div>`;

    h += avaliacaoCardHtml();

    // medidas
    const ms = measurementsList().slice().reverse();
    h += `<h2>Peso e bioimpedância</h2><div class="panel"><button class="btn strength block" data-act="addMedida">Registrar medida</button>`;
    if (!ms.length) h += `<div class="empty">Registre seu peso e, se tiver, os dados da balança de bioimpedância. A evolução aparece na aba Evolução.</div>`;
    else {
      h += `<div class="scroll-x" style="margin-top:12px"><table><thead><tr><th>Data</th><th>Peso</th><th>Gord. %</th><th>Músculo</th><th>Cintura</th><th></th></tr></thead><tbody>`;
      ms.slice(0, 20).forEach(m => {
        h += `<tr><td>${ddmm(m.date)}/${m.date.slice(2, 4)}</td><td>${fmtNum(m.peso)}</td><td>${m.gorduraPct != null ? fmtNum(m.gorduraPct) : "–"}</td><td>${m.musculo != null ? fmtNum(m.musculo) : "–"}</td><td>${m.cintura != null ? fmtNum(m.cintura) : "–"}</td><td><button class="del" data-act="editMedida" data-id="${esc(m.id)}">Editar</button></td></tr>`;
      });
      h += `</tbody></table></div>`;
    }
    h += `</div>`;

    // plano
    const pl = activePlan();
    h += `<h2>Plano de treino</h2><div class="panel"><div class="between"><div><strong>${pl ? esc(pl.nome) : "Nenhum plano"}</strong><div class="small muted">${pl ? "Divisão " + pl.split : ""}</div></div><button class="linkbtn" data-act="goPlano">Editar</button></div>
      <div class="row" style="margin-top:10px"><button class="btn ghost sm" data-act="goPlanos">Trocar plano ou criar novo</button></div>
      <div class="field"><label class="lab" for="restPadrao">Descanso padrão entre séries</label><select id="restPadrao" class="txt" data-act="restPadrao">${[30, 45, 60, 75, 90, 120, 150, 180].map(s => `<option value="${s}" ${s === restOf(null) ? "selected" : ""}>${restLabel(s)}</option>`).join("")}</select>
      <div class="help">Vale para todos os exercícios, exceto os que você ajustou um a um. No treino, use "+30 s" quando precisar de mais tempo.</div></div></div>`;

    // caminhada
    const w = S.settings.walk;
    h += `<h2>Caminhada</h2><div class="panel"><div class="between"><div>${w.dias.length ? `${fmtNum(w.km)} km às ${esc(w.hora)}<div class="small muted">${[1, 2, 3, 4, 5, 6, 0].filter(d => w.dias.includes(d)).map(d => DIAS_CURTO[d]).join(", ")}</div>` : "Sem caminhada planejada."}</div><button class="linkbtn" data-act="editWalk">Editar</button></div></div>`;

    h += lembretesHtml();

    // aparência
    const tm = S.settings.tema || "escuro";
    h += `<h2>Aparência</h2><div class="panel"><div class="field" style="margin-top:0"><span class="lab">Tema</span>
      <div class="scale" style="--n:3">${TEMAS.map(([v, l]) => `<button type="button" data-act="tema" data-v="${v}" aria-pressed="${v === tm}">${l}</button>`).join("")}</div>
      <div class="help">O escuro é o padrão, pensado para os treinos cedo.</div></div></div>`;

    h += saudePanelHtml();

    // backup
    h += nuvemPanelHtml();
    const ub = S.settings.ultimoBackup;
    h += `<h2>Backup em arquivo</h2><div class="panel">
      <p class="small">Uma cópia extra num arquivo, para guardar onde quiser ou passar para outro aparelho sem usar a conta Google.</p>
      <p class="small muted">${ub ? "Último backup: " + ddmmyyyy(ub.slice(0, 10)) + "." : "Nenhum backup feito ainda."}</p>
      <div class="row"><button class="btn strength" data-act="backupExport">Fazer backup</button><button class="btn ghost" data-act="backupImport">Restaurar backup</button></div>
      <input type="file" id="backupFile" accept="application/json,.json" hidden>
    </div>`;
    const cf = conferencia();
    h += `<h2>Conferência dos dados</h2><div class="panel"><div class="stats" style="margin-top:0;grid-template-columns:repeat(4,1fr)">
      <div class="stat"><div class="v">${cf.treinos}</div><div class="l">treinos</div></div>
      <div class="stat"><div class="v">${cf.caminhadas}</div><div class="l">caminhadas</div></div>
      <div class="stat"><div class="v">${cf.series}</div><div class="l">séries</div></div>
      <div class="stat"><div class="v">${cf.pesagens}</div><div class="l">pesagens</div></div>
    </div><p class="small muted" style="margin:8px 0 0">Use para conferir que nada sumiu depois de uma atualização ou restauração.</p></div>`;
    h += `<p class="small muted" style="margin-top:18px">Este app é uma ferramenta de registro e não substitui a orientação de médico, fisioterapeuta ou educador físico.</p>
      <p class="small muted" style="margin-top:6px">Versão ${esc(typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev")}${isNative ? " · app Android" : ""}</p>`;
    return h;
  },
  after(){
    if (ui.sub) return;
    fillPermStatus();
    saudePanelAfter();
    const f = $("#backupFile");
    if (f) f.addEventListener("change", () => { if (f.files[0]) onBackupFile(f.files[0]); f.value = ""; });
  }
};
changes.restPadrao = el => { S.settings.restPadrao = parseInt(el.value, 10) || 60; flush("kv", "settings"); setStatus("Descanso padrão: " + restLabel(S.settings.restPadrao)); };
actions.goPlano = () => go("treinos", "plano");
actions.tema = el => { S.settings.tema = el.dataset.v; aplicarTema(S.settings.tema); flush("kv", "settings"); render(); };

/* ---------- lembretes e alarmes (app Android) ---------- */
function lembretesHtml(){
  let h = `<h2>Lembretes e alarmes</h2><div class="panel">`;
  if (!isNative){
    return h + `<p class="small">O alarme do descanso com a tela travada e os lembretes de treino e caminhada funcionam no <strong>app Android</strong>.</p>
      <a class="btn strength block" href="${APK_URL}" target="_blank" rel="noopener">Baixar o app Android</a>
      <p class="small muted" style="margin:10px 0 0">Antes de trocar, faça um backup aqui e restaure no app Android.</p></div>`;
  }
  const L = S.settings.lembretes, w = S.settings.walk;
  h += `<label class="small" style="display:flex;gap:10px;align-items:center"><input type="checkbox" data-act="lemTreino" ${L.treino.ativo ? "checked" : ""} style="width:22px;height:22px;accent-color:var(--strength)"> <span><strong>Lembrete de treino</strong> nos dias do plano</span></label>
    <div class="field" style="margin-top:8px"><label class="lab small" for="lemTreinoHora">Horário do lembrete</label><input id="lemTreinoHora" class="txt" type="time" data-act="lemTreinoHora" value="${esc(L.treino.hora || "")}"></div>
    <label class="small" style="display:flex;gap:10px;align-items:center;margin-top:16px"><input type="checkbox" data-act="lemWalk" ${L.caminhada.ativo ? "checked" : ""} style="width:22px;height:22px;accent-color:var(--walk)"> <span><strong>Lembrete de caminhada</strong> (${esc(w.hora)})</span></label>
    <div class="field" style="margin-top:8px"><label class="lab small" for="lemWalkAntes">Avisar</label><select id="lemWalkAntes" class="txt" data-act="lemWalkAntes">${[0, 10, 15, 30, 60].map(m => `<option value="${m}" ${m === L.caminhada.antes ? "selected" : ""}>${m ? m + " min antes" : "na hora"}</option>`).join("")}</select></div>
    <div id="permStatus" class="small" style="margin-top:16px">Verificando permissões…</div>
    <button class="btn ghost block" style="margin-top:12px" data-act="testAlarm">Testar alarme (toca em 10 segundos)</button>
    <details style="margin-top:12px"><summary class="small" style="font-weight:600;cursor:pointer">Celular Samsung: o alarme não tocou?</summary>
      <ol class="small" style="padding-left:18px;margin:8px 0 0">
        <li>Abra <strong>Configurações → Aplicativos → Treino → Bateria</strong> e escolha <strong>Sem restrições</strong>.</li>
        <li>Em <strong>Configurações → Assistência do aparelho → Bateria → Limites de uso em segundo plano</strong>, confira se o Treino <strong>não</strong> está em "Apps em suspensão".</li>
        <li>Em <strong>Configurações → Aplicativos → Treino → Notificações</strong>, deixe tudo ativado, inclusive "Fim do descanso".</li>
      </ol></details></div>`;
  return h;
}
async function fillPermStatus(){
  const el = $("#permStatus"); if (!el || !isNative) return;
  const st = await notifStatus();
  el.innerHTML = `<div>${st.notif ? "✅" : "⚠️"} Notificações ${st.notif ? "permitidas" : "bloqueadas"} ${st.notif ? "" : '<button class="linkbtn" data-act="askNotif">Permitir</button>'}</div>
    <div>${st.exact ? "✅" : "⚠️"} Alarmes no horário exato ${st.exact ? "permitidos" : "bloqueados"} ${st.exact ? "" : '<button class="linkbtn" data-act="exactSettings">Abrir configuração</button>'}</div>`;
}
changes.lemTreino = el => {
  const L = S.settings.lembretes.treino; L.ativo = el.checked;
  if (L.ativo && !L.hora){ L.hora = "05:00"; const t = $("#lemTreinoHora"); if (t) t.value = L.hora; }
  if (L.ativo) ensureNotifPermission().then(fillPermStatus);
  flush("kv", "settings");
};
changes.lemTreinoHora = el => { S.settings.lembretes.treino.hora = el.value; flush("kv", "settings"); };
changes.lemWalk = el => { S.settings.lembretes.caminhada.ativo = el.checked; if (el.checked) ensureNotifPermission().then(fillPermStatus); flush("kv", "settings"); };
changes.lemWalkAntes = el => { S.settings.lembretes.caminhada.antes = parseInt(el.value, 10) || 0; flush("kv", "settings"); };
actions.askNotif = () => ensureNotifPermission().then(fillPermStatus);
actions.exactSettings = () => openExactAlarmSettings();
actions.testAlarm = async () => {
  const ok = await testNotification();
  setStatus(ok ? "Trave a tela agora: o alarme toca em 10 s" : "Permita as notificações para testar");
  fillPermStatus();
};
actions.goPlanos = () => go("treinos", "planos");

export { requestPersist };
