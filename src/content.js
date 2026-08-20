// Carga el contenido del backend (modelo de "ediciones"); si el server está
// apagado, usa valores por defecto de data.js para que el sitio igual funcione.
import * as D from "./data.js";
import { migrateContent } from "./migrate.js";

// defaults en el formato viejo -> migrados al nuevo
const OLD_DEFAULTS = {
  event: { edicion: D.EVENT.edicion, anio: D.CEREMONY_DATE.getFullYear(), ceremonyDate: D.CEREMONY_DATE.toISOString(), logo: "" },
  members: D.MEMBERS,
  categories: D.CATEGORIES,
  timeline: D.TIMELINE.map((t) => ({ ...t, fotos: t.foto ? [t.foto] : [] })),
  edition2025: D.EDITION_2025,
};
const DEFAULTS = migrateContent(OLD_DEFAULTS);

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
      if (c && Array.isArray(c.members)) return migrateContent(c);
    }
  } catch (e) { /* server apagado: usamos defaults */ }
  return DEFAULTS;
}
