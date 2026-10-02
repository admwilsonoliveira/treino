// Primeiro acesso: perfil, bioimpedância (opcional) e escolha do plano.
import { S, flush } from "../store.js";
import { ui, actions, render, go, setOnboarding } from "../ui.js";
import { ymd, newId } from "../util.js";
import { profileFormHtml, readProfileForm, formState, bioFieldsHtml, readBioFields, requestPersist } from "./perfil.js";
import { templatesHtml } from "./plano.js";

let step = 1, firstMeasureId = null;
const steps = n => `<div class="steps">${[1, 2, 3].map(i => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</div>`;

export const onboarding = {
  html(){
    if (step === 1) return steps(1) + `<h2 style="margin-top:4px">Vamos montar seu perfil</h2>
      <p class="small muted">Essas informações ajudam o app a calcular sua evolução e a sugerir exercícios seguros. Ficam guardadas só neste celular.</p>
      <div class="panel">${profileFormHtml(S.profile || {}, true)}</div>
      <div class="row" style="margin-top:16px"><button class="btn strength" data-act="obNext1">Continuar</button></div>`;
    if (step === 2) return steps(2) + `<h2 style="margin-top:4px">Bioimpedância (opcional)</h2>
      <p class="small muted">Se você tem os números de uma balança de bioimpedância ou de uma avaliação física, preencha. Dá para registrar depois na aba Perfil.</p>
      <div class="panel">${bioFieldsHtml({})}</div>
      <div class="row" style="margin-top:16px"><button class="btn ghost" data-act="obSkip2">Pular</button><button class="btn strength" data-act="obNext2">Salvar e continuar</button></div>`;
    return steps(3) + `<h2 style="margin-top:4px">Escolha seu plano de treino</h2>
      <p class="small muted">Você pode editar exercícios, dias e séries depois, ou trocar de plano quando quiser.</p>` + templatesHtml();
  }
};

export function startOnboarding(){
  step = S.profile ? 3 : 1;
  formState.profile = {};
  ui.afterPlanCreated = finish;
  setOnboarding(onboarding);
  render();
}
function finish(){
  ui.afterPlanCreated = null;
  setOnboarding(null);
  requestPersist();
  go("hoje");
}

actions.obNext1 = () => {
  const r = readProfileForm(true); if (!r) return;
  S.profile = Object.assign(r.profile, { criado: new Date().toISOString(), pesoInicial: r.peso });
  flush("kv", "profile");
  firstMeasureId = newId("m");
  S.measurements[firstMeasureId] = { id: firstMeasureId, date: ymd(new Date()), peso: r.peso };
  flush("measurements", firstMeasureId);
  step = 2; render(); window.scrollTo(0, 0);
};
actions.obSkip2 = () => { step = 3; render(); window.scrollTo(0, 0); };
actions.obNext2 = () => {
  const bio = readBioFields();
  if (firstMeasureId && S.measurements[firstMeasureId]){ Object.assign(S.measurements[firstMeasureId], bio); flush("measurements", firstMeasureId); }
  step = 3; render(); window.scrollTo(0, 0);
};
