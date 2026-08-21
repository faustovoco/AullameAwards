import "./style.css";
import { renderTimelineMosaic } from "./mosaic.js";
import { loadContent } from "./content.js";
import { MES_ORDER, MES_NOMBRE } from "./migrate.js";

const page = document.getElementById("gal-page");
const H = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const MESES = Object.keys(MES_ORDER); // ENE..DIC en orden

let content, albumId = "general", mode = "view", selected = new Set(), code = "";

const askCode = () => (prompt("Clave de la galería (para esta acción):") || "").trim();

async function api(path, opts = {}, useCode) {
  const headers = { ...(opts.headers || {}) };
  if (useCode) headers["x-gallery-code"] = useCode;
  if (opts.body && !(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
  return fetch(path, { ...opts, headers });
}
async function reload() { content = await loadContent(); render(); }

const albumFotos = () => (content.gallery.fotos || []).filter((f) => (f.albumId || "general") === albumId);

// agrupa por año (desc) → mes (cronológico), + "sin mes" por año, + "sin año" al final
function grouped(fotos) {
  const years = {}, noYear = [];
  for (const f of fotos) {
    if (!f.year) { noYear.push(f); continue; }
    const y = (years[f.year] = years[f.year] || { meses: {}, sinMes: [] });
    if (f.month) (y.meses[f.month] = y.meses[f.month] || []).push(f);
    else y.sinMes.push(f);
  }
  const rows = [];
  for (const y of Object.keys(years).map(Number).sort((a, b) => b - a)) {
    const yd = years[y];
    // el año se muestra 1 vez (sectionLabel); debajo van los meses
    for (const mes of Object.keys(yd.meses).sort((a, b) => (MES_ORDER[a] ?? 99) - (MES_ORDER[b] ?? 99)))
      rows.push({ sectionLabel: String(y), mes: MES_NOMBRE[mes] || mes, titulo: "", fotos: yd.meses[mes] });
    if (yd.sinMes.length) rows.push({ sectionLabel: String(y), mes: "Sin mes", titulo: "", fotos: yd.sinMes });
  }
  if (noYear.length) rows.push({ sectionLabel: "Sin clasificar", mes: "", titulo: "", fotos: noYear });
  return rows;
}

function render() {
  document.querySelector(".nav")?.classList.add("scrolled");
  if (content.event?.logo) {
    const icon = document.getElementById("nav-icon");
    if (icon) { icon.src = content.event.logo; icon.hidden = false; document.getElementById("nav-icon-fallback").hidden = true; }
  }
  const albums = content.gallery.albums;
  page.innerHTML = `
    <div class="gal-head">
      <h1 class="gal-title">Galería</h1>
      <div class="gal-albums">
        ${albums.map((a) => `<button class="gal-alb ${a.id === albumId ? "on" : ""}" data-alb="${a.id}">${H(a.nombre)}</button>`).join("")}
        <button class="gal-alb gal-alb--add" id="add-alb">＋ Álbum</button>
      </div>
      <div class="gal-actions">
        ${mode === "view" ? `
          <button class="gal-btn gal-btn--up" id="up">📸 Subir fotos</button>
          <button class="gal-btn" id="sel">Seleccionar / eliminar</button>
          ${albumId !== "general" ? `<button class="gal-btn" id="renalb">Renombrar</button><button class="gal-btn gal-btn--del" id="delalb">Borrar álbum</button>` : ""}
        ` : `
          <span class="gal-selinfo">${selected.size} seleccionadas</span>
          <button class="gal-btn gal-btn--del" id="dodel">🗑 Eliminar</button>
          <button class="gal-btn" id="cancelsel">Cancelar</button>
        `}
      </div>
    </div>
    <div id="up-form" class="gal-upform" hidden></div>
    <div id="gal-body"></div>`;

  // álbum tabs
  page.querySelectorAll("[data-alb]").forEach((b) => (b.onclick = () => { albumId = b.dataset.alb; mode = "view"; selected.clear(); render(); }));
  document.getElementById("add-alb").onclick = async () => {
    const c = askCode(); if (!c) return;
    const nombre = prompt("Nombre del álbum (ej: Viajes):"); if (!nombre) return;
    const r = await api("/api/gallery/album", { method: "POST", body: JSON.stringify({ action: "create", nombre }) }, c);
    if (!r.ok) return alert("Clave incorrecta");
    await reload();
  };

  if (mode === "view") {
    document.getElementById("up").onclick = () => { code = askCode(); if (code) showUpForm(); };
    document.getElementById("sel").onclick = () => { code = askCode(); if (!code) return; mode = "select"; selected.clear(); render(); };
    const rn = document.getElementById("renalb");
    if (rn) rn.onclick = async () => {
      const c = askCode(); if (!c) return;
      const nombre = prompt("Nuevo nombre:", albums.find((a) => a.id === albumId)?.nombre); if (!nombre) return;
      const r = await api("/api/gallery/album", { method: "POST", body: JSON.stringify({ action: "rename", id: albumId, nombre }) }, c);
      if (!r.ok) return alert("Clave incorrecta"); await reload();
    };
    const da = document.getElementById("delalb");
    if (da) da.onclick = async () => {
      const c = askCode(); if (!c) return;
      if (!confirm("¿Borrar el álbum? Las fotos pasan a General.")) return;
      const r = await api("/api/gallery/album", { method: "POST", body: JSON.stringify({ action: "delete", id: albumId }) }, c);
      if (!r.ok) return alert("Clave incorrecta"); albumId = "general"; await reload();
    };
  } else {
    document.getElementById("dodel").onclick = async () => {
      if (!selected.size) return;
      if (!confirm(`¿Eliminar ${selected.size} foto(s)?`)) return;
      const r = await api("/api/gallery/delete", { method: "POST", body: JSON.stringify({ ids: [...selected] }) }, code);
      if (!r.ok) return alert("Clave incorrecta");
      mode = "view"; selected.clear(); await reload();
    };
    document.getElementById("cancelsel").onclick = () => { mode = "view"; selected.clear(); render(); };
  }

  const body = document.getElementById("gal-body");
  const fotos = albumFotos();
  if (!fotos.length) body.innerHTML = `<p class="gal-empty">No hay fotos en este álbum todavía. Tocá <b>Subir fotos</b>.</p>`;
  else if (mode === "view") renderTimelineMosaic(body, grouped(fotos), { scrubber: true });
  else renderSelectGrid(body, fotos);
}

function renderSelectGrid(body, fotos) {
  body.className = "gal-selgrid";
  body.innerHTML = fotos.map((f) => {
    const isVid = f.video && !f.t;
    const src = f.t || f.v || "";
    return `<div class="gal-seltile ${selected.has(f.id) ? "sel" : ""}" data-id="${H(f.id)}">
      ${isVid ? `<span class="gal-vidph">🎬</span>` : `<img loading="lazy" src="${H(src)}">`}
      <span class="gal-check">✓</span>
    </div>`;
  }).join("");
  body.querySelectorAll("[data-id]").forEach((t) => (t.onclick = () => {
    const id = t.dataset.id;
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    t.classList.toggle("sel");
    const info = document.querySelector(".gal-selinfo"); if (info) info.textContent = selected.size + " seleccionadas";
  }));
}

function showUpForm() {
  const el = document.getElementById("up-form");
  el.hidden = false;
  el.innerHTML = `
    <div class="gal-upform__row">
      <label>Álbum<select id="up-album">${content.gallery.albums.map((a) => `<option value="${a.id}" ${a.id === albumId ? "selected" : ""}>${H(a.nombre)}</option>`).join("")}</select></label>
      <label>Año (opcional)<input id="up-year" placeholder="ej: 2025" inputmode="numeric" maxlength="4" /></label>
      <label>Mes (opcional)<select id="up-mes"><option value="">—</option>${MESES.map((m) => `<option value="${m}">${MES_NOMBRE[m]}</option>`).join("")}</select></label>
    </div>
    <label class="gal-drop"><input type="file" id="up-files" accept="image/*,video/*" multiple hidden /><span id="up-text">📸 Tocá para elegir fotos y videos (o desde Google Fotos / Drive)</span></label>
    <div class="gal-upform__actions">
      <button class="gal-btn gal-btn--up" id="up-go" disabled>Subir</button>
      <button class="gal-btn" id="up-cancel">Cancelar</button>
      <span class="gal-upstatus" id="up-status"></span>
    </div>`;
  const files = el.querySelector("#up-files"), text = el.querySelector("#up-text"), go = el.querySelector("#up-go"), status = el.querySelector("#up-status");
  files.onchange = () => { const n = files.files.length; text.textContent = n ? `${n} archivo(s) elegido(s)` : "📸 Tocá para elegir"; go.disabled = !n; };
  el.querySelector("#up-cancel").onclick = () => { el.hidden = true; el.innerHTML = ""; };
  go.onclick = async () => {
    const year = el.querySelector("#up-year").value.trim();
    const mes = el.querySelector("#up-mes").value;
    const album = el.querySelector("#up-album").value;
    go.disabled = true; status.textContent = `Subiendo y optimizando ${files.files.length}…`;
    const fd = new FormData(); [...files.files].forEach((f) => fd.append("files", f));
    try {
      const r = await api(`/api/gallery/upload?album=${encodeURIComponent(album)}&year=${encodeURIComponent(year)}&mes=${encodeURIComponent(mes)}`, { method: "POST", body: fd }, code);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error");
      status.textContent = `✅ ${j.count} subidas`;
      el.hidden = true; el.innerHTML = "";
      await reload();
    } catch (e) { go.disabled = false; status.textContent = "❌ " + e.message; }
  };
}

(async function init() { content = await loadContent(); render(); })();
