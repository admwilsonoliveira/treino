// Exportar o plano de treino: cada treino (A, B, C...) com a lista de exercícios, séries × repetições,
// RIR, descanso, dias e nota de técnica; opcionalmente com a última carga e o 1RM estimado.
// Markdown (para a IA ou o professor) e PDF (para imprimir e levar à academia).
import { activePlan, planLetters, getEx, restOf, lastSetsFor } from "./store.js";
import { num, fmtNum, ymd, ddmmyyyy, restLabel, DIAS_CURTO, downloadBlob } from "./util.js";
import { serie1RM } from "./forca.js";
import { semanaInfo } from "./programa.js";

const ultimaCarga = exId => {
  const l = lastSetsFor(exId); if (!l) return null;
  const sets = l.sets.filter(x => num(x.kg) != null || num(x.reps) != null);
  return sets.length ? { date: l.date, txt: sets.map(x => `${num(x.kg) != null ? fmtNum(num(x.kg)) + " kg" : "–"} × ${num(x.reps) != null ? num(x.reps) : "–"}`).join("; ") } : null;
};

// { titulo, sub, aquecimento: [], treinos: [{ letra, foco, dias, linhas: [[...]] }], head }
export function dadosPlano({ historico = true } = {}){
  const p = activePlan(); if (!p) return null;
  const head = ["#", "Exercício", "Séries × reps", "RIR", "Descanso", "Técnica"].concat(historico ? ["Última vez", "1RM estim."] : []);
  const info = semanaInfo(p);
  return {
    titulo: "Plano de treino: " + (p.nome || "sem nome"),
    sub: `Divisão ${p.split || planLetters(p).join("")}${info ? ` · semana ${info.semana} de 12 (${info.fase.nome})` : ""} · exportado em ${ddmmyyyy(ymd(new Date()))}`,
    aquecimento: (p.warmup || []).map(w => w.t),
    head,
    treinos: planLetters(p).map(L => {
      const t = p.treinos[L];
      return { letra: L, foco: t.foco || "", dias: (t.dias || []).map(d => DIAS_CURTO[d]).join(", "),
        linhas: (t.ex || []).map((it, i) => {
          const ex = getEx(it.exId), u = historico ? ultimaCarga(it.exId) : null, rm = historico ? serie1RM(it.exId).pop() : null;
          return [String(i + 1), ex.nome, it.rx || (it.series ? it.series + " séries" : "–"), it.rir || "–", restLabel(restOf(it)), it.nota != null ? it.nota : (ex.nota || "")]
            .concat(historico ? [u ? `${u.txt} (${ddmmyyyy(u.date).slice(0, 5)})` : "–", rm ? fmtNum(rm.v) + " kg" : "–"] : []);
        }) };
    })
  };
}

const cel = s => String(s == null ? "" : s).replace(/\|/g, "/").replace(/\n/g, " ");
export function planoMarkdown(d){
  let md = `# ${d.titulo}\n\n${d.sub}\n`;
  if (d.aquecimento.length) md += `\n## Aquecimento (todos os treinos)\n\n` + d.aquecimento.map(t => `- ${t}`).join("\n") + "\n";
  d.treinos.forEach(t => {
    md += `\n## Treino ${t.letra}${t.foco ? ": " + t.foco : ""}\n\n${t.dias ? "Dias: " + t.dias + "\n\n" : ""}| ${d.head.join(" | ")} |\n|${d.head.map(() => "---").join("|")}|\n`
      + t.linhas.map(r => `| ${r.map(cel).join(" | ")} |`).join("\n") + "\n";
  });
  return md + `\n> RIR = repetições em reserva (quantas ainda daria para fazer). 1RM estimado pela fórmula de Epley, sem as 2 sessões de calibragem.\n`;
}

const pdfTxt = s => String(s == null ? "" : s).replace(/[–—]/g, "-").replace(/−/g, "-").replace(/…/g, "...").replace(/[^\x00-\xFF]/g, "");
export async function planoPdf(d){
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: d.head.length > 6 ? "landscape" : "portrait" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), verde = [15, 107, 99];
  let y = 14;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(20, 35, 43); doc.text(pdfTxt(d.titulo), 12, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(81, 100, 109); y += 5.5; doc.text(pdfTxt(d.sub), 12, y); y += 3;
  if (d.aquecimento.length){
    const linhas = doc.splitTextToSize(pdfTxt("Aquecimento: " + d.aquecimento.join(" · ")), W - 24);
    doc.setFontSize(9); doc.setTextColor(40, 50, 55); y += 5; doc.text(linhas, 12, y); y += 4 * linhas.length;
  }
  d.treinos.forEach(t => {
    if (y > H - 40){ doc.addPage(); y = 14; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(20, 35, 43);
    doc.text(pdfTxt(`Treino ${t.letra}${t.foco ? ": " + t.foco : ""}${t.dias ? "  (" + t.dias + ")" : ""}`), 12, y + 6);
    autoTable(doc, { startY: y + 8, head: [d.head.map(pdfTxt)], body: t.linhas.map(r => r.map(pdfTxt)), theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.5, valign: "middle" }, headStyles: { fillColor: verde }, columnStyles: { 0: { cellWidth: 7 }, 1: { fontStyle: "bold" } }, margin: { left: 12, right: 12, bottom: 12 } });
    y = ((doc.lastAutoTable && doc.lastAutoTable.finalY) || y + 20) + 4;
  });
  doc.setFontSize(7.5); doc.setTextColor(81, 100, 109);
  doc.text(pdfTxt("RIR = repetições em reserva. 1RM estimado (Epley). App Treino."), 12, H - 6);
  return doc.output("blob");
}

export async function baixarPlano(formato, opcoes){
  const d = dadosPlano(opcoes); if (!d){ alert("Nenhum plano de treino ativo."); return; }
  const nome = "plano-de-treino-" + ymd(new Date());
  if (formato === "md") return downloadBlob(nome + ".md", planoMarkdown(d), "text/markdown;charset=utf-8");
  return downloadBlob(nome + ".pdf", await planoPdf(d));
}
