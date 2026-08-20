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
export const MES_ORDER = { ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5, JUL: 6, AGO: 7, SEP: 8, OCT: 9, NOV: 10, DIC: 11 };

export function migrateContent(c) {
  if (!c || typeof c !== "object") return c;
  const out = (c.editions && c.event && c.event.currentYear) ? c : doMigrate(c);
  // normalizar categorías: cada una con su terna (nominados) e imagen
  for (const y of Object.keys(out.editions || {})) {
    for (const cat of (out.editions[y].categorias || [])) {
      if (!Array.isArray(cat.nominados)) cat.nominados = [];
      if (typeof cat.imagen !== "string") cat.imagen = "";
      if (typeof cat.dato !== "boolean") cat.dato = false; // premio que se decide por datos (sin votación)
    }
  }

  // --- GALERÍA: fuente única de fotos ---
  if (!out.gallery || typeof out.gallery !== "object") out.gallery = {};
  if (!out.gallery.codigo) out.gallery.codigo = "2324";
  if (!Array.isArray(out.gallery.albums) || !out.gallery.albums.length) out.gallery.albums = [{ id: "general", nombre: "General" }];
  if (!Array.isArray(out.gallery.fotos)) out.gallery.fotos = [];

  // migrar las fotos de las timelines de cada edición a la galería (una sola vez por edición)
  for (const y of Object.keys(out.editions || {})) {
    const ed = out.editions[y];
    if (Array.isArray(ed.timeline) && !Array.isArray(ed.meses)) {
      const mesesMap = {};
      for (const m of ed.timeline) {
        const mes = mesCode(m.mes);
        if (!mesesMap[mes]) mesesMap[mes] = { mes, titulo: m.titulo || "", desc: m.desc || "" };
        else { if (!mesesMap[mes].titulo && m.titulo) mesesMap[mes].titulo = m.titulo; if (!mesesMap[mes].desc && m.desc) mesesMap[mes].desc = m.desc; }
        for (const f of (m.fotos || [])) out.gallery.fotos.push(galleryEntry(f, Number(y), mes, "general"));
      }
      ed.meses = Object.values(mesesMap).sort((a, b) => (MES_ORDER[a.mes] ?? 99) - (MES_ORDER[b.mes] ?? 99));
      delete ed.timeline;
    }
    if (!Array.isArray(ed.meses)) ed.meses = [];
  }

  return out;
}

const MES_CODES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const MES_FULL = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
export function mesCode(s) {
  if (!s) return "";
  const u = String(s).toUpperCase().trim();
  if (MES_CODES.includes(u)) return u;
  const fi = MES_FULL.indexOf(u); if (fi >= 0) return MES_CODES[fi];
  const n = parseInt(u, 10); if (n >= 1 && n <= 12) return MES_CODES[n - 1];
  for (let i = 0; i < 12; i++) if (u.startsWith(MES_CODES[i]) || u.startsWith(MES_FULL[i].slice(0, 3))) return MES_CODES[i];
  return u.slice(0, 3);
}
export const MES_NOMBRE = Object.fromEntries(MES_CODES.map((c, i) => [c, MES_FULL[i]]));

const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i;
function gid() { return "g" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }
function galleryEntry(f, year, month, albumId) {
  const base = (typeof f === "string")
    ? (VIDEO_RE.test(f) ? { video: f } : { t: f, v: f })
    : { ...f };
  return { id: gid(), ...base, year: year ?? null, month: month || null, albumId: albumId || "general" };
}

// timeline de recuerdos (para el mosaico) de un año, computada desde la galería
export function editionTimeline(content, year) {
  const ed = (content.editions && content.editions[String(year)]) || {};
  const metaByMes = Object.fromEntries((ed.meses || []).map((m) => [m.mes, m]));
  const byMes = {};
  for (const f of (content.gallery && content.gallery.fotos) || []) {
    if (Number(f.year) === Number(year) && f.month) (byMes[f.month] = byMes[f.month] || []).push(f);
  }
  return Object.keys(byMes)
    .sort((a, b) => (MES_ORDER[a] ?? 99) - (MES_ORDER[b] ?? 99))
    .map((mes) => ({ mes, titulo: metaByMes[mes]?.titulo || "", desc: metaByMes[mes]?.desc || "", fotos: byMes[mes] }));
}

function doMigrate(c) {
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
