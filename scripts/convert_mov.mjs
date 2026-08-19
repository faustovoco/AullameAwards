// Convierte todos los .mov de fotos/ a .mp4 (H.264/AAC) y borra el .mov.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FOTOS = path.join(ROOT, "fotos");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.mov$/i.test(e.name)) out.push(p);
  }
  return out;
}

const movs = fs.existsSync(FOTOS) ? walk(FOTOS) : [];
if (!movs.length) { console.log("No hay .mov para convertir."); process.exit(0); }

let ok = 0;
for (const mov of movs) {
  const mp4 = mov.replace(/\.mov$/i, ".mp4");
  process.stdout.write(`Convirtiendo ${path.basename(mov)} … `);
  try {
    execFileSync(ffmpegPath, [
      "-y", "-i", mov,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-preset", "veryfast",
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
      mp4,
    ], { stdio: "ignore" });
    if (fs.existsSync(mp4) && fs.statSync(mp4).size > 0) {
      fs.rmSync(mov, { force: true });
      console.log("ok");
      ok++;
    } else { console.log("FALLÓ (no se generó el mp4)"); }
  } catch (e) { console.log("ERROR:", e.message); }
}
console.log(`\n✅ ${ok}/${movs.length} convertidos. Ahora corré: npm run import:fotos`);
