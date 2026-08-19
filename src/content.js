// Carga el contenido del backend; si el server está apagado, usa los valores
// por defecto de data.js para que el sitio igual funcione.
import * as D from "./data.js";

const DEFAULTS = {
  event: { edicion: D.EVENT.edicion, ceremonyDate: D.CEREMONY_DATE.toISOString(), logo: "" },
  members: D.MEMBERS,
  categories: D.CATEGORIES,
  timeline: D.TIMELINE.map((t) => ({ ...t, fotos: t.foto ? [t.foto] : [] })),
  edition2025: D.EDITION_2025,
};

const MESES = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];

export function fechaTexto(dateLike) {
  const d = new Date(dateLike);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

export async function loadContent() {
  try {
    const r = await fetch("/api/content");
    if (r.ok) {
      const c = await r.json();
      if (c && Array.isArray(c.members) && c.members.length) return { ...DEFAULTS, ...c };
    }
  } catch (e) { /* server apagado: usamos defaults */ }
  return DEFAULTS;
}
