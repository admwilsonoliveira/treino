// Programa de 12 semanas (periodização), repetido em ciclos.
// Semanas 1–2 adaptação; 3–6 acúmulo 1; 7 deload; 8–11 acúmulo 2; 12 deload + reavaliação.
import { ymd, mondayOf } from "./util.js";

export const FASES = [
  { de: 1, ate: 2, nome: "Adaptação", rir: "RIR 3", nota: "Foco na técnica. Exercícios compostos com 2 séries.", seriesCompostos: 2 },
  { de: 3, ate: 6, nome: "Acúmulo 1", rir: "RIR 2 → 1", nota: "Séries completas. Busque subir repetições ou carga a cada semana." },
  { de: 7, ate: 7, nome: "Deload", rir: "RIR 4", nota: "Semana leve: metade das séries e carga confortável. O corpo consolida o que ganhou.", deload: true },
  { de: 8, ate: 11, nome: "Acúmulo 2", rir: "RIR 1–2", nota: "Volta ao volume completo. Se estiver tudo bem com a coluna, pode somar 1 série em costas, quadríceps e peito." },
  { de: 12, ate: 12, nome: "Deload e reavaliação", rir: "RIR 4", nota: "Semana leve e hora de registrar peso e bioimpedância para comparar com o início.", deload: true }
];

// Programa do plano: ligado por padrão, começando na segunda-feira da semana em que o plano foi criado
export function programaDe(p){
  const prog = (p && p.programa) || {};
  const inicio = prog.inicio || ymd(mondayOf(new Date((p && p.criado) || Date.now())));
  return { ativo: prog.ativo !== false, inicio };
}

export function semanaInfo(p, data = new Date()){
  const prog = programaDe(p);
  if (!p || !prog.ativo) return null;
  const ini = new Date(prog.inicio + "T00:00:00"), hoje = mondayOf(data);
  const semanas = Math.floor((hoje - ini) / (7 * 86400000));
  if (semanas < 0) return { antes: true, inicio: prog.inicio };
  const ciclo = Math.floor(semanas / 12) + 1, semana = (semanas % 12) + 1;
  const fase = FASES.find(f => semana >= f.de && semana <= f.ate);
  return { ciclo, semana, fase, inicio: prog.inicio };
}

// Quantas séries fazer nesta semana (a prescrição do plano é a do volume completo)
export function seriesNaSemana(it, ex, info){
  const n = it.series || 3;
  if (!info || !info.fase) return n;
  if (info.fase.deload) return Math.max(1, Math.ceil(n / 2));
  if (info.fase.seriesCompostos && ex.tipo === "c") return Math.min(n, info.fase.seriesCompostos);
  return n;
}
