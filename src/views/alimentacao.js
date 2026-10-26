// Saúde → Alimentação (entrega 3a): busca no banco (TACO + USDA + meus alimentos), detalhe com medidas
// caseiras, favoritos e cadastro de alimento pelo rótulo (com conversão de %VD pela IN 75/2020).
import { S, flush, setStatus } from "../store.js";
import { ui, actions, inputs, render, openModal, updateModal, closeModal, modalState } from "../ui.js";
import { esc, num, fmtNum, newId, $ } from "../util.js";
import { diarioHtml } from "./diario.js";
import { isNative } from "../native.js";
import { lerCodigo, buscarOFF, meuPorCodigo, codigoValido, FONTE_OFF } from "../codigobarras.js";
import { NUTRIENTES, nutri, VITAMINAS_ROTULO, carregarBanco, bancoPronto, fontes, meusAlimentos, alimento, nomeCompleto, buscar, medidas, paraGramas, ehFavorito } from "../alimentos.js";

const SELO = { TACO: "TACO", USDA: "USDA", IBGE: "IBGE", meu: "meu" };
const fmtV = (v, un) => v == null ? `<span class="muted">sem dado</span>` : fmtNum(v, v >= 100 ? 0 : v >= 10 ? 1 : 2) + " " + un;
actions.goAlimentacao = () => { ui.tab = "saude"; ui.sub = "alimentacao"; render(); window.scrollTo(0, 0); };

export function alimentacaoHtml(){
  let h = `<div class="between"><h2 style="margin-top:0">Alimentação</h2><button class="linkbtn" data-act="goSaude">‹ Saúde</button></div>`;
  if (!bancoPronto()){ carregarBanco().then(render); return h + `<div class="loading">Carregando o banco de alimentos…</div>`; }
  h += diarioHtml();
  h += `<h2>Banco de alimentos</h2><div class="panel"><input class="txt" id="al-q" type="search" placeholder="Buscar alimento (ex.: feijao, ovo, frango)" data-act="alBusca" value="${esc(ui.alBusca || "")}" autocomplete="off">
    <div id="al-res" style="margin-top:8px">${resultadosHtml(ui.alBusca || "")}</div></div>`;
  const meus = meusAlimentos();
  h += `<button class="btn ghost block" data-act="alScan" style="margin-top:12px">Escanear código de barras</button>`;
  h += `<div class="between"><h2>Meus alimentos</h2><button class="linkbtn" data-act="alRotulo">+ Cadastrar pelo rótulo</button></div><div class="panel">
    ${meus.length ? `<ul class="hist">${meus.map(a => `<li><button class="linkbtn al-item" data-act="alVer" data-id="${esc(a.id)}">${esc(nomeCompleto(a))}</button><button class="del" data-act="alRotulo" data-id="${esc(a.id)}">Editar</button></li>`).join("")}</ul>`
      : `<p class="small muted" style="margin:0">Industrializados que não estão na tabela (ex.: o seu whey, uma barra de proteína): cadastre pela tabela nutricional do rótulo.</p>`}</div>`;
  const fo = fontes();
  h += `<p class="small muted" style="margin-top:14px">Fontes: ${esc(fo.TACO || "")}. ${esc(fo.USDA || "")}. ${esc(fo.IBGE || "")}. Código de barras: ${esc(FONTE_OFF)}. Nutriente sem dado aparece como "sem dado", não como zero.</p>`;
  return h;
}
function resultadosHtml(q){
  const rs = buscar(q, 25);
  if (!rs.length) return `<p class="small muted" style="margin:6px 0 0">${q ? "Nada encontrado. Tente outra palavra ou cadastre pelo rótulo." : "Digite para buscar. Seus favoritos aparecem aqui."}</p>`;
  return `<ul class="hist">${rs.map(a => `<li><button class="linkbtn al-item" data-act="alVer" data-id="${esc(a.id)}"><span>${esc(nomeCompleto(a))}</span>
      <span class="small muted">${a.kcal != null ? fmtNum(a.kcal, 0) + " kcal" : "–"} · ${a.prot != null ? fmtNum(a.prot, 1) + " g prot." : "–"} /100 g</span></button>
      <span class="selo ${a.f === "meu" ? "meu" : ""}">${SELO[a.f] || ""}</span><button class="estrela" data-act="alFav" data-id="${esc(a.id)}" aria-label="Favorito" aria-pressed="${ehFavorito(a.id)}">${ehFavorito(a.id) ? "★" : "☆"}</button></li>`).join("")}</ul>`;
}
inputs.alBusca = el => { ui.alBusca = el.value; const r = $("#al-res"); if (r) r.innerHTML = resultadosHtml(el.value); };
function alternaFavorito(id){
  const fs = S.saude.favAlimentos = S.saude.favAlimentos || [], i = fs.indexOf(id);
  if (i >= 0) fs.splice(i, 1); else fs.push(id);
  flush("kv", "saude");
  return i < 0;
}
actions.alFav = el => { const fav = alternaFavorito(el.dataset.id); el.textContent = fav ? "★" : "☆"; el.setAttribute("aria-pressed", String(fav)); };

/* ---------- detalhe: quantidade (gramas ou medida caseira) e nutrientes ---------- */
actions.alVer = el => { const a = alimento(el.dataset.id); if (!a) return; openModal(`<div></div>`, { id: a.id, g: (medidas(a)[0] || { g: 100 }).g }); detalhe(); };
function detalhe(){
  const a = alimento(modalState.id), g = modalState.g, ms = medidas(a), v = paraGramas(a, g);
  const principais = NUTRIENTES.filter(n => n[4]), outros = NUTRIENTES.filter(n => !n[4] && v[n[0]] != null);
  const semDado = NUTRIENTES.filter(n => !n[4] && v[n[0]] == null).map(n => n[1]);
  updateModal(`<div class="between"><h3>${esc(nomeCompleto(a))}</h3><button class="linkbtn" data-act="closeModal">Fechar</button></div>
    <div class="small muted">${esc(a.grupo || (a.f === "meu" ? "Cadastrado por você" : ""))} · fonte: ${a.f === "meu" ? (a.off ? "Open Food Facts (conferido por você)" : "rótulo") : a.f === "IBGE" ? "IBGE (POF 2008-2009, como consumido)" : esc(a.f)}${a.usda && a.f === "TACO" ? " + USDA (vit. D, B12, folato, E, K e selênio)" : ""}</div>
    <div class="field"><span class="lab">Quantidade</span><div class="chips">${ms.map((m, i) => `<button type="button" class="chip" data-act="alMed" data-i="${i}" aria-pressed="${Math.abs(m.g - g) < 0.01}">${esc(m.n)} (${fmtNum(m.g)} g)</button>`).join("")}
      <button type="button" class="chip" data-act="alMedNova">+ medida</button></div>
      <div class="rng" style="margin-top:8px"><input class="txt" id="al-g" type="text" inputmode="decimal" value="${fmtNum(g)}" data-act="alG" style="max-width:120px"><span>gramas</span></div></div>
    <ul class="hist">${principais.map(n => `<li><span>${esc(n[1])}</span><strong>${fmtV(v[n[0]], n[2])}</strong></li>`).join("")}</ul>
    ${outros.length ? `<details style="margin-top:8px"><summary class="small"><strong>Vitaminas e minerais (${outros.length})</strong></summary><ul class="hist">${outros.map(n => `<li><span>${esc(n[1])}</span><span>${fmtV(v[n[0]], n[2])}</span></li>`).join("")}</ul></details>` : ""}
    ${semDado.length ? `<p class="small muted" style="margin:8px 0 0">Sem dado na tabela: ${esc(semDado.join(", "))}.</p>` : ""}
    <div class="row" style="margin-top:14px"><button class="btn ghost" data-act="alFavModal">${ehFavorito(a.id) ? "★ Favorito" : "☆ Favoritar"}</button>${a.f === "meu" ? `<button class="btn ghost" data-act="alRotulo" data-id="${esc(a.id)}">Editar</button>` : ""}</div>`);
}
actions.alMed = el => { modalState.g = medidas(alimento(modalState.id))[+el.dataset.i].g; detalhe(); };
inputs.alG = el => { const g = num(el.value); if (g > 0 && g < 5000){ modalState.g = g; const pos = el.selectionStart; detalhe(); const n = $("#al-g"); if (n){ n.focus(); try{ n.setSelectionRange(pos, pos); }catch(e){} } } };
actions.alFavModal = () => { alternaFavorito(modalState.id); detalhe(); };
actions.alMedNova = () => {
  const id = modalState.id, g = modalState.g;
  updateModal(`<h3>Nova medida caseira</h3><p class="small muted" style="margin-top:6px">Ex.: "1 concha" = 100 g. Pese uma vez e o app lembra.</p>
    <div class="grid2"><div class="field"><label class="lab" for="mn-n">Nome</label><input id="mn-n" class="txt" type="text" maxlength="30" placeholder="1 concha"></div>
    <div class="field"><label class="lab" for="mn-g">Gramas</label><input id="mn-g" class="txt" type="text" inputmode="decimal" value="${fmtNum(g)}"></div></div>
    <div class="err" id="mn-err"></div>
    <div class="row" style="margin-top:16px"><button class="btn ghost" data-act="alMedVoltar">Voltar</button><button class="btn strength" data-act="alMedSalvar">Salvar</button></div>`);
  modalState.id = id;
};
actions.alMedVoltar = () => detalhe();
actions.alMedSalvar = () => {
  const n = $("#mn-n").value.trim(), g = num($("#mn-g").value);
  if (!n || !(g > 0)){ $("#mn-err").textContent = "Informe o nome e os gramas."; return; }
  const M = S.saude.medidas = S.saude.medidas || {}; (M[modalState.id] = M[modalState.id] || []).push({ n, g });
  flush("kv", "saude"); modalState.g = g; detalhe();
};

/* ---------- cadastro pelo rótulo (RDC 429/2020 e IN 75/2020) ---------- */
const CAMPOS_ROTULO = [["kcal", "Valor energético (kcal)", true], ["carb", "Carboidratos (g)", true], ["acucar", "Açúcares totais (g)"], ["acucarAd", "Açúcares adicionados (g)"],
  ["prot", "Proteínas (g)", true], ["gord", "Gorduras totais (g)", true], ["sat", "Gorduras saturadas (g)"], ["trans", "Gorduras trans (g)"], ["fibra", "Fibra alimentar (g)"], ["sodio", "Sódio (mg)"]];
actions.alRotulo = el => abrirRotulo(el && el.dataset && el.dataset.id ? S.alimentos[el.dataset.id] : null);
// pre: produto vindo do código de barras (valores por 100 g), para conferir antes de salvar
function abrirRotulo(salvo, pre = null){
  const a = salvo || pre, p = a ? a.porcaoG || (pre ? 100 : null) : null;
  const porPorcao = k => a && a[k] != null && p ? fmtNum(a[k] * p / 100, 2) : "";
  const avisoOff = pre ? (pre.off ? `<div class="infobox" style="margin-top:8px">Encontrado no Open Food Facts (código ${esc(pre.ean)}). <strong>Confira com a embalagem</strong>: quem cadastra é a comunidade e às vezes falta um valor ou a porção está errada.${pre.porcaoG ? "" : " A porção não veio: os valores abaixo estão por 100 g."}</div>`
    : `<div class="infobox" style="margin-top:8px">O código ${esc(pre.ean)} não está no Open Food Facts. Cadastre pelo rótulo: da próxima vez que escanear, o app acha o produto.</div>`) : "";
  openModal(`<h3>${salvo ? "Editar alimento" : pre && pre.off ? "Conferir produto" : "Cadastrar pelo rótulo"}</h3>${avisoOff}
    <p class="small muted" style="margin-top:6px">Copie da tabela nutricional da embalagem os valores <strong>por porção</strong>. O app guarda por 100 g.</p>
    <div class="grid2"><div class="field"><label class="lab" for="ro-nome">Nome *</label><input id="ro-nome" class="txt" type="text" maxlength="60" value="${esc(a ? a.nome : "")}" placeholder="Whey protein isolado"></div>
      <div class="field"><label class="lab" for="ro-marca">Marca *</label><input id="ro-marca" class="txt" type="text" maxlength="40" value="${esc(a ? a.marca : "")}"></div></div>
    <div class="grid2"><div class="field"><label class="lab" for="ro-porcao">Porção (g ou ml) *</label><input id="ro-porcao" class="txt" type="text" inputmode="decimal" value="${p != null ? fmtNum(p) : ""}" placeholder="30"></div>
      <div class="field"><label class="lab" for="ro-medida">Medida caseira</label><input id="ro-medida" class="txt" type="text" maxlength="30" value="${esc(a && a.medida || "")}" placeholder="1 scoop"></div></div>
    <div class="grid2">${CAMPOS_ROTULO.map(([k, l, ob]) => `<div class="field"><label class="lab" for="ro-${k}">${l}${ob ? " *" : ""}</label><input id="ro-${k}" class="txt" type="text" inputmode="decimal" value="${porPorcao(k)}"></div>`).join("")}</div>
    <details class="field"><summary class="lab">Vitaminas e minerais do rótulo (opcional)</summary>
      <div class="yn" style="margin-top:8px"><button type="button" data-act="roUn" data-v="abs" aria-pressed="true">Em mg ou µg</button><button type="button" data-act="roUn" data-v="vd" aria-pressed="false">Em %VD</button></div>
      <div class="help">Se o rótulo traz só o %VD, escolha "%VD": o app converte com os valores de referência da IN 75/2020 (Anvisa).</div>
      <div class="grid2">${VITAMINAS_ROTULO.map(k => { const n = nutri(k); return `<div class="field"><label class="lab" for="ro-${k}"><span>${esc(n[1])}</span> <span class="small muted ro-un" data-un="${n[2]}">(${n[2]})</span></label><input id="ro-${k}" class="txt" type="text" inputmode="decimal" value="${porPorcao(k)}"></div>`; }).join("")}</div></details>
    <div class="err" id="ro-err"></div>
    <div class="row" style="margin-top:16px"><button class="btn ghost" data-act="closeModal">Cancelar</button><button class="btn strength" data-act="roSalvar" data-id="${esc(salvo ? salvo.id : "")}">Salvar</button></div>
    ${salvo ? `<div class="row" style="margin-top:10px"><button class="btn danger" data-act="roApagar" data-id="${esc(salvo.id)}">Apagar este alimento</button></div>` : ""}`, { un: "abs", ean: a && a.ean || null, off: !!(a && a.off) });
}
actions.roUn = el => {
  modalState.un = el.dataset.v;
  el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false"));
  document.querySelectorAll(".ro-un").forEach(s => { s.textContent = modalState.un === "vd" ? "(%VD)" : "(" + s.dataset.un + ")"; });
};
actions.roSalvar = el => {
  const nome = $("#ro-nome").value.trim(), marca = $("#ro-marca").value.trim(), p = num($("#ro-porcao").value);
  const falta = CAMPOS_ROTULO.filter(c => c[2] && num($("#ro-" + c[0]).value) == null).map(c => c[1].replace(/ \(.*\)/, ""));
  if (!nome || !marca || !(p > 0) || falta.length){ $("#ro-err").textContent = "Preencha os campos com *" + (falta.length ? ": " + falta.join(", ") : "") + "."; return; }
  const id = el.dataset.id || newId("a"), a = { id, nome, marca, porcaoG: p, medida: $("#ro-medida").value.trim() || null, f: "meu", grupo: "Meus alimentos", criado: (S.alimentos[id] || {}).criado || new Date().toISOString() };
  if (modalState.ean){ a.ean = modalState.ean; if (modalState.off) a.off = true; }
  const por100 = v => v * 100 / p;
  CAMPOS_ROTULO.forEach(([k]) => { const v = num($("#ro-" + k).value); if (v != null) a[k] = por100(v); });
  VITAMINAS_ROTULO.forEach(k => {
    const v = num($("#ro-" + k).value); if (v == null) return;
    const vd = nutri(k)[3];
    a[k] = por100(modalState.un === "vd" ? v / 100 * vd : v); // %VD → valor absoluto (IN 75/2020, Anexo II)
  });
  S.alimentos[id] = a; flush("alimentos", id); closeModal(); setStatus("Alimento salvo"); render();
};
/* ---------- código de barras ---------- */
// abre o leitor (APK) ou pede o número (navegador) e devolve o código por callback
export function pedirCodigo(fn, emModal = false){
  if (isNative){ lerCodigo(t => setStatus(t)).then(c => { if (c) fn(c); }).catch(() => alert("Não foi possível abrir o leitor de código de barras.")); return; }
  const html = `<h3>Código de barras</h3><p class="small muted" style="margin-top:6px">No navegador, digite os números que ficam embaixo das barras. No app Android, a câmera lê sozinha.</p>
    <div class="field"><input id="cb-num" class="txt" inputmode="numeric" maxlength="14" placeholder="7891234567890" autofocus></div><div class="err" id="cb-err"></div>
    <div class="row" style="margin-top:14px"><button class="btn ghost" data-act="${emModal ? "refVoltar" : "closeModal"}">Voltar</button><button class="btn strength" data-act="cbOk">Buscar</button></div>`;
  cbFn = fn; if (emModal) updateModal(html); else openModal(html);
  setTimeout(() => { const i = $("#cb-num"); if (i) i.focus(); }, 50);
}
let cbFn = null;
actions.cbOk = () => { const v = $("#cb-num").value.replace(/\D/g, ""); if (!codigoValido(v)){ $("#cb-err").textContent = "O código tem de 8 a 14 números."; return; } const f = cbFn; cbFn = null; f(v); };
actions.alScan = () => pedirCodigo(async ean => {
  const meu = meuPorCodigo(ean);
  if (meu){ closeModal(); actions.alVer({ dataset: { id: meu.id } }); return; }
  setStatus("Buscando o produto…");
  const r = await buscarOFF(ean); setStatus("");
  if (r.erro){ alert(r.erro); return; }
  abrirRotulo(null, r.produto || { ean, off: false });
});
actions.roApagar = el => {
  if (!confirm("Apagar este alimento? Registros antigos que o usam ficam com os valores já calculados.")) return;
  delete S.alimentos[el.dataset.id]; flush("alimentos", el.dataset.id); closeModal(); render();
};
