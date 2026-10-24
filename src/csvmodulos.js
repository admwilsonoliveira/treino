// CSV por módulo (para abrir no Excel em português): separador ";", vírgula decimal e BOM UTF-8.
import { S, measurementsList } from "./store.js";
import { num, ymd, downloadBlob } from "./util.js";
import { dosesList, nomeLocal, sintomasList, nomeSintoma } from "./medicacao.js";
import { eventosList, nomeEvento } from "./peso.js";
import { fitaList, PONTOS, valorPonto } from "./fita.js";
import { dobrasList, PONTOS_DOBRA, valorDobra, soma } from "./dobras.js";
import { examesList, padrao } from "./exames.js";
import { NUTRIENTES } from "./alimentos.js";
import { nomeTipo } from "./nutricao.js";
import { habitosList } from "./habitos.js";

const v = x => { if (x == null || x === "") return ""; if (typeof x === "number") return String(Math.round(x * 100) / 100).replace(".", ","); const s = String(x); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = (head, rows) => "﻿" + [head].concat(rows).map(r => r.map(v).join(";")).join("\r\n");
const nn = x => num(x);
const NUT = NUTRIENTES.slice(0, 8); // energia, macros, fibra e sódio bastam no CSV; o resto está no relatório

export const MODULOS_CSV = [
  ["pesagens", "Pesagens", () => csv(["Data", "Hora", "Peso (kg)", "Gordura (%)", "Massa gorda (kg)", "Músculo esquelético (kg)", "Água (%)", "Cintura (cm)", "Jejum", "Fonte"],
    measurementsList().filter(m => nn(m.peso) != null).map(m => [m.date, m.hora, nn(m.peso), nn(m.gorduraPct), nn(m.massaGorda), nn(m.musculo), nn(m.agua), nn(m.cintura), m.jejum ? "sim" : "", m.fonte]))],
  ["doses", "Doses", () => csv(["Data", "Hora", "Situação", "Dose (mg)", "Local", "Medicamento", "Observação"], dosesList().map(d => [d.date, d.hora, d.status, nn(d.doseMg), nomeLocal(d.local), d.medicamento, d.obs]))],
  ["sintomas", "Sintomas", () => csv(["Data", "Hora", "Sintoma", "Intensidade (0-10)", "Observação"], sintomasList().map(s => [s.date, s.hora, nomeSintoma(s.tipo), s.intensidade, s.obs]))],
  ["fita", "Medidas com fita", () => csv(["Data", "Jejum"].concat(PONTOS.map(p => p[1] + " (cm)")), fitaList().map(f => [f.date, f.jejum ? "sim" : "não"].concat(PONTOS.map(p => valorPonto(f, p[0])))))],
  ["dobras", "Dobras cutâneas", () => csv(["Data", "Protocolo", "Soma (mm)", "Incompleta"].concat(PONTOS_DOBRA.map(p => p[1] + " (mm)")), dobrasList().map(r => { const s = soma(r); return [r.date, r.protocolo, s.mm, s.incompleta ? "sim" : ""].concat(PONTOS_DOBRA.map(p => valorDobra(r, p[0]))); }))],
  ["exames", "Exames", () => csv(["Data", "Exame (como no laudo)", "Exame (padronizado)", "Grupo", "Valor", "Unidade", "Ref. mínima", "Ref. máxima", "Laboratório", "Situação"],
    examesList().map(x => [x.date, x.nome, padrao(x.nome).nome, padrao(x.nome).grupo, nn(x.valor), x.unidade, nn(x.refMin), nn(x.refMax), x.laboratorio, x.valor == null ? "pendente" : ""]))],
  ["refeicoes", "Refeições (um alimento por linha)", () => csv(["Data", "Hora", "Refeição", "Alimento", "Quantidade (g)"].concat(NUT.map(n => n[1] + " (" + n[2] + ")")),
    Object.values(S.refeicoes || {}).sort((a, b) => (a.date + (a.hora || "")).localeCompare(b.date + (b.hora || ""))).flatMap(r => (r.itens || []).map(it => [r.date, r.hora, nomeTipo(r.tipo), it.nome, nn(it.g)].concat(NUT.map(n => nn((it.n || {})[n[0]]))))))],
  ["agua", "Água", () => csv(["Data", "Hora", "ml"], Object.values(S.agua || {}).sort((a, b) => (a.date + (a.hora || "")).localeCompare(b.date + (b.hora || ""))).map(a => [a.date, a.hora, nn(a.ml)]))],
  ["habitos", "Hábitos (check-in)", () => csv(["Data", "Sono (h)", "Qualidade (1-5)", "Ronco (0-2)", "Sonolência (0-2)", "Estresse (1-5)", "Fome (1-5)", "Humor (1-5)", "Cigarros", "Álcool (doses)", "Passos", "FC repouso"],
    habitosList().map(h => [h.date, nn(h.sonoH), h.sonoQ, h.ronco, h.sonolencia, h.estresse, h.fome, h.humor, nn(h.cigarros), nn(h.alcool), nn(h.passos), nn(h.fc)]))],
  ["eventos", "Eventos", () => csv(["Data", "Tipo", "Descrição"], eventosList().map(e => [e.date, nomeEvento(e.tipo), e.descricao]))]
];

export function baixarCsv(k){
  const m = MODULOS_CSV.find(x => x[0] === k); if (!m) return;
  return downloadBlob(`${k}-${ymd(new Date())}.csv`, m[2](), "text/csv;charset=utf-8");
}
