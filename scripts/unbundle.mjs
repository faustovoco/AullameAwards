import fs from "node:fs";
const html = fs.readFileSync("C:/Users/faust/Desktop/Aullame Awards.html", "utf8");

function scriptContent(type) {
  const re = new RegExp(`<script type="${type}">([\s\S]*?)</script>`, "i");
  const m = html.match(re);
  return m ? m[1] : null;
}
for (const t of ["__bundler/manifest","__bundler/page_order","__bundler/ext_resources","__bundler/template"]) {
  const c = scriptContent(t);
  console.log(`\n=== ${t} === (${c?c.length:0} chars)`);
  if (!c) continue;
  if (t === "__bundler/manifest" || t==="__bundler/page_order") {
    try { const j = JSON.parse(c); console.log("JSON keys/type:", Array.isArray(j)?`array[${j.length}]`:Object.keys(j).slice(0,20)); 
      if (Array.isArray(j)) console.log(JSON.stringify(j.slice(0,8),null,1));
      else { for (const k of Object.keys(j).slice(0,12)) { const v=j[k]; console.log(" -",k,"=>", typeof v==="string"?`str(${v.length})`:JSON.stringify(v).slice(0,120)); } }
    } catch(e){ console.log("(no JSON)", c.slice(0,200)); }
  } else {
    console.log(c.slice(0,300));
  }
}
