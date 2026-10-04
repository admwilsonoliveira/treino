// Organizar a semana: escolher, dia a dia, qual treino fazer (ou descanso) e em quais dias caminhar.
// Os dias ficam gravados no próprio plano (treinos[L].dias) e na caminhada (settings.walk.dias).
import { S, flush, activePlan, planLetters, treinoForDay } from "../store.js";
import { actions, changes, go, rerenderKeepScroll } from "../ui.js";
import { esc, DIAS } from "../util.js";

const ORDEM = [1, 2, 3, 4, 5, 6, 0]; // segunda a domingo

export function semanaHtml(){
  const p = activePlan();
  let h = `<div class="between"><h2 style="margin-top:4px">Organizar a semana</h2><button class="linkbtn" data-act="semVoltar">Concluir</button></div>`;
  if (!p) return h + `<div class="empty">Escolha um plano de treino primeiro.</div>`;
  const Ls = planLetters(p), w = S.settings.walk;
  h += `<p class="small muted">Escolha o treino de cada dia. Para trocar dois dias, basta mudar os dois. As mudanças valem para as próximas semanas e para os lembretes.</p><div class="panel">`;
  ORDEM.forEach(d => {
    const atual = treinoForDay(p, d) || "";
    h += `<div class="semrow">
      <label class="semdia" for="sem-${d}">${DIAS[d]}</label>
      <select id="sem-${d}" class="txt" data-act="semTreino" data-d="${d}">
        <option value="" ${atual ? "" : "selected"}>Descanso</option>
        ${Ls.map(L => `<option value="${L}" ${atual === L ? "selected" : ""}>Treino ${L}</option>`).join("")}
      </select>
      <button type="button" class="chip semwalk" data-act="semWalk" data-d="${d}" aria-pressed="${w.dias.includes(d)}" aria-label="Caminhada na ${DIAS[d]}">Caminhada</button>
    </div>`;
  });
  h += `</div>`;
  const semDia = Ls.filter(L => !(p.treinos[L].dias || []).length);
  if (semDia.length) h += `<div class="infobox" style="margin-top:12px">${semDia.map(L => "Treino " + L).join(", ")} ${semDia.length > 1 ? "estão" : "está"} sem dia na semana. Você ainda pode fazê-lo quando quiser, pela aba Treinos.</div>`;
  return h;
}

changes.semTreino = el => {
  const p = activePlan(), d = +el.dataset.d, L = el.value;
  // cada dia tem no máximo um treino: tira o dia de todos e coloca no escolhido
  planLetters(p).forEach(k => { p.treinos[k].dias = (p.treinos[k].dias || []).filter(x => x !== d); });
  if (L) p.treinos[L].dias = [...p.treinos[L].dias, d].sort();
  flush("plans", p.id); rerenderKeepScroll();
};
actions.semWalk = el => {
  const d = +el.dataset.d, w = S.settings.walk, i = w.dias.indexOf(d);
  if (i >= 0) w.dias.splice(i, 1); else w.dias.push(d);
  w.dias.sort(); w.ativo = w.dias.length > 0;
  flush("kv", "settings"); el.setAttribute("aria-pressed", String(i < 0));
};
actions.semVoltar = () => go("hoje");
actions.goSemana = () => go("treinos", "semana");
