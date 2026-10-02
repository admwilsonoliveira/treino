// Banco de exercícios do app.
// IMPORTANTE: os IDs ficam gravados nos registros de treino. Não renomeie IDs sem migrar os dados.
//
// lombar: "seguro"  = coluna apoiada ou sem carga axial relevante
//         "cuidado" = possível com técnica e carga moderada; observar a dor
//         "evitar"  = carga axial alta ou flexão repetida da coluna; evitar com hérnia lombar
// tipo:   "c" composto, "i" isolado, "core"
// load:false = sem carga (registra só repetições ou segundos)
// v: termo de busca no YouTube. video: link específico (opcional, pode ser definido pelo usuário no app)

export const GRUPOS = {
  peito: "Peito", costas: "Costas", ombros: "Ombros", biceps: "Bíceps", triceps: "Tríceps",
  quadriceps: "Quadríceps", posterior: "Posterior de coxa", gluteos: "Glúteos",
  panturrilha: "Panturrilha", core: "Core e abdômen", outros: "Outros"
};
export const EQUIP = {
  halter: "Halteres", barra: "Barra", maquina: "Máquina", cabo: "Cabo/polia", corpo: "Peso do corpo", elastico: "Elástico", kettlebell: "Kettlebell"
};
export const LOMBAR = {
  seguro: { label: "Seguro p/ lombar", cls: "" },
  cuidado: { label: "Cuidado c/ lombar", cls: "walk" },
  evitar: { label: "Evitar c/ hérnia", cls: "alert" }
};

const E = (id, nome, grupo, equip, lombar, tipo, nota, o = {}) => ({ id, nome, grupo, equip, lombar, tipo, nota, ...o });

export const EXERCISES = [
  // ---------- Peito ----------
  E("supino_halter", "Supino com halteres", "peito", "halter", "seguro", "c", "Apoie os halteres nas coxas e deite junto com eles. Nunca se curve para pegá-los do chão.", { v: "supino reto com halteres execução" }),
  E("supino_inclinado", "Supino inclinado 30°", "peito", "halter", "seguro", "c", "Mesmo cuidado para pegar e largar os halteres.", { v: "supino inclinado halteres execução" }),
  E("supino_maquina", "Supino máquina", "peito", "maquina", "seguro", "c", "Coluna apoiada.", { v: "supino máquina execução" }),
  E("supino_inclinado_maquina", "Supino inclinado na máquina", "peito", "maquina", "seguro", "c", "Costas inteiras no encosto."),
  E("supino_reto_barra", "Supino reto com barra", "peito", "barra", "cuidado", "c", "Pés firmes, glúteo no banco, sem exagerar o arco da lombar. Use apoio ou parceiro para tirar a barra."),
  E("supino_declinado", "Supino declinado", "peito", "barra", "cuidado", "c", "Entrar e sair da posição exige cuidado com a coluna."),
  E("crucifixo_halter", "Crucifixo com halteres", "peito", "halter", "seguro", "i", "Cotovelos levemente flexionados, desça até sentir alongar o peito."),
  E("peck_deck", "Crucifixo na máquina (peck deck)", "peito", "maquina", "seguro", "i", "Costas apoiadas, movimento controlado.", { v: "peck deck voador execução" }),
  E("crossover", "Crossover no cabo", "peito", "cabo", "seguro", "i", "Um pé à frente, tronco firme, sem balançar."),
  E("flexao", "Flexão de braço", "peito", "corpo", "seguro", "c", "Corpo em linha reta, abdômen firme. Pode apoiar os joelhos.", { load: false, v: "flexão de braço execução correta" }),
  E("paralelas", "Mergulho nas paralelas", "peito", "corpo", "cuidado", "c", "Tronco levemente inclinado. Use a versão assistida na máquina se necessário.", { v: "mergulho paralelas peito execução" }),
  E("pullover_halter", "Pullover com halter", "peito", "halter", "cuidado", "i", "Não deixe a lombar arquear ao levar o halter para trás."),

  // ---------- Costas ----------
  E("puxada_frontal", "Puxada frontal (pulley)", "costas", "cabo", "seguro", "c", "Tronco quase vertical, puxe com os cotovelos, sem balanço.", { v: "puxada frontal pulley execução correta" }),
  E("puxada_neutra", "Puxada pegada neutra", "costas", "cabo", "seguro", "c", "Tronco estável, sem balanço.", { v: "puxada pegada neutra execução" }),
  E("remada_apoiada", "Remada com apoio no peito", "costas", "maquina", "seguro", "c", "O apoio no peito tira a carga da lombar.", { v: "remada com apoio no peito execução" }),
  E("remada_unilateral", "Remada unilateral no banco", "costas", "halter", "seguro", "c", "Mão e joelho no banco, coluna neutra, sem girar o tronco.", { v: "remada unilateral serrote halter execução" }),
  E("remada_baixa", "Remada baixa sentada (cabo)", "costas", "cabo", "seguro", "c", "Tronco ereto e parado. Não incline para frente e para trás.", { v: "remada baixa sentada triângulo execução" }),
  E("remada_maquina", "Remada na máquina", "costas", "maquina", "seguro", "c", "Peito no apoio, puxe com os cotovelos."),
  E("barra_fixa", "Barra fixa", "costas", "corpo", "seguro", "c", "Pendurar alivia a coluna. Sem balanço nem chute.", { load: false, v: "barra fixa execução correta" }),
  E("barra_assistida", "Barra fixa assistida (gravitron)", "costas", "maquina", "seguro", "c", "Registre a carga de assistência.", { v: "barra fixa assistida máquina execução" }),
  E("pulldown_braco_reto", "Pulldown com braço estendido", "costas", "cabo", "seguro", "i", "Leve inclinação do tronco, braços quase retos."),
  E("face_pull", "Face pull", "costas", "cabo", "seguro", "i", "Puxe a corda na altura do rosto, abrindo os cotovelos. Ótimo para postura."),
  E("remada_curvada_barra", "Remada curvada com barra", "costas", "barra", "evitar", "c", "Tronco inclinado sem apoio sobrecarrega a lombar. Prefira a remada com apoio no peito."),
  E("remada_cavalinho", "Remada cavalinho (T-bar)", "costas", "barra", "evitar", "c", "Prefira a versão com apoio no peito."),
  E("levantamento_terra", "Levantamento terra convencional", "costas", "barra", "evitar", "c", "Carga alta na coluna. Com hérnia, só com liberação e acompanhamento profissional."),
  E("hiperextensao", "Hiperextensão no banco romano", "costas", "corpo", "cuidado", "i", "Movimento curto, sem passar da linha do corpo. Pare se doer.", { load: false, v: "hiperextensão lombar banco romano execução" }),
  E("encolhimento", "Encolhimento com halteres", "costas", "halter", "cuidado", "i", "Tronco ereto, só os ombros sobem."),

  // ---------- Ombros ----------
  E("desenv_maquina", "Desenvolvimento na máquina", "ombros", "maquina", "seguro", "c", "Costas inteiras apoiadas, sem arquear a lombar para empurrar.", { v: "desenvolvimento máquina sentado execução" }),
  E("desenv_halter", "Desenvolvimento com halteres sentado", "ombros", "halter", "seguro", "c", "Banco com encosto quase vertical, lombar apoiada."),
  E("arnold", "Desenvolvimento Arnold", "ombros", "halter", "seguro", "c", "Sentado com encosto.", { v: "desenvolvimento arnold execução" }),
  E("desenv_barra_pe", "Desenvolvimento com barra em pé", "ombros", "barra", "evitar", "c", "Carga sobre a cabeça em pé comprime a coluna. Prefira sentado com encosto."),
  E("elev_lateral", "Elevação lateral", "ombros", "halter", "seguro", "i", "Pode fazer sentado com encosto.", { v: "elevação lateral halteres execução" }),
  E("elev_lateral_cabo", "Elevação lateral no cabo", "ombros", "cabo", "seguro", "i", "Tronco parado, suba até a linha do ombro."),
  E("elev_frontal", "Elevação frontal", "ombros", "halter", "seguro", "i", "Sem jogar o corpo para trás."),
  E("crucifixo_inverso", "Crucifixo inverso na máquina", "ombros", "maquina", "seguro", "i", "Peito no apoio, abra os braços com controle.", { v: "crucifixo inverso máquina execução" }),
  E("remada_alta", "Remada alta", "ombros", "cabo", "cuidado", "i", "Pegada mais aberta e só até a linha do peito, para proteger o ombro."),

  // ---------- Bíceps ----------
  E("rosca", "Rosca bíceps sentado", "biceps", "halter", "seguro", "i", "Sentado com encosto.", { v: "rosca bíceps banco inclinado execução" }),
  E("rosca_martelo", "Rosca martelo", "biceps", "halter", "seguro", "i", "Cotovelos colados ao corpo, sem balanço."),
  E("rosca_scott", "Rosca Scott", "biceps", "maquina", "seguro", "i", "Braço apoiado, sem tirar o cotovelo do banco."),
  E("rosca_cabo", "Rosca no cabo", "biceps", "cabo", "seguro", "i", "Tronco parado."),
  E("rosca_concentrada", "Rosca concentrada", "biceps", "halter", "seguro", "i", "Sentado, cotovelo apoiado na coxa."),
  E("rosca_direta", "Rosca direta com barra", "biceps", "barra", "cuidado", "i", "Em pé: não jogue o tronco para trás para subir a carga."),

  // ---------- Tríceps ----------
  E("triceps", "Tríceps na polia", "triceps", "cabo", "seguro", "i", "Tronco ereto, sem jogar o corpo.", { v: "tríceps polia corda execução" }),
  E("triceps_frances", "Tríceps francês sentado", "triceps", "halter", "seguro", "i", "Banco com encosto, sem arquear a lombar."),
  E("triceps_testa", "Tríceps testa", "triceps", "barra", "seguro", "i", "Deitado, cotovelos apontando para cima."),
  E("triceps_corda_acima", "Tríceps no cabo acima da cabeça", "triceps", "cabo", "seguro", "i", "Abdômen firme, sem arquear a lombar."),
  E("triceps_coice", "Tríceps coice", "triceps", "halter", "seguro", "i", "Apoie a mão e o joelho no banco."),
  E("triceps_banco", "Mergulho no banco", "triceps", "corpo", "seguro", "i", "Desça até 90° no cotovelo.", { load: false, v: "tríceps banco mergulho execução" }),

  // ---------- Quadríceps ----------
  E("leg_press", "Leg press 45°", "quadriceps", "maquina", "seguro", "c", "Lombar e sacro colados no encosto. Desça só até antes do quadril rolar.", { v: "leg press 45 execução correta lombar" }),
  E("leg_press_horizontal", "Leg press horizontal", "quadriceps", "maquina", "seguro", "c", "Lombar colada no encosto."),
  E("extensora", "Cadeira extensora", "quadriceps", "maquina", "seguro", "i", "Isolamento seguro para a coluna, pode ir perto da falha.", { v: "cadeira extensora execução" }),
  E("bulgaro", "Agachamento búlgaro", "quadriceps", "halter", "seguro", "c", "Halteres ao lado do corpo. Comece só com o peso do corpo.", { unit: "kg/mão", v: "agachamento búlgaro halteres execução" }),
  E("step_up", "Subida no banco (step-up)", "quadriceps", "halter", "seguro", "c", "Halteres ao lado do corpo, suba com a perna da frente.", { unit: "kg/mão" }),
  E("agachamento_goblet", "Agachamento goblet", "quadriceps", "halter", "cuidado", "c", "Peso junto ao peito, tronco alto. Desça só até onde a coluna fica neutra."),
  E("hack", "Agachamento hack", "quadriceps", "maquina", "cuidado", "c", "Costas apoiadas, mas a carga passa pelos ombros. Comece leve.", { v: "hack machine agachamento execução" }),
  E("agachamento_smith", "Agachamento no Smith", "quadriceps", "maquina", "cuidado", "c", "Barra nas costas comprime a coluna. Prefira leg press se doer."),
  E("afundo", "Afundo com halteres", "quadriceps", "halter", "cuidado", "c", "Tronco ereto, passos controlados.", { unit: "kg/mão" }),
  E("agachamento_livre", "Agachamento livre com barra", "quadriceps", "barra", "evitar", "c", "Carga axial alta na coluna. Prefira leg press ou búlgaro."),
  E("agachamento_frontal", "Agachamento frontal com barra", "quadriceps", "barra", "evitar", "c", "Carga axial alta na coluna."),
  E("adutora", "Cadeira adutora", "outros", "maquina", "seguro", "i", "Costas apoiadas, movimento controlado.", { v: "cadeira adutora execução" }),

  // ---------- Posterior de coxa ----------
  E("mesa_flexora", "Mesa flexora", "posterior", "maquina", "seguro", "i", "Não deixe o quadril subir. Se incomodar a lombar, troque pela cadeira flexora.", { v: "mesa flexora execução correta" }),
  E("cadeira_flexora", "Cadeira flexora", "posterior", "maquina", "seguro", "i", "Isolamento seguro.", { v: "cadeira flexora execução" }),
  E("flexora_em_pe", "Flexora em pé unilateral", "posterior", "maquina", "seguro", "i", "Apoie bem o tronco na máquina."),
  E("rdl", "Terra romeno com halteres", "posterior", "halter", "cuidado", "c", "Halteres colados nas coxas, quadril para trás, coluna neutra. No começo use o pull-through no cabo.", { v: "levantamento terra romeno halteres execução coluna neutra" }),
  E("pull_through", "Pull-through no cabo", "posterior", "cabo", "cuidado", "c", "Dobradiça de quadril com carga leve, ótima para aprender o movimento.", { v: "pull through cabo execução" }),
  E("stiff_barra", "Stiff com barra", "posterior", "barra", "evitar", "c", "Carga alta longe do corpo. Prefira o terra romeno com halteres leve."),
  E("bom_dia", "Bom dia (good morning)", "posterior", "barra", "evitar", "c", "Barra nas costas com tronco inclinado. Evitar com hérnia."),
  E("nordic", "Flexão nórdica", "posterior", "corpo", "cuidado", "i", "Desça devagar, com o quadril estendido.", { load: false, v: "nordic curl flexão nórdica execução" }),

  // ---------- Glúteos ----------
  E("hip_thrust", "Hip thrust", "gluteos", "barra", "seguro", "c", "Termine com o quadril estendido, sem arquear a lombar. Pausa de 1 s em cima.", { v: "hip thrust execução correta" }),
  E("ponte_gluteo", "Ponte de glúteo", "gluteos", "corpo", "seguro", "i", "Contraia o glúteo em cima, sem arquear a lombar.", { v: "ponte de glúteo execução correta" }),
  E("ponte_unilateral", "Ponte de glúteo unilateral", "gluteos", "corpo", "seguro", "i", "Pelve nivelada durante todo o movimento.", { load: false }),
  E("abducao", "Abdução de quadril", "gluteos", "maquina", "seguro", "i", "Glúteo médio estabiliza a pelve na caminhada.", { v: "cadeira abdutora execução" }),
  E("abducao_elastico", "Abdução com elástico", "gluteos", "elastico", "seguro", "i", "Pode ser em pé, deitado de lado ou sentado.", { load: false }),
  E("gluteo_cabo", "Glúteo no cabo (coice)", "gluteos", "cabo", "seguro", "i", "Tronco firme, sem arquear a lombar ao estender o quadril."),
  E("gluteo_maquina", "Glúteo na máquina", "gluteos", "maquina", "seguro", "i", "Movimento controlado, sem jogar a lombar.", { v: "glúteo máquina coice execução" }),

  // ---------- Panturrilha ----------
  E("panturrilha", "Panturrilha sentado", "panturrilha", "maquina", "seguro", "i", "Sem carga na coluna.", { v: "panturrilha sentado execução" }),
  E("panturrilha_leg", "Panturrilha no leg press", "panturrilha", "maquina", "seguro", "i", "Lombar apoiada."),
  E("panturrilha_em_pe", "Panturrilha em pé na máquina", "panturrilha", "maquina", "cuidado", "i", "Os apoios nos ombros comprimem a coluna. Prefira sentado."),

  // ---------- Core ----------
  E("pallof", "Pallof press", "core", "cabo", "seguro", "core", "Resista à rotação. Tronco parado, braços estendem e voltam.", { v: "pallof press execução" }),
  E("suitcase", "Suitcase carry", "core", "halter", "seguro", "core", "Tronco alto, sem inclinar para o lado do peso. Pegue o halter de um banco.", { v: "suitcase carry execução" }),
  E("farmer", "Farmer carry", "core", "halter", "seguro", "core", "Rigidez total do tronco, passos curtos.", { unit: "kg/mão", v: "farmer walk execução" }),
  E("dead_bug", "Dead bug", "core", "corpo", "seguro", "core", "Lombar encostada sem pressionar com força.", { load: false, v: "dead bug exercício execução" }),
  E("bird_dog", "Bird dog", "core", "corpo", "seguro", "core", "Estenda braço e perna opostos, sem girar o quadril.", { load: false, v: "bird dog exercício execução" }),
  E("curl_up", "Curl-up modificado (McGill)", "core", "corpo", "seguro", "core", "Uma perna dobrada, mãos sob a lombar, eleve só a cabeça e os ombros.", { load: false, v: "curl up McGill execução" }),
  E("prancha", "Prancha frontal", "core", "corpo", "seguro", "core", "Registre os segundos no campo de repetições.", { load: false, v: "prancha abdominal execução correta" }),
  E("prancha_lateral", "Prancha lateral", "core", "corpo", "seguro", "core", "Registre os segundos no campo de repetições.", { load: false, v: "prancha lateral McGill execução" }),
  E("roda_abdominal", "Roda abdominal", "core", "corpo", "cuidado", "core", "Amplitude curta e sem deixar a lombar afundar.", { load: false }),
  E("elevacao_pernas", "Elevação de pernas", "core", "corpo", "cuidado", "core", "Mãos sob a lombar e joelhos dobrados para reduzir a tensão.", { load: false }),
  E("abdominal_supra", "Abdominal supra tradicional", "core", "corpo", "evitar", "core", "Flexão repetida da coluna. Prefira curl-up de McGill ou dead bug.", { load: false }),
  E("abdominal_remador", "Abdominal remador", "core", "corpo", "evitar", "core", "Flexão repetida da coluna.", { load: false }),
  E("russian_twist", "Russian twist", "core", "corpo", "evitar", "core", "Rotação com a coluna flexionada. Prefira o Pallof press.", { load: false }),
  E("abdominal_maquina", "Abdominal na máquina", "core", "maquina", "evitar", "core", "Flexão da coluna com carga.")
];

export const EX_BASE_BY_ID = Object.fromEntries(EXERCISES.map(e => [e.id, e]));

// Prescrição padrão sugerida quando o exercício é adicionado a um treino
export function defaultRx(ex){
  if (ex.tipo === "core") return { series: 3, rx: "3 × 10–12", rir: "controle" };
  if (ex.tipo === "i") return { series: 3, rx: "3 × 10–15", rir: "RIR 0–1" };
  return { series: 3, rx: "3 × 8–12", rir: "RIR 1–2" };
}
