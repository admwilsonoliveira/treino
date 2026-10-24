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

// Escolhe uma foto da galeria e tenta descobrir a data em que ela foi tirada
// (EXIF no app Android; data do arquivo no navegador). Devolve { src, date (AAAA-MM-DD) | null }.
export async function escolherDaGaleria(){
  const dataDe = v => { const m = String(v || "").match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };
  if (isNative){
    const { Camera } = await import("@capacitor/camera");
    const r = await Camera.getPhoto({ resultType: "dataUrl", source: "PHOTOS", quality: 85, width: 1600, correctOrientation: true });
    const ex = r.exif || {};
    return { src: r.dataUrl, date: dataDe(ex.DateTimeOriginal || ex.DateTimeDigitized || ex.DateTime) };
  }
  return new Promise((ok, erro) => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.addEventListener("change", () => {
      const f = inp.files[0]; if (!f) return erro(new Error("cancelado"));
      const d = f.lastModified ? new Date(f.lastModified) : null;
      const fr = new FileReader();
      fr.onload = () => ok({ src: fr.result, date: d ? d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") : null });
      fr.onerror = erro; fr.readAsDataURL(f);
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
