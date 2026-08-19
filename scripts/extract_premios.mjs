import fs from "node:fs";
const raw = fs.readFileSync("C:/Users/faust/Desktop/Aullame Awards.html", "utf8");
const start = raw.indexOf("const PREMIOS = [");
if (start < 0) { console.log("NO ENCONTRADO"); process.exit(1); }
// bracket match desde el primer '['
let i = raw.indexOf("[", start), depth = 0, end = -1;
for (let j = i; j < raw.length; j++) {
  const ch = raw[j];
  if (ch === "[") depth++;
  else if (ch === "]") { depth--; if (depth === 0) { end = j; break; } }
}
let seg = raw.slice(i, end + 1);
// desescapar lo básico del string embebido
seg = seg.replace(/\u002F/gi, "/").replace(/\n/g, "\n").replace(/\\"/g, '"').replace(/\\/g, "\\");
console.log("longitud:", seg.length);
console.log(seg.slice(0, 1600));
