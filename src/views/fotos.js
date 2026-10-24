// Foto do aparelho de cada exercício, para achar a máquina na academia.
// Uma foto por exercício (vale para todos os planos). Guardada reduzida: imagem (até 900 px) + miniatura (160 px).
import { S, flush, getEx, setStatus } from "../store.js";
import { actions, openModal, closeModal, rerenderKeepScroll } from "../ui.js";
import { esc } from "../util.js";
import { isNative } from "../native.js";

export function carregarImagem(src){
  return new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = src; });
}
export function reduzir(img, max, qualidade){
  const f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * f); c.height = Math.round(img.naturalHeight * f);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", qualidade);
}
// Abre a câmera (ou a galeria) e devolve a foto como data URL
export async function capturar(titulo = "Foto do aparelho"){
  if (isNative){
    const { Camera } = await import("@capacitor/camera");
    const r = await Camera.getPhoto({
      resultType: "dataUrl", source: "PROMPT", quality: 80, width: 1200, correctOrientation: true,
      promptLabelHeader: titulo, promptLabelPhoto: "Escolher da galeria", promptLabelPicture: "Tirar foto", promptLabelCancel: "Cancelar"
    });
    return r.dataUrl;
  }
  return new Promise((ok, erro) => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*"; inp.setAttribute("capture", "environment");
    inp.addEventListener("change", () => {
      const f = inp.files[0]; if (!f) return erro(new Error("cancelado"));
      const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = erro; fr.readAsDataURL(f);
    });
    inp.click();
  });
}

// Data em que a foto foi tirada, lida do próprio arquivo JPEG (EXIF DateTimeOriginal)
export function dataDoExif(buf){
  try{
    const v = new DataView(buf); if (v.getUint16(0) !== 0xFFD8) return null;
    let o = 2;
    while (o + 4 < v.byteLength){
      const marca = v.getUint16(o), tam = v.getUint16(o + 2);
      if (marca === 0xFFE1 && v.getUint32(o + 4) === 0x45786966){ // "Exif"
        const t = o + 10, le = v.getUint16(t) === 0x4949;
        const u16 = p => v.getUint16(t + p, le), u32 = p => v.getUint32(t + p, le);
        const ler = (ifd, tag) => { const n = u16(ifd); for (let i = 0; i < n; i++){ const e = ifd + 2 + i * 12; if (u16(e) === tag) return e; } return null; };
        const texto = e => { const len = u32(e + 4), p = u32(e + 8); let s = ""; for (let i = 0; i < len - 1; i++) s += String.fromCharCode(v.getUint8(t + p + i)); return s; };
        const ifd0 = u32(4), exifPtr = ler(ifd0, 0x8769);
        const e = (exifPtr != null && (ler(u32(exifPtr + 8), 0x9003) || ler(u32(exifPtr + 8), 0x9004))) || ler(ifd0, 0x0132);
        if (e == null) return null;
        const m = texto(e).match(/^(\d{4}):(\d{2}):(\d{2})/);
        return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
      }
      if ((marca & 0xFF00) !== 0xFF00) return null;
      o += 2 + tam;
    }
  }catch(e){}
  return null;
}
// Data no nome do arquivo: IMG_20260715_..., 20260715_..., IMG-20260715-WA..., Screenshot_2026-07-15...
export function dataDoNome(nome){
  const m = String(nome || "").match(/(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})/);
  if (!m) return null;
  const a = +m[1], mes = +m[2], d = +m[3];
  return mes >= 1 && mes <= 12 && d >= 1 && d <= 31 ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
// Escolhe várias fotos de uma vez; para cada uma devolve { src, date, de: "foto" | "nome" | null }
export function escolherVarias(){
  return new Promise((ok, erro) => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
    inp.addEventListener("change", async () => {
      const fs = [...inp.files]; if (!fs.length) return erro(new Error("cancelado"));
      const out = [];
      for (const f of fs){
        const buf = await f.arrayBuffer(), ex = dataDoExif(buf), nm = dataDoNome(f.name);
        const src = await new Promise((r, e) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = e; fr.readAsDataURL(f); });
        out.push({ src, date: ex || nm, de: ex ? "foto" : nm ? "nome" : null });
      }
      ok(out);
    });
    inp.click();
  });
}

export function fotoHtml(exId){
  const f = S.fotos[exId];
  if (f) return `<button type="button" class="fotobtn" data-act="fotoVer" data-ex="${esc(exId)}" aria-label="Ver foto do aparelho"><img src="${f.thumb}" alt=""></button>`;
  return `<button type="button" class="linkbtn fotoadd" data-act="fotoAdd" data-ex="${esc(exId)}">📷 Foto do aparelho</button>`;
}

actions.fotoAdd = async el => {
  const exId = el.dataset.ex;
  try{
    const src = await capturar();
    setStatus("Salvando foto…");
    const img = await carregarImagem(src);
    S.fotos[exId] = { id: exId, data: reduzir(img, 900, 0.72), thumb: reduzir(img, 160, 0.7), atualizado: new Date().toISOString() };
    await flush("fotos", exId);
    closeModal(); rerenderKeepScroll();
    setStatus("Foto salva");
  }catch(e){
    const msg = String((e && e.message) || e);
    if (!/cancel/i.test(msg)) alert("Não foi possível usar a foto.\n\n" + msg);
  }
};
actions.fotoVer = el => {
  const exId = el.dataset.ex, f = S.fotos[exId], ex = getEx(exId);
  if (!f) return;
  openModal(`<div class="between"><h3>${esc(ex.nome)}</h3><button class="linkbtn" data-act="closeModal">Fechar</button></div>
    <img src="${f.data}" alt="Foto do aparelho de ${esc(ex.nome)}" style="display:block;width:100%;border-radius:12px;margin-top:10px">
    <div class="row" style="margin-top:14px"><button class="btn ghost" data-act="fotoAdd" data-ex="${esc(exId)}">Trocar foto</button><button class="btn danger" data-act="fotoDel" data-ex="${esc(exId)}">Remover</button></div>`);
};
actions.fotoDel = async el => {
  const exId = el.dataset.ex;
  if (!confirm("Remover a foto deste aparelho?")) return;
  delete S.fotos[exId]; await flush("fotos", exId);
  closeModal(); rerenderKeepScroll();
};
