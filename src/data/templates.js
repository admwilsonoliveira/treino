// Modelos de plano prontos. O usuário escolhe um e pode editar tudo depois.
export const LETTERS = ["A", "B", "C", "D", "E"];
export const SPLITS = { ABC: 3, ABCD: 4, ABCDE: 5 };

export const WARMUP_COLUNA = [
  { t: "Esteira ou bike com tronco ereto, 5 min leve" },
  { t: "Gato-camelo suave, 5 a 6 ciclos", v: "gato camelo exercício lombar" },
  { t: "Ponte de glúteo, 2 × 10", v: "ponte de glúteo execução correta" },
  { t: "Curl-up modificado (Big 3 de McGill)", v: "curl up McGill execução" },
  { t: "Prancha lateral (Big 3 de McGill)", v: "prancha lateral McGill execução" },
  { t: "Bird dog (Big 3 de McGill)", v: "bird dog exercício execução" },
  { t: "Rotação torácica, 5 por lado", v: "rotação torácica quatro apoios exercício" }
];
export const WARMUP_GERAL = [
  { t: "Esteira ou bike, 5 min leve" },
  { t: "Mobilidade de ombros e quadril, 2 min", v: "mobilidade ombro quadril aquecimento musculação" },
  { t: "1 a 2 séries leves do primeiro exercício" }
];

const T = (exId, series, rx, rir, rest) => ({ exId, series, rx, rir, rest });

export const TEMPLATES = [
  {
    key: "abc_coluna",
    nome: "ABC com proteção da coluna",
    desc: "3 dias (seg, qua, sex). Corpo inteiro com ênfases diferentes, pensado para quem tem hérnia lombar.",
    split: "ABC", warmup: WARMUP_COLUNA,
    treinos: {
      A: { foco: "Quadríceps, empurrar e puxada", dias: [1], ex: [
        T("supino_halter", 3, "3 × 6–10", "RIR 1–2", 150), T("puxada_frontal", 3, "3 × 8–12", "RIR 1–2", 120),
        T("leg_press", 3, "3 × 8–12", "RIR 2", 150), T("desenv_maquina", 3, "3 × 8–12", "RIR 1–2", 120),
        T("extensora", 3, "2–3 × 10–15", "RIR 0–1", 90), T("mesa_flexora", 2, "2 × 10–15", "RIR 1", 90),
        T("pallof", 3, "3 × 10 por lado", "pausa 2 s", 45)] },
      B: { foco: "Posterior, glúteo e remada", dias: [3], ex: [
        T("remada_apoiada", 3, "3 × 8–12", "RIR 1–2", 120), T("supino_inclinado", 3, "3 × 8–12", "RIR 1–2", 120),
        T("rdl", 3, "3 × 8–10", "RIR 2–3", 150), T("hip_thrust", 3, "3 × 8–12", "RIR 1–2", 120),
        T("cadeira_flexora", 3, "3 × 10–15", "RIR 0–1", 90), T("elev_lateral", 3, "3 × 12–20", "RIR 0–1", 75),
        T("suitcase", 3, "3 × 30–40 m por lado", "carga em 1 mão", 60)] },
      C: { foco: "Unilateral, glúteo e braços", dias: [5], ex: [
        T("supino_maquina", 3, "3 × 8–12", "RIR 1–2", 120), T("puxada_neutra", 3, "3 × 10–12", "RIR 1–2", 120),
        T("bulgaro", 3, "3 × 8–12 por perna", "RIR 2", 120), T("remada_unilateral", 3, "3 × 10–12 por lado", "RIR 1–2", 90),
        T("abducao", 2, "2 × 12–20", "RIR 0–1", 60), T("rosca", 3, "3 × 10–15", "RIR 0–1", 75),
        T("triceps", 3, "3 × 10–15", "RIR 0–1", 75), T("farmer", 3, "3 × 30–40 m", "2 halteres", 60),
        T("dead_bug", 2, "2 × 6 por lado", "lento", 45), T("panturrilha", 3, "2–3 × 10–15", "RIR 0–1", 60)] }
    }
  },
  {
    key: "abcd_ss",
    nome: "ABCD superior e inferior",
    desc: "4 dias (seg, ter, qui, sex). Alterna parte de cima e parte de baixo do corpo.",
    split: "ABCD", warmup: WARMUP_GERAL,
    treinos: {
      A: { foco: "Superior: peito e costas", dias: [1], ex: [
        T("supino_halter", 3, "3 × 6–10", "RIR 1–2", 150), T("remada_apoiada", 3, "3 × 8–12", "RIR 1–2", 120),
        T("desenv_maquina", 3, "3 × 8–12", "RIR 1–2", 120), T("puxada_frontal", 3, "3 × 8–12", "RIR 1–2", 120),
        T("rosca_martelo", 2, "2 × 10–15", "RIR 0–1", 75), T("triceps", 2, "2 × 10–15", "RIR 0–1", 75)] },
      B: { foco: "Inferior: quadríceps", dias: [2], ex: [
        T("leg_press", 3, "3 × 8–12", "RIR 2", 150), T("bulgaro", 3, "3 × 8–12 por perna", "RIR 2", 120),
        T("extensora", 3, "3 × 10–15", "RIR 0–1", 90), T("mesa_flexora", 3, "3 × 10–15", "RIR 1", 90),
        T("panturrilha", 3, "3 × 10–15", "RIR 0–1", 60), T("pallof", 3, "3 × 10 por lado", "controle", 45)] },
      C: { foco: "Superior: ombros e braços", dias: [4], ex: [
        T("supino_inclinado", 3, "3 × 8–12", "RIR 1–2", 120), T("puxada_neutra", 3, "3 × 10–12", "RIR 1–2", 120),
        T("remada_baixa", 3, "3 × 10–12", "RIR 1–2", 90), T("elev_lateral", 3, "3 × 12–20", "RIR 0–1", 75),
        T("rosca", 3, "3 × 10–15", "RIR 0–1", 75), T("triceps_frances", 3, "3 × 10–15", "RIR 0–1", 75)] },
      D: { foco: "Inferior: posterior e glúteos", dias: [5], ex: [
        T("hip_thrust", 3, "3 × 8–12", "RIR 1–2", 120), T("rdl", 3, "3 × 8–10", "RIR 2–3", 150),
        T("cadeira_flexora", 3, "3 × 10–15", "RIR 0–1", 90), T("abducao", 3, "3 × 12–20", "RIR 0–1", 60),
        T("step_up", 2, "2 × 10 por perna", "RIR 2", 90), T("dead_bug", 2, "2 × 6 por lado", "lento", 45)] }
    }
  },
  {
    key: "abcde_grupos",
    nome: "ABCDE por grupo muscular",
    desc: "5 dias (seg a sex). Cada dia foca em um ou dois grupos musculares.",
    split: "ABCDE", warmup: WARMUP_GERAL,
    treinos: {
      A: { foco: "Peito e tríceps", dias: [1], ex: [
        T("supino_halter", 3, "3 × 6–10", "RIR 1–2", 150), T("supino_inclinado_maquina", 3, "3 × 8–12", "RIR 1–2", 120),
        T("peck_deck", 3, "3 × 10–15", "RIR 0–1", 75), T("triceps", 3, "3 × 10–15", "RIR 0–1", 75),
        T("triceps_frances", 3, "3 × 10–15", "RIR 0–1", 75)] },
      B: { foco: "Costas e bíceps", dias: [2], ex: [
        T("puxada_frontal", 3, "3 × 8–12", "RIR 1–2", 120), T("remada_apoiada", 3, "3 × 8–12", "RIR 1–2", 120),
        T("remada_unilateral", 3, "3 × 10–12 por lado", "RIR 1–2", 90), T("face_pull", 3, "3 × 12–15", "RIR 1", 60),
        T("rosca", 3, "3 × 10–15", "RIR 0–1", 75), T("rosca_martelo", 2, "2 × 10–15", "RIR 0–1", 75)] },
      C: { foco: "Quadríceps e panturrilha", dias: [3], ex: [
        T("leg_press", 4, "4 × 8–12", "RIR 2", 150), T("bulgaro", 3, "3 × 8–12 por perna", "RIR 2", 120),
        T("extensora", 3, "3 × 10–15", "RIR 0–1", 90), T("adutora", 3, "3 × 12–15", "RIR 1", 60),
        T("panturrilha", 4, "4 × 10–15", "RIR 0–1", 60)] },
      D: { foco: "Ombros e core", dias: [4], ex: [
        T("desenv_maquina", 3, "3 × 8–12", "RIR 1–2", 120), T("elev_lateral", 4, "4 × 12–20", "RIR 0–1", 75),
        T("crucifixo_inverso", 3, "3 × 12–15", "RIR 0–1", 60), T("pallof", 3, "3 × 10 por lado", "controle", 45),
        T("prancha_lateral", 3, "3 × 20–30 s por lado", "controle", 45), T("bird_dog", 2, "2 × 8 por lado", "lento", 45)] },
      E: { foco: "Posterior e glúteos", dias: [5], ex: [
        T("hip_thrust", 4, "4 × 8–12", "RIR 1–2", 120), T("rdl", 3, "3 × 8–10", "RIR 2–3", 150),
        T("mesa_flexora", 3, "3 × 10–15", "RIR 1", 90), T("cadeira_flexora", 3, "3 × 10–15", "RIR 0–1", 90),
        T("abducao", 3, "3 × 12–20", "RIR 0–1", 60)] }
    }
  }
];

export function emptyTreinos(split){
  const out = {}, n = SPLITS[split];
  const diasPadrao = { 3: [[1], [3], [5]], 4: [[1], [2], [4], [5]], 5: [[1], [2], [3], [4], [5]] }[n];
  LETTERS.slice(0, n).forEach((L, i) => { out[L] = { foco: "", dias: diasPadrao[i], ex: [] }; });
  return out;
}
