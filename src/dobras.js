// Dobras cutâneas (módulo Saúde): pontos, protocolos, valor oficial (mediana), soma em mm e,
// na aba Avançado, % de gordura por Jackson & Pollock (7 e 3 dobras) e Petroski (1995) + Siri.
// A métrica principal é a SOMA em mm; as fórmulas têm erro alto com adipômetro de plástico.
import { S, measurementsList } from "./store.js";
import { num } from "./util.js";

// [id, nome, direção, onde fica, vista do desenho, x, y] — coordenadas no desenho de 120×256;
// de frente, o lado direito da pessoa fica à esquerda de quem olha; de costas, à direita
export const PONTOS_DOBRA = [
  ["peitoral", "Peitoral", "diagonal", "Na metade entre a frente da axila e o mamilo.", "frente", 50, 74],
  ["axilar_media", "Axilar média", "vertical", "Na linha do meio da axila, na altura da ponta do esterno.", "frente", 41, 92],
  ["triceps", "Tríceps", "vertical", "Atrás do braço, no meio entre o ombro e o cotovelo.", "costas", 91, 92],
  ["subescapular", "Subescapular", "diagonal", "2 cm abaixo da ponta de baixo da escápula.", "costas", 70, 96],
  ["abdominal", "Abdominal", "vertical", "2 cm à direita do umbigo.", "frente", 54, 118],
  ["suprailiaca", "Suprailíaca", "diagonal", "Logo acima do osso do quadril, na linha da frente da axila.", "frente", 45, 130],
  ["coxa", "Coxa", "vertical", "Na frente da coxa, no meio entre a virilha e a patela.", "frente", 50, 172],
  ["panturrilha_medial", "Panturrilha medial", "vertical", "Na parte de dentro da panturrilha, onde ela é mais grossa.", "frente", 55, 222],
  ["biceps", "Bíceps (opcional)", "vertical", "Na frente do braço, no meio.", "frente", 29, 98]
];
export const nomeDobra = k => (PONTOS_DOBRA.find(p => p[0] === k) || [, k])[1];
export const ponto = k => PONTOS_DOBRA.find(p => p[0] === k);

// Sozinho: 3 dobras que dá para medir em si mesmo (+ extras). Com ajuda: 7 dobras + panturrilha (Petroski).
export const PROTOCOLOS = {
  sozinho: { nome: "Sozinho (3 dobras)", pontos: ["peitoral", "abdominal", "coxa"], extras: ["panturrilha_medial", "suprailiaca"] },
  com_ajuda: { nome: "Com ajuda (7 dobras + Petroski)", pontos: ["peitoral", "axilar_media", "triceps", "subescapular", "abdominal", "suprailiaca", "coxa", "panturrilha_medial"], extras: ["biceps"] }
};
export const DIF_MAX_MM = 2;   // leituras do mesmo ponto diferindo mais que isso: pede a 4ª
export const PERTO_LIMITE = 45, DOBRA_GRANDE = 40;
export const FORA = "fora";    // leitura que não fechou (passou da abertura do aparelho)

export function adipometro(){
  const a = (S.saude && S.saude.adipometro) || {};
  return { modelo: a.modelo || "Adipômetro digital (plástico)", limite: num(a.limite) || 50 };
}

// Valor oficial = mediana das leituras; leitura "fora" conta como maior que todas
export function oficial(arr){
  const v = (arr || []).map(x => x === FORA ? Infinity : num(x)).filter(x => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2), med = v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  return med === Infinity ? FORA : med;
}
export const precisaQuarta = arr => { const v = (arr || []).filter(x => x !== FORA).map(num).filter(x => x != null); return v.length >= 2 && Math.max(...v) - Math.min(...v) > DIF_MAX_MM && arr.length < 4; };
export const valorDobra = (r, k) => r && r.leituras ? oficial(r.leituras[k]) : null;
export const dentro = (r, k) => { const v = valorDobra(r, k); return v != null && v !== FORA; };

export const dobrasList = () => Object.values(S.dobras || {}).sort((a, b) => (a.date || "").localeCompare(b.date || ""));

// Soma dos pontos que couberam no aparelho; "incompleta" se algum ponto medido passou do limite
export function soma(r, pontos){
  const ks = pontos || Object.keys(r.leituras || {});
  const ok = ks.filter(k => dentro(r, k)), fora = ks.filter(k => valorDobra(r, k) === FORA);
  return { mm: ok.reduce((s, k) => s + valorDobra(r, k), 0), pontos: ok, fora, incompleta: fora.length > 0 };
}
// Comparação justa: só os pontos que estão dentro da faixa nas duas medições
export function somaComum(a, b){
  const ks = Object.keys(a.leituras || {}).filter(k => dentro(a, k) && dentro(b, k));
  return ks.length ? { pontos: ks, a: soma(a, ks).mm, b: soma(b, ks).mm } : null;
}

/* ---------- aba Avançado: % de gordura (homens) ---------- */
function idadeEm(date){
  const n = S.profile && S.profile.nascimento; if (!n) return null;
  const a = new Date(n + "T12:00:00"), d = new Date(date + "T12:00:00");
  let i = d.getFullYear() - a.getFullYear(); if (d.getMonth() < a.getMonth() || (d.getMonth() === a.getMonth() && d.getDate() < a.getDate())) i--;
  return i;
}
const siri = dc => 495 / dc - 450;
const FORMULAS = [
  // Jackson & Pollock (1978), 7 dobras, homens
  { k: "JP7", nome: "Jackson & Pollock, 7 dobras", pontos: ["peitoral", "axilar_media", "triceps", "subescapular", "abdominal", "suprailiaca", "coxa"], dc: (s, i) => 1.112 - 0.00043499 * s + 0.00000055 * s * s - 0.00028826 * i },
  // Jackson & Pollock (1978), 3 dobras, homens
  { k: "JP3", nome: "Jackson & Pollock, 3 dobras", pontos: ["peitoral", "abdominal", "coxa"], dc: (s, i) => 1.10938 - 0.0008267 * s + 0.0000016 * s * s - 0.0002574 * i },
  // Petroski (1995), homens brasileiros, 4 dobras (coeficientes conferidos na Rev. Bras. Cineantropometria e Desempenho Humano)
  { k: "PETROSKI4", nome: "Petroski (homens brasileiros), 4 dobras", pontos: ["subescapular", "triceps", "suprailiaca", "panturrilha_medial"], dc: (s, i) => 1.10726863 - 0.00081201 * s + 0.00000212 * s * s - 0.00041761 * i }
];
export function percentuais(r){
  const masc = !(S.profile && S.profile.sexo === "F"), idade = idadeEm(r.date);
  return FORMULAS.map(f => {
    const falta = f.pontos.filter(k => !dentro(r, k));
    if (!masc || idade == null || falta.length) return { k: f.k, nome: f.nome, falta, pct: null };
    const s = f.pontos.reduce((a, k) => a + valorDobra(r, k), 0), pct = siri(f.dc(s, idade));
    return { k: f.k, nome: f.nome, falta: [], pct, somaMm: s };
  });
}
// Pesagem do mesmo dia ou de no máximo 1 dia de diferença
export function pesagemPerto(date){
  const t = d => new Date(d + "T12:00:00").getTime();
  return measurementsList().filter(m => num(m.peso) != null && Math.abs(t(m.date) - t(date)) <= 864e5).sort((a, b) => Math.abs(t(a.date) - t(date)) - Math.abs(t(b.date) - t(date)))[0] || null;
}

/* ---------- conquista: abdominal ou suprailíaca passou a caber (abaixo de 45 mm) ---------- */
export function conquista(){
  const ds = dobrasList(); if (ds.length < 2) return null;
  const u = ds[ds.length - 1], ant = ds[ds.length - 2];
  return ["abdominal", "suprailiaca"].filter(k => {
    const vu = valorDobra(u, k), va = valorDobra(ant, k);
    return vu != null && vu !== FORA && vu < PERTO_LIMITE && va != null && (va === FORA || va >= PERTO_LIMITE);
  }).map(nomeDobra);
}
