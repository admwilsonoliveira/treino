// PDF de 1 página para levar à consulta: curva de peso (média de 7 dias) com faixas de dose e % de perda,
// cintura e FLI, doses e mudanças, efeitos colaterais, últimos exames com variação, índice de força, STOP-Bang,
// suplementos, o lembrete sobre anestesia e as "Perguntas para o médico". Desenhado direto no jsPDF (sem imagem).
import { S, measurementsList } from "./store.js";
import { num, fmtNum, ymd, ddmm, ddmmyyyy, ageFrom, downloadBlob } from "./util.js";
import { addDias, aplicadas, dosesList, nomeLocal, nomeMed, sintomasList, nomeSintoma } from "./medicacao.js";
import { serieMedia, perdaTotal, pesoInicial, mediaAtual, ritmo, faixasDose, eventosList } from "./peso.js";
import { baseCintura, ultimoValor } from "./fita.js";
import { examesList, padrao, serie, sinal, fli, tyg } from "./exames.js";
import { indiceForca, variacao4 } from "./forca.js";
import { stopBangUltimo, stopBangRisco } from "./habitos.js";
import { manutencao, faixaAlvo, decisoesList, nomeDecisao } from "./manutencao.js";

const pdfTxt = s => String(s == null ? "" : s).replace(/[–—]/g, "-").replace(/−/g, "-").replace(/…/g, "...").replace(/→/g, "->").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/[^\x00-\xFF]/g, "");
const f = (v, d = 1) => (v == null || !isFinite(v) ? "-" : fmtNum(v, d));
const sn = (v, d = 1) => (v == null || !isFinite(v) ? "-" : (v > 0 ? "+" : v < 0 ? "-" : "") + fmtNum(Math.abs(v), d));
export const ANESTESIA = "Uso tirzepatida: informar antes de qualquer cirurgia, endoscopia ou sedação (risco de aspiração).";

// os exames mais recentes (um por nome padronizado), com o valor anterior
function ultimosExames(max = 16){
  const nomes = [...new Set(examesList().filter(x => x.valor != null).map(x => padrao(x.nome).nome))];
  return nomes.map(n => { const s = serie(n); const u = s[s.length - 1], a = s[s.length - 2]; return { n, u, a, sg: sinal(u) }; })
    .sort((x, y) => y.u.date.localeCompare(x.u.date) || (x.sg === "ok") - (y.sg === "ok")).slice(0, max);
}

export async function pdfMedico(){
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" }), p = S.profile || {}, sd = S.saude || {};
  const verde = [15, 107, 99], roxo = [124, 92, 196], cinza = [90, 105, 112], tinta = [20, 35, 43], M = 12, W = 186;
  const txt = (t, x, y, o = {}) => { doc.setFont("helvetica", o.b ? "bold" : "normal"); doc.setFontSize(o.s || 8.5); doc.setTextColor(...(o.c || tinta)); doc.text(pdfTxt(t), x, y, o.al ? { align: o.al } : undefined); };
  const hoje = ymd(new Date());

  // cabeçalho
  txt("Resumo para a consulta", M, 14, { b: 1, s: 15 });
  const idade = ageFrom(p.nascimento);
  txt(`${p.nome || ""}${idade != null ? " · " + idade + " anos" : ""}${p.altura ? " · " + f(num(p.altura), 0) + " cm" : ""} · gerado em ${ddmmyyyy(hoje)}`, M, 19.5, { c: cinza });
  txt(`${nomeMed(sd.medicamento)}${sd.doseAtualMg ? " " + f(num(sd.doseAtualMg)) + " mg" : ""}${sd.inicioTratamento ? " · início " + ddmmyyyy(sd.inicioTratamento) : ""}`, M + W, 14, { al: "right", b: 1, c: roxo });

  // gráfico do peso (média de 7 dias) com faixas de dose
  const gx = M, gy = 25, gw = 118, gh = 52, ini = pesoInicial(), desde = ini ? addDias(ini.date, -14) : null;
  const pts = serieMedia().filter(x => !desde || x.date >= desde).filter(x => x.v != null);
  doc.setDrawColor(210); doc.rect(gx, gy, gw, gh);
  if (pts.length >= 2){
    const t = s => new Date(s + "T12:00:00").getTime(), x0 = t(pts[0].date), x1 = Math.max(t(hoje), t(pts[pts.length - 1].date));
    const vs = pts.map(x => x.v), lo = Math.floor(Math.min(...vs) - 1), hi = Math.ceil(Math.max(...vs) + 1);
    const X = s => gx + 8 + (t(s) - x0) / Math.max(1, x1 - x0) * (gw - 10), Y = v => gy + 3 + (hi - v) / (hi - lo) * (gh - 9);
    const maxMg = Math.max(1, ...faixasDose().map(b => b.mg || 0));
    faixasDose().forEach(b => {
      if (b.ate < pts[0].date) return;
      const a = X(b.de < pts[0].date ? pts[0].date : b.de), z = Math.min(X(b.ate > hoje ? hoje : b.ate), gx + gw - 2), k = 0.12 + 0.3 * (b.mg || 0) / maxMg;
      doc.setFillColor(255 - (255 - roxo[0]) * k, 255 - (255 - roxo[1]) * k, 255 - (255 - roxo[2]) * k); doc.rect(a, gy + 0.3, Math.max(0.5, z - a), gh - 6.5, "F");
      txt(f(b.mg) + " mg", a + 0.8, gy + 3.5, { s: 6, c: roxo });
    });
    eventosList().filter(e => e.date >= pts[0].date && e.tipo !== "mudanca_dose").forEach(e => { doc.setDrawColor(200, 140, 30); doc.setLineDashPattern([1, 1], 0); doc.line(X(e.date), gy + 1, X(e.date), gy + gh - 6); doc.setLineDashPattern([], 0); });
    doc.setDrawColor(...verde); doc.setLineWidth(0.6);
    for (let i = 1; i < pts.length; i++) doc.line(X(pts[i - 1].date), Y(pts[i - 1].v), X(pts[i].date), Y(pts[i].v));
    doc.setLineWidth(0.2);
    [hi, (hi + lo) / 2, lo].forEach(v => txt(f(v, 0), gx + 1, Y(v) + 1, { s: 6, c: cinza }));
    txt(ddmm(pts[0].date), gx + 8, gy + gh - 1.5, { s: 6, c: cinza }); txt(ddmm(hoje), gx + gw - 1, gy + gh - 1.5, { s: 6, c: cinza, al: "right" });
    txt("Peso (média de 7 dias, kg) · fundo roxo = dose", gx + gw / 2, gy + gh - 1.5, { s: 6, c: cinza, al: "center" });
  } else txt("Pesagens insuficientes para o gráfico.", gx + 4, gy + 10, { c: cinza });

  // números ao lado do gráfico
  const pt = perdaTotal(), r4 = ritmo(4), c0 = baseCintura(), c1 = ultimoValor("cintura_umbigo"), fl = fli(), ty = tyg();
  const ix = indiceForca(), v4 = variacao4(), sb = stopBangUltimo();
  const linhas = [
    ["Peso inicial", ini ? `${f(ini.peso)} kg (${ddmm(ini.date)})` : "-"],
    ["Peso atual (média 7 d)", mediaAtual() != null ? f(mediaAtual()) + " kg" : "-"],
    ["Perda total", pt ? `${sn(pt.kg)} kg (${sn(pt.pct)}%)` : "-"],
    ["Ritmo (4 semanas)", r4 != null ? sn(r4, 2) + " kg/sem" : "-"],
    ["Cintura (jejum)", c1 ? `${c0 && c0.date !== c1.date ? f(c0.v) + " -> " : ""}${f(c1.v)} cm (${ddmm(c1.date)})` : "-"],
    ["FLI (gordura no fígado)", fl ? `${f(fl.valor, 0)}${fl.ggtAntiga ? " (GGT antiga)" : ""}` : "-"],
    ["TyG", ty ? f(ty.valor, 2) : "-"],
    ["Índice de força", ix.length ? `${f(ix[ix.length - 1].v, 0)}${v4 ? " (" + sn(v4.pct) + "% em 4 sem)" : ""}` : "-"],
    ...(manutencao().ativo && faixaAlvo() ? [["Manutenção (faixa)", `${f(faixaAlvo().min)} a ${f(faixaAlvo().max)} kg`]] : []),
    ["STOP-Bang", sb ? `${sb.pontos}/8 · risco ${stopBangRisco(sb.pontos)} (${ddmm(sb.date)})` : "não respondido"]
  ];
  let y = gy + 3;
  linhas.forEach(([k, v]) => { txt(k, M + gw + 4, y, { s: 7.5, c: cinza }); txt(v, M + W, y, { s: 8, b: 1, al: "right" }); y += 5.6; });

  // doses e mudanças | efeitos colaterais (8 semanas)
  y = gy + gh + 4;
  const ds = dosesList().slice(-8).reverse();
  const mud = eventosList().filter(e => e.tipo === "mudanca_dose").slice(-4).map(e => `${ddmm(e.date)}: ${e.descricao || "mudança de dose"}`).join(" · ");
  autoTable(doc, { startY: y, head: [["Doses (últimas 8)", "mg", "Local / situação"]], body: (ds.length ? ds : [null]).map(d => !d ? ["Nenhuma dose registrada", "", ""] : [ddmmyyyy(d.date), d.doseMg ? f(num(d.doseMg)) : "-", d.status === "aplicada" ? nomeLocal(d.local) || "-" : d.status].map(pdfTxt)),
    theme: "grid", styles: { fontSize: 7, cellPadding: 0.9 }, headStyles: { fillColor: roxo }, margin: { left: M, right: M + W / 2 + 2 }, tableWidth: W / 2 - 2 });
  const yDoses = doc.lastAutoTable.finalY;
  const de8 = addDias(hoje, -56), por = {};
  sintomasList().filter(s => s.date >= de8).forEach(s => { const r = por[s.tipo] = por[s.tipo] || { n: 0, max: 0, ult: s.date }; r.n++; r.max = Math.max(r.max, s.intensidade || 0); r.ult = s.date; });
  const sint = Object.entries(por).sort((a, b) => b[1].n - a[1].n);
  autoTable(doc, { startY: y, head: [["Efeitos colaterais (8 semanas)", "Vezes", "Máx.", "Último"]], body: (sint.length ? sint.map(([k, r]) => [nomeSintoma(k), r.n, r.max + "/10", ddmm(r.ult)]) : [["Nenhum registrado", "", "", ""]]).map(row => row.map(pdfTxt)),
    theme: "grid", styles: { fontSize: 7, cellPadding: 0.9 }, headStyles: { fillColor: verde }, margin: { left: M + W / 2 + 2, right: M }, tableWidth: W / 2 - 2 });
  y = Math.max(yDoses, doc.lastAutoTable.finalY) + 2;
  if (mud){ txt("Mudanças de dose: " + mud, M, y + 2.5, { s: 7 }); y += 4; }
  const dcs = decisoesList().slice(-3);
  if (dcs.length){ txt("Decisões anteriores: " + dcs.map(x => `${ddmm(x.date)} ${nomeDecisao(x.decisao).toLowerCase()}${x.motivo ? " (" + x.motivo + ")" : ""}`).join(" · "), M, y + 2.5, { s: 7 }); y += 4; }

  // últimos exames
  const ex = ultimosExames(16);
  if (ex.length){
    autoTable(doc, { startY: y + 1, head: [["Exame", "Último", "Data", "Anterior", "Variação", "Ref."]],
      body: ex.map(({ n, u, a }) => [n, f(num(u.valor), 2) + " " + (u.unidade || ""), ddmm(u.date) + "/" + u.date.slice(2, 4), a ? f(num(a.valor), 2) : "-", a && num(a.valor) ? sn((num(u.valor) - num(a.valor)) / num(a.valor) * 100, 0) + "%" : "-",
        [u.refMin, u.refMax].some(v => v != null) ? `${u.refMin != null ? f(num(u.refMin), 1) : ""}-${u.refMax != null ? f(num(u.refMax), 1) : ""}` : "-"].map(pdfTxt)),
      theme: "grid", styles: { fontSize: 6.8, cellPadding: 0.7 }, headStyles: { fillColor: verde }, margin: { left: M, right: M },
      didParseCell: d => { if (d.section === "body" && d.column.index === 1){ const sg = ex[d.row.index].sg; if (sg === "vermelho") d.cell.styles.textColor = [190, 40, 40]; else if (sg === "amarelo") d.cell.styles.textColor = [170, 120, 0]; } } });
    y = doc.lastAutoTable.finalY + 2;
  }

  // suplementos, anestesia e perguntas
  const sup = (sd.suplementos || []).join(", ");
  txt("Suplementos em uso: " + (sup || "nenhum informado"), M, y + 3, { s: 7.5 }); y += 5;
  if (sd.medicamento === "tirzepatida"){ txt(ANESTESIA, M, y + 3, { s: 7.5, b: 1, c: roxo }); y += 5; }
  const perg = String(sd.perguntasMedico || "").trim();
  txt("Perguntas para o médico", M, y + 4, { b: 1, s: 9.5 }); y += 6;
  const espaco = 285 - y;
  doc.setDrawColor(200); doc.rect(M, y, W, Math.max(12, espaco - 4));
  if (perg){ doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...tinta); const ls = doc.splitTextToSize(pdfTxt(perg), W - 4); ls.slice(0, Math.floor((espaco - 6) / 3.6)).forEach((l, i) => doc.text(l, M + 2, y + 4 + i * 3.6)); }
  txt("App Treino · registro pessoal; não substitui avaliação médica. Curvas e índices são estimativas.", M, 292, { s: 6.5, c: cinza });
  return doc;
}

export async function baixarPdfMedico(){
  const doc = await pdfMedico();
  return downloadBlob(`resumo-consulta-${ymd(new Date())}.pdf`, doc.output("blob"));
}
