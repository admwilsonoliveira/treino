// Painel "Saúde" no Perfil: ativar (com termo), importar histórico, apagar.
import { S, setStatus } from "../store.js";
import { actions, render, openModal, closeModal, modalState } from "../ui.js";
import { esc, fmtNum, ddmm, ddmmyyyy, DIAS, $ } from "../util.js";
import { saudeAtiva, ativarSaude, apagarSaude, contagemSaude, validarHistorico, prepararHistorico, aplicarHistorico } from "../saude.js";

const TERMO = `<p class="small">Ao ativar, o app passa a guardar os dados de saúde que você registrar ou importar: <strong>medicação e doses, sintomas, medidas do corpo, dobras, fotos de progresso, eventos e resultados de exames</strong>.</p>
  <ul class="small" style="padding-left:18px;margin:8px 0">
    <li><strong>Onde ficam:</strong> só neste celular e, se você ligou o backup, na pasta oculta do app no <strong>seu</strong> Google Drive. As fotos de progresso nunca vão para o Drive.</li>
    <li><strong>Quem vê:</strong> só você. Outras pessoas que usam o app não têm acesso, e nada é enviado ao desenvolvedor nem a terceiros.</li>
    <li><strong>Para que servem:</strong> registrar, calcular e avisar. O app não decide dose nem substitui o seu médico.</li>
    <li><strong>Seu controle:</strong> você pode apagar tudo quando quiser, em Perfil → Saúde.</li>
  </ul>
  <p class="small muted">Dados de saúde são dados sensíveis pela LGPD (Lei 13.709/2018, art. 11) e só podem ser tratados com o seu consentimento.</p>`;

const NOMES = { doses: "Doses", measurements: "Pesagens", fita: "Medidas com fita", exames: "Exames", eventos: "Eventos" };
const MASC = ["exames", "eventos"];
const pl = (n, um, varios = um + "s") => n + " " + (n === 1 ? um : varios);
const MED = { tirzepatida: "Tirzepatida", semaglutida: "Semaglutida", outro: "Outro" };

export function saudePanelHtml(){
  if (!saudeAtiva()) return `<h2>Saúde</h2><div class="panel">
    <p class="small">Acompanhe medicação, peso, medidas com fita e exames junto com o treino. Fica desligado até você ativar, e só você vê esses dados.</p>
    <button class="btn strength block" data-act="saudeTermo" style="margin-top:6px">Ativar acompanhamento de saúde</button></div>`;
  const c = contagemSaude(), sd = S.saude;
  const med = sd.medicamento ? `${MED[sd.medicamento] || esc(sd.medicamento)}${sd.doseAtualMg ? " · " + fmtNum(sd.doseAtualMg) + " mg" : ""}${sd.diaFixo != null ? " · " + DIAS[sd.diaFixo].toLowerCase() : ""}` : "";
  return `<h2>Saúde</h2><div class="panel">
    <div class="between"><strong>Acompanhamento ativo</strong><span class="tag">desde ${ddmmyyyy((sd.consentimentoEm || "").slice(0, 10))}</span></div>
    ${med ? `<p class="small" style="margin:8px 0 0">Medicação: ${med}</p>` : ""}
    <p class="small muted" style="margin:6px 0 0">${pl(c.doses, "dose")} · ${pl(c.fita, "medida com fita", "medidas com fita")} · ${pl(c.exames, "exame")} · ${pl(c.eventos, "evento")}</p>
    <div class="row" style="margin-top:12px"><button class="btn strength" data-act="goSaude">Abrir Saúde</button><button class="btn ghost" data-act="saudeImportar">Importar histórico</button></div>
    <input type="file" id="histFile" accept="application/json,.json" hidden>
    <div class="row" style="margin-top:4px"><button class="linkbtn" data-act="saudeTermo">Ler o termo</button><button class="linkbtn danger" data-act="saudeApagar">Apagar meus dados de saúde</button></div>
  </div>`;
}
export function saudePanelAfter(){
  const f = $("#histFile");
  if (f) f.addEventListener("change", () => { if (f.files[0]) onHistoricoFile(f.files[0]); f.value = ""; });
}

actions.saudeTermo = () => openModal(`<h3>Acompanhamento de saúde</h3><div style="margin-top:10px">${TERMO}</div>
  <div class="row" style="margin-top:18px">${saudeAtiva()
    ? `<button class="btn ghost block" data-act="closeModal">Fechar</button>`
    : `<button class="btn ghost" data-act="closeModal">Não agora</button><button class="btn strength" data-act="saudeAtivar">Concordo e ativar</button>`}</div>`);
actions.saudeAtivar = async () => { await ativarSaude(); closeModal(); setStatus("Acompanhamento de saúde ativado"); render(); };

actions.saudeApagar = () => openModal(`<h3>Apagar meus dados de saúde</h3>
  <p class="small" style="margin-top:8px">Apaga deste celular <strong>todas</strong> as doses, sintomas, eventos, medidas com fita e exames, e desliga o acompanhamento. Se o backup no Google Drive estiver ligado, ele também deixa de ter esses dados.</p>
  <p class="small">Treinos, caminhadas e pesagens <strong>não</strong> são apagados.</p>
  <p class="small muted">Se quiser guardar uma cópia, faça antes um "Backup em arquivo".</p>
  <div class="row" style="margin-top:18px"><button class="btn ghost" data-act="closeModal">Cancelar</button><button class="btn danger" data-act="saudeApagarSim">Apagar</button></div>`);
actions.saudeApagarSim = async () => {
  if (!confirm("Tem certeza? Os dados de saúde serão apagados e isso não pode ser desfeito.")) return;
  await apagarSaude(); closeModal(); setStatus("Dados de saúde apagados"); render();
};

/* ---------- importar histórico ---------- */
actions.saudeImportar = () => $("#histFile").click();
export async function onHistoricoFile(file){
  let d;
  try{ d = JSON.parse(await file.text()); }catch(e){ alert("Não foi possível ler o arquivo. Escolha o arquivo .json do histórico."); return; }
  const err = validarHistorico(d); if (err){ alert(err); return; }
  const prep = prepararHistorico(d);
  const linhas = Object.keys(NOMES).map(k => {
    const n = prep.novos[k].length, e = prep.existentes[k], a = MASC.includes(k) ? "o" : "a";
    if (!n && !e) return "";
    return `<li><strong>${NOMES[k]}:</strong> ${n} nov${a}${n === 1 ? "" : "s"}${e ? ` <span class="muted">(${e} já existia${e === 1 ? "" : "m"} e ${e === 1 ? "será pulad" + a : "serão pulad" + a + "s"})</span>` : ""}</li>`;
  }).join("");
  const cf = prep.config;
  const cfg = [cf.medicamento && "medicamento " + (MED[cf.medicamento] || cf.medicamento), cf.doseAtualMg && "dose atual " + fmtNum(cf.doseAtualMg) + " mg",
    cf.diaFixo != null && "dia fixo " + DIAS[cf.diaFixo].toLowerCase(), cf.inicioTratamento && "início em " + ddmmyyyy(cf.inicioTratamento),
    cf.proximaDose && "próxima dose " + ddmm(cf.proximaDose)].filter(Boolean);
  const total = Object.values(prep.novos).reduce((s, a) => s + a.length, 0) + prep.ajustes.length + prep.duvidosos.length + cfg.length;
  openModal(`<h3>Importar histórico de saúde</h3>
    <p class="small muted" style="margin-top:6px">Confira antes. Nada é gravado até você tocar em "Importar". Nenhum treino é alterado.</p>
    <ul class="small" style="padding-left:18px;margin:10px 0">${linhas}</ul>
    ${cfg.length ? `<p class="small"><strong>Medicação:</strong> ${esc(cfg.join(" · "))}</p>` : ""}
    ${prep.ajustes.length ? `<p class="small" style="margin-top:8px"><strong>Ajustes em pesagens que já existem:</strong></p><ul class="small" style="padding-left:18px;margin:4px 0">${prep.ajustes.map(a => `<li>${esc(a.desc)}</li>`).join("")}</ul>` : ""}
    ${prep.duvidosos.length ? `<div class="field"><span class="lab">Leituras de músculo fora da curva</span><p class="small muted" style="margin:0 0 6px">Ficam guardadas, mas as marcadas não entram nos cálculos de músculo. Toque para desmarcar.</p>
      <div class="chips">${prep.duvidosos.map(x => `<button type="button" class="chip" data-act="histDuv" data-id="${esc(x.id)}" aria-pressed="true">${ddmm(x.date)}: ${fmtNum(x.valor)} kg${x.mediana != null ? ` <span style="font-weight:500">(vizinhas ~${fmtNum(x.mediana)})</span>` : ""}</button>`).join("")}</div></div>` : ""}
    ${prep.altura && total ? `<div class="field"><span class="lab">Altura</span><p class="small muted" style="margin:0 0 6px">O arquivo diz ${fmtNum(prep.altura.arquivo, 0)} cm${prep.altura.app ? ` e o seu perfil diz ${fmtNum(prep.altura.app, 0)} cm` : ""}. Qual vale?</p>
      <div class="yn"><button type="button" data-act="histAltura" data-v="arquivo" aria-pressed="true">${fmtNum(prep.altura.arquivo, 0)} cm</button><button type="button" data-act="histAltura" data-v="app" aria-pressed="false">${prep.altura.app ? fmtNum(prep.altura.app, 0) + " cm" : "Manter vazio"}</button></div></div>` : ""}
    ${total ? "" : `<div class="infobox" style="margin-top:10px">Tudo deste arquivo já está no app. Não há nada novo para importar.</div>`}
    <div class="row" style="margin-top:20px"><button class="btn ghost" data-act="closeModal">Cancelar</button>${total ? `<button class="btn strength" data-act="histConfirmar">Importar</button>` : ""}</div>`,
  { prep, altura: "arquivo", duv: prep.duvidosos.map(x => x.id) });
}
actions.histAltura = el => {
  modalState.altura = el.dataset.v;
  el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false"));
};
actions.histDuv = el => {
  const id = el.dataset.id, i = modalState.duv.indexOf(id);
  if (i >= 0) modalState.duv.splice(i, 1); else modalState.duv.push(id);
  el.setAttribute("aria-pressed", String(i < 0));
};
actions.histConfirmar = async () => {
  const { prep, altura, duv } = modalState; if (!prep) return;
  await aplicarHistorico(prep, { usarAlturaArquivo: altura === "arquivo", duvidosos: duv });
  closeModal(); setStatus("Histórico importado"); render();
};
