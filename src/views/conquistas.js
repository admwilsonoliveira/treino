// Selos das micrometas: aviso no Hoje (animação curta, desligada com "reduzir movimento") e lista na Saúde.
import { S } from "../store.js";
import { actions, render } from "../ui.js";
import { esc, ddmmyyyy } from "../util.js";
import { CONQUISTAS, conferirConquistas, conquistasNovas, marcarVistas } from "../conquistas.js";

export function conquistaCardHtml(){
  const novas = conquistasNovas(); if (!novas.length) return "";
  return `<div class="panel conquista"><strong>Conquista${novas.length > 1 ? "s" : ""}!</strong>
    ${novas.map(([, t, d]) => `<div style="margin-top:6px"><span class="selo" aria-hidden="true">★</span> <strong>${esc(t)}</strong><div class="small muted">${esc(d)}</div></div>`).join("")}
    <button class="btn ghost" data-act="conqVisto" style="margin-top:10px">Legal!</button></div>`;
}
actions.conqVisto = () => { marcarVistas(); render(); };

export function conquistasHtml(){
  const feitas = conferirConquistas(), c = (S.saude && S.saude.conquistas) || {};
  return `<h2>Conquistas</h2><div class="panel"><div class="selos">${CONQUISTAS.map(([k, t]) => `<div class="selo-item ${c[k] ? "ok" : ""}"><span class="selo" aria-hidden="true">${c[k] ? "★" : "☆"}</span><div><div class="small"><strong>${esc(t)}</strong></div><div class="small muted">${c[k] ? "em " + ddmmyyyy(c[k].date) : "ainda não"}</div></div></div>`).join("")}</div>
    ${feitas.length ? "" : `<p class="small muted" style="margin:8px 0 0">Marcos concretos do seu progresso. Aparecem aqui quando acontecem.</p>`}</div>`;
}
