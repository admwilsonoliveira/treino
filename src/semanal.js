// Relatório semanal (segunda a domingo): peso, doses, sintomas, medidas, alimentação, vitaminas, treinos,
// sono e estresse, alertas. É recalculado dos registros a qualquer momento; o que fica guardado é só a lista
// de alertas que estavam ativos quando a semana fechou (S.saude.alertasSemana[segunda]), porque essa não dá para refazer.
import { S, done, flush, kcalFor } from "./store.js";
import { num, fmtNum, ymd, ddmm, ddmmyyyy, mondayOf } from "./util.js";
import { addDias, aplicadas, nomeLocal, sintomasList, nomeSintoma, alertasSeguranca } from "./medicacao.js";
import { media7, pesagens, valorEm } from "./peso.js";
import { fitaList, valorPonto } from "./fita.js";
import { dobrasList, soma } from "./dobras.js";
import { refeicoesDo, totalDia, aguaTotal, aguaDo, metas } from "./nutricao.js";
import { analise } from "./vitaminas.js";
import { bancoPronto } from "./alimentos.js";
import { habitosList } from "./habitos.js";
import { filaAlertas } from "./alertas.js";
import { duracaoMin } from "./forca.js";

const f = (v, d = 1) => (v == null || !isFinite(v) ? "–" : fmtNum(v, d));
const sn = (v, d = 1) => (v == null || !isFinite(v) ? "–" : (v > 0 ? "+" : v < 0 ? "−" : "") + fmtNum(Math.abs(v), d));
const media = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
export const segundaDe = date => ymd(mondayOf(new Date(date + "T12:00:00")));
export const semanaAtual = () => segundaDe(ymd(new Date()));
const diasDa = ini => Array.from({ length: 7 }, (_, i) => addDias(ini, i));

// fecha a semana anterior: guarda os alertas ativos (uma vez por semana; chamado ao abrir o Hoje)
export function fecharSemana(){
  if (!(S.saude && S.saude.ativo)) return;
  const agora = new Date(), domingoNoite = agora.getDay() === 0 && agora.getHours() >= 20;
  const ini = domingoNoite ? semanaAtual() : addDias(semanaAtual(), -7);
  const g = S.saude.alertasSemana = S.saude.alertasSemana || {};
  if (g[ini]) return;
  g[ini] = alertasSeguranca().map(a => a.titulo).concat(filaAlertas().map(a => a.titulo));
  Object.keys(g).sort().slice(0, -26).forEach(k => delete g[k]); // guarda até 26 semanas
  flush("kv", "saude");
}

export function resumoSemana(ini = semanaAtual()){
  const dias = diasDa(ini), fim = dias[6], hoje = ymd(new Date()), naSemana = x => x.date >= ini && x.date <= fim;
  const andamento = fim >= hoje, secoes = [];
  const sec = t => { const s = { t, paragrafos: [], tabelas: [], notas: [] }; secoes.push(s); return s; };

  // peso
  const pes = pesagens().filter(naSemana), mFim = valorEm(andamento ? hoje : fim), mIni = valorEm(addDias(ini, -1));
  const s1 = sec("Peso");
  s1.paragrafos.push(pes.length ? `Média de 7 dias: ${f(mIni)} → ${f(mFim)} kg (${sn(mFim != null && mIni != null ? mFim - mIni : null, 2)} kg na semana). ${pes.length} pesage${pes.length === 1 ? "m" : "ns"}.` : "Sem pesagem nesta semana.");

  // medicação
  const ds = aplicadas().filter(naSemana), ss = sintomasList().filter(naSemana);
  const s2 = sec("Medicação e efeitos colaterais");
  s2.paragrafos.push(ds.length ? ds.map(d => `Dose ${ddmm(d.date)}${d.doseMg ? ": " + f(num(d.doseMg)) + " mg" : ""}${d.local ? " (" + nomeLocal(d.local) + ")" : ""}`).join(" · ") : "Nenhuma dose registrada.");
  if (ss.length) s2.tabelas.push({ head: ["Data", "Sintoma", "Intensidade (0–10)"], body: ss.map(x => [ddmm(x.date), nomeSintoma(x.tipo), x.intensidade != null ? x.intensidade : "–"]) });
  else s2.paragrafos.push("Nenhum sintoma registrado.");

  // medidas
  const fs = fitaList().filter(naSemana), dbs = dobrasList().filter(naSemana);
  if (fs.length || dbs.length){
    const s3 = sec("Medidas e dobras");
    fs.forEach(x => s3.paragrafos.push(`Fita ${ddmm(x.date)}${x.jejum ? " (jejum)" : ""}: cintura ${f(valorPonto(x, "cintura_umbigo"))} cm, quadril ${f(valorPonto(x, "quadril"))} cm, pescoço ${f(valorPonto(x, "pescoco"))} cm.`));
    dbs.forEach(x => { const sm = soma(x); s3.paragrafos.push(`Dobras ${ddmm(x.date)}: soma ${sm ? (sm.incompleta ? "≥ " : "") + f(sm.mm, 0) : "–"} mm.`); });
  }

  // alimentação
  const comReg = dias.filter(d => refeicoesDo(d).length), comAgua = dias.filter(d => aguaDo(d).length), m = metas();
  const s4 = sec("Alimentação");
  s4.paragrafos.push(comReg.length ? `${comReg.length} dia${comReg.length === 1 ? "" : "s"} com registro. Médias: proteína ${f(media(comReg.map(d => totalDia(d).t.prot || 0)), 0)} g (piso ${m.prot.piso} g), ${f(media(comReg.map(d => totalDia(d).t.kcal || 0)), 0)} kcal, fibra ${f(media(comReg.map(d => totalDia(d).t.fibra || 0)), 0)} g.` : "Sem refeições registradas.");
  if (comAgua.length) s4.paragrafos.push(`Água: média de ${f(media(comAgua.map(aguaTotal)) / 1000)} L por dia (meta ${f(m.agua / 1000)} L).`);
  if (bancoPronto()){
    const v = analise(andamento ? hoje : fim);
    if (v.ok) s4.tabelas.push({ t: "Vitaminas e minerais (nutrientes-alvo)", head: ["Nutriente", "Média/dia", "Referência", "%", "Situação"], body: v.itens.map(x => [x.nome, f(x.media, x.k === "omega3" ? 0 : 1) + " " + x.un, f(x.meta, x.meta < 10 ? 1 : 0) + " " + x.un, f(x.pct, 0) + "%", x.classe === "baixo" ? "baixo" : x.classe === "atencao" ? "atenção" : x.classe === "ok" ? "ok" : "–"]) });
  }

  // treinos
  const ts = done().filter(s => s.type === "treino" && naSemana(s)), cs = done().filter(s => s.type === "caminhada" && naSemana(s));
  const s5 = sec("Treinos e caminhadas");
  s5.paragrafos.push(`${ts.length} treino${ts.length === 1 ? "" : "s"} de força${ts.length ? ` (${ts.map(t => (t.treino || "") + " " + ddmm(t.date) + (duracaoMin(t) ? ", " + Math.round(duracaoMin(t)) + " min" : "")).join(" · ")})` : ""}. ${cs.length} caminhada${cs.length === 1 ? "" : "s"}, ${f(cs.reduce((a, s) => a + (num(s.km) || 0), 0))} km. Gasto estimado com exercício: ${f(ts.concat(cs).reduce((a, s) => a + (kcalFor(s) || 0), 0), 0)} kcal.`);

  // hábitos
  const hs = habitosList().filter(naSemana);
  if (hs.length){
    const mm = k => media(hs.map(h => num(h[k])).filter(v => v != null));
    sec("Sono, estresse e humor").paragrafos.push(`${hs.length} check-in${hs.length === 1 ? "" : "s"}. Sono ${f(mm("sonoH"))} h (qualidade ${f(mm("sonoQ"))}/5) · estresse ${f(mm("estresse"))}/5 · fome ${f(mm("fome"))}/5 · humor ${f(mm("humor"))}/5${mm("passos") != null ? " · " + Math.round(mm("passos")).toLocaleString("pt-BR") + " passos/dia" : ""}${hs.some(h => num(h.alcool)) ? " · álcool " + f(hs.reduce((a, h) => a + (num(h.alcool) || 0), 0)) + " doses" : ""}.`);
  }

  // alertas
  const guardados = S.saude && S.saude.alertasSemana && S.saude.alertasSemana[ini];
  const al = guardados || (andamento ? alertasSeguranca().map(a => a.titulo).concat(filaAlertas().map(a => a.titulo)) : null);
  sec("Alertas").paragrafos.push(al ? (al.length ? al.join(" · ") : "Nenhum alerta.") : "Sem registro dos alertas desta semana.");

  return { titulo: "Relatório da semana", sub: `${ddmmyyyy(ini)} a ${ddmmyyyy(fim)}${andamento ? " (semana em andamento)" : ""}`, ini, fim, andamento, secoes };
}
