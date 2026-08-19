// ============================================================
//  Toma tu presentación exportada (Aullame Awards.html) y genera
//  public/ceremonia.html con UN cambio quirúrgico: el array PREMIOS
//  usa los datos reales de la votación si están disponibles, y si no,
//  usa tus datos de ejemplo. Volvé a correr esto cada vez que
//  re-exportes la presentación desde la herramienta de diseño.
//
//  Uso:  node scripts/build_ceremonia.mjs ["ruta/al/export.html"]
//  Default: ../Aullame Awards.html (el que está en el Escritorio)
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const INPUT = process.argv[2] || path.join(ROOT, "..", "Aullame Awards.html");
const OUTPUT = path.join(ROOT, "public", "ceremonia.html");

// Script que se inyecta en el <head>: pasa los datos reales (guardados en
// sessionStorage por el botón ▶) a una variable global que la presentación lee.
const INJECT = `<script>/* Aullame: datos reales inyectados por el sitio */try{var __d=sessionStorage.getItem('AULLAME_PREMIOS');if(__d){window.AULLAME_PREMIOS=JSON.parse(__d);}}catch(e){}</script>`;

// Hace que "const PREMIOS = [" lea primero la data real (top o self) y si no,
// use el array de ejemplo original.
const FIND = "const PREMIOS = [";
const REPLACE = "const PREMIOS = (window.AULLAME_PREMIOS||(window.top&&window.top.AULLAME_PREMIOS))||[";

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`❌ No encuentro el export en:\n   ${INPUT}\n   Pasá la ruta como argumento: node scripts/build_ceremonia.mjs "C:/ruta/al/export.html"`);
    process.exit(1);
  }
  let html = fs.readFileSync(INPUT, "utf8");
  const bytes0 = Buffer.byteLength(html);

  // 1) Patch del array de datos
  const count = html.split(FIND).length - 1;
  if (count === 0) {
    console.error(`❌ No encontré "${FIND}" en el export.\n   ¿Cambió el nombre de la variable en la presentación? Debería llamarse PREMIOS.`);
    process.exit(1);
  }
  if (count > 1) console.warn(`⚠️  "${FIND}" aparece ${count} veces; parcheo solo la primera.`);
  html = html.replace(FIND, REPLACE); // solo la primera ocurrencia

  // 2) Inyección del <head>
  if (html.includes("AULLAME_PREMIOS") === false) {
    // (por si acaso: solo si el replace no dejó la marca)
  }
  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => m + "\n" + INJECT);
  else html = INJECT + html;

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, html);

  console.log("✅ Ceremonia generada:");
  console.log("   entrada:", INPUT);
  console.log("   salida :", OUTPUT, `(${(Buffer.byteLength(html) / 1e6).toFixed(2)} MB)`);
  console.log(`   patch PREMIOS: ${count} encontrado(s), 1 aplicado`);
  console.log("   → El botón ▶ del sitio ya la lanza con los datos de la votación.");
}
main();
