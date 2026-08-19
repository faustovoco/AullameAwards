// ============================================================
//  Importa las fotos de la Edición 2025 (una por ganador).
//  Dejá las fotos en la carpeta fotos-2025/ (ver LEEME.txt) y corré:
//     npm run import:2025
//  Optimiza cada foto y la engancha al ganador correspondiente en content.json.
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, "fotos-2025-ganadores");
const DEST = path.join(ROOT, "public", "img", "2025");
const CONTENT_FILE = path.join(ROOT, "data", "content.json");
const IMG_RE = /\.(jpe?g|png|webp|avif)$/i;

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  if (!fs.existsSync(SRC)) { console.log(`Falta la carpeta ${SRC}. Creála y poné las fotos.`); return; }
  const content = JSON.parse(fs.readFileSync(CONTENT_FILE, "utf8"));
  const e25 = content.edition2025 || (content.edition2025 = { ganadores: [] });
  fs.mkdirSync(DEST, { recursive: true });

  const files = fs.readdirSync(SRC).filter((f) => IMG_RE.test(f));
  if (!files.length) { console.log("No hay fotos en fotos-2025/. Poné las fotos (ver LEEME.txt) y reintentá."); return; }

  // objetivos: aullame del año + cada categoría ganadora
  const targets = [
    { slug: "aullame-del-anio", alias: ["aullame"], set: (url) => { e25.aullameDelAnio = { ...(e25.aullameDelAnio || {}), foto: url }; }, label: "Aullame del Año" },
    ...(e25.ganadores || []).map((g) => ({
      slug: slug(g.categoria), alias: [], set: (url) => { g.foto = url; }, label: g.categoria,
    })),
  ];

  const hechos = [];
  for (const f of files) {
    const fslug = slug(f.replace(/\.[^.]+$/, ""));
    const t = targets.find((t) => fslug === t.slug || fslug.includes(t.slug) || t.alias.some((a) => fslug.includes(a)));
    if (!t) { console.warn(`⚠️  "${f}" no coincide con ningún premio (revisá el nombre en LEEME.txt).`); continue; }
    const out = path.join(DEST, t.slug + ".webp");
    await sharp(path.join(SRC, f)).rotate().resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toFile(out);
    t.set(`/img/2025/${t.slug}.webp`);
    hechos.push(t.label);
  }

  fs.writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2));
  console.log("✅ Fotos 2025 importadas:");
  hechos.forEach((h) => console.log("   ✓ " + h));
  const faltan = targets.filter((t) => !hechos.includes(t.label)).map((t) => t.label);
  if (faltan.length) console.log("   (sin foto todavía: " + faltan.join(", ") + ")");
  console.log("   Recargá el sitio y abrí 'Edición 2025'. 🐺");
}
main();
