// Módulo Saúde: ativação com consentimento (LGPD), exclusão e importação do histórico.
// Os dados de saúde são só de quem usa este aparelho; nunca entram no código nem vão para outro usuário.
import * as db from "./db.js";
import { S, flush, flushPending } from "./store.js";
import { num, norm, ddmm } from "./util.js";

export const TERMO_VERSAO = 1;
export const saudeAtiva = () => !!(S.saude && S.saude.ativo);

export function ativarSaude(){
  S.saude = Object.assign({ id: "saude" }, S.saude || {}, { ativo: true, consentimentoEm: new Date().toISOString(), termoVersao: TERMO_VERSAO });
  return flush("kv", "saude");
}

// Apaga doses, sintomas, eventos, medidas com fita, exames e a configuração. Treinos e pesagens ficam.
export async function apagarSaude(){
  await flushPending();
  await db.clearStores(db.SAUDE_STORES);
  db.SAUDE_STORES.forEach(n => { S[n] = {}; });
  S.saude = null;
  await flush("kv", "saude"); // sem objeto, o flush apaga o registro (e avisa o backup do Drive)
}

export const contagemSaude = () => Object.fromEntries(db.SAUDE_STORES.map(n => [n, Object.keys(S[n]).length]));

/* ---------- importação do histórico (arquivo JSON) ---------- */
const slug = s => norm(s).replace(/ /g, "_");
const DIA_SEMANA = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
const diasEntre = (a, b) => Math.abs((new Date(a + "T12:00:00") - new Date(b + "T12:00:00")) / 864e5);
const semNulos = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ""));

export function medicamentoDe(txt){
  const t = norm(txt);
  if (t.includes("tirzepatida") || t.includes("mounjaro")) return "tirzepatida";
  if (t.includes("semaglutida") || t.includes("ozempic") || t.includes("wegovy")) return "semaglutida";
  return t ? "outro" : null;
}

export function validarHistorico(d){
  if (!d || typeof d !== "object" || !d.perfil || !["doses", "composicao_corporal", "medidas_fita", "exames", "eventos"].some(k => Array.isArray(d[k])))
    return "Este arquivo não é um histórico de saúde no formato esperado.";
  return null;
}

// Monta o que seria gravado, sem gravar nada (para a prévia)
export function prepararHistorico(d){
  const meta = d._meta || {}, perfil = d.perfil || {};
  const novos = { doses: [], eventos: [], fita: [], exames: [], measurements: [] };
  const existentes = { doses: 0, eventos: 0, fita: 0, exames: 0, measurements: 0 };
  const ajustes = [], duvidosos = [];
  const add = (store, o) => { const atual = store === "measurements" ? S.measurements[o.id] : S[store][o.id]; if (atual) existentes[store]++; else novos[store].push(o); };
  const medPadrao = medicamentoDe(perfil.medicamento);

  (d.doses || []).forEach(x => {
    if (!x || !x.data) return;
    add("doses", semNulos({ id: "imp-dose-" + x.data, date: x.data, medicamento: medicamentoDe(x.medicamento) || medPadrao, doseMg: num(x.dose_mg),
      status: x.status || "aplicada", obs: x.observacao, obsImportacao: meta.doses_obs, origem: "importacao" }));
  });

  // pesagens: a mesma data que já existe no app é pulada
  const porData = {}; Object.values(S.measurements).forEach(m => { (porData[m.date] = porData[m.date] || []).push(m); });
  const comp = (d.composicao_corporal || []).filter(x => x && x.data).sort((a, b) => a.data.localeCompare(b.data));
  comp.forEach((x, i) => {
    const ja = porData[x.data] && porData[x.data][0], mu = num(x.musculo_kg);
    // sugestão (você confirma na prévia): músculo a mais de 1,5 kg da mediana das 4 leituras vizinhas,
    // ou marcado no próprio arquivo como "outlier_provavel"
    const viz = comp.slice(Math.max(0, i - 2), i).concat(comp.slice(i + 1, i + 3)).map(v => num(v.musculo_kg)).filter(v => v != null).sort((a, b) => a - b);
    const med = viz.length ? (viz.length % 2 ? viz[(viz.length - 1) / 2] : (viz[viz.length / 2 - 1] + viz[viz.length / 2]) / 2) : null;
    const id = ja ? ja.id : "imp-med-" + x.data;
    if (mu != null && (x.outlier_provavel || (med != null && Math.abs(mu - med) > 1.5)) && !(ja && (ja.duvidoso || []).includes("musculo")))
      duvidosos.push({ id, date: x.data, valor: mu, mediana: med });
    if (ja){ existentes.measurements++; return; }
    novos.measurements.push(semNulos({ id, date: x.data, peso: num(x.peso_kg), gorduraPct: num(x.gordura_pct), massaGorda: num(x.massa_gorda_kg),
      musculo: mu, agua: num(x.agua_pct), fonte: x.fonte, origem: "importacao" }));
  });

  (d.medidas_fita || []).forEach(x => {
    if (!x || !x.data) return;
    const leituras = {};
    Object.entries(x).forEach(([k, v]) => {
      if (!/_cm$/.test(k) || num(v) == null) return;
      const ponto = k.replace(/_cm$/, "") === "cintura" ? "cintura_umbigo" : k.replace(/_cm$/, "");
      leituras[ponto] = [num(v)];
    });
    const f = semNulos({ id: "imp-fita-" + x.data, date: x.data, jejum: x.jejum === true, leituras, obs: x.observacao, origem: "importacao" });
    add("fita", f);
    // cintura que estava na pesagem e é a mesma desta medida (até 3 dias de diferença): passa para a medida com fita
    const c = leituras.cintura_umbigo && leituras.cintura_umbigo[0];
    if (c != null) Object.values(S.measurements).forEach(m => {
      if (num(m.cintura) === c && diasEntre(m.date, x.data) <= 3)
        ajustes.push({ store: "measurements", id: m.id, desc: `Cintura de ${String(c).replace(".", ",")} cm da pesagem de ${ddmm(m.date)} passa para a medida com fita de ${ddmm(x.data)}${x.jejum ? "" : " (sem jejum)"}`,
          aplicar: mm => { mm.cinturaMovida = { valor: mm.cintura, para: f.id }; delete mm.cintura; } });
    });
  });

  (d.exames || []).forEach(x => {
    if (!x || !x.data || !x.exame) return;
    add("exames", semNulos({ id: "imp-ex-" + x.data + "-" + slug(x.exame) + "-" + slug(x.laboratorio).slice(0, 16), date: x.data, laboratorio: x.laboratorio, nome: x.exame,
      valor: num(x.valor), unidade: x.unidade, refMin: num(x.ref_min), refMax: num(x.ref_max), status: num(x.valor) == null ? "nao_liberado" : "liberado",
      obs: x.obs || (num(x.valor) == null ? x.status : null), origem: "importacao" }));
  });

  (d.eventos || []).forEach(x => {
    if (!x || !x.data) return;
    add("eventos", semNulos({ id: "imp-ev-" + x.data + "-" + slug(x.tipo) + "-" + slug(x.descricao).slice(0, 24), date: x.data, tipo: x.tipo || "outro", descricao: x.descricao, origem: "importacao" }));
  });

  // configuração da medicação: só preenche o que ainda não existe
  const atual = S.saude || {}, config = {};
  const cand = { medicamento: medPadrao, medicamentoNome: perfil.medicamento, inicioTratamento: perfil.inicio_tratamento, doseAtualMg: num(perfil.dose_atual_mg),
    diaFixo: DIA_SEMANA[norm(perfil.dia_aplicacao)], proximaDose: perfil.proxima_dose, suplementos: Array.isArray(perfil.suplementos) ? perfil.suplementos : null };
  Object.entries(cand).forEach(([k, v]) => { if (v != null && atual[k] == null) config[k] = v; });

  const alturaArq = num(perfil.altura_cm), alturaApp = S.profile ? num(S.profile.altura) : null;
  return { novos, existentes, ajustes, duvidosos, config, altura: alturaArq && alturaArq !== alturaApp ? { arquivo: alturaArq, app: alturaApp } : null };
}

// duvidosos: ids das pesagens cujo músculo o usuário confirmou como leitura duvidosa
export async function aplicarHistorico(prep, { usarAlturaArquivo = false, duvidosos = [] } = {}){
  const grava = [];
  Object.entries(prep.novos).forEach(([store, arr]) => arr.forEach(o => {
    (store === "measurements" ? S.measurements : S[store])[o.id] = o;
  }));
  prep.ajustes.forEach(a => { const m = S.measurements[a.id]; if (m) a.aplicar(m); });
  duvidosos.forEach(id => { const m = S.measurements[id]; if (m && !(m.duvidoso || []).includes("musculo")) m.duvidoso = (m.duvidoso || []).concat("musculo"); });
  const mexidas = new Set(prep.novos.measurements.map(o => o.id).concat(prep.ajustes.map(a => a.id), duvidosos));
  Object.entries(prep.novos).forEach(([store, arr]) => { if (store !== "measurements") arr.forEach(o => grava.push(flush(store, o.id))); });
  mexidas.forEach(id => { if (S.measurements[id]) grava.push(flush("measurements", id)); });
  if (Object.keys(prep.config).length){
    S.saude = Object.assign({}, S.saude, prep.config, { historicoImportadoEm: new Date().toISOString() });
    grava.push(flush("kv", "saude"));
  }
  if (usarAlturaArquivo && prep.altura && S.profile){ S.profile.altura = prep.altura.arquivo; grava.push(flush("kv", "profile")); }
  await Promise.all(grava);
}
