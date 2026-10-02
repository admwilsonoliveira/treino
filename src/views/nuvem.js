// Interface do backup no Google Drive: painel no Perfil, ações de entrar/sair/restaurar e avisos.
import { S, setStatus } from "../store.js";
import { ui, actions, render, go, openModal, closeModal } from "../ui.js";
import { esc, ddmmyyyy, timeOf } from "../util.js";
import { cloud, nuvem, signIn, signOut, backupNow, remoteInfo, restoreFromDrive, sessionActive } from "../cloud.js";
import { isNative } from "../native.js";

const quando = iso => iso ? ddmmyyyy(iso.slice(0, 10)) + " às " + timeOf(iso) : "";
const temDados = () => Object.keys(S.sessions).length > 0 || Object.keys(S.measurements).length > 1;

export function nuvemPanelHtml(){
  const n = nuvem();
  let h = `<h2>Backup no Google Drive</h2><div class="panel">`;
  if (!n || !n.email){
    h += `<p class="small">Entre com sua conta Google para o app guardar uma cópia dos seus dados <strong>automaticamente</strong> no seu Google Drive. Se trocar de celular, é só entrar de novo para recuperar tudo.</p>
      <p class="small muted">O app usa uma pasta oculta do Drive e só enxerga os arquivos que ele mesmo criou. Seus outros arquivos continuam privados.</p>
      <button class="btn strength block" data-act="cloudSignIn">Entrar com Google</button>`;
  } else {
    const precisaReconectar = cloud.status === "auth" || (!isNative && !sessionActive());
    h += `<p class="small" style="margin:0">Conectado como <strong>${esc(n.email)}</strong></p>
      <p class="small muted" style="margin:4px 0 12px">${n.ultimoEnvio ? "Último backup: " + quando(n.ultimoEnvio) + "." : "Nenhum backup enviado ainda."}</p>`;
    if (cloud.erro) h += `<div class="warnbox show" style="margin:0 0 12px">${esc(cloud.erro)}</div>`;
    if (precisaReconectar) h += `<div class="infobox" style="margin-bottom:12px">${isNative ? "A conexão com o Google expirou." : "Na versão do navegador, a conexão com o Google dura cerca de 1 hora."} Toque em <strong>Reconectar</strong> para continuar o backup automático.</div>
      <button class="btn strength block" data-act="cloudReconnect">Reconectar</button>`;
    else h += `<div class="row"><button class="btn strength" data-act="cloudBackup">Fazer backup agora</button><button class="btn ghost" data-act="cloudRestore">Restaurar do Drive</button></div>`;
    h += `<div class="row" style="margin-top:6px"><button class="linkbtn" data-act="cloudSignOut">Sair da conta Google</button></div>`;
  }
  return h + `</div>`;
}

// Aviso na aba Hoje quando outro aparelho salvou dados mais novos
export function remoteBannerHtml(){
  const r = cloud.remote; if (!r) return "";
  return `<div class="panel" style="margin-bottom:12px;border-color:var(--walk)"><strong>Há dados mais novos no seu Google Drive</strong>
    <p class="small muted" style="margin:4px 0 10px">Backup feito em outro aparelho em ${quando(r.modifiedTime)}${r.registros ? `, com ${r.registros} registros` : ""}.</p>
    <div class="row"><button class="btn strength" data-act="cloudRestore">Trazer para este celular</button><button class="btn ghost" data-act="cloudKeepLocal">Manter os deste celular</button></div></div>`;
}

/* ---------- ações ---------- */
async function afterSignIn(fromOnboarding){
  setStatus("Procurando backup no Drive…");
  let info = null;
  try{ info = await remoteInfo(); }catch(e){ setStatus(e.message); }
  setStatus("");
  if (!info){
    if (!fromOnboarding){ await backupNow(true); render(); }
    else openModal(`<h3>Nenhum backup encontrado</h3><p style="margin-top:10px">Não há dados deste app no Drive de ${esc(nuvem().email)}. Continue o cadastro: a partir de agora o backup será automático.</p><div class="row" style="margin-top:20px"><button class="btn strength" data-act="closeModal">Continuar</button></div>`);
    return;
  }
  const local = temDados();
  openModal(`<h3>Backup encontrado no Drive</h3>
    <p style="margin-top:10px">Feito em <strong>${quando(info.modifiedTime)}</strong>${info.registros ? `, com <strong>${info.registros} registros</strong> de treino e caminhada` : ""}.</p>
    ${local ? `<p class="small muted">Este celular também tem dados. Escolha qual versão manter: a outra será substituída.</p>` : ""}
    <div class="row" style="margin-top:20px"><button class="btn strength" data-act="cloudRestoreConfirmed">Restaurar do Drive</button>
    <button class="btn ghost" data-act="${local ? "cloudKeepLocal" : "closeModal"}">${local ? "Manter os deste celular" : "Agora não"}</button></div>`);
}
actions.cloudSignIn = async el => {
  const onboarding = !!el.dataset.onboarding;
  el.disabled = true;
  try{ await signIn(); await afterSignIn(onboarding); }
  catch(e){ if (!/cancel/i.test(String(e && e.message))) alert("Não foi possível entrar com Google.\n\n" + (e && e.message ? e.message : e)); }
  finally{ el.disabled = false; }
  if (!onboarding && !document.querySelector("#modal[style*='flex']")) render();
};
actions.cloudReconnect = async () => {
  try{ await signIn(); cloud.status = ""; await backupNow(true); }catch(e){ if (!/cancel/i.test(String(e && e.message))) alert("Não foi possível reconectar.\n\n" + (e.message || e)); }
  render();
};
actions.cloudBackup = async el => { el.disabled = true; await backupNow(true); render(); };
actions.cloudRestore = async () => {
  let info = null;
  try{ info = await remoteInfo(); }catch(e){ alert(e.message); return; }
  if (!info){ alert("Não há backup no seu Google Drive ainda."); return; }
  openModal(`<h3>Restaurar do Google Drive?</h3>
    <p style="margin-top:10px">Backup de <strong>${quando(info.modifiedTime)}</strong>${info.registros ? `, com ${info.registros} registros` : ""}.</p>
    <p class="small muted">Os dados que estão neste celular agora serão substituídos pelos do Drive.</p>
    <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Cancelar</button><button class="btn strength" data-act="cloudRestoreConfirmed">Restaurar</button></div>`);
};
actions.cloudRestoreConfirmed = async el => {
  el.disabled = true; setStatus("Restaurando do Drive…");
  try{
    await restoreFromDrive();
    closeModal(); setStatus("Dados restaurados do Google Drive");
    if (ui.afterRestore) return ui.afterRestore();
    go("hoje");
  }catch(e){ el.disabled = false; setStatus(""); alert("Não foi possível restaurar.\n\n" + (e.message || e)); }
};
actions.cloudKeepLocal = async () => { closeModal(); cloud.remote = null; await backupNow(true); render(); };
actions.cloudSignOut = async () => {
  if (!confirm("Sair da conta Google? O backup automático para. Seus dados continuam neste celular e o último backup continua no Drive.")) return;
  await signOut(); render();
};
