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
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";

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
  res.json(readJSON(CONTENT_FILE, null) || {});
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
    const vname = base + (path.extname(originalName).toLowerCase() || ".mp4");
    const vdest = path.join(destDir, vname);
    fs.renameSync(srcPath, vdest);
    const entry = { video: `${urlBase}/${vname}` };
    const tmp = path.join(destDir, base + "__f.jpg");
    try {
      execFileSync(ffmpegPath, ["-y", "-ss", "0.5", "-i", vdest, "-frames:v", "1", "-q:v", "3", tmp], { stdio: "ignore" });
      if (fs.existsSync(tmp) && fs.statSync(tmp).size > 0) {
        await sharp(tmp).resize({ width: 160, withoutEnlargement: true }).webp({ quality: 60 }).toFile(path.join(destDir, "thumb", base + ".webp"));
        await sharp(tmp).resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toFile(path.join(destDir, "view", base + ".webp"));
        entry.t = `${urlBase}/thumb/${base}.webp`;
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
  if (!["2025", "2026"].includes(year)) return res.status(400).json({ error: "Año inválido" });

  const destDir = path.join(ROOT, "public", "img", "contrib", year, mes);
  const urlBase = `/img/contrib/${year}/${mes}`;
  const entries = [];
  for (const f of (req.files || [])) {
    try { entries.push(await optimizeInto(f.path, f.originalname, destDir, urlBase)); }
    catch (e) { console.error("contrib optimize fail", f.originalname, e.message); }
  }
  if (!entries.length) return res.status(400).json({ error: "No se pudo procesar ningún archivo" });

  // engancharlo al timeline correspondiente
  const content = readJSON(CONTENT_FILE, {});
  let tl;
  if (year === "2025") { content.edition2025 = content.edition2025 || {}; tl = content.edition2025.timeline = content.edition2025.timeline || []; }
  else { tl = content.timeline = content.timeline || []; }
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
  const content = readJSON(CONTENT_FILE, {});
  const voter = (votes.voters || []).find((v) => v.token === req.params.token);
  if (!voter) return res.status(404).json({ error: "Link de votación inválido" });
  res.json({
    ok: true,
    voter: { name: voter.name },
    alreadyVoted: !!votes.ballots[voter.token],
    categories: (content.categories || []).map((c) => ({ id: c.id, nombre: c.nombre, emoji: c.emoji })),
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

// calcula el conteo por categoría
function computeResults() {
  const votes = readJSON(VOTES_FILE, {});
  const content = readJSON(CONTENT_FILE, {});
  const memberName = (id) => (content.members || []).find((m) => m.id === id)?.nombre || id;
  const ballots = Object.values(votes.ballots || {});
  return (content.categories || []).map((cat) => {
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
  const content = readJSON(CONTENT_FILE, {});
  const descByName = Object.fromEntries((content.categories || []).map((c) => [c.nombre, c.desc || ""]));
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
