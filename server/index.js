// ============================================================
//  AULLAME AWARDS — Backend (Express + almacenamiento en JSON)
//  - Contenido editable (integrantes, categorías, timeline, 2025)
//  - Votación con token personal y secreto + conteo interno
//  - Subida de fotos
// ============================================================
import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import { migrateContent, currentEdition } from "../src/migrate.js";

// ffmpeg async (no bloquea el server mientras transcodea un video)
const pexec = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "public", "img", "uploads");
const CONTENT_FILE = path.join(DATA_DIR, "content.json");
const VOTES_FILE = path.join(DATA_DIR, "votes.json");

// Modo producción: con --serve el server también sirve el sitio ya compilado
// (dist/) y usa el PORT que da el hosting. En dev usa API_PORT (Vite sirve la web).
const SERVE = process.argv.includes("--serve");
const PORT = SERVE ? (process.env.PORT || 8787) : (process.env.API_PORT || 8787);

// --- helpers de almacenamiento ---
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const readJSON = (f, fallback) => {
  try { return JSON.parse(fs.readFileSync(f, "utf8")); }
  catch { return fallback; }
};
const writeJSON = (f, obj) => fs.writeFileSync(f, JSON.stringify(obj, null, 2));
const token = () => crypto.randomBytes(9).toString("hex");

// lee el contenido y lo migra al modelo de "ediciones" si hace falta (persiste)
function readContent() {
  const raw = readJSON(CONTENT_FILE, null);
  if (!raw) return { event: { currentYear: 0, logo: "" }, members: [], editions: {} };
  const migrated = migrateContent(raw);
  if (migrated !== raw && (!raw.editions || !raw.event?.currentYear)) writeJSON(CONTENT_FILE, migrated);
  return migrated;
}
// migración al arrancar
try { if (fs.existsSync(CONTENT_FILE)) readContent(); } catch (e) { console.warn("migración:", e.message); }

// seed votes store si no existe (la clave admin se puede fijar con ADMIN_KEY en el hosting)
if (!fs.existsSync(VOTES_FILE)) {
  writeJSON(VOTES_FILE, { adminKey: process.env.ADMIN_KEY || "aullame2026", locked: true, voters: [], ballots: {} });
}

// --- app ---
const app = express();
app.use(express.json({ limit: "2mb" }));

// auth admin por header
function requireAdmin(req, res, next) {
  const store = readJSON(VOTES_FILE, {});
  const key = req.get("x-admin-key");
  if (!key || key !== store.adminKey) return res.status(401).json({ error: "clave admin inválida" });
  next();
}

// ---------- CONTENIDO ----------
app.get("/api/content", (req, res) => {
  res.json(readContent());
});
app.put("/api/content", requireAdmin, (req, res) => {
  writeJSON(CONTENT_FILE, req.body || {});
  res.json({ ok: true });
});

// ---------- SUBIDA DE FOTOS ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || ".jpg").toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });
app.post("/api/upload", requireAdmin, upload.array("files", 500), (req, res) => {
  const urls = (req.files || []).map((f) => `/img/uploads/${f.filename}`);
  res.json({ urls });
});

// ---------- SUBIDA OPTIMIZADA (galerías/mosaicos: fotos + videos) ----------
const uploadBig = multer({ storage, limits: { fileSize: 300 * 1024 * 1024 } });
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg)$/i;

async function optimizeInto(srcPath, originalName, destDir, urlBase) {
  fs.mkdirSync(path.join(destDir, "thumb"), { recursive: true });
  fs.mkdirSync(path.join(destDir, "view"), { recursive: true });
  const base = path.parse(srcPath).name;
  if (VIDEO_EXT.test(originalName)) {
    const origExt = (path.extname(originalName) || ".mp4").toLowerCase();
    const origCompatible = /\.(mp4|webm)$/i.test(origExt);
    const origSize = fs.statSync(srcPath).size;
    const tmpV = path.join(destDir, base + ".__t.mp4");
    // COMPRIMIR el video al subirlo (async, no bloquea el server). CRF 21, máx 1080p.
    let compressed = false;
    try {
      await pexec(ffmpegPath, ["-y", "-i", srcPath,
        "-vf", "scale='if(gte(iw,ih),min(1920,iw),-2)':'if(gte(iw,ih),-2,min(1920,ih))'",
        "-c:v", "libx264", "-crf", "21", "-preset", "veryfast", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", tmpV],
        { maxBuffer: 1 << 26 });
      compressed = fs.existsSync(tmpV) && fs.statSync(tmpV).size > 0;
    } catch (e) { compressed = false; }

    // usar el comprimido si es más chico, o si el original no es compatible (.mov, etc.)
    let vname;
    if (compressed && (fs.statSync(tmpV).size < origSize || !origCompatible)) {
      vname = base + ".mp4";
      fs.renameSync(tmpV, path.join(destDir, vname));
    } else {
      fs.rmSync(tmpV, { force: true });
      vname = base + (origCompatible ? origExt : ".mp4"); // ya estaba óptimo → dejar original
      fs.copyFileSync(srcPath, path.join(destDir, vname));
    }
    fs.rmSync(srcPath, { force: true });
    const vdest = path.join(destDir, vname);
    const entry = { video: `${urlBase}/${vname}` };
    // fotograma de portada desde el video ya comprimido
    const tmp = path.join(destDir, base + "__f.jpg");
    try {
      await pexec(ffmpegPath, ["-y", "-ss", "0.5", "-i", vdest, "-frames:v", "1", "-q:v", "3", tmp], { maxBuffer: 1 << 26 });
      if (fs.existsSync(tmp) && fs.statSync(tmp).size > 0) {
        await sharp(tmp).resize({ width: 160, withoutEnlargement: true }).webp({ quality: 60 }).toFile(path.join(destDir, "thumb", base + ".webp"));
        await sharp(tmp).resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toFile(path.join(destDir, "view", base + ".webp"));
        entry.t = `${urlBase}/thumb/${base}.webp`;
        entry.poster = `${urlBase}/view/${base}.webp`;
      }
    } catch (e) { /* sin poster */ }
    fs.rmSync(tmp, { force: true });
    return entry;
  }
  // imagen
  await sharp(srcPath).rotate().resize({ width: 160, withoutEnlargement: true }).webp({ quality: 55 }).toFile(path.join(destDir, "thumb", base + ".webp"));
  await sharp(srcPath).rotate().resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toFile(path.join(destDir, "view", base + ".webp"));
  fs.rmSync(srcPath, { force: true }); // borrar el original full-res subido
  return { t: `${urlBase}/thumb/${base}.webp`, v: `${urlBase}/view/${base}.webp` };
}

// ---------- CARGA INICIAL (seed): sube archivos ya optimizados al volumen ----------
// Solo admin. Sube archivo por archivo (sin reprocesar) a public/img o data/.
const SEED_ROOTS = { img: path.join(ROOT, "public", "img"), data: DATA_DIR };
function seedResolve(target, rel) {
  const base = SEED_ROOTS[target];
  if (!base || !rel) return null;
  const p = path.normalize(path.join(base, rel));
  if (p !== base && !p.startsWith(base + path.sep)) return null; // no escapar del dir
  return p;
}
// ¿ya existe (con ese tamaño)? para saltarlo y hacer la carga re-ejecutable
app.get("/api/seed-check", requireAdmin, (req, res) => {
  const p = seedResolve(req.query.target, req.query.path);
  if (!p) return res.status(400).json({ error: "path inválido" });
  const exists = fs.existsSync(p) && (!req.query.size || fs.statSync(p).size === Number(req.query.size));
  res.json({ exists });
});
// escribe un archivo (body crudo) en el volumen. append=1 => agrega (para subir por partes)
app.put("/api/seed-file", requireAdmin, express.raw({ type: "*/*", limit: "64mb" }), (req, res) => {
  const p = seedResolve(req.query.target, req.query.path);
  if (!p) return res.status(400).json({ error: "path inválido" });
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (req.query.append === "1") fs.appendFileSync(p, req.body);
  else fs.writeFileSync(p, req.body); // primer chunk (o archivo entero) trunca
  res.json({ ok: true, size: req.body.length });
});

// ?dir=nombre-de-carpeta (bajo public/img). Devuelve entries listos para el mosaico.
app.post("/api/upload-gallery", requireAdmin, uploadBig.array("files", 300), async (req, res) => {
  const safeDir = String(req.query.dir || "gallery").replace(/[^a-z0-9_-]/gi, "");
  const destDir = path.join(ROOT, "public", "img", safeDir);
  const urlBase = `/img/${safeDir}`;
  const entries = [];
  for (const f of (req.files || [])) {
    try { entries.push(await optimizeInto(f.path, f.originalname, destDir, urlBase)); }
    catch (e) { console.error("optimize fail", f.originalname, e.message); }
  }
  res.json({ entries });
});

// ---------- CONTRIBUCIÓN PÚBLICA (los integrantes suben sus fotos) ----------
// Sin clave: cualquiera con el link sube. Se optimiza y aparece al toque.
const MES_ORDER = { ENE:0,FEB:1,MAR:2,ABR:3,MAY:4,JUN:5,JUL:6,AGO:7,SEP:8,OCT:9,NOV:10,DIC:11 };
app.post("/api/contribute", uploadBig.array("files", 200), async (req, res) => {
  const year = String(req.query.year || req.body?.year || "2026");
  const mes = String(req.query.mes || req.body?.mes || "").toUpperCase();
  if (!(mes in MES_ORDER)) return res.status(400).json({ error: "Mes inválido" });
  const content = readContent();
  if (!/^\d{4}$/.test(year) || !content.editions[year]) return res.status(400).json({ error: "Año inválido" });

  const destDir = path.join(ROOT, "public", "img", "contrib", year, mes);
  const urlBase = `/img/contrib/${year}/${mes}`;
  const entries = [];
  for (const f of (req.files || [])) {
    try { entries.push(await optimizeInto(f.path, f.originalname, destDir, urlBase)); }
    catch (e) { console.error("contrib optimize fail", f.originalname, e.message); }
  }
  if (!entries.length) return res.status(400).json({ error: "No se pudo procesar ningún archivo" });

  // engancharlo a la timeline de esa edición
  const tl = content.editions[year].timeline = content.editions[year].timeline || [];
  let m = tl.find((t) => (t.mes || "").toUpperCase() === mes);
  if (!m) { m = { mes, titulo: "", desc: "", fotos: [] }; tl.push(m); }
  m.fotos = [...(m.fotos || []), ...entries];
  tl.sort((a, b) => (MES_ORDER[(a.mes || "").toUpperCase()] ?? 99) - (MES_ORDER[(b.mes || "").toUpperCase()] ?? 99));
  writeJSON(CONTENT_FILE, content);

  res.json({ ok: true, count: entries.length });
});

// ---------- VOTACIÓN (público con token) ----------
app.get("/api/ballot/:token", (req, res) => {
  const votes = readJSON(VOTES_FILE, {});
  const content = readContent();
  const voter = (votes.voters || []).find((v) => v.token === req.params.token);
  if (!voter) return res.status(404).json({ error: "Link de votación inválido" });
  const ed = currentEdition(content) || { categorias: [] };
  res.json({
    ok: true,
    voter: { name: voter.name },
    alreadyVoted: !!votes.ballots[voter.token],
    categories: (ed.categorias || []).map((c) => ({ id: c.id, nombre: c.nombre, emoji: c.emoji })),
    candidates: (content.members || []).map((m) => ({ id: m.id, nombre: m.nombre, apodo: m.apodo, foto: m.foto })),
  });
});

app.post("/api/ballot/:token", (req, res) => {
  const votes = readJSON(VOTES_FILE, {});
  const voter = (votes.voters || []).find((v) => v.token === req.params.token);
  if (!voter) return res.status(404).json({ error: "Link inválido" });
  if (votes.ballots[voter.token]) return res.status(409).json({ error: "Ya votaste 🐺" });
  const picks = (req.body && req.body.votes) || {};
  votes.ballots[voter.token] = picks;
  voter.voted = true;
  writeJSON(VOTES_FILE, votes);
  res.json({ ok: true });
});

// ---------- ADMIN: votantes, lock, resultados ----------
app.get("/api/admin/state", requireAdmin, (req, res) => {
  const votes = readJSON(VOTES_FILE, {});
  res.json({
    locked: votes.locked,
    totalVoters: (votes.voters || []).length,
    totalVoted: Object.keys(votes.ballots || {}).length,
    voters: (votes.voters || []).map((v) => ({
      id: v.id, name: v.name, token: v.token, voted: !!votes.ballots[v.token],
    })),
  });
});

// crear/actualizar votantes. body: { names: ["Fulano", ...] }
app.post("/api/admin/voters", requireAdmin, (req, res) => {
  const votes = readJSON(VOTES_FILE, {});
  const names = (req.body && req.body.names) || [];
  const existing = votes.voters || [];
  votes.voters = names.map((name, i) => {
    const prev = existing[i];
    return { id: "v" + (i + 1), name: String(name).trim(), token: prev ? prev.token : token() };
  });
  writeJSON(VOTES_FILE, votes);
  res.json({ ok: true, voters: votes.voters });
});

// bloquear/desbloquear resultados (desbloquear = habilita la ceremonia real)
app.post("/api/admin/lock", requireAdmin, (req, res) => {
  const votes = readJSON(VOTES_FILE, {});
  votes.locked = !!(req.body && req.body.locked);
  writeJSON(VOTES_FILE, votes);
  res.json({ ok: true, locked: votes.locked });
});

// cambiar clave admin
app.post("/api/admin/key", requireAdmin, (req, res) => {
  const votes = readJSON(VOTES_FILE, {});
  const nk = (req.body && req.body.newKey || "").trim();
  if (nk.length < 4) return res.status(400).json({ error: "clave muy corta" });
  votes.adminKey = nk;
  writeJSON(VOTES_FILE, votes);
  res.json({ ok: true });
});

// calcula el conteo por categoría (de la edición en curso)
function computeResults() {
  const votes = readJSON(VOTES_FILE, {});
  const content = readContent();
  const ed = currentEdition(content) || { categorias: [] };
  const memberName = (id) => (content.members || []).find((m) => m.id === id)?.nombre || id;
  const ballots = Object.values(votes.ballots || {});
  return (ed.categorias || []).map((cat) => {
    const counts = {};
    for (const b of ballots) {
      const pick = b[cat.id];
      if (pick) counts[pick] = (counts[pick] || 0) + 1;
    }
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return {
      categoria: cat.nombre, emoji: cat.emoji, mayor: !!cat.mayor,
      nominados: ranked.slice(0, 4).map(([id]) => memberName(id)),
      primero: ranked[0] ? memberName(ranked[0][0]) : "—",
      segundo: ranked[1] ? memberName(ranked[1][0]) : "—",
      detalle: ranked.map(([id, n]) => ({ nombre: memberName(id), votos: n })),
    };
  });
}

// resultados completos (solo admin, siempre disponibles)
app.get("/api/admin/results", requireAdmin, (req, res) => res.json(computeResults()));

// ceremonia pública: solo si está DESBLOQUEADO (la noche del evento)
app.get("/api/ceremony", (req, res) => {
  const votes = readJSON(VOTES_FILE, {});
  if (votes.locked) return res.status(403).json({ error: "locked" });
  // orden: categorías normales primero, el "mayor" (Aullame del Año) al final
  const r = computeResults().map(({ detalle, ...rest }) => rest);
  r.sort((a, b) => (a.mayor === b.mayor ? 0 : a.mayor ? 1 : -1));
  res.json(r);
});

// PREMIOS: mismo formato que el array de la presentación (ceremonia.html).
// { nombre, desc, nominados:[...], ganador, segundo, nota, mayor }
// Solo disponible cuando el organizador desbloqueó (si no, la presentación usa su ejemplo).
app.get("/api/premios", (req, res) => {
  const votes = readJSON(VOTES_FILE, {});
  if (votes.locked) return res.status(403).json({ error: "locked" });
  const content = readContent();
  const ed = currentEdition(content) || { categorias: [] };
  const descByName = Object.fromEntries((ed.categorias || []).map((c) => [c.nombre, c.desc || ""]));
  const premios = computeResults().map((r) => ({
    nombre: r.categoria,
    desc: descByName[r.categoria] || "",
    nominados: r.nominados,
    ganador: r.primero,
    segundo: r.segundo,
    nota: "",
    ...(r.mayor ? { mayor: true } : {}),
  }));
  premios.sort((a, b) => (!!a.mayor === !!b.mayor ? 0 : a.mayor ? 1 : -1));
  res.json(premios);
});

// --- Servir el sitio compilado (solo en modo producción: node server --serve) ---
if (SERVE) {
  const DIST = path.join(ROOT, "dist");
  if (fs.existsSync(DIST)) app.use(express.static(DIST));
  else console.warn("⚠️  No existe dist/. Corré 'npm run build' antes de 'npm start'.");
  // public/ se sirve en vivo: fotos (subidas + timeline), modelo 3D y ceremonia.html
  app.use(express.static(path.join(ROOT, "public")));
}

app.listen(PORT, () => {
  if (SERVE) console.log(`🐺 Aullame (sitio + API) en http://localhost:${PORT}`);
  else console.log(`🐺 Aullame API en http://localhost:${PORT}`);
});
