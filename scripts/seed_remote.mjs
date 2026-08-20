// ============================================================
//  Carga inicial al server desplegado: sube content.json + todas las
//  fotos/videos YA optimizados (sin reprocesar) al volumen del VPS.
//  Re-ejecutable: saltea lo que ya está subido.
//
//  Uso:  node scripts/seed_remote.mjs <BASE_URL> <ADMIN_KEY>
//   ej:  node scripts/seed_remote.mjs https://aullame-awards-app.rs2pvp.easypanel.host aullame2026
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE = (process.argv[2] || "").replace(/\/$/, "");
const KEY = process.argv[3] || "";
if (!BASE || !KEY) { console.error("Uso: node scripts/seed_remote.mjs <BASE_URL> <ADMIN_KEY>"); process.exit(1); }

const CONCURRENCY = 6;
const IMG_DIR = path.join(ROOT, "public", "img");
const SKIP = new Set(["contrib"]); // las contribuciones en vivo no se tocan

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name), out); }
    else out.push(path.join(dir, e.name));
  }
  return out;
}

// arma la lista: todo public/img (img). content.json SOLO con --content
// (por defecto NO se pisa el contenido en vivo, que puede tener ediciones del panel)
const jobs = [];
const includeContent = process.argv.includes("--content");
const contentFile = path.join(ROOT, "data", "content.json");
if (includeContent && fs.existsSync(contentFile)) jobs.push({ target: "data", abs: contentFile, rel: "content.json" });
for (const abs of walk(IMG_DIR)) jobs.push({ target: "img", abs, rel: path.relative(IMG_DIR, abs).split(path.sep).join("/") });

const totalBytes = jobs.reduce((a, j) => a + fs.statSync(j.abs).size, 0);
console.log(`Subiendo ${jobs.length} archivos (${(totalBytes / 1e9).toFixed(2)} GB) a ${BASE} ...\n`);

let done = 0, sent = 0, skipped = 0, failed = 0, bytesSent = 0;
const mb = (b) => (b / 1048576).toFixed(1);

const CHUNK = 6 * 1024 * 1024; // 6 MB por request (evita timeouts del proxy)

async function one(job) {
  const size = fs.statSync(job.abs).size;
  const q = `target=${job.target}&path=${encodeURIComponent(job.rel)}`;
  const H = { "x-admin-key": KEY, "content-type": "application/octet-stream" };
  try {
    // ¿ya está?
    const chk = await fetch(`${BASE}/api/seed-check?${q}&size=${size}`, { headers: { "x-admin-key": KEY } });
    if (chk.ok && (await chk.json()).exists) { skipped++; return; }

    if (size <= CHUNK) {
      // archivo chico: un solo PUT
      const r = await fetch(`${BASE}/api/seed-file?${q}`, { method: "PUT", headers: H, body: fs.readFileSync(job.abs) });
      if (!r.ok) throw new Error("HTTP " + r.status);
    } else {
      // grande: por partes (primer chunk trunca, el resto agrega)
      const fd = fs.openSync(job.abs, "r");
      const buf = Buffer.alloc(CHUNK);
      let off = 0, first = true;
      try {
        while (off < size) {
          const n = fs.readSync(fd, buf, 0, CHUNK, off);
          const r = await fetch(`${BASE}/api/seed-file?${q}&append=${first ? 0 : 1}`, { method: "PUT", headers: H, body: buf.subarray(0, n) });
          if (!r.ok) throw new Error("HTTP " + r.status + " (chunk @" + off + ")");
          off += n; first = false;
        }
      } finally { fs.closeSync(fd); }
    }
    sent++; bytesSent += size;
  } catch (e) {
    failed++;
    console.log(`  ✗ ${job.rel} (${mb(size)}MB): ${e.message}`);
  } finally {
    done++;
    if (done % 50 === 0 || done === jobs.length)
      process.stdout.write(`\r  ${done}/${jobs.length}  subidos:${sent} saltados:${skipped} fallidos:${failed}  (${mb(bytesSent)}MB)   `);
  }
}

// pool de concurrencia
let idx = 0;
async function worker() { while (idx < jobs.length) { await one(jobs[idx++]); } }
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(`\n\n✅ Listo. Subidos: ${sent}, ya estaban: ${skipped}, fallidos: ${failed}.`);
if (failed) console.log("   (volvé a correr el comando para reintentar los fallidos)");
