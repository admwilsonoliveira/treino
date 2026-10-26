// Acrescenta ao banco (src/data/alimentos.json) as tabelas públicas do IBGE (POF 2008-2009):
// - composição dos alimentos "como consumidos" (preparações brasileiras), que a TACO não tem;
// - medidas caseiras (concha, colher, escumadeira...) em gramas, inclusive para os alimentos da TACO
//   que o IBGE usou como referência.
// Uso: node ibge2json.cjs <app>/node_modules/xlsx tabelacompleta.xls tabelamedidas_bd.xls ../../src/data/alimentos.json
// Rodar depois de gera_banco.py (que gera o alimentos.json da TACO + USDA). Pode rodar de novo: refaz a parte do IBGE.
const fs = require("fs");
const XLSX = require(process.argv[2]);
const [, , , arqComp, arqMed, arqBanco] = process.argv;

const linhas = (arq, ini) => { const wb = XLSX.readFile(arq); return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }).slice(ini).filter(r => typeof r[0] === "number"); };
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const num = v => (typeof v === "number" && isFinite(v) ? Math.round(v * 1000) / 1000 : null);

// o IBGE grava em maiúsculas e quase sempre sem acento: devolve os acentos das palavras mais comuns
const ACENTOS = Object.fromEntries(("feijão pão limão maçã mamão melão açúcar acúcar café chá filé purê molho camarão salmão atum leitão "
  + "macarrão requeijão sabão coração fígado lingüiça linguiça suíno suína bovino bovina músculo lombo contrafilé maminha "
  + "batata-inglesa mandioquinha abóbora chuchu brócolis espinafre agrião alface pimentão cebola alho tomate pepino quiabo jiló "
  + "maracujá abacaxi açaí cupuaçu caju pêssego ameixa uva tangerina laranja goiaba mangaba jabuticaba pitanga acerola "
  + "pão-de-queijo pães biscoito bolacha bolo farofa farinha mandioca polvilho tapioca cuscuz canjica pamonha mingau "
  + "galinha frango peito coxa sobrecoxa asa pescoço moela peixe bacalhau sardinha caranguejo siri "
  + "leite iogurte coalhada queijo manteiga margarina creme nata ovo ovos gema clara "
  + "óleo azeite banha gordura salgado salgada doce doces mel melado rapadura sorvete chocolate bombom pudim "
  + "refrigerante cerveja cachaça vinho suco água guaraná "
  + "orgânico orgânica não específico especificado especificada à às ao milanesa grão grãos sêmola trigo integral "
  + "pequi buriti baru castanha castanha-do-pará amêndoa avelã pistache noz nozes amendoim gergelim linhaça "
  + "salsicha mortadela presunto apresuntado salame hambúrguer almôndega carne-seca charque jabá "
  + "sopa caldo ensopado refogado grelhado assado cozido frito empanado vinagrete "
  + "pedaço pedaços porção porções xícara carcaça açúcares cálice taça médio média médios grão-de-bico salsicha calabresa").split(" ").filter(Boolean).map(p => [norm(p), p]));
const comAcento = s => s.toLowerCase().replace(/[a-zà-ú\-]+/g, w => ACENTOS[norm(w)] || w);
const capitaliza = s => s.charAt(0).toUpperCase() + s.slice(1);
const nomePrep = p => { const t = String(p || "").trim(); if (!t || t === "NAO SE APLICA") return ""; return comAcento(t.replace(/\(A\)/g, "").replace(/\s+/g, " ").trim()); };

function grupoDe(cod, nome){
  const n = norm(nome), p = String(cod).slice(0, 3);
  if (/\bovo|\bovos|\bgema|\bclara de ovo/.test(n)) return "Ovos e derivados";
  if (/feijao|lentilha|grao de bico|ervilha|\bsoja\b|fava/.test(n) && !/conserva/.test(n)) return "Leguminosas e derivados";
  if (["630", "650", "800", "801"].includes(p)) return "Cereais e derivados";
  if (["640", "670", "880"].includes(p)) return "Verduras, hortaliças e derivados";
  if (p === "660") return "Nozes e sementes";
  if (["680", "681"].includes(p)) return "Frutas e derivados";
  if (["690", "691"].includes(p)) return "Produtos açucarados";
  if (["700", "701", "707"].includes(p)) return "Miscelâneas";
  if (["710", "711", "780", "810"].includes(p)) return "Carnes e derivados";
  if (["720", "726", "727", "740", "744", "760"].includes(p)) return "Pescados e frutos do mar";
  if (p === "770") return "Outros alimentos industrializados";
  if (p === "790") return "Leite e derivados";
  if (["820", "821", "827", "830"].includes(p)) return "Bebidas (alcoólicas e não alcoólicas)";
  if (p === "840") return "Gorduras e óleos";
  return "Alimentos preparados";
}

// colunas da tabela de composição -> chaves do app (null = sem dado, "-" no IBGE)
const COL = { kcal: 6, prot: 7, gord: 8, carb: 9, fibra: 10, calcio: 11, magnesio: 12, manganes: 13, fosforo: 14, ferro: 15, sodio: 16, potassio: 18, cobre: 19, zinco: 20,
  selenio: 21, vitA: 23, b1: 24, b2: 25, b3: 26, b6: 28, b12: 29, folato: 30, vitD: 31, vitE: 32, vitC: 33, colest: 34, sat: 35, mono: 36, poli: 37, omega3: 39, trans: 40, acucar: 41, acucarAd: 42 };

const banco = JSON.parse(fs.readFileSync(arqBanco, "utf8"));
banco.itens = banco.itens.filter(a => a.f !== "IBGE");                       // refaz do zero a parte do IBGE
banco.itens.forEach(a => { if (a.med) a.med = a.med.filter(m => m.f !== "IBGE"); });
const tacoPorNome = Object.fromEntries(banco.itens.filter(a => a.f === "TACO").map(a => [norm(a.nome), a]));

// medidas caseiras: código do alimento + código da preparação -> [{ n, g }]
const MEDIDA_UTIL = /colher|concha|escumadeira|unidade|fatia|pedaco|xicara|copo|prato|porcao|bife|file|posta|coxa|asa|lata|garrafa|pacote|caixa|tablete|bola|espiga|cacho|folha|ramo|dente|punhado|pegador|taca|cuia|tigela|caneca/;
const medidas = {};
linhas(arqMed, 3).forEach(r => {
  const k = r[0] + "-" + r[2], nome = String(r[5] || "").trim(), g = num(r[8]);
  if (!g || !MEDIDA_UTIL.test(norm(nome))) return;
  const n = "1 " + comAcento(nome.replace(/\(A\)/g, "").replace(/\s+/g, " ").trim());
  const l = medidas[k] = medidas[k] || [];
  if (!l.some(m => m.n === n)) l.push({ n, g, f: "IBGE" });
});

// alimentos da TACO cujas medidas caseiras vêm de um item genérico do IBGE (o IBGE não usou a TACO como referência)
const MEDIDA_DE = [[/^feijao .*cozido/, "6303102-99"], [/^arroz .*cozido/, "6300101-99"], [/^lentilha cozida/, "6302001-99"], [/^grao de bico/, "6301501-99"]];
let novos = 0, pulados = 0, medTaco = 0;
banco.itens.filter(a => a.f === "TACO").forEach(a => {
  const r = MEDIDA_DE.find(([re]) => re.test(norm(a.nome))); if (!r || !medidas[r[1]]) return;
  a.med = a.med || []; medidas[r[1]].forEach(m => { if (!a.med.some(x => x.n === m.n)) { a.med.push(m); medTaco++; } });
});
linhas(arqComp, 4).forEach(r => {
  const [cod, desc, codPrep, prep, ref, descRef] = r;
  const med = (medidas[cod + "-" + codPrep] || []).slice(0, 10);
  const base = String(descRef || "").split(/ \(| \+/)[0].trim(), taco = tacoPorNome[norm(base)];
  // alimento que é só um item da TACO (sem óleo, sal ou outros ingredientes): não duplica, só leva as medidas caseiras
  if (ref === 2 && !String(descRef).includes("+") && taco){
    taco.med = taco.med || [];
    med.forEach(m => { if (!taco.med.some(x => x.n === m.n)) { taco.med.push(m); medTaco++; } });
    pulados++; return;
  }
  if (taco && med.length && codPrep === 99) med.forEach(m => { taco.med = taco.med || []; if (!taco.med.some(x => x.n === m.n)) { taco.med.push(m); medTaco++; } });
  const nomeAl = capitaliza(comAcento(String(desc).replace(/\s+/g, " ").trim())), pp = nomePrep(prep);
  const a = { id: "i" + cod + "-" + codPrep, nome: pp ? nomeAl + ", " + pp : nomeAl, grupo: grupoDe(cod, desc), f: "IBGE" };
  Object.entries(COL).forEach(([k, c]) => { const v = num(r[c]); if (v != null) a[k] = v; });
  if (med.length) a.med = med;
  banco.itens.push(a); novos++;
});
banco.fontes.IBGE = "IBGE, Pesquisa de Orçamentos Familiares 2008-2009: Tabelas de Composição Nutricional dos Alimentos Consumidos no Brasil e Tabela de Medidas Referidas (dado público, ftp.ibge.gov.br)";
fs.writeFileSync(arqBanco, JSON.stringify(banco));
console.log(`IBGE: ${novos} alimentos novos, ${pulados} iguais à TACO (só medidas), ${medTaco} medidas caseiras acrescentadas à TACO. Total: ${banco.itens.length}`);
