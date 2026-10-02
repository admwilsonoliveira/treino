// Relatório de evolução por período, com exportação em PDF e Excel.
import { Chart } from "chart.js";
import { S, done, getEx, measurementsList, kcalFor, dorLabel, setStatus } from "../store.js";
import { ui, actions, render } from "../ui.js";
import { esc, num, fmtNum, ymd, ddmm, ddmmyyyy, timeOf, pace, downloadBlob } from "../util.js";
import { diagnostico } from "../diagnostico.js";

export const PERIODOS = [["30", "30 dias"], ["90", "90 dias"], ["365", "12 meses"], ["tudo", "Tudo"]];

function inicioDe(per){
  if (per === "tudo"){ const all = done(), m = measurementsList(); const d = [all[0] && all[0].date, m[0] && m[0].date].filter(Boolean).sort()[0]; return d || ymd(new Date()); }
  return ymd(new Date(Date.now() - (parseInt(per, 10) - 1) * 86400000));
}
const minutos = s => s.end ? Math.max(0, (new Date(s.end) - new Date(s.start)) / 60000) : 0;
const media = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export function relatorioDados(per = "30"){
  const de = inicioDe(per), ate = ymd(new Date());
  const ss = done().filter(s => s.date >= de && s.date <= ate);
  const tr = ss.filter(s => s.type === "treino"), cw = ss.filter(s => s.type === "caminhada");
  const r = { de, ate, per };
  r.resumo = {
    treinos: tr.filter(s => s.status === "concluido").length,
    incompletos: tr.filter(s => s.status === "incompleto").length,
    caminhadas: cw.length,
    km: cw.reduce((a, s) => a + (num(s.km) || 0), 0),
    horasTreino: tr.reduce((a, s) => a + minutos(s), 0) / 60,
    horasCaminhada: cw.reduce((a, s) => a + minutos(s), 0) / 60,
    kcalTreino: tr.reduce((a, s) => a + (kcalFor(s) || 0), 0),
    kcalCaminhada: cw.reduce((a, s) => a + (kcalFor(s) || 0), 0),
    dorAntes: media(tr.filter(s => s.pre && s.pre.dor != null).map(s => s.pre.dor)),
    dorDepois: media(tr.filter(s => s.post && s.post.dor != null).map(s => s.post.dor)),
    avaliacao: media(tr.filter(s => s.post && s.post.sens).map(s => s.post.sens)),
    alertasDor: tr.filter(s => s.post && (s.post.irradiada || s.post.dorAguda)).length
  };
  // cargas por exercício: maior carga na primeira e na última sessão do período
  const porEx = {};
  tr.forEach(s => Object.keys(s.sets || {}).forEach(id => {
    let max = 0, vol = 0, reps = 0;
    s.sets[id].forEach(x => { const kg = num(x.kg), rp = num(x.reps); if (kg != null && rp > 0){ max = Math.max(max, kg); vol += kg * rp; } if (rp) reps += rp; });
    if (!max && !reps) return;
    (porEx[id] = porEx[id] || []).push({ date: s.date, max, vol, reps });
  }));
  r.cargas = Object.keys(porEx).map(id => {
    const a = porEx[id], ex = getEx(id), first = a[0], last = a[a.length - 1];
    return { id, nome: ex.nome, unit: ex.load === false ? "reps" : (ex.unit || "kg"), semCarga: ex.load === false, sessoes: a.length,
      inicio: ex.load === false ? first.reps : first.max, fim: ex.load === false ? last.reps : last.max,
      volume: a.reduce((x, y) => x + y.vol, 0) };
  }).map(c => Object.assign(c, { variacao: c.inicio ? (c.fim - c.inicio) / c.inicio * 100 : null }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  r.caminhadas = cw.map(s => { const min = minutos(s), km = num(s.km); return { date: s.date, inicio: timeOf(s.start), min, km, ritmo: km ? min / km : null, kcal: kcalFor(s) }; });
  r.ritmoMedio = r.resumo.km ? (r.caminhadas.reduce((a, c) => a + c.min, 0) / r.resumo.km) : null;
  r.treinosLista = tr.map(s => ({ date: s.date, treino: s.treino, inicio: timeOf(s.start), fim: timeOf(s.end), min: minutos(s), kcal: kcalFor(s), dorA: s.pre && s.pre.dor, dorD: s.post && s.post.dor, status: s.status === "incompleto" ? "Incompleto" : "Concluído" }));
  // medidas
  const ms = measurementsList().filter(m => m.date >= de && m.date <= ate);
  r.medidas = ms;
  const varCampo = k => { const a = ms.filter(m => num(m[k]) != null); return a.length ? { inicio: num(a[0][k]), fim: num(a[a.length - 1][k]), dif: num(a[a.length - 1][k]) - num(a[0][k]) } : null; };
  r.corpo = { peso: varCampo("peso"), gorduraPct: varCampo("gorduraPct"), massaGorda: varCampo("massaGorda"), musculo: varCampo("musculo"), cintura: varCampo("cintura") };
  r.diag = diagnostico();
  return r;
}

/* ---------- tela ---------- */
const f1 = v => (v == null ? "–" : fmtNum(v));
const sinal = v => (v == null ? "–" : (v > 0 ? "+" : "") + fmtNum(v));
export function relatorioHtml(){
  const per = ui.relPeriodo || "30", r = relatorioDados(per), R = r.resumo;
  let h = `<div class="toggle" role="group" aria-label="Período" style="margin-top:0">${PERIODOS.map(([k, t]) => `<button type="button" data-act="relPer" data-v="${k}" aria-pressed="${per === k}">${t}</button>`).join("")}</div>
    <p class="small muted" style="margin:0 0 10px">De ${ddmmyyyy(r.de)} a ${ddmmyyyy(r.ate)}.</p>
    <div class="row"><button class="btn strength" data-act="relPdf">Exportar PDF</button><button class="btn ghost" data-act="relXlsx">Exportar Excel</button></div>`;
  h += `<h2>Resumo</h2><div class="stats">
    <div class="stat"><div class="v">${R.treinos}</div><div class="l">treinos${R.incompletos ? ` (+${R.incompletos} incompl.)` : ""}</div></div>
    <div class="stat"><div class="v">${R.caminhadas}</div><div class="l">caminhadas</div></div>
    <div class="stat"><div class="v">${fmtNum(R.km)}</div><div class="l">km</div></div>
    <div class="stat"><div class="v">${fmtNum(R.horasTreino + R.horasCaminhada)}</div><div class="l">horas ativas</div></div>
    <div class="stat"><div class="v">${Math.round(R.kcalTreino + R.kcalCaminhada)}</div><div class="l">kcal (estimativa)</div></div>
    <div class="stat"><div class="v">${R.dorAntes == null ? "–" : fmtNum(R.dorAntes)}→${R.dorDepois == null ? "–" : fmtNum(R.dorDepois)}</div><div class="l">${esc(dorLabel().toLowerCase())} média</div></div>
  </div>${R.alertasDor ? `<p class="small" style="color:var(--danger);margin-top:8px">${R.alertasDor} treino(s) com alerta de dor no check-out.</p>` : ""}`;

  const C = r.corpo;
  h += `<h2>Corpo</h2><div class="panel">`;
  if (!C.peso) h += `<div class="empty">Sem pesagens neste período.</div>`;
  else {
    h += `<div class="scroll-x"><table><thead><tr><th></th><th>Início</th><th>Fim</th><th>Variação</th></tr></thead><tbody>`;
    [["peso", "Peso (kg)"], ["gorduraPct", "Gordura (%)"], ["massaGorda", "Massa gorda (kg)"], ["musculo", "Músculo (kg)"], ["cintura", "Cintura (cm)"]].forEach(([k, t]) => {
      const v = C[k]; if (!v) return;
      h += `<tr><td>${t}</td><td>${f1(v.inicio)}</td><td>${f1(v.fim)}</td><td><strong>${sinal(v.dif)}</strong></td></tr>`;
    });
    h += `</tbody></table></div>`;
  }
  h += `</div>`;

  h += `<h2>Cargas</h2><div class="panel">`;
  if (!r.cargas.length) h += `<div class="empty">Nenhum treino com cargas neste período.</div>`;
  else {
    h += `<div class="scroll-x"><table><thead><tr><th>Exercício</th><th>Início</th><th>Fim</th><th>Var.</th><th>Sessões</th></tr></thead><tbody>`;
    r.cargas.forEach(c => { h += `<tr><td>${esc(c.nome)}</td><td>${f1(c.inicio)}</td><td>${f1(c.fim)}</td><td>${c.variacao == null ? "–" : sinal(c.variacao) + "%"}</td><td>${c.sessoes}</td></tr>`; });
    h += `</tbody></table></div><p class="small muted" style="margin:8px 0 0">Maior carga (ou repetições, nos exercícios sem carga) na primeira e na última sessão do período.</p>`;
  }
  h += `</div>`;

  h += `<h2>Caminhadas</h2><div class="panel">`;
  if (!r.caminhadas.length) h += `<div class="empty">Nenhuma caminhada neste período.</div>`;
  else h += `<p style="margin:0">${r.caminhadas.length} caminhadas, ${fmtNum(R.km)} km${r.ritmoMedio ? `, ritmo médio ${pace(r.ritmoMedio)} /km` : ""}, cerca de ${Math.round(R.kcalCaminhada)} kcal.</p>`;
  h += `</div>`;
  return h;
}
actions.relPer = el => { ui.relPeriodo = el.dataset.v; render(); };

/* ---------- textos seguros para o PDF (fontes padrão só têm Latin-1) ---------- */
const pdfTxt = s => String(s == null ? "" : s).replace(/[–—]/g, "-").replace(/…/g, "...").replace(/→/g, "->").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/[^\x00-\xFF]/g, "");
const nomeArquivo = (r, ext) => `relatorio-treino-${r.de}-a-${r.ate}.${ext}`;

// Gráfico desenhado fora da tela para virar imagem no PDF
async function chartImage(cfg, w = 900, h = 360){
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.style.cssText = "position:fixed;left:-10000px;top:0;width:" + w + "px;height:" + h + "px";
  document.body.appendChild(c);
  const ch = new Chart(c, Object.assign({}, cfg, { options: Object.assign({ responsive: false, animation: false, devicePixelRatio: 1 }, cfg.options || {}) }));
  // fundo branco + JPEG: arquivo bem menor que PNG transparente
  const out = document.createElement("canvas"); out.width = w; out.height = h;
  const ctx = out.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(c, 0, 0);
  const url = out.toDataURL("image/jpeg", 0.85);
  ch.destroy(); c.remove();
  return url;
}

actions.relPdf = async el => {
  el.disabled = true; setStatus("Gerando PDF…");
  try{
    const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const r = relatorioDados(ui.relPeriodo || "30"), R = r.resumo, d = r.diag, p = S.profile;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const verde = [15, 107, 99], cinza = [81, 100, 109];
    let y = 16;
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(20, 35, 43);
    doc.text(pdfTxt("Relatório de evolução"), 14, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...cinza);
    y += 6; doc.text(pdfTxt(`${p.nome} · ${ddmmyyyy(r.de)} a ${ddmmyyyy(r.ate)} · gerado em ${ddmmyyyy(ymd(new Date()))}`), 14, y);
    y += 4;
    const tabela = (titulo, head, body, opts = {}) => {
      if (y > 255){ doc.addPage(); y = 16; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(20, 35, 43);
      doc.text(pdfTxt(titulo), 14, y + 6);
      autoTable(doc, Object.assign({ startY: y + 9, head: head ? [head.map(pdfTxt)] : undefined, body: body.map(row => row.map(pdfTxt)),
        theme: "grid", styles: { fontSize: 9, cellPadding: 1.8 }, headStyles: { fillColor: verde }, margin: { left: 14, right: 14, bottom: 16 } }, opts));
      y = ((doc.lastAutoTable && doc.lastAutoTable.finalY) || y + 20) + 4;
    };
    tabela("Resumo do período", null, [
      ["Treinos concluídos", String(R.treinos) + (R.incompletos ? ` (+${R.incompletos} incompletos)` : "")],
      ["Caminhadas", `${R.caminhadas} · ${fmtNum(R.km)} km${r.ritmoMedio ? " · ritmo médio " + pace(r.ritmoMedio) + " /km" : ""}`],
      ["Tempo ativo", `${fmtNum(R.horasTreino)} h de treino + ${fmtNum(R.horasCaminhada)} h de caminhada`],
      ["Calorias (estimativa)", `${Math.round(R.kcalTreino)} kcal treino + ${Math.round(R.kcalCaminhada)} kcal caminhada`],
      [dorLabel() + " média", `${R.dorAntes == null ? "-" : fmtNum(R.dorAntes)} antes -> ${R.dorDepois == null ? "-" : fmtNum(R.dorDepois)} depois (0 a 10)`],
      ["Alertas de dor no check-out", String(R.alertasDor)]
    ], { columnStyles: { 0: { fontStyle: "bold", cellWidth: 60 } } });
    if (d && d.itens.length) tabela("Avaliação física (informativa)", ["Indicador", "Valor", "Classificação"],
      d.itens.map(i => [i.k, (i.sinal && i.v > 0 ? "+" : "") + fmtNum(i.v, i.fmt) + (i.un ? " " + i.un : ""), i.txt || ""]));
    const C = r.corpo, linhasCorpo = [["peso", "Peso (kg)"], ["gorduraPct", "Gordura (%)"], ["massaGorda", "Massa gorda (kg)"], ["musculo", "Músculo esquelético (kg)"], ["cintura", "Cintura (cm)"]].filter(([k]) => C[k]).map(([k, t]) => [t, f1(C[k].inicio), f1(C[k].fim), sinal(C[k].dif)]);
    if (linhasCorpo.length) tabela("Corpo", ["Medida", "Início", "Fim", "Variação"], linhasCorpo);
    // gráfico de peso
    if (r.medidas.filter(m => num(m.peso) != null).length > 1){
      const ms = r.medidas.filter(m => num(m.peso) != null);
      const img = await chartImage({ type: "line", data: { labels: ms.map(m => ddmm(m.date)), datasets: [{ label: "Peso (kg)", data: ms.map(m => num(m.peso)), borderColor: "#0f6b63", backgroundColor: "#0f6b63", pointRadius: 3, borderWidth: 2 }].concat(p.metaPeso ? [{ label: "Meta", data: ms.map(() => p.metaPeso), borderColor: "#51646d", borderDash: [6, 4], pointRadius: 0, borderWidth: 1 }] : []) }, options: { plugins: { legend: { display: true } } } });
      if (y + 85 > 280){ doc.addPage(); y = 16; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(20, 35, 43);
      doc.text(pdfTxt("Evolução do peso"), 14, y + 6);
      doc.addImage(img, "JPEG", 14, y + 9, 182, 73); y += 85;
    }
    if (r.cargas.length) tabela("Evolução das cargas", ["Exercício", "Início", "Fim", "Variação", "Sessões"],
      r.cargas.map(c => [c.nome + (c.semCarga ? " (reps)" : ""), f1(c.inicio), f1(c.fim), c.variacao == null ? "-" : sinal(c.variacao) + "%", String(c.sessoes)]));
    if (r.treinosLista.length) tabela("Treinos", ["Data", "Treino", "Horário", "Duração", "kcal", "Dor antes/depois", "Status"],
      r.treinosLista.map(t => [ddmm(t.date), t.treino, `${t.inicio}-${t.fim}`, Math.round(t.min) + " min", t.kcal != null ? String(t.kcal) : "-", `${t.dorA ?? "-"} / ${t.dorD ?? "-"}`, t.status]));
    if (r.caminhadas.length) tabela("Caminhadas", ["Data", "Início", "Tempo", "Km", "Ritmo", "kcal"],
      r.caminhadas.map(c => [ddmm(c.date), c.inicio, Math.round(c.min) + " min", c.km ? fmtNum(c.km) : "-", c.ritmo ? pace(c.ritmo) + " /km" : "-", c.kcal != null ? String(c.kcal) : "-"]));
    // rodapé
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++){
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...cinza);
      doc.text(doc.splitTextToSize(pdfTxt("App Treino · Registro pessoal; não substitui avaliação de médico, fisioterapeuta, nutricionista ou educador físico. Calorias e avaliação são estimativas."), 165), 14, 287);
      doc.text(`${i}/${n}`, 196, 290, { align: "right" });
    }
    await downloadBlob(nomeArquivo(r, "pdf"), doc.output("blob"));
    setStatus("PDF gerado");
  }catch(e){ setStatus(""); alert("Não foi possível gerar o PDF.\n\n" + (e.message || e)); }
  finally{ el.disabled = false; }
};

actions.relXlsx = async el => {
  el.disabled = true; setStatus("Gerando planilha…");
  try{
    const XLSX = await import("xlsx");
    const r = relatorioDados(ui.relPeriodo || "30"), R = r.resumo, wb = XLSX.utils.book_new();
    const add = (nome, rows, cols) => { const ws = XLSX.utils.aoa_to_sheet(rows); if (cols) ws["!cols"] = cols.map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, nome); };
    const n = v => (v == null ? "" : Math.round(v * 100) / 100);
    add("Resumo", [["Relatório de evolução", `${ddmmyyyy(r.de)} a ${ddmmyyyy(r.ate)}`], [],
      ["Treinos concluídos", R.treinos], ["Treinos incompletos", R.incompletos], ["Caminhadas", R.caminhadas], ["Km caminhados", n(R.km)],
      ["Horas de treino", n(R.horasTreino)], ["Horas de caminhada", n(R.horasCaminhada)], ["kcal treino (estimativa)", Math.round(R.kcalTreino)], ["kcal caminhada (estimativa)", Math.round(R.kcalCaminhada)],
      [dorLabel() + " média antes", n(R.dorAntes)], [dorLabel() + " média depois", n(R.dorDepois)], ["Alertas de dor", R.alertasDor]], [32, 22]);
    if (r.diag) add("Avaliação", [["Indicador", "Valor", "Unidade", "Classificação", "Referência"]].concat(r.diag.itens.map(i => [i.k, n(i.v), i.un || "", i.txt || "", i.ref || ""])), [26, 12, 12, 30, 50]);
    add("Medidas", [["Data", "Peso (kg)", "Gordura (%)", "Massa gorda (kg)", "Músculo (kg)", "Água (%)", "Cintura (cm)"]].concat(r.medidas.map(m => [ddmmyyyy(m.date), n(num(m.peso)), n(num(m.gorduraPct)), n(num(m.massaGorda)), n(num(m.musculo)), n(num(m.agua)), n(num(m.cintura))])), [12, 10, 12, 16, 13, 10, 12]);
    add("Cargas", [["Exercício", "Unidade", "Início", "Fim", "Variação (%)", "Sessões", "Volume total (kg×reps)"]].concat(r.cargas.map(c => [c.nome, c.unit, n(c.inicio), n(c.fim), n(c.variacao), c.sessoes, n(c.volume)])), [34, 9, 9, 9, 13, 9, 20]);
    add("Treinos", [["Data", "Treino", "Início", "Fim", "Duração (min)", "kcal", "Dor antes", "Dor depois", "Status"]].concat(r.treinosLista.map(t => [ddmmyyyy(t.date), t.treino, t.inicio, t.fim, Math.round(t.min), t.kcal ?? "", t.dorA ?? "", t.dorD ?? "", t.status])), [12, 8, 8, 8, 13, 8, 10, 11, 12]);
    add("Caminhadas", [["Data", "Início", "Duração (min)", "Km", "Ritmo (min/km)", "kcal"]].concat(r.caminhadas.map(c => [ddmmyyyy(c.date), c.inicio, Math.round(c.min), n(c.km), c.ritmo ? pace(c.ritmo) : "", c.kcal ?? ""])), [12, 8, 13, 8, 14, 8]);
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    await downloadBlob(nomeArquivo(r, "xlsx"), new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    setStatus("Planilha gerada");
  }catch(e){ setStatus(""); alert("Não foi possível gerar a planilha.\n\n" + (e.message || e)); }
  finally{ el.disabled = false; }
};
