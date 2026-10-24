// Exames laboratoriais (módulo Saúde): nomes padronizados por grupo, sinal de cor pela referência,
// cálculos (não-HDL, TG/HDL, testosterona livre de Vermeulen, FLI, TyG, FIB-4) e pendências.
// Cada usuário preenche os seus (à mão ou por arquivo preparado). Nada de exame fixo no código.
import { S, measurementsList } from "./store.js";
import { num, norm, ymd } from "./util.js";
import { diasAte } from "./medicacao.js";
import { media7 } from "./peso.js";
import { fitaOficial, valorPonto } from "./fita.js";

// [nome padrão, grupo, padrão de reconhecimento (sobre o nome normalizado)]
export const CATALOGO = [
  ["Colesterol total", "Lipídios", /^colesterol( total)?$/], ["HDL", "Lipídios", /\bhdl\b/], ["LDL", "Lipídios", /\bldl\b/], ["VLDL", "Lipídios", /\bvldl\b/],
  ["Triglicérides", "Lipídios", /triglicer/], ["ApoB", "Lipídios", /\bapo ?b\b|apolipoproteina b/], ["Lp(a)", "Lipídios", /\blp ?a\b|lipoproteina a/],
  ["Glicose em jejum", "Glicose", /glicose|glicemia/], ["HbA1c", "Glicose", /hba1c|hemoglobina glicada/], ["Insulina", "Glicose", /^insulina/],
  ["TGO (AST)", "Fígado", /\btgo\b|\bast\b|aspartato/], ["TGP (ALT)", "Fígado", /\btgp\b|\balt\b|alanina/], ["GGT", "Fígado", /\bggt\b|gama ?gt|gamaglutamil/],
  ["Fosfatase alcalina", "Fígado", /fosfatase alcalina/], ["Bilirrubina total", "Fígado", /bilirrubina total/], ["Bilirrubina direta", "Fígado", /bilirrubina direta/],
  ["Bilirrubina indireta", "Fígado", /bilirrubina indireta/], ["Albumina", "Fígado", /^albumina/],
  ["Creatinina", "Rins", /^creatinina/], ["Ureia", "Rins", /^ureia/], ["Ácido úrico", "Rins", /acido urico/], ["Sódio", "Rins", /^sodio/], ["Potássio", "Rins", /^potassio/],
  ["Cálcio", "Rins", /^calcio/], ["Magnésio", "Rins", /^magnesio/],
  ["Testosterona total", "Hormônios", /testosterona total/], ["SHBG", "Hormônios", /\bshbg\b/], ["Testosterona livre", "Hormônios", /testosterona livre/],
  ["Testosterona biodisponível", "Hormônios", /testosterona biodisponivel/], ["Cortisol", "Hormônios", /cortisol/], ["TSH", "Hormônios", /\btsh\b/], ["T4 livre", "Hormônios", /t4 livre/],
  ["Vitamina D (25-OH)", "Vitaminas e ferro", /vitamina d/], ["Vitamina B12", "Vitaminas e ferro", /b12/], ["Ácido fólico", "Vitaminas e ferro", /folico|folato/],
  ["Ferro sérico", "Vitaminas e ferro", /^ferro/], ["Ferritina", "Vitaminas e ferro", /ferritina/], ["Saturação de transferrina", "Vitaminas e ferro", /saturacao de transferrina/],
  ["Homocisteína", "Vitaminas e ferro", /homocisteina/],
  ["Eritrócitos", "Hemograma", /eritrocit|hemacias/], ["Hemoglobina", "Hemograma", /^hemoglobina$/], ["Hematócrito", "Hemograma", /hematocrit/], ["VCM", "Hemograma", /^vcm$/],
  ["HCM", "Hemograma", /^hcm$/], ["CHCM", "Hemograma", /^chcm$/], ["RDW", "Hemograma", /^rdw$/], ["Leucócitos", "Hemograma", /leucocit/], ["Plaquetas", "Hemograma", /plaquetas/],
  ["CPK", "Músculo", /\bcpk\b|creatinofosfoquinase|\bck\b/]
];
export const GRUPOS_EXAME = ["Lipídios", "Glicose", "Fígado", "Rins", "Hormônios", "Vitaminas e ferro", "Hemograma", "Músculo", "Outros"];
// nome padrão de um exame (a ordem do catálogo resolve "Bilirrubina total" antes de "Bilirrubina")
export function padrao(nome){
  const n = norm(nome);
  if (/vldl/.test(n)) return { nome: "VLDL", grupo: "Lipídios" };
  if (/hemoglobina glicada|hba1c/.test(n)) return { nome: "HbA1c", grupo: "Glicose" };
  const c = CATALOGO.find(x => x[2].test(n));
  return c ? { nome: c[0], grupo: c[1] } : { nome, grupo: "Outros" };
}
// exames calculados por fórmula no laudo (ex.: testosterona livre calculada) não entram como medida
export const examesList = () => Object.values(S.exames || {}).sort((a, b) => a.date.localeCompare(b.date) || (a.nome || "").localeCompare(b.nome || ""));
export const serie = nomePadrao => examesList().filter(x => padrao(x.nome).nome === nomePadrao && x.valor != null);
export const ultimo = nomePadrao => serie(nomePadrao).pop() || null;

/* ---------- sinal de cor ---------- */
// verde dentro da referência · amarelo até 10% fora · vermelho mais de 10% fora · B12 < 300 pg/mL = amarelo
export function sinal(x){
  if (x.valor == null) return "pendente";
  const v = num(x.valor), lo = num(x.refMin), hi = num(x.refMax);
  let s = "ok";
  if (lo != null && v < lo) s = (lo - v) / lo > 0.1 ? "vermelho" : "amarelo";
  else if (hi != null && v > hi) s = (v - hi) / hi > 0.1 ? "vermelho" : "amarelo";
  if (s === "ok" && padrao(x.nome).nome === "Vitamina B12" && v < 300) s = "amarelo";
  return s;
}

/* ---------- cálculos ---------- */
const perto = (nomeP, date, dias = 30) => serie(nomeP).filter(x => Math.abs(diasAte(x.date, date)) <= dias).sort((a, b) => Math.abs(diasAte(a.date, date)) - Math.abs(diasAte(b.date, date)))[0] || null;
export function lipidios(){
  return [...new Set(serie("HDL").map(x => x.date))].map(d => {
    const hdl = perto("HDL", d, 0), ct = perto("Colesterol total", d, 0), tg = perto("Triglicérides", d, 0);
    return { date: d, naoHdl: ct && hdl ? ct.valor - hdl.valor : null, tgHdl: tg && hdl ? tg.valor / hdl.valor : null };
  });
}
// Testosterona livre e biodisponível (Vermeulen et al., JCEM 1999): Ka albumina 3,6×10⁴ L/mol, Kt SHBG 1×10⁹ L/mol
export function vermeulen(ttNgDl, shbgNmol, albGdl){
  const Ka = 3.6e4, Kt = 1e9, TT = ttNgDl * 10 * 1e-9 / 288.4, SH = shbgNmol * 1e-9, AL = albGdl * 10 / 69000;
  const N = 1 + Ka * AL, a = N * Kt, b = N + Kt * (SH - TT), c = -TT;
  const tl = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a), livre = tl * 288.4 * 1e8;
  return { livre, bio: livre * N };
}
export function testosterona(){
  return serie("Testosterona total").map(t => {
    const sh = perto("SHBG", t.date), al = perto("Albumina", t.date);
    if (!sh) return null;
    const r = vermeulen(t.valor, sh.valor, al ? al.valor : 4.3);
    return { date: t.date, tt: t.valor, shbg: sh.valor, albumina: al ? al.valor : 4.3, albPadrao: !al, livre: r.livre, bio: r.bio };
  }).filter(Boolean);
}
function idadeEm(date){
  const n = S.profile && S.profile.nascimento; if (!n) return null;
  const a = new Date(n + "T12:00:00"), d = new Date(date + "T12:00:00");
  let i = d.getFullYear() - a.getFullYear(); if (d.getMonth() < a.getMonth() || (d.getMonth() === a.getMonth() && d.getDate() < a.getDate())) i--;
  return i;
}
function cinturaAte(date){
  const f = fitaOficial().filter(x => x.date <= date && valorPonto(x, "cintura_umbigo") != null).pop();
  if (f) return { v: valorPonto(f, "cintura_umbigo"), date: f.date };
  const m = measurementsList().filter(x => x.date <= date && num(x.cintura) != null).pop();
  return m ? { v: num(m.cintura), date: m.date } : null;
}
function imcEm(date){
  const alt = S.profile && num(S.profile.altura), ms = measurementsList().filter(m => m.date <= date && num(m.peso) != null);
  if (!alt || !ms.length) return null;
  const p = media7(ms[ms.length - 1].date); return p ? p / Math.pow(alt / 100, 2) : null;
}
// FLI (Bedogni et al., 2006): ≥ 60 sugere esteatose; < 30 descarta
export function fli(date = ymd(new Date())){
  const tg = serie("Triglicérides").filter(x => x.date <= date).pop(), ggt = serie("GGT").filter(x => x.date <= date).pop();
  const imc = imcEm(date), c = cinturaAte(date);
  if (!tg || !ggt || imc == null || !c) return null;
  const y = 0.953 * Math.log(tg.valor) + 0.139 * imc + 0.718 * Math.log(ggt.valor) + 0.053 * c.v - 15.745;
  return { date, valor: Math.exp(y) / (1 + Math.exp(y)) * 100, tg: tg.valor, ggt: ggt.valor, ggtData: ggt.date, ggtAntiga: diasAte(ggt.date, date) > 182, imc, cintura: c.v };
}
export function fliMensal(meses = 6){
  const out = [], hoje = ymd(new Date());
  for (let i = meses - 1; i >= 0; i--){
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i + 1); d.setDate(0); // último dia de cada mês (o mês atual: hoje)
    const f = fli(i === 0 ? hoje : ymd(d)); if (f) out.push(f);
  }
  return out;
}
// TyG = ln(TG × glicose ÷ 2): ~8,5 associado a esteatose; > 8,8 sugere resistência à insulina (sem corte universal)
export function tyg(){
  const tg = ultimo("Triglicérides"), gl = ultimo("Glicose em jejum");
  if (!tg || !gl) return null;
  return { valor: Math.log(tg.valor * gl.valor / 2), datasDiferentes: tg.date !== gl.date, tgData: tg.date, glData: gl.date };
}
// FIB-4 = idade × AST ÷ (plaquetas[10⁹/L] × √ALT), com os 3 exames até 30 dias entre si; < 1,3 = baixo risco
export function fib4(){
  const ast = ultimo("TGO (AST)"); if (!ast) return null;
  const alt = perto("TGP (ALT)", ast.date), pl = perto("Plaquetas", ast.date), idade = idadeEm(ast.date);
  if (!alt || !pl || idade == null) return null;
  const plaq = pl.valor > 2000 ? pl.valor / 1000 : pl.valor; // /mm³ → 10⁹/L
  return { valor: idade * ast.valor / (plaq * Math.sqrt(alt.valor)), date: ast.date };
}
// HDL caindo (no SURMOUNT-1 subiu em média ~8%)
export function hdlCaindo(){ const s = serie("HDL"); return s.length >= 2 && s[s.length - 1].valor < s[s.length - 2].valor; }

/* ---------- pendências ---------- */
export const pendentes = () => examesList().filter(x => x.valor == null && x.status !== "liberado");
export function alertaPendente(){
  const p = pendentes().filter(x => diasAte(x.date, ymd(new Date())) > 30);
  return p.length ? { titulo: "Exame pendente", msg: `${[...new Set(p.map(x => padrao(x.nome).nome))].join(", ")} sem resultado há mais de 30 dias. Leve à próxima consulta.` } : null;
}
export const PROXIMA_COLETA = ["Glicemia de jejum", "Perfil lipídico + ApoB", "GGT, TGO, TGP e plaquetas (para FLI e FIB-4)", "Vitamina D", "Ácido fólico",
  "Vitamina B12 (± homocisteína ou ácido metilmalônico)", "TSH", "Creatinina/eGFR (avise que usa creatina)", "Saturação de transferrina", "Lp(a), uma vez na vida",
  "Testosterona total + SHBG + albumina"];
