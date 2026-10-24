// Relatório completo dos últimos 12 meses: todos os números (perfil, peso e composição, comparação de
// gordura e músculo por método, medicação, sintomas, medidas, dobras, exames, treinos, força, caminhadas,
// testes e eventos). Exporta em Markdown (para enviar a uma IA) e PDF (para o médico). Fotos nunca entram.
import { S, done, getEx, measurementsList, kcalFor, imc, imcClasse, dorLabel } from "./store.js";
import { num, fmtNum, ymd, ddmmyyyy, ageFrom, timeOf, pace, downloadBlob } from "./util.js";
import { saudeAtiva } from "./saude.js";
import { dosesList, nomeLocal, nomeMed, nivelAtual, sintomasList, nomeSintoma, SINAIS, alertasSeguranca, agenda } from "./medicacao.js";
import { media7, ritmo, perdaTotal, composicao, ffmiMensal, plato, projecao, eventosList, nomeEvento, pesoInicial } from "./peso.js";
import { fitaList, PONTOS, valorPonto, indices, nomePonto } from "./fita.js";
import { dobrasList, soma, percentuais, nomeDobra, valorDobra, FORA, adipometro } from "./dobras.js";
import { indiceForca, ancoras, serie1RM, progressao, variacao4, duracaoMin } from "./forca.js";
import { rankingDor } from "./views/dorex.js";
import { dadosPlano } from "./planoexport.js";
import { refeicoesDo, totaisDe, aguaTotal, metas, nomeTipo, tdeeAdaptativo } from "./nutricao.js";
import { analise } from "./vitaminas.js";
import { mondayOf } from "./util.js";
import { habitosList, stopBangList, tabagismo } from "./habitos.js";

const f = (v, d = 1) => (v == null || !isFinite(v) ? "–" : fmtNum(v, d));
const sn = (v, d = 1) => (v == null || !isFinite(v) ? "–" : (v > 0 ? "+" : v < 0 ? "−" : "") + fmtNum(Math.abs(v), d));
const dt = s => (s ? ddmmyyyy(s) : "–");
const t12 = s => new Date(s + "T12:00:00").getTime();
const pertoDe = (date, dias) => { const ps = measurementsList().filter(m => num(m.peso) != null && Math.abs(t12(m.date) - t12(date)) <= dias * 864e5); return ps.sort((a, b) => Math.abs(t12(a.date) - t12(date)) - Math.abs(t12(b.date) - t12(date)))[0] || null; };
const mgDe = m => num(m.massaGorda) != null ? num(m.massaGorda) : (num(m.gorduraPct) != null ? num(m.peso) * num(m.gorduraPct) / 100 : null);
const melhorDobras = r => { const p = percentuais(r); return p.find(x => x.k === "JP7" && x.pct != null) || p.find(x => x.k === "JP3" && x.pct != null) || p.find(x => x.k === "PETROSKI4" && x.pct != null) || null; };

export function dadosCompletos(){
  const ate = ymd(new Date()), de = ymd(new Date(Date.now() - 364 * 864e5)), noPer = x => x.date >= de && x.date <= ate;
  const p = S.profile || {}, saude = saudeAtiva(), secoes = [];
  const sec = (t, extra = {}) => { const s = Object.assign({ t, paragrafos: [], tabelas: [], notas: [] }, extra); secoes.push(s); return s; };
  const ms = measurementsList().filter(noPer), pes = ms.filter(m => num(m.peso) != null);

  /* 1. perfil */
  const s1 = sec("Perfil");
  const ult = pes[pes.length - 1], alt = num(p.altura);
  s1.tabelas.push({ head: ["Item", "Valor"], body: [
    ["Nome", p.nome || "–"], ["Idade", p.nascimento ? ageFrom(p.nascimento) + " anos" : "–"], ["Sexo", p.sexo === "F" ? "Feminino" : p.sexo === "M" ? "Masculino" : "–"],
    ["Altura", alt ? f(alt / 100, 2) + " m" : "–"],
    ["IMC atual", ult && alt ? `${f(imc(num(ult.peso), alt), 2)} (${imcClasse(imc(num(ult.peso), alt))})` : "–"],
    ["Meta de peso", p.metaPeso ? f(p.metaPeso) + " kg" + (p.metaData ? " até " + dt(p.metaData) : "") : "–"],
    ["Restrições", (p.restricoes || []).join(", ") || "nenhuma"]
  ].concat(saude && S.saude.medicamento ? [
    ["Medicação", `${nomeMed(S.saude.medicamento)}${S.saude.doseAtualMg ? " · " + f(S.saude.doseAtualMg) + " mg/semana" : ""}${S.saude.diaFixo != null ? " · dia fixo: " + ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][S.saude.diaFixo] : ""}`],
    ["Início do tratamento", dt(S.saude.inicioTratamento)], ["Suplementos", (S.saude.suplementos || []).join(", ") || "–"]
  ] : []) });

  /* 2. resumo */
  const s2 = sec("Resumo dos 12 meses");
  const pi = pesoInicial(), pt = perdaTotal(), tr = done().filter(s => s.type === "treino" && noPer(s)), cw = done().filter(s => s.type === "caminhada" && noPer(s));
  const ix = indiceForca(), v4 = variacao4();
  s2.tabelas.push({ head: ["Indicador", "Valor"], body: [
    ["Peso inicial", pi ? `${f(pi.peso)} kg em ${dt(pi.date)}` : "–"],
    ["Peso atual (média de 7 dias)", ult ? `${f(media7(ult.date))} kg (${dt(ult.date)})` : "–"],
    ["Variação total", pt ? `${sn(pt.kg)} kg (${sn(pt.pct)}%)` : "–"],
    ["Ritmo (kg/semana)", `1 sem: ${sn(ritmo(1), 2)} · 4 sem: ${sn(ritmo(4), 2)} · 6 sem: ${sn(ritmo(6), 2)}`],
    ["Treinos de força", String(tr.length)], ["Caminhadas", `${cw.length} · ${f(cw.reduce((a, s) => a + (num(s.km) || 0), 0))} km`],
    ["Índice de força", ix.length ? `${f(ix[ix.length - 1].v, 0)}${v4 ? ` (${sn(v4.pct)}% em 4 semanas)` : ""}` : "ainda sem dados (calibragem)"]
  ] });
  const pl = plato(); if (pl && pl.nivel !== "ok") s2.notas.push(`${pl.titulo}: ${pl.msg}`);
  const pj = projecao(); if (pj.length) s2.notas.push("Projeção pelo ritmo de 4 semanas: " + pj.map(x => `${x.alvo} kg em ${dt(x.date)}`).join("; ") + ".");

  /* 3. gordura e músculo por método */
  const fita = fitaList().filter(noPer), dob = dobrasList().filter(noPer);
  const bio = pes.filter(m => mgDe(m) != null || num(m.musculo) != null);
  if (bio.length || fita.length || dob.length){
    const s3 = sec("Gordura e músculo: comparação entre métodos");
    // último valor de cada método
    const linhas = [];
    const ub = bio[bio.length - 1];
    if (ub){ const mg = mgDe(ub); linhas.push(["Bioimpedância (relógio)", dt(ub.date), f(num(ub.gorduraPct)), f(mg), mg != null ? f(num(ub.peso) - mg) : "–", f(num(ub.musculo))]); }
    const fm = fita.filter(x => x.jejum && indices(x).gorduraMarinha != null).pop();
    if (fm){ const pc = indices(fm).gorduraMarinha, pp = pertoDe(fm.date, 3); linhas.push(["Fita métrica (fórmula da Marinha)", dt(fm.date), f(pc), pp ? f(num(pp.peso) * pc / 100) : "–", pp ? f(num(pp.peso) * (1 - pc / 100)) : "–", "–"]); }
    const ud = dob.filter(r => melhorDobras(r)).pop();
    if (ud){ const b = melhorDobras(ud), pp = pertoDe(ud.date, 1); linhas.push([`Dobras cutâneas (${b.nome})`, dt(ud.date), f(b.pct), pp ? f(num(pp.peso) * b.pct / 100) : "–", pp ? f(num(pp.peso) * (1 - b.pct / 100)) : "–", "–"]); }
    if (linhas.length) s3.tabelas.push({ t: "Último valor de cada método", head: ["Método", "Data", "Gordura (%)", "Massa gorda (kg)", "Massa magra (kg)", "Músculo esquelético (kg)"], body: linhas });
    // evolução por método (primeira e última leitura)
    const evo = [];
    if (bio.length >= 2){
      [["Gordura (%) · relógio", m => num(m.gorduraPct)], ["Massa gorda (kg) · relógio", mgDe], ["Músculo esquelético (kg) · relógio", m => (m.duvidoso || []).includes("musculo") ? null : num(m.musculo)], ["Massa magra (kg) · relógio", m => mgDe(m) != null ? num(m.peso) - mgDe(m) : null]].forEach(([n, g]) => {
        const xs = bio.filter(m => g(m) != null); if (xs.length < 2) return;
        evo.push([n, `${f(g(xs[0]))} (${dt(xs[0].date)})`, `${f(g(xs[xs.length - 1]))} (${dt(xs[xs.length - 1].date)})`, sn(g(xs[xs.length - 1]) - g(xs[0]))]);
      });
    }
    const fms = fita.filter(x => x.jejum && indices(x).gorduraMarinha != null);
    if (fms.length >= 2) evo.push(["Gordura (%) · fita (Marinha)", `${f(indices(fms[0]).gorduraMarinha)} (${dt(fms[0].date)})`, `${f(indices(fms[fms.length - 1]).gorduraMarinha)} (${dt(fms[fms.length - 1].date)})`, sn(indices(fms[fms.length - 1]).gorduraMarinha - indices(fms[0]).gorduraMarinha)]);
    const dds = dob.filter(r => melhorDobras(r));
    if (dds.length >= 2) evo.push(["Gordura (%) · dobras", `${f(melhorDobras(dds[0]).pct)} (${dt(dds[0].date)})`, `${f(melhorDobras(dds[dds.length - 1]).pct)} (${dt(dds[dds.length - 1].date)})`, sn(melhorDobras(dds[dds.length - 1]).pct - melhorDobras(dds[0]).pct)]);
    if (evo.length) s3.tabelas.push({ t: "Evolução por método", head: ["Medida", "Primeira", "Última", "Variação"], body: evo });
    // linha do tempo com todos os métodos
    const datas = [...new Set(bio.map(m => m.date).concat(fita.filter(x => x.jejum).map(x => x.date), dob.map(r => r.date)))].sort();
    s3.tabelas.push({ t: "Linha do tempo (todas as datas com medida)", larga: true, head: ["Data", "Peso (kg)", "% gord. relógio", "Massa gorda relógio", "Músculo relógio", "% gord. Marinha", "% gord. dobras", "Soma dobras (mm)", "Cintura (cm)"],
      body: datas.map(d => {
        const m = pes.find(x => x.date === d), fx = fita.find(x => x.jejum && x.date === d), dx = dob.find(r => r.date === d), bd = dx && melhorDobras(dx), sd = dx && soma(dx);
        return [dt(d), m ? f(num(m.peso)) : "–", m ? f(num(m.gorduraPct)) : "–", m ? f(mgDe(m)) : "–", m && !(m.duvidoso || []).includes("musculo") ? f(num(m.musculo)) : (m && m.musculo != null ? f(num(m.musculo)) + "*" : "–"),
          fx ? f(indices(fx).gorduraMarinha) : "–", bd ? f(bd.pct) : "–", sd ? (sd.incompleta ? "≥" : "") + f(sd.mm) : "–", fx ? f(valorPonto(fx, "cintura_umbigo")) : (m && m.cintura != null ? f(num(m.cintura)) : "–")];
      }) });
    const cp = composicao();
    if (cp) s3.paragrafos.push(`Composição da perda pelo relógio (${dt(cp.de)} a ${dt(cp.ate)}): ${sn(cp.dPeso)} kg de peso, ${sn(cp.dGordura)} kg de gordura — cerca de ${Math.round(cp.gordura * 100)}% foi gordura (faixa provável ${Math.round(cp.faixa[0] * 100)}% a ${Math.round(cp.faixa[1] * 100)}%). Referência do estudo SURMOUNT-1 (DEXA): ~74% gordura.`);
    const ff = ffmiMensal().filter(x => x.mes >= de.slice(0, 7) && x.mes <= ate.slice(0, 7));
    if (ff.length) s3.paragrafos.push("FFMI (índice de massa livre de gordura) por mês: " + ff.map(x => `${x.mes.slice(5, 7)}/${x.mes.slice(0, 4)}: ${f(x.v)}`).join(" · ") + ".");
    s3.notas.push("Cada método tem erro próprio (relógio de bioimpedância: ±2–3 pontos de % de gordura; fórmulas de dobras com adipômetro de plástico e dobras grandes: erro alto). Compare cada método com ele mesmo ao longo do tempo. * = leitura de músculo marcada como duvidosa.");
  }

  /* 4. pesagens */
  if (pes.length) sec("Pesagens e bioimpedância").tabelas.push({ larga: true, head: ["Data", "Hora", "Peso (kg)", "Média 7 dias", "Jejum", "Gordura (%)", "Massa gorda (kg)", "Músculo (kg)", "Água (%)", "Fonte"],
    body: pes.map(m => [dt(m.date), m.hora || "–", f(num(m.peso)), f(media7(m.date)), m.jejum ? "sim" : m.jejum === false ? "não" : "–", f(num(m.gorduraPct)), f(num(m.massaGorda)), f(num(m.musculo)) + ((m.duvidoso || []).includes("musculo") ? "*" : ""), f(num(m.agua)), m.fonte ? String(m.fonte).replace(/_/g, " ") : "–"]) });

  if (saude){
    /* 5. medicação */
    const ds = dosesList().filter(noPer);
    if (ds.length){
      const s5 = sec("Medicação");
      const ag = agenda(), nv = nivelAtual();
      if (ag.programada) s5.paragrafos.push(`Próxima dose programada: ${dt(ag.programada)}.${nv != null ? ` Nível estimado agora: ${f(nv, 0)}% (estimativa por modelo farmacocinético — não é dosagem real).` : ""}`);
      s5.tabelas.push({ head: ["Data", "Hora", "Situação", "Dose (mg)", "Local", "Observação"], body: ds.map(x => [dt(x.date), x.hora || "–", x.status, x.doseMg != null ? f(x.doseMg) : "–", nomeLocal(x.local) || "–", [x.obs, x.obsImportacao].filter(Boolean).join(" · ") || ""]) });
      s5.notas.push("Informe o uso de tirzepatida antes de qualquer cirurgia, endoscopia ou sedação (risco de aspiração).");
    }
    const ss = sintomasList().filter(noPer);
    if (ss.length) sec("Sintomas e efeitos colaterais").tabelas.push({ head: ["Data", "Sintoma", "Intensidade (0–10)", "Sinais", "Observação"],
      body: ss.map(x => [dt(x.date), nomeSintoma(x.tipo), x.intensidade != null ? String(x.intensidade) : "–", (SINAIS[x.tipo] || []).filter(k => (x.sinais || {})[k[0]]).map(k => k[1].toLowerCase()).join(", ") || "–", x.obs || ""]) });
    const al = alertasSeguranca(); if (al.length) sec("Alertas de segurança ativos").paragrafos.push(...al.map(a => `${a.titulo} (${dt(a.date)}): ${a.msg}`));

    /* 6. fita */
    if (fita.length){
      const s6 = sec("Medidas com fita (cm)");
      const pts = PONTOS.map(x => x[0]).filter(k => fita.some(r => valorPonto(r, k) != null));
      s6.tabelas.push({ larga: true, pdfUltimas: 6, head: ["Ponto"].concat(fita.map(r => dt(r.date) + (r.jejum ? "" : " (sem jejum)"))), body: pts.map(k => [nomePonto(k)].concat(fita.map(r => f(valorPonto(r, k))))) });
      s6.tabelas.push({ t: "Índices", head: ["Data", "Jejum", "Cintura/altura", "Cintura/quadril", "% gordura (Marinha)"], body: fita.map(r => { const i = indices(r); return [dt(r.date), r.jejum ? "sim" : "não", f(i.cinturaAltura, 2), f(i.cinturaQuadril, 2), f(i.gorduraMarinha)]; }) });
    }
    /* 7. dobras */
    if (dob.length){
      const s7 = sec("Dobras cutâneas (mm)"), ad = adipometro();
      const pts = [...new Set(dob.flatMap(r => Object.keys(r.leituras || {})))];
      s7.tabelas.push({ larga: true, pdfUltimas: 6, head: ["Ponto"].concat(dob.map(r => dt(r.date))), body: pts.map(k => [nomeDobra(k)].concat(dob.map(r => { const v = valorDobra(r, k); return v === FORA ? `>${r.limiteMm || ad.limite}` : f(v); })))
        .concat([["Soma"].concat(dob.map(r => { const s = soma(r); return (s.incompleta ? "≥" : "") + f(s.mm); }))]) });
      s7.notas.push(`Aparelho: ${ad.modelo}, abertura até ${ad.limite} mm. Medido do lado direito. ">" = passou do limite do aparelho (fica fora da soma). A soma em mm é a métrica principal.`);
    }
    /* 8. exames */
    const ex = Object.values(S.exames || {}).filter(noPer).sort((a, b) => a.date.localeCompare(b.date) || (a.nome || "").localeCompare(b.nome || ""));
    if (ex.length){
      const s8 = sec("Exames laboratoriais");
      const ref = x => x.refMin != null && x.refMax != null ? `${f(x.refMin, 2)}–${f(x.refMax, 2)}` : x.refMin != null ? `> ${f(x.refMin, 2)}` : x.refMax != null ? `< ${f(x.refMax, 2)}` : "–";
      const st = x => x.valor == null ? (x.obs || "não liberado") : (x.refMin != null && x.valor < x.refMin) ? "abaixo" : (x.refMax != null && x.valor > x.refMax) ? "acima" : "dentro";
      s8.tabelas.push({ head: ["Data", "Exame", "Valor", "Unidade", "Referência", "Situação", "Laboratório"], body: ex.map(x => [dt(x.date), x.nome, x.valor != null ? f(x.valor, 2) : "–", x.unidade || "", ref(x), st(x), x.laboratorio || ""]) });
      // calculados: TG/HDL e não-HDL na mesma data
      const calc = [];
      [...new Set(ex.map(x => x.date))].forEach(d => {
        const v = n => (ex.find(x => x.date === d && x.nome === n) || {}).valor;
        const tg = v("Triglicerides"), hdl = v("HDL"), ct = v("Colesterol total");
        if (tg != null && hdl) calc.push([dt(d), "Triglicérides/HDL", f(tg / hdl, 1), "ideal < 2; > 3,5 sugere resistência à insulina"]);
        if (ct != null && hdl != null) calc.push([dt(d), "Não-HDL", f(ct - hdl, 0) + " mg/dL", "< 130 mg/dL"]);
      });
      if (calc.length) s8.tabelas.push({ t: "Calculados", head: ["Data", "Índice", "Valor", "Referência"], body: calc });
    }
    /* alimentação: médias por semana (dias com registro) e, no Markdown, o que foi comido nos últimos 7 dias */
    const refs = Object.values(S.refeicoes || {}).filter(noPer);
    if (refs.length){
      const sa = sec("Alimentação"), m = metas(), porSemana = {};
      [...new Set(refs.map(r => r.date))].forEach(d => { const w = ymd(mondayOf(new Date(d + "T12:00:00"))); (porSemana[w] = porSemana[w] || []).push(d); });
      sa.paragrafos.push(`Metas: proteína piso ${m.prot.piso} g, alvo ${m.prot.alvo} g, teto ${m.prot.teto} g; água ${f(m.agua / 1000)} L; fibra 25–38 g; açúcar adicionado < 25 g; sódio < 2.300 mg. Médias só dos dias com registro.`);
      sa.tabelas.push({ t: "Médias por semana", larga: true, head: ["Semana de", "Dias registrados", "kcal", "Proteína (g)", "Dias ≥ piso", "Fibra (g)", "Sódio (mg)", "Água (L)"],
        body: Object.keys(porSemana).sort().map(w => {
          const ds = porSemana[w], tt = ds.map(d => totaisDe(refeicoesDo(d)).t), med = k => tt.reduce((s, t) => s + (t[k] || 0), 0) / tt.length;
          return [dt(w), String(ds.length), f(med("kcal"), 0), f(med("prot"), 0), `${tt.filter(t => (t.prot || 0) >= m.prot.piso).length}/${ds.length}`, f(med("fibra"), 0), f(med("sodio"), 0), f(ds.reduce((s, d) => s + aguaTotal(d), 0) / ds.length / 1000, 1)];
        }) });
      const ult7 = [...new Set(refs.map(r => r.date))].sort().slice(-7);
      sa.tabelas.push({ t: "O que foi registrado nos últimos 7 dias com registro", soMd: true, head: ["Data", "Refeição", "Hora", "Itens", "Proteína (g)", "kcal"],
        body: ult7.flatMap(d => refeicoesDo(d).map(r => [dt(d), nomeTipo(r.tipo), r.hora || "–", (r.itens || []).map(it => `${it.nome} (${it.medida || f(it.g, 0) + " g"})`).join("; "),
          f((r.itens || []).reduce((s, it) => s + (num(it.n && it.n.prot) || 0), 0), 0), f((r.itens || []).reduce((s, it) => s + (num(it.n && it.n.kcal) || 0), 0), 0)])) });
      const td = tdeeAdaptativo(); if (td.ok) sa.paragrafos.push(`Gasto calórico real (adaptativo): ${f(td.tdee, 0)} kcal/dia nos últimos ${td.dias} dias.`);
      const an = analise(); if (an.ok) sa.paragrafos.push("Nutrientes-alvo da última semana: " + an.itens.map(x => `${x.nome} ${x.pct == null ? "–" : f(x.pct, 0) + "%"}${x.exame ? " (exame também baixo)" : ""}`).join("; ") + ".");
      sa.notas.push("Valores dos alimentos: TACO 4ª ed. (NEPA/Unicamp) e USDA FoodData Central (CC0); alimentos de rótulo informados pelo usuário. Nutriente sem dado não entra na soma.");
    }
    /* eventos */
    const evs = eventosList().filter(noPer);
    if (evs.length) sec("Eventos").tabelas.push({ head: ["Data", "Tipo", "Descrição"], body: evs.map(e => [dt(e.date), nomeEvento(e.tipo), e.descricao || ""]) });
  }

  /* 9. treinos */
  if (tr.length){
    const s9 = sec("Treinos de força");
    s9.tabelas.push({ head: ["Data", "Treino", "Duração (min)", "kcal (estim.)", dorLabel() + " antes/depois", "Exercício que incomodou"],
      body: tr.map(s => [dt(s.date), s.treino || "–", f(duracaoMin(s), 0), kcalFor(s) != null ? String(kcalFor(s)) : "–", `${s.pre && s.pre.dor != null ? s.pre.dor : "–"} / ${s.post && s.post.dor != null ? s.post.dor : "–"}`,
        ((s.post && s.post.dorEx) || []).map(x => getEx(x.exId).nome + (x.rir != null ? ` (RIR ${x.rir})` : "") + (x.nota ? ": " + x.nota : "")).join("; ")]) });
    // séries completas (só no Markdown, para a IA)
    s9.tabelas.push({ t: "Séries por treino (carga × repetições)", soMd: true, head: ["Data", "Exercício", "Séries"], body: tr.flatMap(s => Object.keys(s.sets || {}).map(id => [dt(s.date), getEx(id).nome, s.sets[id].filter(x => num(x.kg) != null || num(x.reps) != null).map(x => `${num(x.kg) != null ? f(num(x.kg)) + " kg" : "–"} × ${num(x.reps) != null ? num(x.reps) : "–"}`).join("; ")]).filter(r => r[2])) });
    const pr = progressao();
    if (pr.length) s9.tabelas.push({ t: "Força: 1RM estimado (Epley, sem as 2 sessões de calibragem)", head: ["Exercício", "4 semanas anteriores (kg)", "Últimas 4 semanas (kg)", "Variação"], body: pr.map(x => [getEx(x.id).nome + (ancoras().includes(x.id) ? " (âncora)" : ""), f(x.anterior), f(x.atual), x.anterior ? sn((x.atual - x.anterior) / x.anterior * 100) + "%" : "–"]) });
    if (ix.length) s9.paragrafos.push("Índice de força por semana (100 = primeira medida depois da calibragem): " + ix.map(x => `${x.semana.slice(8, 10)}/${x.semana.slice(5, 7)}: ${f(x.v, 0)}`).join(" · ") + ".");
    ancoras().forEach(id => { const ser = serie1RM(id); if (ser.length) s9.paragrafos.push(`${getEx(id).nome}: ` + ser.map(x => `${dt(x.date)} ${f(x.v)} kg`).join("; ") + "."); });
    const rk = rankingDor();
    if (rk.length) s9.tabelas.push({ t: "Exercícios ligados à dor", head: ["Exercício", "Vezes", "Dor média", "Carga média", "Última"], body: rk.map(r => [getEx(r.exId).nome, String(r.vezes), f(r.dorMedia), r.cargaMedia != null ? f(r.cargaMedia) + " kg" : "–", dt(r.ultima)]) });
  }
  /* plano de treino atual */
  const pl2 = dadosPlano({ historico: true });
  if (pl2){
    const sp = sec("Plano de treino atual");
    sp.paragrafos.push(pl2.titulo.replace("Plano de treino: ", "") + " · " + pl2.sub.split(" · exportado")[0] + (pl2.aquecimento.length ? ". Aquecimento: " + pl2.aquecimento.join("; ") + "." : ""));
    pl2.treinos.forEach(t => sp.tabelas.push({ t: `Treino ${t.letra}${t.foco ? ": " + t.foco : ""}${t.dias ? " (" + t.dias + ")" : ""}`, larga: true, head: pl2.head, body: t.linhas }));
  }
  /* 10. caminhadas */
  if (cw.length) sec("Caminhadas").tabelas.push({ head: ["Data", "Início", "Duração (min)", "Km", "Ritmo", "kcal (estim.)"],
    body: cw.map(s => { const min = duracaoMin(s), km = num(s.km); return [dt(s.date), timeOf(s.start), f(min, 0), f(km, 2), km && min ? pace(min / km) + " /km" : "–", kcalFor(s) != null ? String(kcalFor(s)) : "–"]; }) });
  /* 11. testes */
  const ts = Object.values(S.testes || {}).filter(noPer).sort((a, b) => a.date.localeCompare(b.date));
  if (ts.length) sec("Testes funcionais").tabelas.push({ head: ["Data", "Teste", "Resultado", "Referência"],
    body: ts.map(t => t.tipo === "sentar_levantar" ? [dt(t.date), "Sentar e levantar 5 vezes", f(t.segundos) + " s", "> 15 s = força baixa (EWGSOP2)"] : [dt(t.date), "Força de preensão", f(t.melhor) + " kg", p.sexo === "F" ? "< 16 kg = fraqueza" : "< 27 kg = fraqueza"]) });

  // hábitos: médias por mês do check-in da noite, STOP-Bang e cigarro
  if (saude){
    const hs = habitosList().filter(noPer), sbs = stopBangList().filter(noPer), tb = tabagismo();
    if (hs.length || sbs.length || tb.status){
      const s = sec("Hábitos, sono e apneia"), mm = (a, k) => { const v = a.map(h => num(h[k])).filter(x => x != null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
      const meses = [...new Set(hs.map(h => h.date.slice(0, 7)))];
      if (meses.length) s.tabelas.push({ head: ["Mês", "Check-ins", "Sono (h)", "Qualidade (1–5)", "Estresse (1–5)", "Fome (1–5)", "Humor (1–5)", "Passos/dia", "Álcool (doses no mês)", "FC repouso"],
        body: meses.map(m => { const a = hs.filter(h => h.date.slice(0, 7) === m); return [m.slice(5) + "/" + m.slice(0, 4), a.length, f(mm(a, "sonoH")), f(mm(a, "sonoQ")), f(mm(a, "estresse")), f(mm(a, "fome")), f(mm(a, "humor")), f(mm(a, "passos"), 0), f(a.reduce((x, h) => x + (num(h.alcool) || 0), 0)), f(mm(a, "fc"), 0)]; }) });
      if (sbs.length) s.tabelas.push({ head: ["Data", "STOP-Bang", "Ronco alto", "Cansaço", "Pausas observadas", "Pressão alta"], body: sbs.map(x => [dt(x.date), x.pontos + "/8", x.resp.S ? "sim" : "não", x.resp.T ? "sim" : "não", x.resp.O ? "sim" : "não", x.resp.P ? "sim" : "não"]) });
      if (tb.status) s.paragrafos.push("Cigarro: " + (tb.status === "parou" ? "parou em " + dt(tb.parouEm) : tb.status === "fuma" ? "fuma" : "nunca fumou") + ".");
    }
  }

  return { titulo: "Relatório completo de saúde e treino", sub: `${p.nome || ""} · ${dt(de)} a ${dt(ate)} · gerado em ${dt(ate)}`, de, ate, secoes };
}

/* ---------- Markdown (para enviar a uma IA ou guardar) ---------- */
const cel = s => String(s == null ? "" : s).replace(/\|/g, "/").replace(/\n/g, " ");
export function emMarkdown(r){
  let md = `# ${r.titulo}\n\n${r.sub}\n\n> Registro pessoal gerado pelo App Treino. Não substitui avaliação médica. Números com vírgula decimal; "–" = sem dado.\n`;
  r.secoes.forEach(s => {
    md += `\n## ${s.t}\n`;
    s.paragrafos.forEach(p => { md += `\n${p}\n`; });
    s.tabelas.forEach(t => {
      if (t.t) md += `\n### ${t.t}\n`;
      md += `\n| ${t.head.map(cel).join(" | ")} |\n|${t.head.map(() => "---").join("|")}|\n` + t.body.map(row => `| ${row.map(cel).join(" | ")} |`).join("\n") + "\n";
    });
    s.notas.forEach(n => { md += `\n- ${n}\n`; });
  });
  return md;
}

/* ---------- PDF (para levar ao médico) ---------- */
const pdfTxt = s => String(s == null ? "" : s).replace(/[–—]/g, "-").replace(/−/g, "-").replace(/…/g, "...").replace(/→/g, "->").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/[^\x00-\xFF]/g, "");
export async function emPdf(r){
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" }), verde = [15, 107, 99], cinza = [81, 100, 109];
  let y = 16;
  doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(20, 35, 43); doc.text(pdfTxt(r.titulo), 14, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...cinza); y += 6; doc.text(pdfTxt(r.sub), 14, y); y += 4;
  const titulo = (txt, tam) => { if (y > 262){ doc.addPage(); y = 16; } doc.setFont("helvetica", "bold"); doc.setFontSize(tam); doc.setTextColor(20, 35, 43); doc.text(pdfTxt(txt), 14, y + 6); y += 8; };
  const texto = txt => { doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40, 50, 55); doc.splitTextToSize(pdfTxt(txt), 182).forEach(l => { if (y > 280){ doc.addPage(); y = 16; } doc.text(l, 14, y + 4); y += 4.4; }); y += 1.5; };
  r.secoes.forEach(s => {
    titulo(s.t, 13);
    s.paragrafos.forEach(texto);
    s.tabelas.filter(t => !t.soMd).forEach(t => {
      let head = t.head, body = t.body;
      // tabelas com uma coluna por data: no PDF só as últimas N datas
      if (t.pdfUltimas && head.length - 1 > t.pdfUltimas){ head = [head[0]].concat(head.slice(-t.pdfUltimas)); body = body.map(row => [row[0]].concat(row.slice(-t.pdfUltimas))); }
      if (t.t) titulo(t.t, 10);
      autoTable(doc, { startY: y + 1, head: [head.map(pdfTxt)], body: body.map(row => row.map(pdfTxt)), theme: "grid",
        styles: { fontSize: t.larga || head.length > 6 ? 7 : 8.5, cellPadding: 1.4 }, headStyles: { fillColor: verde }, margin: { left: 14, right: 14, bottom: 16 } });
      y = ((doc.lastAutoTable && doc.lastAutoTable.finalY) || y + 20) + 4;
    });
    s.notas.forEach(n => texto("• " + n));
  });
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++){
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...cinza);
    doc.text(doc.splitTextToSize(pdfTxt("App Treino · registro pessoal; não substitui avaliação médica. Estimativas (calorias, composição, nível do medicamento) são aproximadas."), 165), 14, 287);
    doc.text(`${i}/${n}`, 196, 290, { align: "right" });
  }
  return doc.output("blob");
}

export async function baixarRelatorio(formato){
  const r = dadosCompletos(), nome = `relatorio-completo-${r.ate}`;
  if (formato === "md") return downloadBlob(nome + ".md", emMarkdown(r), "text/markdown;charset=utf-8");
  return downloadBlob(nome + ".pdf", await emPdf(r));
}
