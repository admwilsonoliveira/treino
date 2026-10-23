// Tema claro/escuro escolhido no Perfil ("escuro" é o padrão; "auto" segue o celular).
// Uma cópia fica no localStorage para aplicar antes de os dados carregarem (sem piscar branco).
const KEY = "treino.tema";
const COR = { dark: "#07090a", light: "#f5f6f7" };

export const TEMAS = [["escuro", "Escuro"], ["claro", "Claro"], ["auto", "Igual ao celular"]];

export function aplicarTema(tema){
  const t = tema || "escuro", el = document.documentElement;
  if (t === "auto") delete el.dataset.theme;
  else el.dataset.theme = t === "claro" ? "light" : "dark";
  const escuro = t === "escuro" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.removeAttribute("media"); m.content = escuro ? COR.dark : COR.light; });
  try{ localStorage.setItem(KEY, t); }catch(e){}
}

export function temaSalvo(){
  try{ return localStorage.getItem(KEY) || "escuro"; }catch(e){ return "escuro"; }
}
