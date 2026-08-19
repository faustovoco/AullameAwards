// ============================================================
//  Importa y OPTIMIZA la TIMELINE de recuerdos 2025 (por meses).
//  Igual que import_fotos.mjs pero para la Edición 2025.
//
//  Uso:
//   1. Dejá los archivos en fotos-2025/<mes>/  (subcarpetas: enero, ENE, 01...)
//   2. Corré:  npm run import:2025
//
//  Fotos  -> miniatura (tile) + versión mediana (visor) en webp.
//  Videos -> se copian + se les saca un fotograma como miniatura.
//  Se escribe en content.edition2025.timeline (aparece debajo de los ganadores).
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC_DIR = process.argv[2] || path.join(ROOT, "fotos-2025");
const DEST_BASE = path.join(ROOT, "public", "img", "2025-timeline");
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
const THUMB_W = 160, VIEW_MAX = 900;

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
function extractFrame(src, outJpg) {
  for (const ss of ["0.5", "0"]) {
    try {
      execFileSync(ffmpegPath, ["-y", "-ss", ss, "-i", src, "-frames:v", "1", "-q:v", "3", outJpg], { stdio: "ignore" });
      if (fs.existsSync(outJpg) && fs.statSync(outJpg).size > 0) return true;
    } catch (e) { /* siguiente */ }
  }
  return false;
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) { console.log(`Falta ${SRC_DIR}. Creá subcarpetas por mes.`); return; }
  const content = JSON.parse(fs.readFileSync(CONTENT_FILE, "utf8"));
  content.edition2025 = content.edition2025 || {};
  content.edition2025.timeline = content.edition2025.timeline || [];
  const tl = content.edition2025.timeline;
  const folders = fs.readdirSync(SRC_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  if (!folders.length) { console.log(`No hay subcarpetas de meses en ${SRC_DIR}.`); return; }

  const resumen = [];
  for (const dir of folders) {
    const mi = monthIndex(dir.name);
    if (mi < 0) { console.warn(`⚠️  Ignoro "${dir.name}" (no reconozco el mes).`); continue; }
    const { code, nombre } = MESES[mi];
    const all = fs.readdirSync(path.join(SRC_DIR, dir.name)).filter((f) => PHOTO_RE.test(f) || GIF_RE.test(f) || VIDEO_RE.test(f)).sort();
    if (!all.length) continue;

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
        const entry = { video: `/img/2025-timeline/${code}/${safe}` };
        const tmp = path.join(destDir, base + "__f.jpg");
        if (extractFrame(src, tmp)) {
          try {
            await sharp(tmp).resize({ width: THUMB_W, withoutEnlargement: true }).webp({ quality: 60 }).toFile(path.join(destDir, "thumb", base + ".webp"));
            await sharp(tmp).resize({ width: VIEW_MAX, height: VIEW_MAX, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toFile(path.join(destDir, "view", base + ".webp"));
            entry.t = `/img/2025-timeline/${code}/thumb/${base}.webp`;
          } catch (e) { /* sin poster */ }
          fs.rmSync(tmp, { force: true });
        }
        entries.push(entry); nVideos++;
      } else if (GIF_RE.test(f)) {
        const safe = base + ".gif";
        fs.copyFileSync(src, path.join(destDir, safe));
        entries.push({ t: `/img/2025-timeline/${code}/${safe}`, v: `/img/2025-timeline/${code}/${safe}` }); nFotos++;
      } else {
        try {
          await sharp(src).rotate().resize({ width: THUMB_W, withoutEnlargement: true }).webp({ quality: 55 }).toFile(path.join(destDir, "thumb", base + ".webp"));
          await sharp(src).rotate().resize({ width: VIEW_MAX, height: VIEW_MAX, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toFile(path.join(destDir, "view", base + ".webp"));
          entries.push({ t: `/img/2025-timeline/${code}/thumb/${base}.webp`, v: `/img/2025-timeline/${code}/view/${base}.webp` }); nFotos++;
        } catch (e) { console.warn(`\n     ⚠️  ${f}: ${e.message}`); }
      }
    }
    console.log("ok");

    let mes = tl.find((t) => (t.mes || "").toUpperCase() === code);
    if (!mes) { mes = { mes: code, titulo: "", desc: "", fotos: [] }; tl.push(mes); }
    const otras = (mes.fotos || []).filter((u) => {
      const s = typeof u === "string" ? u : (u.t || u.v || u.video || "");
      return !s.startsWith(`/img/2025-timeline/${code}/`);
    });
    mes.fotos = [...otras, ...entries];
    resumen.push({ code, nombre, nFotos, nVideos });
  }

  const order = Object.fromEntries(MESES.map((m, i) => [m.code, i]));
  tl.sort((a, b) => (order[(a.mes || "").toUpperCase()] ?? 99) - (order[(b.mes || "").toUpperCase()] ?? 99));
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2));

  console.log("\n✅ Recuerdos 2025 optimizados e importados:");
  resumen.forEach((r) => console.log(`   ${r.code} (${r.nombre}): ${r.nFotos} fotos${r.nVideos ? ` + ${r.nVideos} videos` : ""}`));
  console.log("   Recargá el sitio y abrí 'Edición 2025'. 🐺");
}
main();
