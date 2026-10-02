// Avaliação física (pré-diagnóstico informativo): cartão no Perfil e tela completa.
import { S, measurementsList } from "../store.js";
import { actions, go } from "../ui.js";
import { esc, fmtNum, ddmmyyyy } from "../util.js";
import { diagnostico } from "../diagnostico.js";

const COR = { ok: "var(--strength)", atencao: "var(--walk)", alerta: "var(--danger)" };
const n1 = v => fmtNum(v, 1), n0 = v => fmtNum(v, 0);

// Nota explicativa de cada indicador: o que é + leitura do resultado da pessoa
function explicacao(i, d){
  const p = S.profile, M = p.sexo !== "F";
  const ms = measurementsList();
  switch (i.k){
    case "IMC": return `<p>É o peso dividido pela altura ao quadrado (${n1(d.peso)} ÷ ${fmtNum(d.altura / 100, 2)}²). A Organização Mundial da Saúde usa estas faixas: abaixo de 18,5 baixo peso; 18,5 a 24,9 adequado; 25 a 29,9 sobrepeso; 30 a 34,9 obesidade grau I; 35 a 39,9 grau II; 40 ou mais, grau III.</p>
      <p><strong>Seu resultado:</strong> ${n1(i.v)}, ${esc(i.txt)}. ${d.altura ? `Para um IMC de 24,9 na sua altura, o peso seria cerca de ${n1(24.9 * Math.pow(d.altura / 100, 2))} kg.` : ""}</p>
      <p class="muted">Limitação: o IMC não separa músculo de gordura. Quem treina pode ter IMC alto com pouca gordura. Por isso o % de gordura e a cintura dizem mais sobre a saúde.</p>`;
    case "Cintura ÷ altura": return `<p>É a medida da cintura (na altura do umbigo) dividida pela altura. Mostra a <strong>gordura na barriga</strong>, que é a que mais se relaciona com pressão alta, diabetes e problemas do coração. A regra prática: a cintura deve ser menor que a <strong>metade da altura</strong> (resultado abaixo de 0,50).</p>
      <p><strong>Seu resultado:</strong> ${i.v.toFixed(2).replace(".", ",")}, ${esc(i.txt)}. ${i.v >= 0.5 && d.altura ? `A cintura ideal para a sua altura fica abaixo de ${n0(d.altura / 2)} cm.` : "Continue acompanhando."}</p>`;
    case "Gordura corporal": return `<p>É a parte do seu peso que é gordura. Faixas de referência para ${M ? "homens" : "mulheres"}: ${M ? "atleta 6% a 13%; boa forma 14% a 17%; aceitável 18% a 24%; obesidade 25% ou mais" : "atleta 14% a 20%; boa forma 21% a 24%; aceitável 25% a 31%; obesidade 32% ou mais"}.</p>
      <p><strong>Seu resultado:</strong> ${n1(i.v)}%, ${esc(i.txt)}. São ${n1(d.massaGorda)} kg de gordura no seu corpo.${p.metaGordura && d.pesoAlvoGordura ? ` Com a sua meta de ${n1(p.metaGordura)}%, e mantendo a massa magra, você ficaria com cerca de ${n1(d.pesoAlvoGordura)} kg.` : ""}</p>
      <p class="muted">A balança de bioimpedância varia bastante com a hidratação. Para comparar uma medida com a outra, meça sempre nas mesmas condições: de manhã, em jejum, depois de urinar e antes de treinar.</p>`;
    case "Massa gorda": return `<p>É o peso da gordura em quilos: peso × % de gordura (${n1(d.peso)} × ${n1(d.gordura)}%).</p>
      <p><strong>Seu resultado:</strong> ${n1(i.v)} kg. É este número que você quer ver cair. Se o peso cai e a massa gorda cai junto, o emagrecimento está vindo da gordura.</p>`;
    case "Massa magra": {
      const musc = ms.filter(m => m.musculo != null).pop();
      return `<p>É <strong>tudo o que não é gordura</strong>: músculos, ossos, órgãos, sangue, pele e principalmente água (mais da metade dela). Conta: peso − massa gorda (${n1(d.peso)} − ${n1(d.massaGorda)}).</p>
      <p><strong>Seu resultado:</strong> ${n1(i.v)} kg. <strong>Não é só músculo.</strong>${musc ? ` Seu músculo esquelético, pela balança, é ${n1(musc.musculo)} kg, cerca de ${n0(musc.musculo / i.v * 100)}% da massa magra.` : ""}</p>
      <p class="muted">No emagrecimento, o objetivo é perder gordura mantendo a massa magra. Treino de força e proteína suficiente ajudam a preservá-la.</p>`;
    }
    case "Índice de massa magra": return `<p>É parecido com o IMC, mas usa só a massa magra: massa magra ÷ altura² (${n1(d.massaMagra)} ÷ ${fmtNum(d.altura / 100, 2)}²). Serve para comparar a "estrutura" de pessoas de alturas diferentes, sem a gordura. Para ${M ? "homens: 18 a 20 é a média; 20 a 22 acima da média; 22 a 25 muito acima (típico de quem treina há anos)" : "mulheres: 14 a 17 é a média; 17 a 19 acima da média; acima de 19 muito acima"}.</p>
      <p><strong>Seu resultado:</strong> ${n1(i.v)}, ${esc(i.txt)}.</p>
      <p class="muted">Detalhe: quem está acima do peso tende a ter esse índice um pouco maior, porque o corpo precisa de mais estrutura (ossos, água, músculos das pernas) para carregar o peso extra. Ao emagrecer, é normal ele cair um pouco.</p>`;
    case "Músculo esquelético": {
      const a = ms.filter(m => m.musculo != null), first = a[0], last = a[a.length - 1];
      const dif = first && last && first !== last ? last.musculo - first.musculo : null;
      return `<p>São os músculos ligados aos ossos, os que você movimenta e treina. É uma parte da massa magra, estimada pela balança de bioimpedância.</p>
      <p><strong>Seu resultado:</strong> ${n1(i.v)} kg.${dif != null ? ` Desde ${ddmmyyyy(first.date)}: ${dif > 0 ? "+" : ""}${n1(dif)} kg.` : ""}</p>
      <p class="muted">Em déficit calórico, <strong>manter</strong> o músculo já é um ótimo resultado. Pequenas quedas (meio quilo) podem ser só variação de água. Olhe a tendência de várias semanas, não uma medida isolada.</p>`;
    }
    case "Gasto em repouso": return `<p>São as calorias que o corpo gasta por dia <strong>parado</strong>, só para se manter vivo: respirar, bater o coração, manter a temperatura. É a maior parte do gasto do dia.</p>
      <p><strong>Seu resultado:</strong> cerca de ${n0(i.v)} kcal por dia, ${d.massaMagra ? "calculado pela sua massa magra (fórmula de Katch-McArdle), que é mais preciso" : "estimado por idade, peso, altura e sexo (fórmula de Mifflin-St Jeor)"}.</p>`;
    case "Gasto diário estimado": return `<p>É o gasto em repouso somado ao gasto das atividades do dia, incluindo treino e caminhada. Usamos um fator de atividade conforme as sessões por semana do seu plano (${d.fator.treinos} treinos + ${d.fator.caminhadas} caminhadas = fator ${fmtNum(d.fator.f, 3)}).</p>
      <p><strong>Seu resultado:</strong> cerca de ${n0(i.v)} kcal por dia. Comer, em média, abaixo disso faz perder peso; acima, ganhar.</p>
      <p class="muted">É uma estimativa, com margem de erro de 10% a 15%. O que vale de verdade é o ritmo do seu peso ao longo das semanas.</p>`;
    case "Ritmo atual do peso": {
      const pct = d.peso ? Math.abs(i.v) / d.peso * 100 : null;
      return `<p>É quanto o seu peso está variando por semana, calculado pela tendência de todas as pesagens das últimas 6 semanas (e não só pela primeira e a última). Para emagrecer preservando músculo, a referência é perder entre <strong>0,5% e 1% do peso por semana</strong>.</p>
      <p><strong>Seu resultado:</strong> ${i.v > 0 ? "+" : ""}${fmtNum(i.v, 2)} kg por semana${pct != null && i.v < 0 ? `, ou ${fmtNum(pct, 2)}% do seu peso: ${pct < 0.5 ? "um ritmo lento, mas sustentável" : pct <= 1 ? "dentro da faixa recomendada" : "acima da faixa recomendada, com risco de perder músculo"}` : ""}.</p>
      <p class="muted">Pese-se pelo menos uma vez por semana, nas mesmas condições, para o cálculo ficar confiável.</p>`;
    }
  }
  return "";
}
const valor = i => (i.sinal && i.v > 0 ? "+" : "") + fmtNum(i.v, i.fmt) + (i.un ? ` <span class="small muted">${esc(i.un)}</span>` : "");

export function avaliacaoCardHtml(){
  const d = diagnostico(); if (!d) return "";
  const chave = ["IMC", "Gordura corporal", "Cintura ÷ altura", "Gasto diário estimado"];
  const itens = d.itens.filter(i => chave.includes(i.k)).slice(0, 3);
  let h = `<h2>Avaliação física</h2><div class="panel"><div class="stats" style="margin-top:0;grid-template-columns:repeat(${Math.max(1, itens.length)},1fr)">`;
  itens.forEach(i => { h += `<div class="stat" style="border-top:4px solid ${COR[i.nivel] || "var(--line)"}"><div class="v" style="font-size:24px">${fmtNum(i.v, i.fmt)}</div><div class="l">${esc(i.k)}${i.txt ? ": " + esc(i.txt) : ""}</div></div>`; });
  h += `</div>`;
  const alerta = d.alertas.find(a => a.nivel === "alerta");
  if (alerta) h += `<div class="warnbox show">${esc(alerta.txt)}</div>`;
  return h + `<button class="btn ghost block" style="margin-top:12px" data-act="goAvaliacao">Ver avaliação completa</button></div>`;
}

export function avaliacaoHtml(){
  const d = diagnostico(), p = S.profile;
  let h = `<div class="between"><h2 style="margin-top:4px">Avaliação física</h2><button class="linkbtn" data-act="goPerfil">Voltar</button></div>`;
  if (!d) return h + `<div class="empty">Complete seu perfil primeiro.</div>`;
  h += `<p class="small muted">Com base no seu perfil${d.data ? " e na pesagem de " + ddmmyyyy(d.data) : ""}. Valores informativos: não substituem avaliação profissional.</p>`;
  d.alertas.filter(a => a.nivel !== "info").forEach(a => { h += `<div class="warnbox show" style="${a.nivel === "atencao" ? "background:var(--walk-soft);color:var(--ink)" : ""}">${esc(a.txt)}</div>`; });

  h += `<div class="panel" style="margin-top:12px">`;
  d.itens.forEach(i => {
    h += `<div style="padding:10px 0;border-bottom:1px solid var(--line);display:flex;gap:12px;align-items:flex-start">
      <i style="flex:0 0 6px;align-self:stretch;border-radius:3px;background:${i.nivel ? COR[i.nivel] : "var(--line)"}"></i>
      <div style="flex:1"><div class="between"><span>${esc(i.k)}</span><strong style="font-family:var(--display);font-size:22px">${valor(i)}</strong></div>
      ${i.txt ? `<div class="small" style="color:${i.nivel && i.nivel !== "ok" ? COR[i.nivel] : "var(--ink-2)"}">${esc(i.txt)}</div>` : ""}
      ${i.ref ? `<div class="small muted">${esc(i.ref)}</div>` : ""}
      ${(() => { const e = explicacao(i, d); return e ? `<details class="small expl"><summary>O que significa?</summary><div>${e}</div></details>` : ""; })()}</div></div>`;
  });
  h += `</div>`;

  // Meta
  if (p.metaPeso || p.metaGordura){
    h += `<h2>Meta</h2><div class="panel">`;
    if (p.metaPeso && d.falta != null){
      h += `<p style="margin:0"><strong>${fmtNum(p.metaPeso)} kg</strong>${p.metaData ? " até " + ddmmyyyy(p.metaData) : ""}: ${Math.abs(d.falta) < 0.5 ? "meta atingida! 🎉" : `faltam <strong>${fmtNum(Math.abs(d.falta))} kg</strong>.`}</p>`;
      if (d.ritmoNecessario != null) h += `<p class="small muted" style="margin:6px 0 0">Para chegar no prazo: ${fmtNum(Math.abs(d.ritmoNecessario), 2)} kg por semana.</p>`;
      if (d.ritmo != null) h += `<p class="small muted" style="margin:4px 0 0">Ritmo atual: ${d.ritmo > 0 ? "+" : ""}${fmtNum(d.ritmo, 2)} kg por semana${d.previsao ? `. Mantendo esse ritmo, você chega à meta por volta de <strong>${ddmmyyyy(d.previsao)}</strong>` : ""}.</p>`;
      else h += `<p class="small muted" style="margin:4px 0 0">Registre o peso pelo menos uma vez por semana para o app calcular seu ritmo e prever quando chega à meta.</p>`;
    }
    if (p.metaGordura){
      h += `<p style="margin:${p.metaPeso ? "12px" : "0"} 0 0">Meta de gordura: <strong>${fmtNum(p.metaGordura)}%</strong>.`;
      h += d.pesoAlvoGordura ? ` Mantendo sua massa magra atual, isso corresponde a cerca de <strong>${fmtNum(d.pesoAlvoGordura)} kg</strong>.</p>` : ` Registre o % de gordura para calcular o peso correspondente.</p>`;
    }
    if (d.deficitDia) h += `<p class="small muted" style="margin:10px 0 0">Seu ritmo atual equivale a um déficit médio de cerca de ${d.deficitDia} kcal por dia em relação ao que você gasta (estimativa).</p>`;
    h += `</div>`;
  }
  const infos = d.alertas.filter(a => a.nivel === "info");
  if (infos.length) h += `<h2>Para melhorar a avaliação</h2><div class="panel">${infos.map(a => `<p class="small" style="margin:0 0 8px">• ${esc(a.txt)}</p>`).join("")}<button class="btn strength block" data-act="addMedida">Registrar medida</button></div>`;
  h += `<p class="small muted" style="margin-top:16px">Referências: IMC (OMS); relação cintura/altura (corte 0,5); faixas de % de gordura do American Council on Exercise; gasto em repouso por Katch-McArdle (com % de gordura) ou Mifflin-St Jeor. São estimativas para acompanhar a evolução, não diagnóstico médico.</p>`;
  return h;
}
actions.goAvaliacao = () => go("perfil", "avaliacao");
actions.goPerfil = () => go("perfil");
