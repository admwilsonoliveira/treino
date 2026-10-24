// Saúde → Fotos de progresso: frente, lado e costas, uma vez por mês. Ficam SÓ no aparelho
// (fora do Google Drive e dos relatórios); no backup em arquivo só se o usuário marcar.
// Na lista aparecem borradas até um toque. Comparação lado a lado com peso e cintura de cada data.
import { S, flush, setStatus } from "../store.js";
import { ui, actions, changes, render, openModal, updateModal, closeModal, modalState } from "../ui.js";
import { esc, fmtNum, ymd, ddmm, ddmmyyyy, newId, $ } from "../util.js";
import { capturar, carregarImagem, reduzir, escolherDaGaleria } from "./fotos.js";
import { media7 } from "../peso.js";
import { fitaList, valorPonto } from "../fita.js";

export const POSES = [["frente", "Frente"], ["lado", "Lado"], ["costas", "Costas"]];
const nomePose = k => (POSES.find(p => p[0] === k) || [, k])[1];
const fotos = () => Object.values(S.progresso || {}).sort((a, b) => (a.date + a.pose).localeCompare(b.date + b.pose));
// sessões: uma por data, com até 3 poses
export function sessoesFotos(){
  const por = {};
  fotos().forEach(f => { (por[f.date] = por[f.date] || {})[f.pose] = f; });
  return Object.keys(por).sort().map(date => ({ date, poses: por[date] }));
}
const anteriorDaPose = pose => fotos().filter(f => f.pose === pose).pop() || null;
const t12 = s => new Date(s + "T12:00:00").getTime();
function cinturaPerto(date){
  const fs = fitaList().filter(f => valorPonto(f, "cintura_umbigo") != null && Math.abs(t12(f.date) - t12(date)) <= 7 * 864e5);
  const f = fs.sort((a, b) => Math.abs(t12(a.date) - t12(date)) - Math.abs(t12(b.date) - t12(date)))[0];
  return f ? valorPonto(f, "cintura_umbigo") : null;
}
const legenda = date => { const p = media7(date), c = cinturaPerto(date); return [p != null ? fmtNum(p) + " kg" : null, c != null ? "cintura " + fmtNum(c) + " cm" : null].filter(Boolean).join(" · ") || "sem peso nesta data"; };

actions.goFotos = () => { ui.tab = "saude"; ui.sub = "fotos"; render(); window.scrollTo(0, 0); };
ui.fotosVistas = ui.fotosVistas || {};

export function progressoHtml(){
  const ss = sessoesFotos();
  let h = `<div class="between"><h2 style="margin-top:0">Fotos de progresso</h2><button class="linkbtn" data-act="goSaude">‹ Saúde</button></div>
    <div class="panel"><p class="small" style="margin:0">Uma vez por mês, junto com as medidas: <strong>frente, lado e costas</strong>.</p>
    <ul class="checklist small"><li>Mesmo local, mesma luz e mesma roupa.</li><li>Celular na mesma altura (apoiado numa prateleira, com o timer da câmera).</li><li>Corpo inteiro no quadro, postura relaxada.</li></ul>
    <p class="small muted" style="margin:0 0 10px">As fotos ficam só neste celular: não vão para o Google Drive nem para os relatórios.</p>
    <div class="row"><button class="btn strength" data-act="fotosNova">Tirar as fotos de hoje</button><button class="btn ghost" data-act="fotosImportar">Importar da galeria</button></div>
    <label class="small" style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" data-act="fotosBackup" ${S.saude.backupFotosProgresso ? "checked" : ""} style="width:20px;height:20px;accent-color:var(--strength)"> Incluir as fotos no "Backup em arquivo" (o arquivo fica maior)</label></div>`;
  if (!ss.length) return h + `<p class="empty">Nenhuma foto ainda. A primeira serve de ponto de partida: daqui a alguns meses ela vai mostrar o que a balança não mostra.</p>`;

  if (ss.length >= 2){
    const a = ss.find(s => s.date === ui.fotoA) || ss[0], b = ss.find(s => s.date === ui.fotoB) || ss[ss.length - 1], pose = ui.fotoPose || "frente";
    const opt = sel => ss.map(s => `<option value="${s.date}" ${s.date === sel.date ? "selected" : ""}>${ddmmyyyy(s.date)}</option>`).join("");
    const lado = s => { const f = s.poses[pose]; return `<div class="cmp-foto">${f ? `<img src="${f.data}" alt="${esc(nomePose(pose))} em ${ddmm(s.date)}">` : `<div class="sem-foto">sem foto ${esc(nomePose(pose).toLowerCase())}</div>`}<div class="small"><strong>${ddmm(s.date)}</strong></div><div class="small muted">${esc(legenda(s.date))}</div></div>`; };
    h += `<h2>Comparar</h2><div class="panel"><div class="grid2"><select class="txt" data-act="fotoA">${opt(a)}</select><select class="txt" data-act="fotoB">${opt(b)}</select></div>
      <div class="toggle" role="group" style="margin:10px 0">${POSES.map(([k, l]) => `<button type="button" data-act="fotoPose" data-v="${k}" aria-pressed="${pose === k}">${l}</button>`).join("")}</div>
      ${ui.fotosComparar ? `<div class="cmp">${lado(a)}${lado(b)}</div>` : `<button class="btn ghost block" data-act="fotosMostrarCmp">Mostrar comparação</button>`}</div>`;
  }
  h += `<h2>Sessões</h2>`;
  ss.slice().reverse().forEach(s => {
    const vis = !!ui.fotosVistas[s.date];
    h += `<div class="panel" style="margin-top:10px"><div class="between"><strong>${ddmmyyyy(s.date)}</strong><span class="small muted">${esc(legenda(s.date))}</span></div>
      <div class="mini-fotos">${POSES.map(([k, l]) => { const f = s.poses[k]; return f ? `<button type="button" class="mini ${vis ? "" : "borrada"}" data-act="fotoVerProg" data-id="${esc(f.id)}" aria-label="${l}"><img src="${f.thumb}" alt=""><span>${l}</span></button>` : `<div class="mini vazio"><span>${l}</span></div>`; }).join("")}</div>
      <div class="row" style="margin-top:8px"><button class="linkbtn" data-act="fotosVer" data-v="${s.date}">${vis ? "Esconder" : "Mostrar"}</button><button class="linkbtn danger" data-act="fotosApagarSessao" data-v="${s.date}">Apagar estas fotos</button></div></div>`;
  });
  return h;
}
changes.fotosBackup = el => { S.saude.backupFotosProgresso = el.checked; flush("kv", "saude"); };
changes.fotoA = el => { ui.fotoA = el.value; render(); };
changes.fotoB = el => { ui.fotoB = el.value; render(); };
actions.fotoPose = el => { ui.fotoPose = el.dataset.v; render(); };
actions.fotosMostrarCmp = () => { ui.fotosComparar = true; render(); };
actions.fotosVer = el => { ui.fotosVistas[el.dataset.v] = !ui.fotosVistas[el.dataset.v]; render(); };
actions.fotoVerProg = el => {
  const f = S.progresso[el.dataset.id]; if (!f) return;
  openModal(`<div class="between"><h3>${esc(nomePose(f.pose))} · ${ddmm(f.date)}</h3><button class="linkbtn" data-act="closeModal">Fechar</button></div>
    <img src="${f.data}" alt="" style="display:block;width:100%;border-radius:12px;margin-top:10px">
    <p class="small muted">${esc(legenda(f.date))}</p>
    <div class="row"><button class="btn danger" data-act="fotoApagarProg" data-id="${esc(f.id)}">Apagar esta foto</button></div>`);
};
actions.fotoApagarProg = async el => {
  if (!confirm("Apagar esta foto?")) return;
  delete S.progresso[el.dataset.id]; await flush("progresso", el.dataset.id); closeModal(); render();
};
actions.fotosApagarSessao = async el => {
  if (!confirm(`Apagar as fotos de ${ddmmyyyy(el.dataset.v)}?`)) return;
  for (const f of fotos().filter(x => x.date === el.dataset.v)){ delete S.progresso[f.id]; await flush("progresso", f.id); }
  render();
};

/* ---------- tirar as 3 fotos: uma pose por vez, com a anterior da mesma pose como referência ---------- */
actions.fotosNova = () => { openModal(`<div></div>`, { idx: 0, novas: {} }); telaPose(); };
function telaPose(){
  const st = modalState, [k, l] = POSES[st.idx], ant = anteriorDaPose(k), nova = st.novas[k];
  updateModal(`<div class="small muted">Foto ${st.idx + 1} de ${POSES.length}</div><h3 style="margin-top:4px">${l}</h3>
    ${nova ? `<img src="${nova.data}" alt="" class="foto-prev">` : ant ? `<div class="small muted" style="margin-top:6px">Referência (${ddmm(ant.date)}): tente a mesma posição e distância.</div><img src="${ant.thumb}" alt="" class="foto-ref">`
      : `<p class="small" style="margin-top:6px">${k === "frente" ? "De frente para a câmera, braços soltos ao lado do corpo." : k === "lado" ? "De lado (o direito), braços soltos, olhando para a frente." : "De costas para a câmera, braços soltos."}</p>`}
    <div class="row" style="margin-top:12px"><button class="btn ${nova ? "ghost" : "strength"}" data-act="fotoTirar">${nova ? "Refazer" : "Tirar foto"}</button>${nova ? `<button class="btn strength" data-act="fotoProxima">${st.idx < POSES.length - 1 ? "Próxima" : "Salvar"}</button>` : `<button class="btn ghost" data-act="fotoPular">Pular</button>`}</div>
    <div class="row" style="margin-top:10px"><button class="btn ghost block" data-act="fotosCancelar">Cancelar</button></div>`);
}
actions.fotoTirar = async () => {
  try{
    const src = await capturar("Foto de progresso"), img = await carregarImagem(src);
    // 1080 px basta para comparar; miniatura de 200 px para a lista
    modalState.novas[POSES[modalState.idx][0]] = { data: reduzir(img, 1080, 0.78), thumb: reduzir(img, 200, 0.7) };
    telaPose();
  }catch(e){ const m = String((e && e.message) || e); if (!/cancel/i.test(m)) alert("Não foi possível usar a foto.\n\n" + m); }
};
actions.fotoPular = () => avancaPose();
actions.fotoProxima = () => avancaPose();
async function avancaPose(){
  if (modalState.idx < POSES.length - 1){ modalState.idx++; return telaPose(); }
  const date = ymd(new Date()), novas = modalState.novas;
  if (!Object.keys(novas).length){ closeModal(); return; }
  for (const [pose, f] of Object.entries(novas)){
    // uma foto por pose por dia: refazer no mesmo dia substitui
    const velha = fotos().find(x => x.date === date && x.pose === pose); const id = velha ? velha.id : newId("p");
    S.progresso[id] = { id, date, pose, data: f.data, thumb: f.thumb };
    await flush("progresso", id);
  }
  closeModal(); setStatus("Fotos salvas só neste celular"); ui.tab = "saude"; ui.sub = "fotos"; render();
}
/* ---------- importar fotos antigas da galeria (com a data em que foram tiradas) ---------- */
actions.fotosImportar = async () => {
  try{
    const g = await escolherDaGaleria(), img = await carregarImagem(g.src);
    const nova = { data: reduzir(img, 1080, 0.78), thumb: reduzir(img, 200, 0.7) };
    const hoje = ymd(new Date()), date = g.date && g.date <= hoje ? g.date : hoje;
    openModal(`<h3>Importar foto</h3><img src="${nova.data}" alt="" class="foto-prev">
      <div class="field"><label class="lab" for="fi-date">Data da foto</label><input id="fi-date" class="txt" type="date" max="${hoje}" value="${date}">
        <div class="help">${g.date ? "Data lida da própria foto. Confira." : "Não deu para ler a data da foto: informe quando ela foi tirada."}</div></div>
      <div class="field"><span class="lab">Pose</span><div class="scale" style="--n:3">${POSES.map(([k, l], i) => `<button type="button" data-act="fiPose" data-v="${k}" aria-pressed="${i === 0}">${l}</button>`).join("")}</div></div>
      <div class="err" id="fi-err"></div>
      <div class="row" style="margin-top:16px"><button class="btn ghost" data-act="closeModal">Cancelar</button><button class="btn strength" data-act="fiSalvar">Salvar</button></div>`, { nova, pose: "frente" });
  }catch(e){ const m = String((e && e.message) || e); if (!/cancel/i.test(m)) alert("Não foi possível usar a foto.\n\n" + m); }
};
actions.fiPose = el => { modalState.pose = el.dataset.v; el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false")); };
actions.fiSalvar = async () => {
  const date = $("#fi-date").value, { nova, pose } = modalState;
  if (!date || date > ymd(new Date())){ $("#fi-err").textContent = "Informe a data da foto (não pode ser no futuro)."; return; }
  if (fotos().some(x => x.date === date && x.pose === pose) && !confirm(`Já existe uma foto de ${nomePose(pose).toLowerCase()} em ${ddmmyyyy(date)}. Substituir?`)) return;
  const velha = fotos().find(x => x.date === date && x.pose === pose), id = velha ? velha.id : newId("p");
  S.progresso[id] = { id, date, pose, data: nova.data, thumb: nova.thumb, importada: true };
  await flush("progresso", id);
  closeModal(); setStatus("Foto importada");
  if (confirm("Foto salva. Importar outra?")) return actions.fotosImportar();
  render();
};
actions.fotosCancelar = () => { if (!Object.keys(modalState.novas || {}).length || confirm("Descartar as fotos desta sessão?")) closeModal(); };
