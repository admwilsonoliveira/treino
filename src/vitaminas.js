// Vitaminas da semana (módulo Saúde): análise dos 8 nutrientes-alvo nos últimos 7 dias com registro,
// ligação com os exames, sugestões de alimentos (nunca suplementos) e preferências alimentares.
import { S } from "./store.js";
import { ymd, num, norm, mondayOf } from "./util.js";
import { alimento, medidas, nomeCompleto, bancoPronto, itensBanco } from "./alimentos.js";
import { refeicoesDo, totaisDe, metas, alimentosRecentes } from "./nutricao.js";
import { addDias, diasAte, sintomasList } from "./medicacao.js";

// [chave, nome, unidade, meta por dia] — proteína usa a meta do usuário; ômega-3 é qualitativo (dias com fonte)
export function alvos(){
  return [["b12", "Vitamina B12", "µg", 2.4], ["folato", "Folato", "µg", 400], ["vitD", "Vitamina D", "µg", 15], ["fibra", "Fibra", "g", 25],
    ["calcio", "Cálcio", "mg", 1000], ["ferro", "Ferro", "mg", 8], ["prot", "Proteína", "g", metas().prot.alvo], ["omega3", "Gordura boa / ômega-3", "dias", 5]];
}
export const MIN_DIAS = 4;
const hoje = () => ymd(new Date());

// fonte de gordura boa: ômega-3 ≥ 0,3 g ou monoinsaturada ≥ 8 g por 100 g (azeite, castanhas, abacate, linhaça, chia, peixes gordos)
const gorduraBoa = n => (num(n.omega3) || 0) >= 0.3 || (num(n.mono) || 0) >= 8;

/* ---------- análise ---------- */
export function analise(fim = hoje()){
  const dias = [0, 1, 2, 3, 4, 5, 6].map(i => addDias(fim, -i)).filter(d => refeicoesDo(d).length);
  const r = { dias: dias.length, fim, ok: dias.length >= MIN_DIAS, itens: [] };
  if (!r.ok) return r;
  const refs = dias.flatMap(d => refeicoesDo(d)), tot = totaisDe(refs);
  alvos().forEach(([k, nome, un, meta]) => {
    let media, cob;
    if (k === "omega3"){
      // dias em que algum item teve gordura boa (por 100 g do alimento original)
      const comFonte = dias.filter(d => refeicoesDo(d).some(x => (x.itens || []).some(it => { const a = alimento(it.alimentoId); return a ? gorduraBoa(a) : false; }))).length;
      media = comFonte * 7 / dias.length; cob = 100;
    } else { media = (tot.t[k] || 0) / dias.length; cob = tot.itens ? Math.round((tot.cob[k] || 0) / tot.itens * 100) : 0; }
    const pct = meta ? media / meta * 100 : null;
    r.itens.push({ k, nome, un, meta, media, pct, cob, classe: pct == null ? "–" : pct < 70 ? "baixo" : pct < 100 ? "atencao" : "ok", exame: exameBaixo(k) });
  });
  return r;
}

/* ---------- exames: o mesmo nutriente também baixo no laudo? ---------- */
function ultimoExame(teste){
  const xs = Object.values(S.exames || {}).filter(x => x.valor != null && teste(norm(x.nome))).sort((a, b) => a.date.localeCompare(b.date));
  return xs.pop() || null;
}
export function exameBaixo(k){
  let x = null, baixo = false;
  if (k === "b12"){ x = ultimoExame(n => n.includes("b12")); baixo = !!x && x.valor < 300; } // abaixo de 300 pg/mL = zona cinzenta, mesmo dentro da referência
  else if (k === "folato"){ x = ultimoExame(n => n.includes("folico") || n.includes("folato")); baixo = !!x && x.refMin != null && x.valor < x.refMin; }
  else if (k === "vitD"){ x = ultimoExame(n => n.includes("vitamina d")); baixo = !!x && x.refMin != null && x.valor < x.refMin; }
  return baixo ? { valor: x.valor, unidade: x.unidade, date: x.date } : null;
}
export const triglicerideosAltos = () => { const x = ultimoExame(n => n.includes("triglicer")); return !!x && x.refMax != null && x.valor > x.refMax; };
export const intestinoPreso = () => sintomasList().some(s => s.tipo === "intestino_preso" && diasAte(s.date, hoje()) <= 7);

/* ---------- preferências (seção 7.7) ---------- */
export function prefs(){
  const p = (S.saude && S.saude.prefs) || {};
  return { naoPreparo: p.naoPreparo || [], peixesRestritos: !!p.peixesRestritos, peixesLiberados: p.peixesLiberados || [], bloqueados: p.bloqueados || [] };
}
const PEIXES = "Pescados e frutos do mar";
const proibido = (a, p) => p.bloqueados.includes(a.id) || p.naoPreparo.some(t => norm(a.nome).includes(norm(t)));
const restrito = (a, p) => p.peixesRestritos && a.grupo === PEIXES && !p.peixesLiberados.includes(a.id);
// grupos que não entram nas sugestões (pratos prontos, doces, bebidas) e itens que se comem cozidos mas estão crus
const FORA_GRUPOS = ["Alimentos preparados", "Produtos açucarados", "Bebidas (alcoólicas e não alcoólicas)", "Miscelâneas"];
const COZIDOS = ["Cereais e derivados", "Leguminosas e derivados", "Carnes e derivados", PEIXES, "Ovos e derivados"];
// ingredientes que ninguém come puros (farinha, amido, óleo de cozinha, caldo, fermento...)
const INGREDIENTE = /^(farinha|amido|fecula|polvilho|fermento|oleo|mistura|creme de|caldo|gelatina|sal|acucar|tempero|extrato|glicose|melado)\b/;
// doces feitos com amendoim ou coco não contam como sugestão saudável
const DOCE = /pacoca|pe de moleque|cocada|doce|rapadura/;
const servivel = a => { const n = norm(a.nome); return !FORA_GRUPOS.includes(a.grupo) && !INGREDIENTE.test(n) && !DOCE.test(n) && !(COZIDOS.includes(a.grupo) && /\bcrua?\b/.test(n) && !/atum|sardinha/.test(n)); };
// gordura boa: só as fontes da especificação (seção 7.6)
const GORDURA_BOA = /azeite de oliva|castanha|amendoim|abacate|linhaca|chia|\bnoz\b|amendoa|ovo de galinha inteiro cozido/;

// porção usual: a medida caseira (unidade, fatia...) ou uma porção típica do grupo; limitada a 250 g
function porcao(a){
  const m = medidas(a).find(x => !/xicara/.test(norm(x.n))) || null;
  if (m && m.g > 0 && m.g <= 250) return m;
  const n = norm(a.nome);
  if (a.grupo === "Gorduras e óleos") return { n: "1 colher de sopa", g: 13 };
  if (/^amendoim/.test(n)) return { n: "1 punhado", g: 30 };
  if (a.grupo === "Nozes e sementes") return /linhaca|chia|gergelim/.test(n) ? { n: "1 colher de sopa", g: 10 } : { n: "1 punhado", g: 30 };
  if (/^(leite|iogurte|bebida lactea)/.test(n)) return { n: "1 copo (200 ml)", g: 200 };
  if (/^queijo/.test(n)) return { n: "2 fatias", g: 40 };
  if (a.grupo === "Leguminosas e derivados") return { n: "1 concha", g: 100 };
  if (a.grupo === "Carnes e derivados" || a.grupo === PEIXES) return { n: "1 porção", g: 100 };
  if (a.grupo === "Verduras, hortaliças e derivados") return { n: "3 colheres de sopa", g: 60 };
  if (a.grupo === "Cereais e derivados") return { n: "4 colheres de sopa", g: 100 };
  return { n: "100 g", g: 100 };
}

// 3 alimentos para um nutriente: mais nutriente por porção usual, preferindo favoritos, o que já come e proteína
export function sugerir(k, meta, n = 3, { incluirRestritos = false } = {}){
  if (!bancoPronto()) return [];
  const p = prefs(), favs = new Set((S.saude && S.saude.favAlimentos) || []), usados = new Set(alimentosRecentes(40));
  const lista = itensBanco().concat(Object.values(S.alimentos || {}));
  return lista.filter(a => a && num(a[k]) > 0 && servivel(a) && !proibido(a, p) && (incluirRestritos ? restrito(a, p) : !restrito(a, p)) && (k !== "mono" || GORDURA_BOA.test(norm(a.nome))))
    .map(a => { const md = porcao(a), v = num(a[k]) * md.g / 100, pr = (num(a.prot) || 0) * md.g / 100;
      return { a, md, v, prot: pr, nota: v / meta * 10 + (favs.has(a.id) ? 2 : 0) + (usados.has(a.id) ? 1.5 : 0) + (pr >= 10 ? 1 : 0) }; })
    .filter(x => x.v >= meta * 0.08)            // pelo menos 8% da meta numa porção
    .sort((x, y) => y.nota - x.nota)
    .filter((x, i, arr) => arr.findIndex(y => norm(y.a.nome.split(",")[0]) === norm(x.a.nome.split(",")[0])) === i) // um de cada tipo (não 3 carnes ou 3 feijões)
    .slice(0, n);
}

/* ---------- sugestões da semana (no máximo 3 nutrientes) ---------- */
export function sugestoesDaSemana(r = analise()){
  if (!r.ok) return [];
  let baixos = r.itens.filter(x => x.classe === "baixo" && x.k !== "prot");
  // ferro: só sugere alimentos abaixo de 50% (ferritina alta-normal); nunca suplemento
  baixos = baixos.filter(x => x.k !== "ferro" || x.pct < 50);
  if (intestinoPreso() && !baixos.some(x => x.k === "fibra")){ const fb = r.itens.find(x => x.k === "fibra"); if (fb && fb.pct < 100) baixos.push(fb); }
  baixos.sort((a, b) => (b.exame ? 1 : 0) - (a.exame ? 1 : 0) || (b.k === "fibra" && intestinoPreso() ? 1 : 0) - (a.k === "fibra" && intestinoPreso() ? 1 : 0) || a.pct - b.pct);
  return baixos.slice(0, 3).map(x => {
    const s = { item: x, alimentos: x.k === "omega3" ? sugerir("mono", 8, 3) : sugerir(x.k, x.meta), notas: [] };
    if (x.k === "b12") s.notas.push("Seu B12 está no limite baixo; converse com o médico sobre a necessidade de reposição.");
    if (x.k === "vitD") s.notas.push(`A alimentação sozinha raramente corrige a vitamina D; exposição ao sol e possível reposição devem ser discutidas com o médico${x.exame ? ` (seu exame: ${String(x.exame.valor).replace(".", ",")} ${x.exame.unidade || ""})` : ""}.`);
    if (x.k === "omega3" && triglicerideosAltos()) s.notas.push("Converse com o médico sobre ômega-3 (seus triglicérides).");
    if (x.k === "fibra" && intestinoPreso()) s.notas.push("Você registrou intestino preso: reforce fibra e água.");
    if (x.k === "ferro") s.notas.push("Ferro só pela alimentação: o app nunca sugere suplemento de ferro.");
    // "para experimentar": item de categoria restrita, no máximo 1 vez por mês, se baixo há 2 semanas
    if (x.k !== "omega3" && baixoHa2Semanas(x.k) && (S.saude.experimentarMes || "") !== hoje().slice(0, 7)){
      const e = sugerir(x.k, x.meta, 1, { incluirRestritos: true })[0]; if (e) s.experimentar = e;
    }
    return s;
  });
}

/* ---------- histórico semanal (para o mapa de calor e o "baixo há 2 semanas") ---------- */
export function guardarSemana(r = analise()){
  if (!r.ok || !S.saude) return false;
  const w = ymd(mondayOf(new Date(r.fim + "T12:00:00"))), H = S.saude.vitHist = S.saude.vitHist || {};
  const novo = Object.fromEntries(r.itens.map(x => [x.k, x.pct == null ? null : Math.round(x.pct)]));
  if (JSON.stringify(H[w]) === JSON.stringify(novo)) return false;
  H[w] = novo; return true;
}
function baixoHa2Semanas(k){
  const H = (S.saude && S.saude.vitHist) || {}, ws = Object.keys(H).sort().slice(-2);
  return ws.length === 2 && ws.every(w => H[w][k] != null && H[w][k] < 70);
}
export const nomeSug = x => nomeCompleto(x.a);
