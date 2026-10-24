// Aba "Mais" (navegação de quem usa o módulo Saúde) e o botão "+" de registro rápido.
import { views, actions, openModal, closeModal } from "../ui.js";

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
const RAPIDO = [["addMedida", "Peso"], ["doseNova", "Dose"], ["fitaNova", "Medidas com fita"], ["dobrasNova", "Dobras"], ["sintomaNovo", "Sintoma"], ["eventoNovo", "Evento"]];
actions.rapido = () => openModal(`<h3>Registrar</h3><div class="acoes">${RAPIDO.map(([a, l]) => `<button type="button" data-act="rapidoIr" data-v="${a}">${l}</button>`).join("")}</div>
  <div class="row" style="margin-top:16px"><button class="btn ghost block" data-act="closeModal">Fechar</button></div>`);
actions.rapidoIr = el => { const fn = actions[el.dataset.v]; closeModal(); if (fn) fn(el); };
