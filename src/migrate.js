// Migración de la estructura vieja de content.json al modelo de "ediciones".
// Es idempotente: si ya está en el formato nuevo, lo devuelve igual.
//
// NUEVO modelo:
// {
//   event:   { currentYear, logo },
//   members: [...],
//   editions: {
//     "2025": { anio, edicion, ceremonyDate, finalizada, categorias:[], ganadores:[], aullameDelAnio:{}, timeline:[] },
//     "2026": { ... }
//   }
// }
export function migrateContent(c) {
  if (!c || typeof c !== "object") return c;
  if (c.editions && c.event && c.event.currentYear) return c; // ya migrado

  const out = {
    event: { currentYear: 0, logo: (c.event && c.event.logo) || "" },
    members: c.members || [],
    editions: {},
  };

  const cats = c.categories || [];

  // Edición actual (la vieja "2026": event + categories + timeline)
  const curYear = Number((c.event && c.event.anio) || new Date().getFullYear());
  out.event.currentYear = curYear;
  out.editions[String(curYear)] = {
    anio: curYear,
    edicion: (c.event && c.event.edicion) || "",
    ceremonyDate: (c.event && c.event.ceremonyDate) || "",
    finalizada: false,
    categorias: JSON.parse(JSON.stringify(cats)),
    ganadores: [],
    aullameDelAnio: { ganador: "", foto: "", frase: "" },
    timeline: c.timeline || [],
  };

  // Edición pasada (la vieja "edition2025")
  const e = c.edition2025;
  if (e) {
    const y = Number(e.anio || curYear - 1);
    out.editions[String(y)] = {
      anio: y,
      edicion: e.edicion || romano(y, curYear),
      ceremonyDate: e.ceremonyDate || "",
      finalizada: true,
      categorias: JSON.parse(JSON.stringify(cats)),
      ganadores: e.ganadores || [],
      aullameDelAnio: e.aullameDelAnio || { ganador: "", foto: "", frase: "" },
      timeline: e.timeline || [],
    };
  }

  return out;
}

// helper: "I Edición" para el año más viejo, incrementando
function romano(year, curYear) {
  const diff = curYear - year; // 1 => la anterior
  const n = 2 - diff; // curYear ~ II
  const R = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return `${R[Math.max(1, n)] || n} Edición`;
}

// devuelve la edición en curso
export function currentEdition(c) {
  return (c.editions && c.editions[String(c.event.currentYear)]) || null;
}
// años ordenados (desc: más nuevo primero)
export function editionYears(c) {
  return Object.keys(c.editions || {}).map(Number).sort((a, b) => b - a);
}
