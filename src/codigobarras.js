// Código de barras dos industrializados: leitura com a câmera (APK: leitor do Google via
// @capacitor-mlkit/barcode-scanning, sem pedir permissão de câmera) e busca no Open Food Facts
// (base aberta, ODbL — citar a fonte). O produto encontrado é conferido pelo usuário e vira um
// "Meu alimento" com o código (campo ean), para as próximas leituras funcionarem sem internet.
import { S } from "./store.js";
import { isNative } from "./native.js";

export const FONTE_OFF = "Open Food Facts (openfoodfacts.org), base aberta sob licença ODbL";
export const meuPorCodigo = ean => Object.values(S.alimentos || {}).find(a => a.ean === ean) || null;
export const codigoValido = s => /^\d{8,14}$/.test(String(s || "").trim());

// APK: abre o leitor do Google; devolve o número lido, null se cancelou. No navegador, a tela pede para digitar.
export async function lerCodigo(aviso = () => {}){
  if (!isNative) return null;
  const { BarcodeScanner, BarcodeFormat } = await import("@capacitor-mlkit/barcode-scanning");
  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (!available){
    // o módulo do Google é baixado uma vez pelo Play Services
    aviso("Preparando o leitor de código de barras (só na primeira vez)…");
    await new Promise(async (ok, erro) => {
      const l = await BarcodeScanner.addListener("googleBarcodeScannerModuleInstallProgress", ev => { if (ev.state === 4){ l.remove(); ok(); } else if (ev.state === 5 || ev.state === 3){ l.remove(); erro(new Error("instalacao")); } });
      BarcodeScanner.installGoogleBarcodeScannerModule().catch(erro);
    });
  }
  try{
    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE] });
    return barcodes && barcodes[0] ? barcodes[0].rawValue : null;
  }catch(e){ return null; } // cancelado
}

// nutriments do Open Food Facts vêm em gramas por 100 g: converte para as unidades do app
const OFF = [["kcal", "energy-kcal_100g", 1], ["prot", "proteins_100g", 1], ["carb", "carbohydrates_100g", 1], ["acucar", "sugars_100g", 1], ["acucarAd", "added-sugars_100g", 1],
  ["gord", "fat_100g", 1], ["sat", "saturated-fat_100g", 1], ["trans", "trans-fat_100g", 1], ["mono", "monounsaturated-fat_100g", 1], ["poli", "polyunsaturated-fat_100g", 1],
  ["fibra", "fiber_100g", 1], ["sodio", "sodium_100g", 1e3], ["colest", "cholesterol_100g", 1e3], ["vitA", "vitamin-a_100g", 1e6], ["vitD", "vitamin-d_100g", 1e6],
  ["vitE", "vitamin-e_100g", 1e3], ["vitK", "vitamin-k_100g", 1e6], ["vitC", "vitamin-c_100g", 1e3], ["b1", "vitamin-b1_100g", 1e3], ["b2", "vitamin-b2_100g", 1e3],
  ["b3", "vitamin-pp_100g", 1e3], ["b6", "vitamin-b6_100g", 1e3], ["b12", "vitamin-b12_100g", 1e6], ["folato", "vitamin-b9_100g", 1e6], ["calcio", "calcium_100g", 1e3],
  ["ferro", "iron_100g", 1e3], ["magnesio", "magnesium_100g", 1e3], ["zinco", "zinc_100g", 1e3], ["fosforo", "phosphorus_100g", 1e3], ["potassio", "potassium_100g", 1e3],
  ["selenio", "selenium_100g", 1e6], ["cobre", "copper_100g", 1e3], ["manganes", "manganese_100g", 1e3]];

// busca o produto; devolve { produto } (valores por 100 g), { naoAchou: true } ou { erro }
export async function buscarOFF(ean){
  const campos = "code,product_name,product_name_pt,generic_name_pt,brands,quantity,serving_size,serving_quantity,nutriments";
  let r;
  try{ r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json?fields=${campos}`); }
  catch(e){ return { erro: "Sem internet para buscar o produto. Tente de novo ou cadastre pelo rótulo." }; }
  if (r.status === 404) return { naoAchou: true };
  if (!r.ok) return { erro: "O Open Food Facts não respondeu agora. Tente de novo em instantes." };
  const d = await r.json();
  if (!d || d.status !== 1 || !d.product) return { naoAchou: true };
  return { produto: alimentoDoOFF(d.product, ean) };
}
export function alimentoDoOFF(p, ean){
  const n = p.nutriments || {}, a = { nome: (p.product_name_pt || p.product_name || p.generic_name_pt || "").trim(), marca: String(p.brands || "").split(",")[0].trim(), ean, off: true };
  OFF.forEach(([k, campo, fator]) => { const v = parseFloat(n[campo]); if (isFinite(v)) a[k] = v * fator; });
  if (a.kcal == null && isFinite(parseFloat(n["energy_100g"]))) a.kcal = parseFloat(n["energy_100g"]) / 4.184; // kJ → kcal
  const sq = parseFloat(p.serving_quantity);
  a.porcaoG = sq > 0 && sq < 2000 ? sq : null;
  a.medida = p.serving_size ? String(p.serving_size).slice(0, 30) : null;
  a.semNutrientes = ["kcal", "prot", "carb", "gord"].every(k => a[k] == null);
  return a;
}
