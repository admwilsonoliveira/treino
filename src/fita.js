// Medidas com fita (módulo Saúde): valor oficial de cada ponto, índices, % de gordura pela Marinha,
// metas de cintura e alerta do pescoço.
import { S } from "./store.js";
import { num, ymd } from "./util.js";

export const GRUPOS = [
  ["Tronco", [["cintura_umbigo", "Cintura (altura do umbigo)"], ["cintura_menor", "Cintura (parte mais fina)"], ["pescoco", "Pescoço"], ["quadril", "Quadril"], ["peito", "Peito (altura dos mamilos)"]]],
  ["Braços", [["braco_relaxado_dir", "Braço relaxado dir."], ["braco_relaxado_esq", "Braço relaxado esq."], ["braco_contraido_dir", "Braço contraído dir."], ["braco_contraido_esq", "Braço contraído esq."], ["antebraco_dir", "Antebraço dir."], ["antebraco_esq", "Antebraço esq."]]],
  ["Pernas", [["coxa_dir", "Coxa dir."], ["coxa_esq", "Coxa esq."], ["coxa_medial_dir", "Coxa medial dir."], ["coxa_medial_esq", "Coxa medial esq."], ["panturrilha_dir", "Panturrilha dir."], ["panturrilha_esq", "Panturrilha esq."]]]
];
export const PONTOS = GRUPOS.flatMap(g => g[1]);
export const nomePonto = k => (PONTOS.find(p => p[0] === k) || [, k])[1];
// Nos braços, aumentar ou manter é bom (músculo); nos outros pontos, diminuir é bom
export const ehBraco = k => k.startsWith("braco") || k.startsWith("antebraco");
export const DIF_MAX = 1; // cm entre as 2 leituras; acima disso, pede a 3ª

// Valor oficial: 1 leitura = ela; 2 = média; 3 ou mais = mediana
export function oficial(arr){
  const v = (arr || []).map(num).filter(x => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  if (v.length === 1) return v[0];
  if (v.length === 2) return (v[0] + v[1]) / 2;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
export const valorPonto = (f, k) => f && f.leituras ? oficial(f.leituras[k]) : null;

export const fitaList = () => Object.values(S.fita).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
// Gráficos e índices oficiais usam só medidas em jejum
export const fitaOficial = () => fitaList().filter(f => f.jejum);
export function ultimoValor(k, { soJejum = true } = {}){
  const f = (soJejum ? fitaOficial() : fitaList()).filter(x => valorPonto(x, k) != null).pop();
  return f ? { date: f.date, v: valorPonto(f, k), f } : null;
}

// % de gordura pelo método da Marinha americana (medidas em polegadas)
export function marinha(cintura, pescoco, alturaCm, sexo, quadril){
  const pol = x => x / 2.54;
  if (!cintura || !pescoco || !alturaCm) return null;
  if (sexo === "F"){
    if (!quadril) return null;
    const d = pol(cintura) + pol(quadril) - pol(pescoco); if (d <= 0) return null;
    return 163.205 * Math.log10(d) - 97.684 * Math.log10(pol(alturaCm)) - 78.387;
  }
  const d = pol(cintura) - pol(pescoco); if (d <= 0) return null;
  return 86.010 * Math.log10(d) - 70.041 * Math.log10(pol(alturaCm)) + 36.76;
}
export function indices(f){
  const alt = S.profile && num(S.profile.altura), sexo = S.profile && S.profile.sexo;
  const c = valorPonto(f, "cintura_umbigo"), q = valorPonto(f, "quadril"), p = valorPonto(f, "pescoco");
  return {
    cinturaAltura: c && alt ? c / alt : null,
    cinturaQuadril: c && q ? c / q : null,
    gorduraMarinha: marinha(c, p, alt, sexo === "F" ? "F" : "M", q)
  };
}

// Metas de cintura: as do usuário, ou abaixo de 100 → cintura/altura 0,55 → 0,50
export function metasCintura(){
  const sd = S.saude || {};
  if (Array.isArray(sd.metasCintura) && sd.metasCintura.length) return sd.metasCintura.slice().sort((a, b) => b - a);
  const alt = S.profile && num(S.profile.altura), base = baseCintura();
  if (!alt) return [];
  const m = [Math.round(alt * 0.55), Math.round(alt * 0.5)];
  if (base && base.v > 100) m.unshift(100);
  return m.filter((x, i, a) => a.indexOf(x) === i && (!base || x < base.v));
}
export const baseCintura = () => { const f = fitaOficial().find(x => valorPonto(x, "cintura_umbigo") != null); return f ? { date: f.date, v: valorPonto(f, "cintura_umbigo") } : null; };

// Pescoço acima de 43 cm: risco de apneia — no máximo um aviso por mês
export function alertaPescoco(){
  if (!(S.saude && S.saude.ativo)) return null;
  const u = ultimoValor("pescoco", { soJejum: false });
  if (!u || u.v <= 43) return null;
  if ((S.saude.pescocoAvisadoMes || "") === ymd(new Date()).slice(0, 7)) return null;
  return { titulo: "Pescoço acima de 43 cm", msg: "É um fator de risco para apneia do sono. Comente com o médico.", ok: "pescocoVisto" };
}
