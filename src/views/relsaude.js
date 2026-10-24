// Saúde → Relatórios e coach: relatório semanal, PDF de 1 página para o médico, CSV por módulo e pacote para o coach.
import { S, flush, setStatus } from "../store.js";
import { ui, actions, changes, render, go } from "../ui.js";
import { esc, ymd, ddmm, downloadBlob } from "../util.js";
import { isNative } from "../native.js";
import { addDias } from "../medicacao.js";
import { resumoSemana, semanaAtual } from "../semanal.js";
import { emMarkdown, emPdf } from "../relcompleto.js";
import { baixarPdfMedico } from "../medicopdf.js";
import { MODULOS_CSV, baixarCsv } from "../csvmodulos.js";
import { pacoteCoach, semanaDoPacote, cardapio } from "../coach.js";
import { carregarBanco, bancoPronto } from "../alimentos.js";

actions.goRelSaude = () => go("saude", "relatorios");
ui.relSemana = ui.relSemana || null;

function secoesHtml(r){
  return r.secoes.map(s => `<div style="margin-top:10px"><strong class="small">${esc(s.t)}</strong>${s.paragrafos.map(p => `<p class="small" style="margin:2px 0 0">${esc(p)}</p>`).join("")}
    ${s.tabelas.map(t => `${t.t ? `<div class="small muted" style="margin-top:6px">${esc(t.t)}</div>` : ""}<div style="overflow-x:auto"><table class="tbl small"><thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${t.body.map(row => `<tr>${row.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`).join("")}</div>`).join("");
}

export function relSaudeHtml(){
  if (!bancoPronto()) carregarBanco().then(() => { if (ui.sub === "relatorios") render(); });
  const sd = S.saude, atual = semanaAtual(), semanas = Array.from({ length: 8 }, (_, i) => addDias(atual, -7 * i));
  const sel = ui.relSemana && semanas.includes(ui.relSemana) ? ui.relSemana : (new Date().getDay() === 0 ? atual : addDias(atual, -7));
  const r = resumoSemana(sel);
  let h = `<div class="between"><h2 style="margin-top:0">Relatórios e coach</h2><button class="linkbtn" data-act="goSaude">‹ Saúde</button></div>`;

  // semanal
  h += `<h2>Relatório da semana</h2><div class="panel"><div class="chips">${semanas.map(s => `<button type="button" class="chip" data-act="relSem" data-v="${s}" aria-pressed="${s === sel}">${ddmm(s)}${s === atual ? " (atual)" : ""}</button>`).join("")}</div>
    <div class="small muted" style="margin-top:8px">${esc(r.sub)}</div>${secoesHtml(r)}
    <div class="row" style="margin-top:12px"><button class="btn ghost" data-act="relSemMd">Markdown</button><button class="btn ghost" data-act="relSemPdf">PDF</button></div></div>`;

  // médico
  h += `<h2>Para o médico</h2><div class="panel"><p class="small" style="margin:0">Uma página com peso e faixas de dose, cintura, FLI, doses, efeitos colaterais, últimos exames, força, STOP-Bang e suplementos.</p>
    <div class="field"><label class="lab" for="rs-sup">Suplementos em uso (separe por vírgula)</label><input id="rs-sup" class="txt" data-act="rsSup" value="${esc((sd.suplementos || []).join(", "))}" placeholder="ex.: creatina 3 g"></div>
    <div class="field"><label class="lab" for="rs-perg">Perguntas para o médico</label><textarea id="rs-perg" class="txt" rows="4" data-act="rsPerg" placeholder="Anote durante o mês. Vão no fim do PDF.">${esc(sd.perguntasMedico || "")}</textarea></div>
    <button class="btn strength block" data-act="rsPdfMedico">Gerar PDF de 1 página</button></div>`;

  // coach
  const ini = semanaDoPacote(), c = cardapio();
  h += `<h2>Pacote para o coach</h2><div class="panel"><p class="small" style="margin:0">Um arquivo Markdown com a semana de ${ddmm(ini)} a ${ddmm(addDias(ini, 6))}: relatório, alimentos com quantidades, vitaminas, preferências, exames pendentes e as suas dúvidas. Envie para a sua IA (coach).</p>
    <div class="field"><label class="lab" for="rs-duv">Dúvidas para o coach</label><textarea id="rs-duv" class="txt" rows="4" data-act="rsDuv" placeholder="Anote durante a semana.">${esc(sd.duvidasCoach || "")}</textarea></div>
    <button class="btn strength block" data-act="rsPacote">Gerar e compartilhar</button>
    <button class="panel hub" data-act="goCardapio" style="margin-top:12px"><div><strong>Cardápio da semana e lista de compras</strong><div class="small muted">${c ? `Importado: semana de ${ddmm(c.semana_inicio)} · ${c.pessoas} pessoa${c.pessoas === 1 ? "" : "s"}` : "Importe o arquivo que o coach devolver"}</div></div><span aria-hidden="true">›</span></button></div>`;

  // CSV
  h += `<h2>Planilhas (CSV)</h2><div class="panel"><p class="small muted" style="margin:0 0 8px">Um arquivo por parte, para abrir no Excel.</p><div class="chips">${MODULOS_CSV.map(([k, l]) => `<button type="button" class="chip" data-act="rsCsv" data-v="${k}">${esc(l)}</button>`).join("")}</div></div>`;
  return h;
}

actions.relSem = el => { ui.relSemana = el.dataset.v; render(); };
actions.relSemMd = () => { const r = resumoSemana(ui.relSemana || addDias(semanaAtual(), -7)); downloadBlob(`relatorio-semana-${r.ini}.md`, emMarkdown(r), "text/markdown;charset=utf-8"); };
actions.relSemPdf = async () => { const r = resumoSemana(ui.relSemana || addDias(semanaAtual(), -7)); downloadBlob(`relatorio-semana-${r.ini}.pdf`, await emPdf(r)); };
changes.rsSup = el => { S.saude.suplementos = el.value.split(",").map(s => s.trim()).filter(Boolean); flush("kv", "saude"); setStatus("Salvo"); };
changes.rsPerg = el => { S.saude.perguntasMedico = el.value; flush("kv", "saude"); setStatus("Salvo"); };
changes.rsDuv = el => { S.saude.duvidasCoach = el.value; flush("kv", "saude"); setStatus("Salvo"); };
actions.rsPdfMedico = async () => { const a = document.getElementById("rs-perg"); if (a){ S.saude.perguntasMedico = a.value; flush("kv", "saude"); } setStatus("Gerando PDF…"); await baixarPdfMedico(); setStatus(""); };
actions.rsCsv = el => baixarCsv(el.dataset.v);
actions.rsPacote = async () => {
  const a = document.getElementById("rs-duv"); if (a){ S.saude.duvidasCoach = a.value; flush("kv", "saude"); }
  if (!bancoPronto()) await carregarBanco();
  const nome = `pacote-coach-${semanaDoPacote()}.md`, md = pacoteCoach();
  let compartilhou = false;
  // navegador do celular: menu nativo de compartilhar; no APK, downloadBlob já abre o menu
  if (!isNative && navigator.canShare){
    try{ const file = new File([md], nome, { type: "text/markdown" }); if (navigator.canShare({ files: [file] })){ await navigator.share({ files: [file], title: "Pacote para o coach" }); compartilhou = true; } }catch(e){ if (e && e.name === "AbortError") return; }
  }
  if (!compartilhou) await downloadBlob(nome, md, "text/markdown;charset=utf-8");
  if ((S.saude.duvidasCoach || "").trim() && confirm("Pacote gerado. Limpar as dúvidas anotadas para a próxima semana?")){ S.saude.duvidasCoach = ""; flush("kv", "saude"); render(); }
};
