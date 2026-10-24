// Relatório da alimentação por período (para o médico ou para a IA): tudo o que foi registrado dia a dia,
// com horários e valores nutricionais, o acumulado por semana e as médias de vitaminas e minerais.
// Usa o mesmo gerador de Markdown e PDF do relatório completo.
import { S } from "./store.js";
import { fmtNum, ymd, ddmmyyyy, mondayOf, downloadBlob, DIAS } from "./util.js";
import { refeicoesDo, aguaTotal, totaisDe, metas, nomeTipo, proteinaDaRefeicao } from "./nutricao.js";
import { addDias } from "./medicacao.js";
import { emMarkdown, emPdf } from "./relcompleto.js";

export const PERIODOS_ALIM = [["7", "7 dias"], ["14", "14 dias"], ["30", "30 dias"], ["90", "90 dias"], ["tudo", "Tudo"]];
// metas diárias de referência (DRI/IOM, homens 31–50 anos; seção 7.5 da especificação)
const MICRO = [["b12", "Vitamina B12", "µg", 2.4], ["folato", "Folato", "µg", 400], ["vitD", "Vitamina D", "µg", 15], ["calcio", "Cálcio", "mg", 1000], ["ferro", "Ferro", "mg", 8],
  ["magnesio", "Magnésio", "mg", 420], ["zinco", "Zinco", "mg", 11], ["vitC", "Vitamina C", "mg", 90], ["potassio", "Potássio", "mg", 3400], ["selenio", "Selênio", "µg", 55], ["vitA", "Vitamina A", "µg", 900], ["omega3", "Ômega-3", "g", null]];
const f = (v, d = 0) => (v == null || !isFinite(v) ? "–" : fmtNum(v, d));
const dt = s => ddmmyyyy(s);
const diaSem = s => DIAS[new Date(s + "T12:00:00").getDay()];

export function dadosAlimentacao(per = "7"){
  const ate = ymd(new Date()), todos = [...new Set(Object.values(S.refeicoes || {}).map(r => r.date))].sort();
  const de = per === "tudo" ? (todos[0] || ate) : addDias(ate, -(parseInt(per, 10) - 1));
  const dias = todos.filter(d => d >= de && d <= ate), m = metas(), secoes = [];
  const sec = t => { const s = { t, paragrafos: [], tabelas: [], notas: [] }; secoes.push(s); return s; };
  const tot = d => totaisDe(refeicoesDo(d));
  const r = { titulo: "Relatório da alimentação", sub: `${(S.profile && S.profile.nome) || ""} · ${dt(de)} a ${dt(ate)} · ${dias.length} dia${dias.length === 1 ? "" : "s"} com registro`, de, ate, secoes };
  if (!dias.length){ sec("Sem registros").paragrafos.push("Não há refeições registradas neste período."); return r; }

  // 1. resumo
  const ts = dias.map(d => tot(d).t), med = k => ts.reduce((s, t) => s + (t[k] || 0), 0) / ts.length, agua = dias.reduce((s, d) => s + aguaTotal(d), 0) / dias.length;
  const s1 = sec("Resumo do período (média por dia registrado)");
  s1.tabelas.push({ head: ["Item", "Média por dia", "Meta"], body: [
    ["Energia", f(med("kcal")) + " kcal", "sem meta (informação)"], ["Proteína", f(med("prot")) + " g", `piso ${m.prot.piso} · alvo ${m.prot.alvo} · teto ${m.prot.teto} g`],
    ["Dias com proteína ≥ piso", `${ts.filter(t => (t.prot || 0) >= m.prot.piso).length} de ${dias.length}`, "todos"],
    ["Refeições com 30 g ou mais de proteína", f(dias.reduce((s, d) => s + refeicoesDo(d).filter(x => proteinaDaRefeicao(x) >= 30).length, 0) / dias.length, 1) + " por dia", "3 ou mais"],
    ["Carboidratos", f(med("carb")) + " g", "–"], ["Gorduras totais", f(med("gord")) + " g", "–"], ["Gorduras saturadas", f(med("sat"), 1) + " g", "–"],
    ["Fibra", f(med("fibra"), 1) + " g", "25 a 38 g"], ["Açúcar adicionado (só rótulos)", f(med("acucarAd"), 1) + " g", "abaixo de 25 g"], ["Sódio", f(med("sodio")) + " mg", "abaixo de 2.300 mg"],
    ["Água", f(agua / 1000, 1) + " L", f(m.agua / 1000, 1) + " L"]] });

  // 2. acumulado por semana
  const porSemana = {};
  dias.forEach(d => { const w = ymd(mondayOf(new Date(d + "T12:00:00"))); (porSemana[w] = porSemana[w] || []).push(d); });
  sec("Acumulado por semana").tabelas.push({ larga: true, head: ["Semana de", "Dias", "kcal total", "kcal/dia", "Proteína total (g)", "Proteína/dia (g)", "Dias ≥ piso", "Carb./dia (g)", "Gord./dia (g)", "Fibra/dia (g)", "Sódio/dia (mg)", "Água/dia (L)"],
    body: Object.keys(porSemana).sort().map(w => {
      const ds = porSemana[w], tt = ds.map(d => tot(d).t), soma = k => tt.reduce((s, t) => s + (t[k] || 0), 0);
      return [dt(w), String(ds.length), f(soma("kcal")), f(soma("kcal") / ds.length), f(soma("prot")), f(soma("prot") / ds.length), `${tt.filter(t => (t.prot || 0) >= m.prot.piso).length}/${ds.length}`,
        f(soma("carb") / ds.length), f(soma("gord") / ds.length), f(soma("fibra") / ds.length, 1), f(soma("sodio") / ds.length), f(ds.reduce((s, d) => s + aguaTotal(d), 0) / ds.length / 1000, 1)];
    }) });

  // 3. vitaminas e minerais (média por dia, com a parte dos alimentos que tinha dado)
  const todasRefs = dias.flatMap(d => refeicoesDo(d)), geral = totaisDe(todasRefs);
  const s3 = sec("Vitaminas e minerais (média por dia registrado)");
  s3.tabelas.push({ head: ["Nutriente", "Média por dia", "Referência diária", "% da referência", "Itens com dado"], body: MICRO.map(([k, n, un, ref]) => {
    const v = (geral.t[k] || 0) / dias.length, cob = geral.itens ? Math.round((geral.cob[k] || 0) / geral.itens * 100) : 0;
    return [n, cob ? f(v, un === "µg" || un === "g" ? 1 : 0) + " " + un : "sem dado", ref ? f(ref, ref < 10 ? 1 : 0) + " " + un : "–", ref && cob ? f(v / ref * 100) + "%" : "–", cob + "%"];
  }) });
  s3.notas.push("Alimento sem dado de um nutriente não entra na soma, então o valor real tende a ser maior quando a coluna \"itens com dado\" é baixa. Referências: DRI (IOM) para homens de 31 a 50 anos. O app não prescreve suplementos: leve ao seu médico.");

  // 4. dia a dia
  const s4 = sec("Dia a dia");
  dias.slice().reverse().forEach(d => {
    const refs = refeicoesDo(d), linhas = [];
    refs.forEach(x => (x.itens || []).forEach((it, i) => {
      const n = it.n || {};
      linhas.push([i === 0 ? (x.hora || "–") : "", i === 0 ? nomeTipo(x.tipo) : "", it.nome, it.medida || f(it.g) + " g", f(n.kcal), f(n.prot, 1), f(n.carb, 1), f(n.gord, 1), f(n.fibra, 1), f(n.sodio)]);
    }));
    const t = tot(d).t;
    linhas.push(["", "Total do dia", "", "", f(t.kcal), f(t.prot, 1), f(t.carb, 1), f(t.gord, 1), f(t.fibra, 1), f(t.sodio)]);
    const extras = refs.filter(x => x.fome != null || x.saciedade != null).map(x => `${nomeTipo(x.tipo)}: fome ${x.fome ?? "–"}/10, saciedade ${x.saciedade ?? "–"}/10`);
    s4.tabelas.push({ t: `${diaSem(d)}, ${dt(d)} · água ${f(aguaTotal(d) / 1000, 1)} L${extras.length ? " · " + extras.join("; ") : ""}`, larga: true,
      head: ["Hora", "Refeição", "Alimento", "Quantidade", "kcal", "Prot. (g)", "Carb. (g)", "Gord. (g)", "Fibra (g)", "Sódio (mg)"], body: linhas });
  });
  s4.notas.push("Valores: TACO 4ª ed. (NEPA/Unicamp) e USDA FoodData Central (CC0); alimentos de rótulo como informados. Registro pessoal; não substitui avaliação de nutricionista ou médico.");
  return r;
}

export async function baixarRelAlimentar(per, formato){
  const r = dadosAlimentacao(per), nome = `relatorio-alimentacao-${r.de}-a-${r.ate}`;
  if (formato === "md") return downloadBlob(nome + ".md", emMarkdown(r), "text/markdown;charset=utf-8");
  return downloadBlob(nome + ".pdf", await emPdf(r));
}
