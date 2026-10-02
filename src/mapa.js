// Mapa do percurso (Leaflet + OpenStreetMap). Carregado só quando um mapa aparece na tela.
// Sem internet, o desenho do percurso aparece mesmo sem o mapa de fundo.
let L = null;
async function leaflet(){
  if (L) return L;
  const [m] = await Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]);
  L = m.default || m;
  return L;
}

export async function desenharMapa(el, rota, { cor = "#a8700a" } = {}){
  if (!el) return null;
  const Lf = await leaflet();
  const map = Lf.map(el, { zoomControl: true, attributionControl: true });
  Lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap"
  }).addTo(map);
  const linha = Lf.polyline([], { color: cor, weight: 5, opacity: 0.9 }).addTo(map);
  const ini = Lf.circleMarker([0, 0], { radius: 6, color: "#0f6b63", fillColor: "#0f6b63", fillOpacity: 1 });
  const fim = Lf.circleMarker([0, 0], { radius: 6, color: "#b3261e", fillColor: "#ffffff", fillOpacity: 1, weight: 3 });
  let ajustado = false;
  const atualizar = (r, seguir = false) => {
    const pts = (r || []).map(p => [p[0], p[1]]);
    linha.setLatLngs(pts);
    if (!pts.length){ map.setView([-15.78, -47.93], 4); return; }
    ini.setLatLng(pts[0]).addTo(map);
    fim.setLatLng(pts[pts.length - 1]).addTo(map);
    if (!ajustado || !seguir){ map.fitBounds(linha.getBounds(), { padding: [24, 24], maxZoom: 17 }); ajustado = true; }
    else map.panTo(pts[pts.length - 1], { animate: false });
  };
  atualizar(rota);
  setTimeout(() => map.invalidateSize(), 50);
  return { map, atualizar, remover: () => map.remove() };
}
