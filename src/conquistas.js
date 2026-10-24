// Micrometas (módulo Saúde): selos em marcos concretos, sem pontos nem níveis.
// Gravadas uma vez em S.saude.conquistas = { chave: { date, visto } }; nunca são retiradas.
import { S, flush, done, changeHooks } from "./store.js";
import { ymd, mondayOf } from "./util.js";
import { addDias } from "./medicacao.js";
import { refeicoesDo, totalDia, metas } from "./nutricao.js";
import { perdaTotal } from "./peso.js";
import { fitaOficial, valorPonto, baseCintura } from "./fita.js";
import { dobrasList, valorDobra, FORA, PERTO_LIMITE } from "./dobras.js";
import { fli, fliMensal } from "./exames.js";

const segundaAntes = n => { const m = mondayOf(new Date()); m.setDate(m.getDate() - 7 * n); return ymd(m); };
// as 4 semanas completas antes da atual (segunda a domingo)
const ultimas4 = () => [4, 3, 2, 1].map(n => { const ini = segundaAntes(n); return Array.from({ length: 7 }, (_, i) => addDias(ini, i)); });

function proteina4Semanas(){
  const piso = metas().prot.piso;
  return ultimas4().every(dias => {
    const com = dias.filter(d => refeicoesDo(d).length); if (com.length < 4) return false;
    return com.reduce((s, d) => s + (totalDia(d).t.prot || 0), 0) / com.length >= piso;
  });
}
const treinos4Semanas = () => ultimas4().every(dias => done().filter(s => s.type === "treino" && dias.includes(s.date)).length >= 3);
function cintura100(){
  const b = baseCintura(); if (!b || b.v < 100) return false;
  const u = fitaOficial().filter(f => valorPonto(f, "cintura_umbigo") != null).pop();
  return !!u && valorPonto(u, "cintura_umbigo") < 100;
}
function dobra45(){
  const ds = dobrasList().filter(r => valorDobra(r, "abdominal") != null); if (ds.length < 2) return false;
  const v = valorDobra(ds[ds.length - 1], "abdominal");
  return v !== FORA && v < PERTO_LIMITE && ds.slice(0, -1).some(r => { const a = valorDobra(r, "abdominal"); return a === FORA || a >= PERTO_LIMITE; });
}
function fli60(){
  const f = fli(); if (!f || f.valor >= 60) return false;
  return fliMensal(12).some(x => x.valor >= 60);
}

export const CONQUISTAS = [
  ["cintura100", "Cintura abaixo de 100 cm", "Medida em jejum, na altura do umbigo.", cintura100],
  ["menos15", "−15 kg", "Pela média de 7 dias, desde o início.", () => { const p = perdaTotal(); return !!p && p.kg <= -15; }],
  ["prot4", "4 semanas de proteína", "Média acima do piso em 4 semanas seguidas.", () => !!(S.refeicoes && Object.keys(S.refeicoes).length) && proteina4Semanas()],
  ["treino4", "4 semanas de força", "3 ou mais treinos em 4 semanas seguidas.", treinos4Semanas],
  ["dobra45", "Dobra abdominal abaixo de 45 mm", "Passou a caber no adipômetro.", dobra45],
  ["fli60", "FLI abaixo de 60", "Índice de gordura no fígado saiu da faixa de esteatose provável.", fli60]
];

// confere e grava as novas (uma vez por dia basta)
let conferidoEm = "";
changeHooks.push(store => { if (store !== "kv") conferidoEm = ""; }); // dado novo: confere de novo
export function conferirConquistas(){
  if (!(S.saude && S.saude.ativo)) return [];
  const hoje = ymd(new Date());
  if (conferidoEm !== hoje){
    conferidoEm = hoje;
    const c = S.saude.conquistas = S.saude.conquistas || {};
    let mudou = false;
    CONQUISTAS.forEach(([k, , , teste]) => { if (!c[k]){ let ok = false; try{ ok = teste(); }catch(e){} if (ok){ c[k] = { date: hoje, visto: false }; mudou = true; } } });
    if (mudou) flush("kv", "saude");
  }
  return CONQUISTAS.filter(([k]) => S.saude.conquistas && S.saude.conquistas[k]);
}
export const conquistasNovas = () => conferirConquistas().filter(([k]) => !S.saude.conquistas[k].visto);
export function marcarVistas(){ conquistasNovas().forEach(([k]) => { S.saude.conquistas[k].visto = true; }); flush("kv", "saude"); }
