// Aba "Mais" (navegação de quem usa o módulo Saúde) e o botão "+" de registro rápido.
import { ui, views, actions, render, openModal, closeModal } from "../ui.js";

views.mais = {
  html(){
    const item = (tab, t, s) => `<button class="panel hub" data-act="goTab" data-tab="${tab}" style="margin-top:12px"><div><strong>${t}</strong><div class="small muted">${s}</div></div><span aria-hidden="true">›</span></button>`;
    return `<h2 style="margin-top:0">Mais</h2>`
      + item("caminhada", "Caminhada", "Iniciar, acompanhar e ver o histórico")
      + item("evolucao", "Evolução", "Cargas, corpo, calorias, dor e relatórios")
      + item("perfil", "Perfil", "Dados pessoais, lembretes, aparência e backup");
  }
};

// Registro rápido: cada botão chama a mesma janela usada nas telas
const RAPIDO = [["refNova", "Refeição"], ["aguaRapida", "Água"], ["addMedida", "Peso"], ["doseNova", "Dose"], ["fitaNova", "Medidas com fita"], ["dobrasNova", "Dobras"], ["sintomaNovo", "Sintoma"], ["supRapido", "Suplemento"], ["checkinNovo", "Check-in da noite"], ["eventoNovo", "Evento"]];
actions.rapido = () => openModal(`<h3>Registrar</h3><div class="acoes">${RAPIDO.map(([a, l]) => `<button type="button" data-act="rapidoIr" data-v="${a}">${l}</button>`).join("")}</div>
  <div class="row" style="margin-top:16px"><button class="btn ghost block" data-act="closeModal">Fechar</button></div>`);
actions.goRelCompleto = () => { ui.tab = "evolucao"; ui.sub = null; ui.evoView = "relatorio"; render(); window.scrollTo(0, 0); };
actions.aguaRapida = () => openModal(`<h3>Água</h3><div class="acoes">${[200, 300, 500, 750].map(v => `<button type="button" data-act="aguaMaisFecha" data-v="${v}">+${v} ml</button>`).join("")}</div>
  <div class="row" style="margin-top:16px"><button class="btn ghost block" data-act="closeModal">Fechar</button></div>`);
actions.aguaMaisFecha = el => { closeModal(); actions.aguaMais(el); };
actions.rapidoIr = el => { const fn = actions[el.dataset.v]; closeModal(); if (fn) fn(el); };
