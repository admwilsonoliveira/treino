// Lê a TACO oficial (xlsx) e grava taco.json com os nutrientes por 100 g
const XLSX = require(process.argv[2]), fs = require("fs");
const wb = XLSX.readFile(process.argv[3]);
const val = v => v == null || v === "" || v === "NA" || v === "*" ? null : v === "Tr" ? 0 : (typeof v === "number" ? v : (isFinite(parseFloat(String(v).replace(",", "."))) ? parseFloat(String(v).replace(",", ".")) : null));
const rows = XLSX.utils.sheet_to_json(wb.Sheets["CMVCol taco3"], { header: 1, raw: true, defval: null });
let grupo = null; const out = [];
rows.slice(3).forEach(r => {
  if (typeof r[0] === "string" && r[0].trim() && r[1] == null && !/^(Número|Alimento)/.test(r[0].trim())){ grupo = r[0].trim(); return; }
  if (typeof r[0] !== "number" || !r[1]) return;
  out.push({ id: r[0], nome: String(r[1]).trim(), grupo, kcal: val(r[3]), prot: val(r[5]), gord: val(r[6]), colest: val(r[7]), carb: val(r[8]), fibra: val(r[9]),
    calcio: val(r[11]), magnesio: val(r[12]), manganes: val(r[14]), fosforo: val(r[15]), ferro: val(r[16]), sodio: val(r[17]), potassio: val(r[18]), cobre: val(r[19]), zinco: val(r[20]),
    vitA: val(r[23]) != null ? val(r[23]) : val(r[22]), b1: val(r[24]), b2: val(r[25]), b6: val(r[26]), b3: val(r[27]), vitC: val(r[28]) });
});
const ag = XLSX.utils.sheet_to_json(wb.Sheets["AGtaco3"], { header: 1, raw: true, defval: null });
const byId = Object.fromEntries(out.map(x => [x.id, x]));
ag.slice(3).forEach(r => { const x = byId[r[0]]; if (!x) return; x.sat = val(r[2]); x.mono = val(r[3]); x.poli = val(r[4]); const o3 = [r[18], r[20], r[22]].map(val); x.omega3 = o3.every(v => v == null) ? null : o3.reduce((s, v) => s + (v || 0), 0); });
fs.writeFileSync(process.argv[4], JSON.stringify(out));
console.log("alimentos:", out.length, "grupos:", [...new Set(out.map(x => x.grupo))].join(" | "));
