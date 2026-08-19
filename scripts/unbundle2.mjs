import fs from "node:fs";
const html = fs.readFileSync("C:/Users/faust/Desktop/Aullame Awards.html", "utf8");
for (const t of ["__bundler/manifest","__bundler/template","__bundler/ext_resources"]) {
  const tag = `type="${t}"`;
  const i = html.indexOf(tag);
  console.log(`\n=== ${t} @${i} ===`);
  if (i<0) continue;
  const gt = html.indexOf(">", i);
  console.log("after '>' (300 chars):", JSON.stringify(html.slice(gt+1, gt+301)));
}
// tambien: donde estan los datos de categorias?
const di = html.indexOf("Aullame del Año");
console.log("\n=== contexto de datos @", di, "===");
console.log(JSON.stringify(html.slice(di-600, di-200)));
