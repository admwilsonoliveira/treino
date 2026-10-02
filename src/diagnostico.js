// Pré-diagnóstico físico (informativo): cálculos a partir do perfil, das medidas e da rotina.
// Não é diagnóstico médico. Fórmulas:
// - IMC (OMS); relação cintura/altura (corte 0,5); % de gordura pelas faixas do American Council on Exercise (ACE)
// - Gasto em repouso: Katch-McArdle quando há % de gordura; senão Mifflin-St Jeor
// - Gasto diário: repouso × fator de atividade (sessões de treino + caminhada por semana)
// - Ritmo de peso: regressão linear das pesagens dos últimos 42 dias
import { S, measurementsList, activePlan, planLetters, imc, imcClasse } from "./store.js";
import { num, ageFrom } from "./util.js";

const FAIXAS_GORDURA = {
  M: [[6, "essencial"], [14, "atleta"], [18, "boa forma"], [25, "aceitável"], [Infinity, "obesidade"]],
  F: [[14, "essencial"], [21, "atleta"], [25, "boa forma"], [32, "aceitável"], [Infinity, "obesidade"]]
};
export function classeGordura(pct, sexo){
  const f = FAIXAS_GORDURA[sexo]; if (pct == null || !f) return null;
  return f.find(([lim]) => pct < lim)[1];
}
// nível de alerta para colorir: ok / atencao / alerta
const nivelGordura = c => (c === "obesidade" ? "alerta" : c === "aceitável" ? "atencao" : "ok");

function ultimaCom(campo){ return measurementsList().filter(m => num(m[campo]) != null).pop() || null; }

// Ritmo de variação de peso (kg/semana) pelas pesagens recentes
export function ritmoPeso(dias = 42){
  const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  const pts = measurementsList().filter(m => m.date >= desde && num(m.peso) != null).map(m => ({ x: new Date(m.date + "T12:00:00").getTime() / 86400000, y: num(m.peso) }));
  if (pts.length < 2 || pts[pts.length - 1].x - pts[0].x < 7) return null;
  const n = pts.length, mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
  const num_ = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0), den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  return den ? (num_ / den) * 7 : null;
}

function fatorAtividade(){
  const p = activePlan(), w = S.settings.walk || { dias: [] };
  const treinos = p ? planLetters(p).reduce((a, L) => a + (p.treinos[L].dias || []).length, 0) : 0;
  const sessoes = treinos + (w.dias || []).length;
  const f = sessoes === 0 ? 1.2 : sessoes <= 3 ? 1.375 : sessoes <= 6 ? 1.465 : sessoes <= 9 ? 1.55 : 1.725;
  return { f, sessoes, treinos, caminhadas: (w.dias || []).length };
}

export function diagnostico(){
  const p = S.profile; if (!p) return null;
  const idade = ageFrom(p.nascimento), alt = num(p.altura);
  const mPeso = ultimaCom("peso"), peso = mPeso ? num(mPeso.peso) : num(p.pesoInicial);
  const mGord = ultimaCom("gorduraPct"), mCint = ultimaCom("cintura");
  const gord = mGord ? num(mGord.gorduraPct) : null;
  const d = { idade, altura: alt, peso, data: mPeso && mPeso.date, itens: [], alertas: [] };

  // IMC
  const vImc = imc(peso, alt);
  if (vImc){
    d.imc = vImc;
    d.itens.push({ k: "IMC", v: vImc, fmt: 1, txt: imcClasse(vImc), nivel: vImc < 18.5 || vImc >= 30 ? "alerta" : vImc >= 25 ? "atencao" : "ok", ref: "Adequado entre 18,5 e 24,9" });
  }
  // Cintura / altura
  if (mCint && alt){
    const r = num(mCint.cintura) / alt;
    d.cinturaAltura = r;
    d.itens.push({ k: "Cintura ÷ altura", v: r, fmt: 2, txt: r < 0.5 ? "risco baixo" : r < 0.6 ? "risco aumentado" : "risco alto", nivel: r < 0.5 ? "ok" : r < 0.6 ? "atencao" : "alerta", ref: "Ideal abaixo de 0,50 (cintura menor que metade da altura)" });
  }
  // Gordura e massa magra
  if (gord != null && peso){
    const c = classeGordura(gord, p.sexo);
    const mg = peso * gord / 100, mm = peso - mg;
    Object.assign(d, { gordura: gord, massaGorda: mg, massaMagra: mm });
    d.itens.push({ k: "Gordura corporal", v: gord, fmt: 1, un: "%", txt: c || "", nivel: nivelGordura(c), ref: p.sexo === "F" ? "Boa forma: 21% a 24%" : "Boa forma: 14% a 17%" });
    d.itens.push({ k: "Massa gorda", v: mg, fmt: 1, un: "kg" });
    d.itens.push({ k: "Massa magra", v: mm, fmt: 1, un: "kg", txt: "músculos, ossos, órgãos e água" });
    if (alt){
      // faixas de referência do índice de massa magra (FFMI) para adultos
      const ffmi = mm / Math.pow(alt / 100, 2), lim = p.sexo === "F" ? [14, 17, 19] : [18, 20, 22];
      const txt = ffmi < lim[0] ? "abaixo da média" : ffmi < lim[1] ? "na média" : ffmi < lim[2] ? "acima da média" : "bem acima da média";
      d.ffmi = ffmi;
      d.itens.push({ k: "Índice de massa magra", v: ffmi, fmt: 1, txt, nivel: ffmi < lim[0] ? "atencao" : "ok", ref: `Média para ${p.sexo === "F" ? "mulheres" : "homens"}: ${lim[0]} a ${lim[1]}` });
    }
  }
  const mMusc = ultimaCom("musculo");
  if (mMusc) d.itens.push({ k: "Músculo esquelético", v: num(mMusc.musculo), fmt: 1, un: "kg", txt: "da balança de bioimpedância" });

  // Gasto calórico
  if (peso && alt && idade != null && p.sexo){
    const tmb = d.massaMagra ? 370 + 21.6 * d.massaMagra : 10 * peso + 6.25 * alt - 5 * idade + (p.sexo === "M" ? 5 : -161);
    const fa = fatorAtividade();
    Object.assign(d, { tmb, gastoDia: tmb * fa.f, fator: fa });
    d.itens.push({ k: "Gasto em repouso", v: Math.round(tmb), fmt: 0, un: "kcal/dia", txt: d.massaMagra ? "calculado pela massa magra" : "estimado por idade, peso e altura" });
    d.itens.push({ k: "Gasto diário estimado", v: Math.round(d.gastoDia), fmt: 0, un: "kcal/dia", txt: `com ${fa.sessoes} sessões de treino e caminhada por semana` });
  }

  // Meta e ritmo
  const ritmo = ritmoPeso();
  d.ritmo = ritmo;
  if (ritmo != null && peso){
    const pct = ritmo / peso * 100;
    d.itens.push({ k: "Ritmo atual do peso", v: ritmo, fmt: 2, un: "kg/semana", sinal: true, txt: "pelas pesagens das últimas 6 semanas", nivel: pct < -1 ? "alerta" : "ok" });
    if (pct < -1) d.alertas.push({ nivel: "alerta", txt: `Você está perdendo cerca de ${Math.abs(pct).toFixed(1).replace(".", ",")}% do peso por semana. Acima de 1% por semana aumenta o risco de perder músculo junto com a gordura. Vale conversar com seu médico ou nutricionista.` });
    d.deficitDia = ritmo < 0 ? Math.round(-ritmo * 7700 / 7) : null;
  }
  // Peso-alvo pela meta de gordura, mantendo a massa magra
  if (p.metaGordura && d.massaMagra){
    d.pesoAlvoGordura = d.massaMagra / (1 - p.metaGordura / 100);
  }
  if (p.metaPeso && peso){
    const falta = peso - p.metaPeso;
    d.falta = falta;
    if (Math.abs(falta) >= 0.5){
      if (p.metaData){
        const semanas = (new Date(p.metaData + "T12:00:00") - Date.now()) / (7 * 86400000);
        if (semanas > 0){
          d.ritmoNecessario = -falta / semanas;
          const pctN = Math.abs(d.ritmoNecessario) / peso * 100;
          if (falta > 0 && pctN > 1) d.alertas.push({ nivel: "atencao", txt: `Para chegar a ${String(p.metaPeso).replace(".", ",")} kg no prazo seria preciso perder ${Math.abs(d.ritmoNecessario).toFixed(2).replace(".", ",")} kg por semana (${pctN.toFixed(1).replace(".", ",")}% do peso). É um ritmo alto: considere ampliar o prazo para proteger a massa muscular.` });
        }
      }
      if (ritmo && Math.sign(ritmo) === -Math.sign(falta)){
        const semanas = Math.abs(falta / ritmo);
        d.previsao = new Date(Date.now() + semanas * 7 * 86400000).toISOString().slice(0, 10);
      }
    }
  }
  if (!mPeso) d.alertas.push({ nivel: "atencao", txt: "Registre seu peso na aba Perfil para o diagnóstico ficar completo." });
  if (gord == null) d.alertas.push({ nivel: "info", txt: "Com o % de gordura da bioimpedância, o app calcula massa magra e um gasto em repouso mais preciso." });
  if (!mCint) d.alertas.push({ nivel: "info", txt: "Registre a medida da cintura (na altura do umbigo) para avaliar o risco cardiovascular pela relação cintura/altura." });
  return d;
}
