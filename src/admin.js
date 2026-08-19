import "./style.css";
import "./admin.css";

const root = document.getElementById("admin-root");
const state = {
  key: localStorage.getItem("aullame_key") || "",
  content: null,
  voteState: null,
  results: null,
  tab: "contenido",
};

const H = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const uid = (p) => p + Math.random().toString(36).slice(2, 7);

async function api(path, opts = {}) {
  const headers = { "x-admin-key": state.key, ...(opts.headers || {}) };
  if (opts.body && !(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
  return fetch(path, { ...opts, headers });
}

async function uploadFiles(fileList) {
  const fd = new FormData();
  [...fileList].forEach((f) => fd.append("files", f));
  const r = await api("/api/upload", { method: "POST", body: fd });
  if (!r.ok) throw new Error("Error al subir imágenes");
  return (await r.json()).urls;
}

// sube y optimiza (fotos + videos) a una galería; devuelve entries {t,v}/{video}
async function uploadGallery(fileList, dir) {
  const fd = new FormData();
  [...fileList].forEach((f) => fd.append("files", f));
  const r = await api(`/api/upload-gallery?dir=${encodeURIComponent(dir)}`, { method: "POST", body: fd });
  if (!r.ok) throw new Error("Error al subir");
  return (await r.json()).entries;
}

// ---------------- LOGIN ----------------
function renderLogin(err) {
  root.innerHTML = `
    <div class="adm-login">
      <div class="adm-login__box">
        <div class="adm-kicker">AULLAME AWARDS</div>
        <h1>Panel de edición</h1>
        <p class="adm-muted">Ingresá la clave de organizador.</p>
        <input id="key" type="password" placeholder="Clave" value="${H(state.key)}" />
        ${err ? `<p class="adm-error">${H(err)}</p>` : ""}
        <button id="enter">Entrar</button>
        <p class="adm-hint">Clave inicial: <code>aullame2026</code> (cambiala en Ajustes)</p>
      </div>
    </div>`;
  const enter = () => tryLogin(document.getElementById("key").value.trim());
  document.getElementById("enter").onclick = enter;
  document.getElementById("key").addEventListener("keydown", (e) => e.key === "Enter" && enter());
}

async function tryLogin(key) {
  state.key = key;
  const r = await api("/api/admin/state");
  if (!r.ok) return renderLogin("Clave incorrecta o servidor apagado.");
  localStorage.setItem("aullame_key", key);
  await loadAll();
  renderApp();
}

async function loadAll() {
  state.content = await (await fetch("/api/content")).json();
  state.voteState = await (await api("/api/admin/state")).json();
  try { state.results = await (await api("/api/admin/results")).json(); } catch { state.results = []; }
}

// ---------------- APP SHELL ----------------
function renderApp() {
  root.innerHTML = `
    <header class="adm-top">
      <div class="adm-brand">🐺 <b>Aullame</b> · Panel</div>
      <nav class="adm-tabs">
        ${tabBtn("contenido", "Contenido")}
        ${tabBtn("votantes", "Votantes")}
        ${tabBtn("resultados", "Resultados")}
        ${tabBtn("ajustes", "Ajustes")}
      </nav>
      <a class="adm-view" href="/" target="_blank">Ver sitio ↗</a>
    </header>
    <main class="adm-main" id="adm-main"></main>
    <div class="adm-toast" id="toast" hidden></div>`;
  root.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; renderApp(); }));
  const main = document.getElementById("adm-main");
  ({ contenido: tabContenido, votantes: tabVotantes, resultados: tabResultados, ajustes: tabAjustes }[state.tab])(main);
}
const tabBtn = (id, label) => `<button data-tab="${id}" class="${state.tab === id ? "on" : ""}">${label}</button>`;

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.hidden = false; t.classList.add("show");
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => (t.hidden = true), 300); }, 2000);
}

// ---------------- TAB: CONTENIDO ----------------
function tabContenido(main) {
  const c = state.content;
  const dt = toLocalInput(c.event?.ceremonyDate);
  main.innerHTML = `
    <section class="adm-sec">
      <h2>Evento</h2>
      <div class="adm-grid2">
        <label>Edición<input id="ev-edicion" value="${H(c.event?.edicion || "")}" /></label>
        <label>Fecha y hora de la ceremonia<input id="ev-fecha" type="datetime-local" value="${dt}" /></label>
      </div>
      <label class="adm-logo">Logo (ícono del sitio)
        <div class="adm-logo__row">
          <div class="adm-logo__prev">${c.event?.logo ? `<img src="${H(c.event.logo)}">` : "🐺"}</div>
          <button class="adm-up" data-up="logo">Subir logo</button>
          ${c.event?.logo ? `<button class="adm-del" data-dellogo>Quitar</button>` : ""}
        </div>
      </label>
    </section>

    <section class="adm-sec">
      <h2>Integrantes <button class="adm-add" data-add="member">+ Agregar</button></h2>
      <div id="members">${c.members.map(memberRow).join("")}</div>
    </section>

    <section class="adm-sec">
      <h2>Categorías <button class="adm-add" data-add="cat">+ Agregar</button></h2>
      <div id="cats">${c.categories.map(catRow).join("")}</div>
    </section>

    <section class="adm-sec">
      <h2>Recuerdos del año (mosaico) <button class="adm-add" data-add="month">+ Agregar mes</button></h2>
      <div id="months">${c.timeline.map(monthRow).join("")}</div>
    </section>

    <section class="adm-sec">
      <h2>Edición 2025 (ganadores)</h2>
      <div class="adm-grid2">
        <label>Aullame del Año<input id="e25-gan" value="${H(c.edition2025?.aullameDelAnio?.ganador || "")}" /></label>
        <label>Frase<input id="e25-frase" value="${H(c.edition2025?.aullameDelAnio?.frase || "")}" /></label>
      </div>
      <div id="e25gan">${(c.edition2025?.ganadores || []).map(gan25Row).join("")}</div>
      <button class="adm-add" data-add="g25">+ Agregar ganador 2025</button>
    </section>

    <section class="adm-sec">
      <h2>Recuerdos 2025 (timeline por meses) <button class="adm-add" data-add="month2025">+ Agregar mes</button></h2>
      <p class="adm-muted">Igual que el timeline del año: cada mes con su descripción y sus fotos/videos. Se muestran debajo de los ganadores en "Edición 2025".</p>
      <div id="months2025">${(c.edition2025?.timeline || []).map(monthRow).join("")}</div>
    </section>

    <div class="adm-savebar">
      <button class="adm-save" id="save">💾 Guardar todo</button>
      <span class="adm-muted">Los cambios se ven en el sitio al recargar.</span>
    </div>`;

  bindContenido(main);
}

const memberRow = (m) => `
  <div class="adm-card" data-mid="${m.id}">
    <div class="adm-photo" data-photo>${m.foto ? `<img src="${H(m.foto)}">` : "🐺"}</div>
    <div class="adm-fields">
      <input data-f="nombre" placeholder="Nombre" value="${H(m.nombre)}" />
      <input data-f="apodo" placeholder="Apodo" value="${H(m.apodo)}" />
      <textarea data-f="desc" placeholder="Descripción">${H(m.desc)}</textarea>
    </div>
    <div class="adm-card__actions">
      <button class="adm-up" data-upmember>Foto</button>
      <button class="adm-del" data-delmember>✕</button>
    </div>
  </div>`;

const catRow = (c) => `
  <div class="adm-row" data-cid="${c.id}">
    <input class="adm-emoji" data-f="emoji" value="${H(c.emoji)}" />
    <input data-f="nombre" placeholder="Categoría" value="${H(c.nombre)}" />
    <input data-f="desc" placeholder="Descripción" value="${H(c.desc)}" />
    <label class="adm-check"><input type="checkbox" data-f="mayor" ${c.mayor ? "checked" : ""}/> mayor</label>
    <button class="adm-del" data-delcat>✕</button>
  </div>`;

const monthRow = (t, i) => `
  <div class="adm-month" data-mi="${i}">
    <div class="adm-month__head">
      <input class="adm-mes" data-f="mes" value="${H(t.mes)}" />
      <input data-f="titulo" placeholder="Título" value="${H(t.titulo)}" />
      <input data-f="desc" placeholder="Descripción" value="${H(t.desc)}" />
      <button class="adm-up" data-upmonth>+ Fotos</button>
      <button class="adm-del" data-delmonth>✕</button>
    </div>
    <div class="adm-thumbs">
      ${(t.fotos || []).map((f, fi) => {
        const isVid = typeof f !== "string" && f.video;
        const src = typeof f === "string" ? f : (f.t || f.v || "");
        const inner = isVid && !src ? `<span class="adm-thumb__vid">🎬</span>` : `<img src="${H(src)}">`;
        return `<div class="adm-thumb">${inner}<button data-delfoto="${fi}">✕</button></div>`;
      }).join("")
        || `<span class="adm-muted">Sin fotos. Subí muchas para el mosaico.</span>`}
    </div>
  </div>`;

const gan25Row = (g, i) => `
  <div class="adm-row" data-g25="${i}">
    <input data-f="categoria" placeholder="Categoría" value="${H(g.categoria)}" />
    <input data-f="ganador" placeholder="Ganador" value="${H(g.ganador)}" />
    <button class="adm-del" data-delg25>✕</button>
  </div>`;

const e25fotosThumbs = (fotos) => (fotos || []).map((f, fi) => {
  const isVid = typeof f !== "string" && f.video;
  const src = typeof f === "string" ? f : (f.t || f.v || "");
  const inner = isVid && !src ? `<span class="adm-thumb__vid">🎬</span>` : `<img src="${H(src)}">`;
  return `<div class="adm-thumb">${inner}<button data-del2025foto="${fi}">✕</button></div>`;
}).join("") || `<span class="adm-muted">Sin fotos todavía.</span>`;

function bindContenido(main) {
  const c = state.content;
  // inputs simples de evento y 2025 (guardan en state al escribir)
  const bind = (id, setter) => { const el = document.getElementById(id); if (el) el.oninput = () => setter(el.value); };
  bind("ev-edicion", (v) => (c.event.edicion = v));
  bind("ev-fecha", (v) => (c.event.ceremonyDate = fromLocalInput(v)));
  bind("e25-gan", (v) => (c.edition2025.aullameDelAnio.ganador = v));
  bind("e25-frase", (v) => (c.edition2025.aullameDelAnio.frase = v));

  // logo
  main.querySelector("[data-up='logo']").onclick = () => pickFiles(false, async (files) => {
    const [url] = await uploadFiles(files); c.event.logo = url; renderApp();
  });
  const dl = main.querySelector("[data-dellogo]"); if (dl) dl.onclick = () => { c.event.logo = ""; renderApp(); };

  // members
  main.querySelectorAll("[data-mid]").forEach((card) => {
    const m = c.members.find((x) => x.id === card.dataset.mid);
    card.querySelectorAll("[data-f]").forEach((el) => (el.oninput = () => (m[el.dataset.f] = el.value)));
    card.querySelector("[data-upmember]").onclick = () => pickFiles(false, async (files) => {
      const [url] = await uploadFiles(files); m.foto = url; renderApp();
    });
    card.querySelector("[data-delmember]").onclick = () => { c.members = c.members.filter((x) => x !== m); renderApp(); };
  });

  // cats
  main.querySelectorAll("[data-cid]").forEach((row) => {
    const cat = c.categories.find((x) => x.id === row.dataset.cid);
    row.querySelectorAll("[data-f]").forEach((el) => (el[el.type === "checkbox" ? "onchange" : "oninput"] =
      () => (cat[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value)));
    row.querySelector("[data-delcat]").onclick = () => { c.categories = c.categories.filter((x) => x !== cat); renderApp(); };
  });

  // months (timeline 2026)
  main.querySelectorAll("#months [data-mi]").forEach((row) => {
    const t = c.timeline[+row.dataset.mi];
    row.querySelectorAll("[data-f]").forEach((el) => (el.oninput = () => (t[el.dataset.f] = el.value)));
    row.querySelector("[data-upmonth]").onclick = () => pickFiles(true, async (files) => {
      const urls = await uploadFiles(files); t.fotos = [...(t.fotos || []), ...urls]; renderApp();
    });
    row.querySelector("[data-delmonth]").onclick = () => { c.timeline.splice(+row.dataset.mi, 1); renderApp(); };
    row.querySelectorAll("[data-delfoto]").forEach((b) => (b.onclick = () => { t.fotos.splice(+b.dataset.delfoto, 1); renderApp(); }));
  });

  // 2025 ganadores
  main.querySelectorAll("[data-g25]").forEach((row) => {
    const g = c.edition2025.ganadores[+row.dataset.g25];
    row.querySelectorAll("[data-f]").forEach((el) => (el.oninput = () => (g[el.dataset.f] = el.value)));
    row.querySelector("[data-delg25]").onclick = () => { c.edition2025.ganadores.splice(+row.dataset.g25, 1); renderApp(); };
  });

  // recuerdos 2025 (timeline por meses, con subida optimizada)
  if (!Array.isArray(c.edition2025.timeline)) c.edition2025.timeline = [];
  const save = () => api("/api/content", { method: "PUT", body: JSON.stringify(c) });
  main.querySelectorAll("#months2025 [data-mi]").forEach((row) => {
    const t = c.edition2025.timeline[+row.dataset.mi];
    row.querySelectorAll("[data-f]").forEach((el) => (el.oninput = () => (t[el.dataset.f] = el.value)));
    row.querySelector("[data-upmonth]").onclick = () => pickFiles(true, async (files) => {
      toast("Subiendo y optimizando…");
      const entries = await uploadGallery(files, "2025-timeline");
      t.fotos = [...(t.fotos || []), ...entries];
      await save(); toast("✅ Fotos agregadas"); renderApp();
    }, "image/*,video/*");
    row.querySelector("[data-delmonth]").onclick = () => { c.edition2025.timeline.splice(+row.dataset.mi, 1); renderApp(); };
    row.querySelectorAll("[data-delfoto]").forEach((b) => (b.onclick = async () => { t.fotos.splice(+b.dataset.delfoto, 1); await save(); renderApp(); }));
  });

  // add buttons
  main.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => {
    if (b.dataset.add === "member") c.members.push({ id: uid("m"), nombre: "Nuevo", apodo: "", foto: "", desc: "" });
    if (b.dataset.add === "cat") c.categories.push({ id: uid("c"), nombre: "Nueva categoría", emoji: "🏆", desc: "", mayor: false });
    if (b.dataset.add === "month") c.timeline.push({ mes: "MES", titulo: "", desc: "", fotos: [] });
    if (b.dataset.add === "month2025") { (c.edition2025.timeline = c.edition2025.timeline || []).push({ mes: "MES", titulo: "", desc: "", fotos: [] }); }
    if (b.dataset.add === "g25") c.edition2025.ganadores.push({ categoria: "", ganador: "", foto: "" });
    renderApp();
  }));

  // save
  document.getElementById("save").onclick = async () => {
    const r = await api("/api/content", { method: "PUT", body: JSON.stringify(c) });
    toast(r.ok ? "✅ Guardado" : "❌ Error al guardar");
  };
}

// ---------------- TAB: VOTANTES ----------------
function tabVotantes(main) {
  const vs = state.voteState || { voters: [] };
  const origin = location.origin;
  const namesText = vs.voters.map((v) => v.name).join("\n");
  main.innerHTML = `
    <section class="adm-sec">
      <h2>Votantes</h2>
      <p class="adm-muted">Escribí un nombre por línea. Al generar, cada uno recibe un <b>link personal y secreto</b>.</p>
      <textarea id="voters-names" class="adm-names" rows="8" placeholder="Fulano&#10;Mengano&#10;...">${H(namesText)}</textarea>
      <button class="adm-save" id="gen">Generar / actualizar links</button>
    </section>
    <section class="adm-sec">
      <h2>Links personales (${vs.voters.length})</h2>
      <p class="adm-muted">Enviale a cada uno SU link. ${state.voteState?.totalVoted || 0} de ${vs.voters.length} ya votaron.</p>
      <div class="adm-voters">
        ${vs.voters.map((v) => {
          const link = `${origin}/voto.html?t=${v.token}`;
          return `<div class="adm-voter">
            <span class="adm-voter__name">${H(v.name)} ${v.voted ? '<b class="ok">✔ votó</b>' : '<b class="pend">pendiente</b>'}</span>
            <input readonly value="${link}" />
            <button class="adm-copy" data-copy="${H(link)}">Copiar</button>
          </div>`;
        }).join("") || `<p class="adm-muted">Todavía no generaste links.</p>`}
      </div>
    </section>`;

  document.getElementById("gen").onclick = async () => {
    const names = document.getElementById("voters-names").value.split("\n").map((s) => s.trim()).filter(Boolean);
    const r = await api("/api/admin/voters", { method: "POST", body: JSON.stringify({ names }) });
    if (r.ok) { state.voteState = await (await api("/api/admin/state")).json(); toast("✅ Links generados"); renderApp(); }
    else toast("❌ Error");
  };
  main.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => {
    navigator.clipboard.writeText(b.dataset.copy); toast("📋 Link copiado");
  }));
}

// ---------------- TAB: RESULTADOS ----------------
async function tabResultados(main) {
  state.voteState = await (await api("/api/admin/state")).json();
  state.results = await (await api("/api/admin/results")).json();
  const locked = state.voteState.locked;
  main.innerHTML = `
    <section class="adm-sec">
      <h2>Estado de la ceremonia</h2>
      <div class="adm-lock ${locked ? "locked" : "unlocked"}">
        <div>
          <b>${locked ? "🔒 Resultados bloqueados" : "🔓 Resultados desbloqueados"}</b>
          <p class="adm-muted">${locked
            ? "La ceremonia del sitio mostrará datos de EJEMPLO. Desbloqueá recién la noche del evento."
            : "La ceremonia del sitio ya muestra los GANADORES REALES. ¡Cuidado!"}</p>
        </div>
        <button class="adm-save" id="togglelock">${locked ? "Desbloquear (revelar)" : "Volver a bloquear"}</button>
      </div>
    </section>
    <section class="adm-sec">
      <h2>Conteo interno (secreto)</h2>
      <p class="adm-muted">${state.voteState.totalVoted} votos recibidos.</p>
      ${state.results.map((r) => `
        <div class="adm-result">
          <div class="adm-result__cat">${r.emoji} ${H(r.categoria)} ${r.mayor ? "⭐" : ""}</div>
          <div class="adm-result__bars">
            ${r.detalle.length ? r.detalle.map((d, i) => `
              <div class="adm-bar">
                <span class="adm-bar__pos">${i === 0 ? "🥇" : i === 1 ? "🥈" : "•"}</span>
                <span class="adm-bar__name">${H(d.nombre)}</span>
                <span class="adm-bar__fill" style="width:${Math.min(100, d.votos * 22)}px"></span>
                <span class="adm-bar__n">${d.votos}</span>
              </div>`).join("") : `<span class="adm-muted">Sin votos aún.</span>`}
          </div>
        </div>`).join("")}
    </section>`;

  document.getElementById("togglelock").onclick = async () => {
    if (locked && !confirm("¿Seguro? Esto revela los ganadores reales en la ceremonia del sitio.")) return;
    await api("/api/admin/lock", { method: "POST", body: JSON.stringify({ locked: !locked }) });
    renderApp();
  };
}

// ---------------- TAB: AJUSTES ----------------
function tabAjustes(main) {
  main.innerHTML = `
    <section class="adm-sec">
      <h2>Cambiar clave de organizador</h2>
      <div class="adm-grid2">
        <label>Nueva clave<input id="newkey" type="text" placeholder="mínimo 4 caracteres" /></label>
      </div>
      <button class="adm-save" id="savekey">Cambiar clave</button>
    </section>
    <section class="adm-sec">
      <h2>Sesión</h2>
      <button class="adm-del" id="logout">Cerrar sesión</button>
    </section>`;
  document.getElementById("savekey").onclick = async () => {
    const newKey = document.getElementById("newkey").value.trim();
    const r = await api("/api/admin/key", { method: "POST", body: JSON.stringify({ newKey }) });
    if (r.ok) { state.key = newKey; localStorage.setItem("aullame_key", newKey); toast("✅ Clave cambiada"); }
    else toast("❌ " + ((await r.json()).error || "Error"));
  };
  document.getElementById("logout").onclick = () => { localStorage.removeItem("aullame_key"); state.key = ""; renderLogin(); };
}

// ---------------- utils ----------------
function pickFiles(multiple, cb, accept = "image/*") {
  const input = document.createElement("input");
  input.type = "file"; input.accept = accept; input.multiple = multiple;
  input.onchange = () => { if (input.files.length) cb(input.files).catch((e) => toast("❌ " + e.message)); };
  input.click();
}
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocalInput(v) { return v ? new Date(v).toISOString() : ""; }

// ---------------- init ----------------
if (state.key) tryLogin(state.key); else renderLogin();
