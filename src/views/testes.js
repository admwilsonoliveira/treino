// Testes funcionais mensais (todos os usuários): sentar e levantar 5 vezes e, se ligado, força de preensão.
// Ficam em Evolução → Força; o "Dia de avaliação" aparece no Hoje uma vez por mês.
import { Chart, LineController, LineElement, PointElement, LinearScale, Tooltip } from "chart.js";
import { S, flush, setStatus } from "../store.js";
import { actions, changes, render, openModal, closeModal, modalState } from "../ui.js";
import { num, fmtNum, ymd, ddmmyyyy, newId, $ } from "../util.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip);
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const t12 = s => new Date(s + "T12:00:00").getTime();
const fmtD = v => { const d = new Date(v); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"); };
const feminino = () => S.profile && S.profile.sexo === "F";

export const testesDe = tipo => Object.values(S.testes).filter(t => t.tipo === tipo).sort((a, b) => a.date.localeCompare(b.date));
export const preensaoLigada = () => !!(S.settings && S.settings.testePreensao);

/* ---------- dia de avaliação: a partir do 1º sábado do mês, até fazer o teste ---------- */
export function primeiroSabado(d = new Date()){ const x = new Date(d.getFullYear(), d.getMonth(), 1, 12); while (x.getDay() !== 6) x.setDate(x.getDate() + 1); return x; }
export function avaliacaoPendente(d = new Date()){
  if (d < primeiroSabado(d) && ymd(d) !== ymd(primeiroSabado(d))) return false;
  return !testesDe("sentar_levantar").some(t => t.date.slice(0, 7) === ymd(d).slice(0, 7));
}
export function avaliacaoCardHtml(){
  if (!avaliacaoPendente()) return "";
  const saude = S.saude && S.saude.ativo;
  return `<div class="panel aviso" style="margin-top:12px"><strong>Dia de avaliação do mês</strong>
    <p class="small" style="margin:4px 0 0">Teste de sentar e levantar${saude ? ", medidas com fita e dobras (em jejum) e as fotos do mês" : ""}${preensaoLigada() ? " e força de preensão" : ""}. Leva poucos minutos.</p>
    <div class="row" style="margin-top:10px"><button class="btn strength" data-act="testeSentar">Sentar e levantar</button>${saude ? `<button class="btn ghost" data-act="fitaNova">Medidas</button><button class="btn ghost" data-act="dobrasNova">Dobras</button><button class="btn ghost" data-act="fotosNova">Fotos</button>` : ""}</div></div>`;
}

/* ---------- seção em Evolução → Força ---------- */
let charts = [];
export function testesHtml(){
  const sl = testesDe("sentar_levantar"), u = sl[sl.length - 1];
  let h = `<h2 id="testes">Testes mensais</h2><div class="panel"><div class="between"><strong>Sentar e levantar 5 vezes</strong><button class="linkbtn" data-act="testeSentar">Fazer teste</button></div>`;
  h += u ? `<div class="stat-num" style="font-size:30px;margin-top:6px">${fmtNum(u.segundos)} s</div><div class="small ${u.segundos > 15 ? "" : "muted"}" style="${u.segundos > 15 ? "color:var(--danger)" : ""}">${ddmmyyyy(u.date)} · ${u.segundos > 15 ? "acima de 15 s indica força baixa nas pernas" : "dentro do esperado (até 15 s)"}</div>
      ${sl.length >= 2 ? `<div class="chartbox" style="height:150px;margin-top:8px"><canvas id="chSentar"></canvas></div>` : ""}`
    : `<p class="small muted" style="margin:6px 0 0">Cadeira de cerca de 45 cm, braços cruzados no peito. Levante e sente 5 vezes o mais rápido possível com segurança, sem usar as mãos. Acima de 15 s indica força baixa (EWGSOP2).</p>`;
  h += `</div>`;
  if (preensaoLigada()){
    const pr = testesDe("preensao"), up = pr[pr.length - 1], corte = feminino() ? 16 : 27;
    h += `<div class="panel" style="margin-top:10px"><div class="between"><strong>Força de preensão</strong><button class="linkbtn" data-act="testePreensao">Fazer teste</button></div>
      ${up ? `<div class="stat-num" style="font-size:30px;margin-top:6px">${fmtNum(up.melhor)} kg</div><div class="small muted">${ddmmyyyy(up.date)} · melhor de 3 tentativas por mão · abaixo de ${corte} kg indica fraqueza</div>
        ${pr.length >= 2 ? `<div class="chartbox" style="height:150px;margin-top:8px"><canvas id="chPreensao"></canvas></div>` : ""}` : `<p class="small muted" style="margin:6px 0 0">Com o dinamômetro: 3 tentativas por mão, braço junto ao corpo e cotovelo dobrado. Vale a melhor.</p>`}</div>`;
  }
  h += `<label class="small" style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" data-act="preensaoLigar" ${preensaoLigada() ? "checked" : ""} style="width:20px;height:20px;accent-color:var(--strength)"> Tenho dinamômetro de mão (mostrar o teste de preensão)</label>`;
  return h;
}
export function drawTestes(){
  charts.forEach(c => { try{ c.destroy(); }catch(e){} }); charts = [];
  const mu = cssVar("--musculo"), ink2 = cssVar("--ink-2"), line = cssVar("--line");
  const g = (el, data, un) => charts.push(new Chart(el, { type: "line", data: { datasets: [{ data, borderColor: mu, backgroundColor: mu, pointRadius: 4, borderWidth: 2.5, tension: .2 }] }, options: {
    responsive: true, maintainAspectRatio: false, animation: false, parsing: false, plugins: { legend: { display: false }, tooltip: { callbacks: { title: it => fmtD(it[0].parsed.x), label: it => fmtNum(it.parsed.y) + " " + un } } },
    scales: { x: { type: "linear", ticks: { color: ink2, maxTicksLimit: 5, callback: fmtD }, grid: { display: false } }, y: { ticks: { color: ink2 }, grid: { color: line } } } } }));
  const a = $("#chSentar"); if (a) g(a, testesDe("sentar_levantar").map(t => ({ x: t12(t.date), y: t.segundos })), "s");
  const b = $("#chPreensao"); if (b) g(b, testesDe("preensao").map(t => ({ x: t12(t.date), y: t.melhor })), "kg");
}
changes.preensaoLigar = el => { S.settings.testePreensao = el.checked; flush("kv", "settings"); render(); };

/* ---------- teste de sentar e levantar (cronômetro) ---------- */
let iv = null;
actions.testeSentar = () => {
  openModal(`<h3>Sentar e levantar 5 vezes</h3>
    <ol class="small" style="padding-left:18px;margin:8px 0">
      <li>Cadeira firme de cerca de 45 cm, encostada na parede.</li><li>Sente com os pés no chão e os braços cruzados no peito.</li>
      <li>Toque em Iniciar e levante e sente 5 vezes o mais rápido possível, com segurança.</li><li>Toque em Parar quando sentar pela 5ª vez.</li></ol>
    <div class="stat-num" id="tl-tempo" style="font-size:56px;text-align:center;margin:14px 0">0,0 s</div>
    <div class="row"><button class="btn strength" data-act="tlIniciar" id="tl-btn">Iniciar</button></div>
    <div class="field"><label class="lab" for="tl-seg">Ou digite o tempo (segundos)</label><input id="tl-seg" class="txt" type="text" inputmode="decimal" placeholder="Ex.: 11,8"></div>
    <p class="small muted">Se sentir dor forte, tontura ou falta de ar, pare o teste.</p>
    <div class="err" id="tl-err"></div>
    <div class="row" style="margin-top:16px"><button class="btn ghost" data-act="tlFechar">Voltar</button><button class="btn strength" data-act="tlSalvar">Salvar</button></div>`, { inicio: null });
};
actions.tlIniciar = () => {
  if (modalState.inicio){ // parar
    clearInterval(iv); iv = null;
    const seg = (Date.now() - modalState.inicio) / 1000; modalState.inicio = null;
    $("#tl-seg").value = fmtNum(seg, 1); $("#tl-btn").textContent = "Refazer";
    return;
  }
  modalState.inicio = Date.now(); $("#tl-btn").textContent = "Parar"; $("#tl-seg").value = "";
  clearInterval(iv); iv = setInterval(() => { const el = $("#tl-tempo"); if (!el || !modalState.inicio){ clearInterval(iv); return; } el.textContent = fmtNum((Date.now() - modalState.inicio) / 1000, 1) + " s"; }, 100);
};
actions.tlFechar = () => { clearInterval(iv); iv = null; closeModal(); };
actions.tlSalvar = () => {
  const seg = num($("#tl-seg").value);
  if (!(seg >= 2 && seg <= 120)){ $("#tl-err").textContent = "Faça o teste com o cronômetro ou digite o tempo em segundos."; return; }
  clearInterval(iv); iv = null;
  const id = newId("t"); S.testes[id] = { id, date: ymd(new Date()), tipo: "sentar_levantar", segundos: Math.round(seg * 10) / 10 };
  flush("testes", id); closeModal(); setStatus("Teste salvo: " + fmtNum(seg, 1) + " s"); render();
};

/* ---------- força de preensão ---------- */
actions.testePreensao = () => openModal(`<h3>Força de preensão</h3><p class="small muted" style="margin-top:6px">3 tentativas por mão, alternando. Braço junto ao corpo, cotovelo dobrado a 90°.</p>
  ${["esq", "dir"].map(m => `<div class="field"><span class="lab">Mão ${m === "esq" ? "esquerda" : "direita"} (kg)</span><div class="leit">${[0, 1, 2].map(i => `<input class="txt" id="pr-${m}-${i}" type="text" inputmode="decimal" placeholder="${i + 1}ª">`).join("")}</div></div>`).join("")}
  <div class="err" id="pr-err"></div>
  <div class="row" style="margin-top:16px"><button class="btn ghost" data-act="closeModal">Voltar</button><button class="btn strength" data-act="prSalvar">Salvar</button></div>`);
actions.prSalvar = () => {
  const ler = m => [0, 1, 2].map(i => num($(`#pr-${m}-${i}`).value)).filter(v => v > 0 && v < 150);
  const esq = ler("esq"), dir = ler("dir"), todos = esq.concat(dir);
  if (!todos.length){ $("#pr-err").textContent = "Preencha pelo menos uma tentativa."; return; }
  const id = newId("t"); S.testes[id] = { id, date: ymd(new Date()), tipo: "preensao", esq, dir, melhor: Math.max(...todos) };
  flush("testes", id); closeModal(); setStatus("Teste salvo"); render();
};
