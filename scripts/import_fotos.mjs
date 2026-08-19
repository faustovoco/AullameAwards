// ============================================================
//  Importa y OPTIMIZA fotos/videos al timeline (mosaico de recuerdos).
//
//  Uso:
//   1. Dejá los archivos en fotos/<mes>/  (subcarpetas: enero, ENE, 01, 1, ...)
//   2. Corré:  npm run import:fotos
//
//  Fotos  -> genera miniatura (tile) + versión mediana (visor) en webp.
//  Videos -> se copian y se reproducen solo al pasar el mouse (tile liviano con ▶).
//  Los originales quedan intactos en fotos/. Re-ejecutable.
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";

// Saca un fotograma del video (a ~medio segundo; si no, el primero).
function extractFrame(src, outJpg) {
  for (const ss of ["0.5", "0"]) {
    try {
      execFileSync(ffmpegPath, ["-y", "-ss", ss, "-i", src, "-frames:v", "1", "-q:v", "3", outJpg], { stdio: "ignore" });
      if (fs.existsSync(outJpg) && fs.statSync(outJpg).size > 0) return true;
    } catch (e) { /* probamos el siguiente */ }
  }
  return false;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC_DIR = process.argv[2] || path.join(ROOT, "fotos");
const DEST_BASE = path.join(ROOT, "public", "img", "timeline");
const CONTENT_FILE = path.join(ROOT, "data", "content.json");

const MESES = [
  { code: "ENE", nombre: "Enero" }, { code: "FEB", nombre: "Febrero" },
  { code: "MAR", nombre: "Marzo" }, { code: "ABR", nombre: "Abril" },
  { code: "MAY", nombre: "Mayo" }, { code: "JUN", nombre: "Junio" },
  { code: "JUL", nombre: "Julio" }, { code: "AGO", nombre: "Agosto" },
  { code: "SEP", nombre: "Septiembre" }, { code: "OCT", nombre: "Octubre" },
  { code: "NOV", nombre: "Noviembre" }, { code: "DIC", nombre: "Diciembre" },
];
const PHOTO_RE = /\.(jpe?g|png|webp|avif)$/i;
const GIF_RE = /\.gif$/i;
const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogg)$/i;

const THUMB_W = 160;   // miniatura del cuadradito
const VIEW_MAX = 900;  // versión mediana para el visor grande

function monthIndex(folder) {
  const s = folder.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const num = s.match(/(^|[^0-9])([0-9]{1,2})([^0-9]|$)/);
  if (num) { const n = parseInt(num[2], 10); if (n >= 1 && n <= 12) return n - 1; }
  const names = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const full = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const eng = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  for (let i = 0; i < 12; i++) if (s.startsWith(full[i]) || s.startsWith(eng[i]) || s.startsWith(names[i])) return i;
  return -1;
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    fs.mkdirSync(SRC_DIR, { recursive: true });
    console.log(`📁 Creé ${SRC_DIR}. Meté una subcarpeta por mes con las fotos y volvé a correr.`);
    return;
  }
  const content = JSON.parse(fs.readFileSync(CONTENT_FILE, "utf8"));
  content.timeline = content.timeline || [];
  const folders = fs.readdirSync(SRC_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  if (!folders.length) { console.log(`No hay subcarpetas de meses en ${SRC_DIR}.`); return; }

  const resumen = [];
  for (const dir of folders) {
    const mi = monthIndex(dir.name);
    if (mi < 0) { console.warn(`⚠️  Ignoro "${dir.name}" (no reconozco el mes).`); continue; }
    const { code, nombre } = MESES[mi];
    const all = fs.readdirSync(path.join(SRC_DIR, dir.name)).filter((f) => PHOTO_RE.test(f) || GIF_RE.test(f) || VIDEO_RE.test(f)).sort();
    if (!all.length) continue;

    // rehacer el mes desde cero (borra optimizados viejos y full-res del run anterior)
    const destDir = path.join(DEST_BASE, code);
    fs.rmSync(destDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(destDir, "thumb"), { recursive: true });
    fs.mkdirSync(path.join(destDir, "view"), { recursive: true });

    const entries = [];
    let nFotos = 0, nVideos = 0;
    process.stdout.write(`   ${code}: procesando ${all.length}… `);
    for (const f of all) {
      const src = path.join(SRC_DIR, dir.name, f);
      const base = f.replace(/\.[^.]+$/, "").replace(/[^\w.\-]+/g, "_");

      if (VIDEO_RE.test(f)) {
        const safe = f.replace(/[^\w.\-]+/g, "_");
        fs.copyFileSync(src, path.join(destDir, safe));
        const entry = { video: `/img/timeline/${code}/${safe}` };
        // fotograma como miniatura
        const tmp = path.join(destDir, base + "__frame.jpg");
        if (extractFrame(src, tmp)) {
          try {
            await sharp(tmp).resize({ width: THUMB_W, withoutEnlargement: true }).webp({ quality: 60 })
              .toFile(path.join(destDir, "thumb", base + ".webp"));
            await sharp(tmp).resize({ width: VIEW_MAX, height: VIEW_MAX, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 })
              .toFile(path.join(destDir, "view", base + ".webp"));
            entry.t = `/img/timeline/${code}/thumb/${base}.webp`;
            entry.poster = `/img/timeline/${code}/view/${base}.webp`;
          } catch (e) { /* si falla, queda sin poster */ }
          fs.rmSync(tmp, { force: true });
        }
        entries.push(entry);
        nVideos++;
      } else if (GIF_RE.test(f)) {
        // gif: se copia tal cual (mantiene animación), sirve de tile y de visor
        const safe = base + ".gif";
        fs.copyFileSync(src, path.join(destDir, safe));
        entries.push({ t: `/img/timeline/${code}/${safe}`, v: `/img/timeline/${code}/${safe}` });
        nFotos++;
      } else {
        try {
          await sharp(src).rotate().resize({ width: THUMB_W, withoutEnlargement: true }).webp({ quality: 55 })
            .toFile(path.join(destDir, "thumb", base + ".webp"));
          await sharp(src).rotate().resize({ width: VIEW_MAX, height: VIEW_MAX, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 })
            .toFile(path.join(destDir, "view", base + ".webp"));
          entries.push({ t: `/img/timeline/${code}/thumb/${base}.webp`, v: `/img/timeline/${code}/view/${base}.webp` });
          nFotos++;
        } catch (e) { console.warn(`\n     ⚠️  no pude procesar ${f}: ${e.message}`); }
      }
    }
    console.log("ok");

    let mes = content.timeline.find((t) => (t.mes || "").toUpperCase() === code);
    if (!mes) { mes = { mes: code, titulo: nombre, desc: "", fotos: [] }; content.timeline.push(mes); }
    // conservar solo lo que NO sea de este import (p.ej. subidas por el panel)
    const otras = (mes.fotos || []).filter((u) => {
      const s = typeof u === "string" ? u : (u.t || u.v || u.video || "");
      return !s.startsWith(`/img/timeline/${code}/`);
    });
    mes.fotos = [...otras, ...entries];
    resumen.push({ code, nombre, nFotos, nVideos });
  }

  const order = Object.fromEntries(MESES.map((m, i) => [m.code, i]));
  content.timeline.sort((a, b) => (order[(a.mes || "").toUpperCase()] ?? 99) - (order[(b.mes || "").toUpperCase()] ?? 99));
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2));

  console.log("\n✅ Recuerdos optimizados e importados:");
  resumen.forEach((r) => console.log(`   ${r.code} (${r.nombre}): ${r.nFotos} fotos${r.nVideos ? ` + ${r.nVideos} videos` : ""}`));
  console.log("   Recargá el sitio. El mosaico ahora carga liviano. 🐺");
}
main();
