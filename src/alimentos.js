// Banco de alimentos (módulo Saúde): TACO 4ª ed. (NEPA/Unicamp) + 6 micronutrientes do USDA FoodData Central
// (SR Legacy, CC0) nos alimentos frequentes + alimentos cadastrados pelo usuário a partir do rótulo.
// Valores sempre por 100 g. Nutriente sem dado = null (desconhecido), nunca zero.
// O arquivo src/data/alimentos.json é gerado por scripts/dados/gera_banco.py (não editar à mão).
import { S } from "./store.js";
import { norm, num } from "./util.js";

// [chave, nome, unidade, VD da IN 75/2020 Anexo II (na mesma unidade), destaque na tela]
export const NUTRIENTES = [
  ["kcal", "Energia", "kcal", 2000, true], ["prot", "Proteína", "g", 50, true], ["carb", "Carboidratos", "g", 300, true], ["acucar", "Açúcares totais", "g", null],
  ["acucarAd", "Açúcares adicionados", "g", 50], ["gord", "Gorduras totais", "g", 65, true], ["sat", "Gorduras saturadas", "g", 20], ["trans", "Gorduras trans", "g", 2],
  ["mono", "Gorduras monoinsaturadas", "g", 20], ["poli", "Gorduras poli-insaturadas", "g", 20], ["omega3", "Ômega-3", "g", 4], ["fibra", "Fibra alimentar", "g", 25, true],
  ["sodio", "Sódio", "mg", 2000, true], ["colest", "Colesterol", "mg", 300],
  ["vitA", "Vitamina A", "µg", 800], ["vitD", "Vitamina D", "µg", 15], ["vitE", "Vitamina E", "mg", 15], ["vitK", "Vitamina K", "µg", 120], ["vitC", "Vitamina C", "mg", 100],
  ["b1", "Tiamina (B1)", "mg", 1.2], ["b2", "Riboflavina (B2)", "mg", 1.2], ["b3", "Niacina (B3)", "mg", 15], ["b6", "Vitamina B6", "mg", 1.3], ["b12", "Vitamina B12", "µg", 2.4],
  ["folato", "Folato", "µg", 400], ["calcio", "Cálcio", "mg", 1000], ["ferro", "Ferro", "mg", 14], ["magnesio", "Magnésio", "mg", 420], ["zinco", "Zinco", "mg", 11],
  ["fosforo", "Fósforo", "mg", 700], ["potassio", "Potássio", "mg", 3500], ["selenio", "Selênio", "µg", 60], ["cobre", "Cobre", "mg", 0.9], ["manganes", "Manganês", "mg", 3]
];
export const nutri = k => NUTRIENTES.find(n => n[0] === k);
export const VITAMINAS_ROTULO = ["vitA", "vitD", "vitE", "vitK", "vitC", "b1", "b2", "b3", "b6", "b12", "folato", "calcio", "ferro", "magnesio", "zinco", "fosforo", "potassio", "selenio", "cobre", "manganes"];

let banco = null, carregando = null;
// carrega o banco só quando a Alimentação é aberta (não pesa para quem não usa)
export function carregarBanco(){
  if (banco) return Promise.resolve(banco);
  if (!carregando) carregando = import("./data/alimentos.json").then(m => { banco = m.default || m; banco.itens.forEach(i => { i._n = norm(i.nome); }); return banco; });
  return carregando;
}
export const bancoPronto = () => !!banco;
export const fontes = () => (banco ? banco.fontes : {});

// alimentos cadastrados pelo usuário (store "alimentos")
export const meusAlimentos = () => Object.values(S.alimentos || {}).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
export function alimento(id){
  if (!id) return null;
  if (S.alimentos && S.alimentos[id]) return S.alimentos[id];
  return banco ? banco.itens.find(i => i.id === id) || null : null;
}
export const nomeCompleto = a => a ? a.nome + (a.marca ? " (" + a.marca + ")" : "") : "";

/* ---------- busca sem acento e tolerante a erro de digitação ---------- */
function lev(a, b){
  if (a === b) return 0;
  const m = a.length, n = b.length; if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++){
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
// nota de um termo contra as palavras do nome: 3 começo exato, 2 contém, 1 com 1 erro (termos de 4+ letras), 0 não acha
function notaTermo(t, palavras, texto){
  if (palavras.some(p => p.startsWith(t))) return 3;
  if (texto.includes(t)) return 2;
  if (t.length >= 4 && palavras.some(p => lev(p.slice(0, t.length), t) <= 1 || lev(p, t) <= 1)) return 1;
  return 0;
}
export function buscar(q, limite = 30){
  const termos = norm(q).split(" ").filter(Boolean);
  const favs = new Set((S.saude && S.saude.favAlimentos) || []);
  // os cadastrados pelo usuário não ganham campo extra (seriam gravados junto)
  const lista = meusAlimentos().map(a => ({ a, n: norm(nomeCompleto(a)) })).concat(banco ? banco.itens.map(a => ({ a, n: a._n })) : []);
  if (!termos.length) return lista.filter(x => favs.has(x.a.id)).slice(0, limite).map(x => x.a);
  const res = [];
  lista.forEach(({ a, n: nome }) => {
    const palavras = nome.split(" ");
    let nota = 0, aproximado = false;
    for (const t of termos){ const n = notaTermo(t, palavras, nome); if (!n) return; if (n === 1) aproximado = true; nota += n; }
    if (favs.has(a.id)) nota += 4;
    if (a.f === "meu") nota += 2;
    if (palavras[0] && palavras[0].startsWith(termos[0])) nota += 2;
    if (/\bcrua?\b/.test(nome) && !termos.includes("cru") && !termos.includes("crua")) nota -= 0.5; // cozido costuma ser o que se come
    res.push({ a, aproximado, nota: nota - nome.length / 200 });
  });
  // com erro de digitação só quando não houver resultado exato (evita "atemóia" ao buscar "atum")
  if (res.some(x => !x.aproximado)) return res.filter(x => !x.aproximado).sort((x, y) => y.nota - x.nota).slice(0, limite).map(x => x.a);
  return res.sort((x, y) => y.nota - x.nota).slice(0, limite).map(x => x.a);
}

/* ---------- porções ---------- */
// medidas caseiras: as do banco (USDA, traduzidas), a porção do rótulo e as que o usuário criou
export function medidas(a){
  const out = [];
  if (a.porcaoG) out.push({ n: a.medida ? a.medida : "1 porção", g: a.porcaoG });
  // unidade, fatia e filé antes de xícara e colher (é como se come no dia a dia)
  const ordem = m => /unidade|fatia|filé|coxa|azeitona|folha/.test(m.n) ? 0 : /colher/.test(m.n) ? 1 : 2;
  (a.med || []).slice().sort((x, y) => ordem(x) - ordem(y)).forEach(m => out.push(m));
  (((S.saude && S.saude.medidas) || {})[a.id] || []).forEach(m => out.push(Object.assign({ minha: true }, m)));
  return out;
}
// valores para uma quantidade em gramas; null continua null (desconhecido)
export function paraGramas(a, g){
  const out = {};
  NUTRIENTES.forEach(([k]) => { const v = num(a[k]); out[k] = v == null ? null : v * g / 100; });
  return out;
}
export const ehFavorito = id => ((S.saude && S.saude.favAlimentos) || []).includes(id);
