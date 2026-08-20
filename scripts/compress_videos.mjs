// ============================================================
//  Comprime los videos YA importados (public/img/**) sin perder calidad visible.
//  - CRF 19 (visualmente idéntico) + máx 1080p en el lado largo.
//  - Convierte .mov -> .mp4 (para que anden en Chrome) y actualiza content.json.
//  - Solo toca videos grandes (> UMBRAL) o .mov; los chicos los deja.
//  Uso:  node scripts/compress_videos.mjs
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CONTENT_FILE = path.join(ROOT, "data", "content.json");
const DIRS = [
  path.join(ROOT, "public", "img", "timeline"),
  path.join(ROOT, "public", "img", "2025-timeline"),
  path.join(ROOT, "public", "img", "contrib"),
];
const VIDEO_RE = /\.(mp4|mov|m4v|webm|ogg)$/i;
const SKIP_DIRS = new Set(["thumb", "view", "poster"]);
const UMBRAL = 10 * 1024 * 1024; // 10 MB

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (VIDEO_RE.test(e.name)) out.push(path.join(dir, e.name));
  }
  return out;
}
const toUrl = (abs) => "/" + path.relative(path.join(ROOT, "public"), abs).split(path.sep).join("/");
const mb = (b) => (b / 1048576).toFixed(1);

function transcode(src, dst) {
  execFileSync(ffmpegPath, [
    "-y", "-i", src,
    // cap del lado largo a 1920, mantiene proporción y dimensiones pares
    "-vf", "scale='if(gte(iw,ih),min(1920,iw),-2)':'if(gte(iw,ih),-2,min(1920,ih))'",
    "-c:v", "libx264", "-crf", "19", "-preset", "fast", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
    dst,
  ], { stdio: "ignore" });
}

function main() {
  const vids = DIRS.flatMap((d) => walk(d));
  console.log(`Encontrados ${vids.length} videos. Procesando (umbral ${mb(UMBRAL)}MB o .mov)...\n`);
  const replaces = []; // {oldUrl, newUrl} para actualizar content.json
  let before = 0, after = 0, done = 0, skipped = 0, i = 0;

  for (const src of vids) {
    i++;
    const size = fs.statSync(src).size;
    const isMov = /\.mov$/i.test(src);
    if (!isMov && size <= UMBRAL) { skipped++; continue; }
    before += size;

    const dir = path.dirname(src);
    const baseNoExt = path.basename(src).replace(/\.[^.]+$/, "");
    const finalMp4 = path.join(dir, baseNoExt + ".mp4");
    const tmp = path.join(dir, baseNoExt + ".__tmp.mp4");

    process.stdout.write(`[${i}/${vids.length}] ${path.basename(src)} (${mb(size)}MB) → `);
    try {
      transcode(src, tmp);
      const newSize = fs.statSync(tmp).size;
      // si el original ya era mp4 y quedó MÁS grande, no vale la pena: descartar
      if (!isMov && newSize >= size) {
        fs.rmSync(tmp, { force: true });
        console.log("ya estaba óptimo, lo dejo");
        after += size; done++;
        continue;
      }
      const oldUrl = toUrl(src);
      if (isMov) fs.rmSync(src, { force: true }); // borrar el .mov original
      fs.renameSync(tmp, finalMp4);
      const newUrl = toUrl(finalMp4);
      if (oldUrl !== newUrl) replaces.push({ oldUrl, newUrl });
      after += newSize; done++;
      console.log(`${mb(newSize)}MB`);
    } catch (e) {
      fs.rmSync(tmp, { force: true });
      console.log("ERROR: " + e.message.split("\n")[0]);
      after += size;
    }
  }

  // actualizar referencias .mov -> .mp4 en content.json
  if (replaces.length && fs.existsSync(CONTENT_FILE)) {
    let txt = fs.readFileSync(CONTENT_FILE, "utf8");
    for (const { oldUrl, newUrl } of replaces) txt = txt.split(oldUrl).join(newUrl);
    fs.writeFileSync(CONTENT_FILE, txt);
  }

  console.log(`\n✅ Listo. Comprimidos: ${done}, sin tocar: ${skipped}.`);
  console.log(`   Peso videos tocados: ${mb(before)}MB → ${mb(after)}MB`);
  console.log(`   Refs .mov→.mp4 actualizadas: ${replaces.length}`);
}
main();
