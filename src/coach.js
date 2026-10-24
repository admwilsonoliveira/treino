// Modo híbrido com o coach (IA fora do app): pacote semanal em Markdown, importação do cardápio que o coach
// devolve (JSON da especificação, seção 12.5) e lista de compras da semana agrupada por seção do mercado.
// Quem come junto não tem dados no app: entra só como multiplicador de quantidade (campo "pessoas" do cardápio).
import { S, measurementsList } from "./store.js";
import { num, fmtNum, ymd, ddmm, ddmmyyyy, norm, ageFrom } from "./util.js";
import { addDias, horaAgora } from "./medicacao.js";
import { refeicoesDo, nomeTipo, metas, TIPOS_REFEICAO } from "./nutricao.js";
import { alimento, nomeCompleto, buscar, paraGramas } from "./alimentos.js";
import { prefs } from "./vitaminas.js";
import { pendentes, padrao } from "./exames.js";
import { mediaAtual } from "./peso.js";
import { resumoSemana, semanaAtual } from "./semanal.js";
import { emMarkdown } from "./relcompleto.js";

const f = (v, d = 1) => (v == null || !isFinite(v) ? "–" : fmtNum(v, d));
const cel = s => String(s == null ? "" : s).replace(/\|/g, "/").replace(/\n/g, " ");
// domingo: a semana que está terminando; nos outros dias, a última semana completa
export const semanaDoPacote = () => new Date().getDay() === 0 ? semanaAtual() : addDias(semanaAtual(), -7);

/* ---------- pacote para o coach ---------- */
export function pacoteCoach(ini = semanaDoPacote()){
  const r = resumoSemana(ini), p = S.profile || {}, m = metas(), pr = prefs(), sd = S.saude || {};
  let md = emMarkdown(Object.assign({}, r, { titulo: "Pacote para o coach", sub: `Semana de ${ddmmyyyy(r.ini)} a ${ddmmyyyy(r.fim)} · gerado em ${ddmmyyyy(ymd(new Date()))}` }));
  md += `\n## Perfil e metas\n\n- ${[p.sexo === "F" ? "mulher" : p.sexo === "M" ? "homem" : null, ageFrom(p.nascimento) != null ? ageFrom(p.nascimento) + " anos" : null, p.altura ? f(num(p.altura), 0) + " cm" : null, mediaAtual() != null ? f(mediaAtual()) + " kg (média de 7 dias)" : null].filter(Boolean).join(", ")}\n- Proteína: piso ${m.prot.piso} g, alvo ${m.prot.alvo} g, teto ${m.prot.teto} g por dia · água ${f(m.agua / 1000)} L por dia\n- Restrições do perfil: ${(p.restricoes || []).join(", ") || "nenhuma"}\n`;

  // alimentos da semana
  md += `\n## Alimentos registrados na semana\n\n| Data | Hora | Refeição | Alimento | Quantidade (g) | kcal | Proteína (g) |\n|---|---|---|---|---|---|---|\n`;
  for (let i = 0; i < 7; i++){
    const d = addDias(ini, i);
    refeicoesDo(d).forEach(ref => (ref.itens || []).forEach(it => { md += `| ${ddmm(d)} | ${ref.hora || ""} | ${cel(nomeTipo(ref.tipo))} | ${cel(it.nome)} | ${f(num(it.g), 0)} | ${f(num((it.n || {}).kcal), 0)} | ${f(num((it.n || {}).prot))} |\n`; }));
  }

  // preferências
  const nomesIds = ids => ids.map(id => nomeCompleto(alimento(id)) || id).join(", ") || "nenhum";
  md += `\n## Preferências alimentares\n\n- Não preparo em casa: ${pr.naoPreparo.join(", ") || "nada marcado"}\n- Peixes: ${pr.peixesRestritos ? "restritos; liberados: " + nomesIds(pr.peixesLiberados) : "sem restrição"}\n- Bloqueados ("não quero"): ${nomesIds(pr.bloqueados)}\n- Favoritos: ${nomesIds((sd.favAlimentos || []).slice(0, 20))}\n- Pessoas nas refeições: ${pessoas()}\n`;

  // exames pendentes
  const pend = pendentes();
  md += `\n## Exames pendentes\n\n${pend.length ? pend.map(x => `- ${padrao(x.nome).nome} (coletado em ${ddmmyyyy(x.date)})`).join("\n") : "- Nenhum"}\n`;

  md += `\n## Dúvidas para o coach\n\n${String(sd.duvidasCoach || "").trim() || "(nenhuma anotada)"}\n`;
  md += `\n## Como devolver o cardápio\n\nPara o app importar, devolva um arquivo .json (ou um bloco \`\`\`json neste formato), com quantidades em gramas e "porcao_wilson" = a porção de quem usa o app:\n\n\`\`\`json\n${JSON.stringify(EXEMPLO_CARDAPIO(addDias(ini, 7)), null, 1)}\n\`\`\`\n\nTipos de refeição: ${TIPOS_REFEICAO.map(t => t[0]).join(", ")}.\n`;
  return md;
}
const EXEMPLO_CARDAPIO = seg => ({ semana_inicio: seg, pessoas: pessoas(), dias: [{ data: seg, refeicoes: [{ tipo: "almoco", nome: "Frango grelhado com arroz integral e feijão",
  ingredientes_total: [{ alimento: "peito de frango", g: 400 }], porcao_wilson: [{ alimento: "peito de frango", g: 200 }], preparo: "texto curto" }] }] });
export const pessoas = () => Math.max(1, num(S.saude && S.saude.pessoasRefeicao) || 1);

/* ---------- importar cardápio ---------- */
export function lerCardapio(texto){
  let d = null;
  try{ d = JSON.parse(texto); }catch(e){
    // Markdown com um bloco ```json
    const m = String(texto).match(/```json\s*([\s\S]*?)```/) || String(texto).match(/(\{[\s\S]*"dias"[\s\S]*\})/);
    if (m) try{ d = JSON.parse(m[1]); }catch(e2){}
  }
  if (!d || !Array.isArray(d.dias) || !d.dias.length) return { erro: "Não encontrei um cardápio no formato esperado (com \"dias\" e \"refeicoes\")." };
  const tipos = TIPOS_REFEICAO.map(t => t[0]), item = x => ({ alimento: String(x.alimento || "").trim(), g: num(x.g) }), ok = x => x.alimento && x.g > 0;
  const dias = d.dias.filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.data || "")).map(x => ({ data: x.data, refeicoes: (x.refeicoes || []).map(r => ({
    tipo: tipos.includes(r.tipo) ? r.tipo : "almoco", nome: String(r.nome || "Refeição"), preparo: r.preparo ? String(r.preparo) : "",
    total: (r.ingredientes_total || []).map(item).filter(ok), porcao: (r.porcao_wilson || r.porcao || []).map(item).filter(ok)
  })).filter(r => r.total.length || r.porcao.length) })).filter(x => x.refeicoes.length).sort((a, b) => a.data.localeCompare(b.data));
  if (!dias.length) return { erro: "O cardápio não tem dias com data (AAAA-MM-DD) e refeições com ingredientes em gramas." };
  return { cardapio: { semana_inicio: /^\d{4}-\d{2}-\d{2}$/.test(d.semana_inicio || "") ? d.semana_inicio : dias[0].data, pessoas: Math.max(1, num(d.pessoas) || pessoas()), dias, importadoEm: new Date().toISOString(), comidas: {} } };
}
export const cardapio = () => (S.saude && S.saude.cardapio) || null;

// alimento do banco mais parecido com o nome do cardápio (o mesmo buscador da tela de alimentos)
const cacheBusca = {};
export function acharAlimento(nome){
  const k = norm(nome); if (k in cacheBusca) return cacheBusca[k];
  const sem = k.replace(/\b(de|do|da|em|com|e|ao|a|o)\b/g, " ").replace(/\s+/g, " ").trim();
  let a = buscar(sem, 1)[0] || null;
  if (!a){ const pal = sem.split(" ").filter(w => w.length > 2); a = pal.length > 1 ? buscar(pal.slice(0, 2).join(" "), 1)[0] || buscar(pal[0], 1)[0] || null : null; }
  return (cacheBusca[k] = a);
}
// monta os itens da "minha porção" para gravar como refeição
export function itensDaPorcao(r){
  const itens = [], semBanco = [];
  r.porcao.forEach(x => {
    const a = acharAlimento(x.alimento);
    if (!a){ semBanco.push(x.alimento); return; }
    itens.push({ alimentoId: a.id, nome: nomeCompleto(a), g: x.g, medida: null, f: a.f, n: Object.fromEntries(Object.entries(paraGramas(a, x.g)).filter(([, v]) => v != null)) });
  });
  return { itens, semBanco };
}
export const novaRefeicaoDoCardapio = (dia, r, itens) => ({ date: dia.data > ymd(new Date()) ? ymd(new Date()) : dia.data, hora: horaAgora(), tipo: r.tipo, itens, origem: "cardapio", nomeCardapio: r.nome });

/* ---------- lista de compras ---------- */
const SECOES = ["Hortifrúti", "Açougue e peixaria", "Laticínios e ovos", "Padaria", "Mercearia", "Outros"];
function secaoDe(nome){
  const a = acharAlimento(nome), g = a ? norm(a.grupo || "") : "", n = norm(nome);
  if (/verdura|hortali|fruta/.test(g) || /\b(alface|tomate|cebola|alho|batata|cenoura|abobrinha|brocolis|banana|maca|limao|laranja|couve|espinafre|pepino|mandioca|inhame|abobora|beterraba|chuchu|pimentao)\b/.test(n)) return "Hortifrúti";
  if (/carne|pescado/.test(g) || /\b(frango|carne|peixe|tilapia|salmao|patinho|alcatra|file|bife|porco|lombo|sardinha)\b/.test(n)) return /\batum\b/.test(n) ? "Mercearia" : "Açougue e peixaria";
  if (/leite|ovos/.test(g) || /\b(ovo|ovos|leite|queijo|iogurte|requeijao|manteiga|cottage)\b/.test(n)) return "Laticínios e ovos";
  if (/\b(pao|torrada|bisnaguinha)\b/.test(n)) return "Padaria";
  if (a) return "Mercearia";
  return "Outros";
}
export function listaCompras(c = cardapio()){
  if (!c) return [];
  const soma = {};
  c.dias.forEach(d => d.refeicoes.forEach(r => (r.total.length ? r.total : r.porcao.map(x => ({ alimento: x.alimento, g: x.g * c.pessoas }))).forEach(x => {
    const k = norm(x.alimento); soma[k] = soma[k] || { nome: x.alimento, g: 0, vezes: 0 }; soma[k].g += x.g; soma[k].vezes++;
  })));
  const tenho = new Set((S.saude && S.saude.comprasTenho && S.saude.comprasTenho.semana === c.semana_inicio && S.saude.comprasTenho.itens) || []);
  const itens = Object.entries(soma).map(([k, x]) => Object.assign(x, { k, secao: secaoDe(x.nome), tenho: tenho.has(k) }));
  return SECOES.map(s => ({ secao: s, itens: itens.filter(i => i.secao === s).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) })).filter(g => g.itens.length);
}
export const fmtPeso = g => g >= 1000 ? fmtNum(g / 1000, 2) + " kg" : Math.round(g) + " g";
