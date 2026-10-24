// Saúde → Cardápio da semana (importado do coach): receitas com o total para todos e a sua porção,
// "Comi a minha porção" (registra só a sua parte) e lista de compras por seção do mercado com "já tenho".
import { S, flush, setStatus } from "../store.js";
import { ui, actions, changes, render, go, rerenderKeepScroll } from "../ui.js";
import { esc, ymd, ddmm, newId, DIAS, $ } from "../util.js";
import { nomeTipo } from "../nutricao.js";
import { carregarBanco, bancoPronto } from "../alimentos.js";
import { cardapio, lerCardapio, pessoas, itensDaPorcao, novaRefeicaoDoCardapio, listaCompras, fmtPeso } from "../coach.js";

actions.goCardapio = () => go("saude", "cardapio");
const diaSem = s => DIAS[new Date(s + "T12:00:00").getDay()];
const lista = xs => `<ul class="small" style="margin:4px 0 0;padding-left:18px">${xs.map(x => `<li>${esc(x.alimento)}: ${fmtPeso(x.g)}</li>`).join("")}</ul>`;

export function cardapioHtml(){
  if (!bancoPronto()) carregarBanco().then(() => { if (ui.sub === "cardapio") render(); });
  const c = cardapio(), hoje = ymd(new Date());
  let h = `<div class="between"><h2 style="margin-top:0">Cardápio da semana</h2><button class="linkbtn" data-act="goRelSaude">‹ Relatórios</button></div>
    <input type="file" id="cardFile" accept=".json,.md,.txt,application/json,text/markdown,text/plain" hidden>`;
  h += `<div class="panel"><div class="between"><div><strong>Pessoas nas refeições</strong><div class="small muted">Só multiplica as quantidades. Quem come junto não tem dados no app.</div></div>
    <select class="txt" data-act="cardPessoas" style="width:auto">${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${(c ? c.pessoas : pessoas()) === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>
    <div class="row" style="margin-top:10px"><button class="btn ${c ? "ghost" : "strength"}" data-act="cardImportar">Importar cardápio</button>${c ? `<button class="btn ghost" data-act="cardApagar">Remover</button>` : ""}</div></div>`;
  if (!c) return h + `<p class="empty" style="margin-top:12px">Gere o "Pacote para o coach", envie para a sua IA e importe aqui o cardápio que ela devolver (arquivo .json, ou .md com um bloco json).</p>`;

  const com = c.comidas || {};
  h += `<p class="small muted" style="margin-top:12px">Semana de ${ddmm(c.semana_inicio)} · quantidades totais para ${c.pessoas} pessoa${c.pessoas === 1 ? "" : "s"}.</p>`;
  c.dias.forEach((d, di) => {
    h += `<details class="panel" style="margin-top:10px" ${d.data === hoje || (di === 0 && !c.dias.some(x => x.data === hoje)) ? "open" : ""}><summary><strong>${diaSem(d.data)}, ${ddmm(d.data)}</strong>${d.data === hoje ? ' <span class="tag">hoje</span>' : ""}</summary>`;
    d.refeicoes.forEach((r, ri) => {
      const k = di + "-" + ri, feita = com[k] && S.refeicoes[com[k]];
      h += `<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)"><div class="small muted">${esc(nomeTipo(r.tipo))}</div><strong>${esc(r.nome)}</strong>
        ${r.total.length ? `<div class="small" style="margin-top:6px"><strong>Total (${c.pessoas} pessoa${c.pessoas === 1 ? "" : "s"})</strong>${lista(r.total)}</div>` : ""}
        ${r.porcao.length ? `<div class="small" style="margin-top:6px"><strong>Sua porção</strong>${lista(r.porcao)}</div>` : ""}
        ${r.preparo ? `<p class="small muted" style="margin:6px 0 0">${esc(r.preparo)}</p>` : ""}
        ${r.porcao.length ? (feita ? `<div class="row" style="margin-top:8px"><span class="tag">Registrada</span><button class="linkbtn" data-act="cardDesfazer" data-k="${k}">desfazer</button></div>`
          : `<button class="btn strength" data-act="cardComi" data-k="${k}" style="margin-top:8px">Comi a minha porção</button>`) : ""}</div>`;
    });
    h += `</details>`;
  });

  // lista de compras
  const grupos = listaCompras(c), total = grupos.reduce((s, g) => s + g.itens.length, 0), tenho = grupos.reduce((s, g) => s + g.itens.filter(i => i.tenho).length, 0);
  h += `<h2>Lista de compras</h2><div class="panel"><div class="small muted">Soma da semana para ${c.pessoas} pessoa${c.pessoas === 1 ? "" : "s"}. Toque no que já tem em casa (${tenho} de ${total}).</div>
    ${grupos.map(g => `<div style="margin-top:12px"><strong class="small">${esc(g.secao)}</strong>${g.itens.map(i => `<label class="check-row" style="display:flex;gap:10px;align-items:center;padding:6px 0;${i.tenho ? "opacity:.5;text-decoration:line-through" : ""}"><input type="checkbox" data-act="cardTenho" data-k="${esc(i.k)}" ${i.tenho ? "checked" : ""}><span class="small" style="flex:1">${esc(i.nome)}</span><strong class="small">${fmtPeso(i.g)}</strong></label>`).join("")}</div>`).join("")}</div>`;
  return h;
}
export function cardapioAfter(){
  const f = $("#cardFile");
  if (f) f.addEventListener("change", async () => {
    const file = f.files[0]; f.value = ""; if (!file) return;
    const r = lerCardapio(await file.text());
    if (r.erro){ alert(r.erro); return; }
    const c = r.cardapio, n = c.dias.reduce((s, d) => s + d.refeicoes.length, 0);
    if (cardapio() && !confirm("Substituir o cardápio atual pelo novo?")) return;
    if (!confirm(`Importar ${n} refeições de ${c.dias.length} dias (semana de ${ddmm(c.semana_inicio)}, ${c.pessoas} pessoa${c.pessoas === 1 ? "" : "s"})?`)) return;
    S.saude.cardapio = c; S.saude.pessoasRefeicao = c.pessoas; flush("kv", "saude"); setStatus("Cardápio importado"); render();
  });
}

actions.cardImportar = () => $("#cardFile").click();
actions.cardApagar = () => { if (!confirm("Remover o cardápio importado? As refeições já registradas continuam no diário.")) return; S.saude.cardapio = null; flush("kv", "saude"); render(); };
changes.cardPessoas = el => { S.saude.pessoasRefeicao = +el.value; if (S.saude.cardapio) S.saude.cardapio.pessoas = +el.value; flush("kv", "saude"); render(); };
actions.cardComi = async el => {
  if (!bancoPronto()) await carregarBanco();
  const c = cardapio(), [di, ri] = el.dataset.k.split("-").map(Number), d = c.dias[di], r = d.refeicoes[ri];
  const { itens, semBanco } = itensDaPorcao(r);
  if (!itens.length){ alert("Não encontrei esses alimentos no banco. Registre pela Alimentação."); return; }
  if (semBanco.length && !confirm(`Não encontrei no banco: ${semBanco.join(", ")}. Registrar o restante?`)) return;
  const id = newId("r"); S.refeicoes[id] = Object.assign({ id }, novaRefeicaoDoCardapio(d, r, itens)); flush("refeicoes", id);
  c.comidas = c.comidas || {}; c.comidas[el.dataset.k] = id; flush("kv", "saude");
  setStatus("Refeição registrada"); rerenderKeepScroll();
};
actions.cardDesfazer = el => {
  const c = cardapio(), id = c.comidas && c.comidas[el.dataset.k]; if (!id) return;
  if (!confirm("Apagar do diário a refeição registrada?")) return;
  delete S.refeicoes[id]; flush("refeicoes", id); delete c.comidas[el.dataset.k]; flush("kv", "saude"); rerenderKeepScroll();
};
changes.cardTenho = el => {
  const c = cardapio(), t = S.saude.comprasTenho && S.saude.comprasTenho.semana === c.semana_inicio ? S.saude.comprasTenho : { semana: c.semana_inicio, itens: [] };
  t.itens = el.checked ? [...new Set(t.itens.concat(el.dataset.k))] : t.itens.filter(x => x !== el.dataset.k);
  S.saude.comprasTenho = t; flush("kv", "saude"); rerenderKeepScroll();
};
