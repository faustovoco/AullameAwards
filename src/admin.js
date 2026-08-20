import "./style.css";
import "./admin.css";
import { editionYears, currentEdition } from "./migrate.js";

const root = document.getElementById("admin-root");
const state = {
  key: localStorage.getItem("aullame_key") || "",
  content: null,
  voteState: null,
  results: null,
  tab: "general",
};

const H = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const uid = (p) => p + Math.random().toString(36).slice(2, 7);

async function api(path, opts = {}) {
  const headers = { "x-admin-key": state.key, ...(opts.headers || {}) };
  if (opts.body && !(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
  return fetch(path, { ...opts, headers });
}
const saveContent = () => api("/api/content", { method: "PUT", body: JSON.stringify(state.content) });

async function uploadFiles(fileList) {
  const fd = new FormData();
  [...fileList].forEach((f) => fd.append("files", f));
  const r = await api("/api/upload", { method: "POST", body: fd });
  if (!r.ok) throw new Error("Error al subir imágenes");
  return (await r.json()).urls;
}
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
  if (state.tab.startsWith("y:") && !state.content.editions[state.tab.slice(2)]) state.tab = "general";
  renderApp();
}
async function loadAll() {
  state.content = await (await fetch("/api/content")).json();
  state.voteState = await (await api("/api/admin/state")).json();
  try { state.results = await (await api("/api/admin/results")).json(); } catch { state.results = []; }
}

// ---------------- APP SHELL ----------------
function renderApp() {
  const c = state.content;
  const years = editionYears(c);
  root.innerHTML = `
    <header class="adm-top">
      <div class="adm-brand">🐺 <b>Aullame</b></div>
      <nav class="adm-tabs">
        ${tabBtn("general", "General")}
        ${years.map((y) => tabBtn("y:" + y, y + (y === c.event.currentYear ? " ●" : ""))).join("")}
        <button class="adm-add" id="add-year">+ Año</button>
        <span class="adm-tabsep"></span>
        ${tabBtn("votantes", "Votantes")}
        ${tabBtn("resultados", "Resultados")}
        ${tabBtn("ajustes", "Ajustes")}
      </nav>
      <a class="adm-view" href="/" target="_blank">Ver sitio ↗</a>
    </header>
    <main class="adm-main" id="adm-main"></main>
    <div class="adm-toast" id="toast" hidden></div>`;
  root.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; renderApp(); }));
  document.getElementById("add-year").onclick = addYear;
  const main = document.getElementById("adm-main");
  if (state.tab === "general") tabGeneral(main);
  else if (state.tab.startsWith("y:")) tabYear(main, state.tab.slice(2));
  else ({ votantes: tabVotantes, resultados: tabResultados, ajustes: tabAjustes }[state.tab])(main);
}
const tabBtn = (id, label) => `<button data-tab="${id}" class="${state.tab === id ? "on" : ""}">${label}</button>`;

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.hidden = false; t.classList.add("show");
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => (t.hidden = true), 300); }, 2000);
}

function addYear() {
  const y = prompt("¿Qué año querés agregar? (ej: 2027)");
  const year = Number(y);
  if (!/^\d{4}$/.test(String(year))) return;
  const c = state.content;
  if (c.editions[year]) { state.tab = "y:" + year; return renderApp(); }
  const cur = c.editions[String(c.event.currentYear)];
  c.editions[year] = {
    anio: year, edicion: "", ceremonyDate: "",
    finalizada: year < c.event.currentYear,
    categorias: cur ? JSON.parse(JSON.stringify(cur.categorias)) : [],
    ganadores: [], aullameDelAnio: { ganador: "", foto: "", frase: "" }, meses: [],
  };
  saveContent();
  state.tab = "y:" + year; renderApp();
}

// ---------------- TAB: GENERAL ----------------
function tabGeneral(main) {
  const c = state.content;
  const years = editionYears(c);
  const cur = c.editions[String(c.event.currentYear)] || { edicion: "", ceremonyDate: "" };
  main.innerHTML = `
    <section class="adm-sec">
      <h2>Evento</h2>
      <div class="adm-grid2">
        <label>Edición en curso (año)
          <select id="cur-year">${years.map((y) => `<option value="${y}" ${y === c.event.currentYear ? "selected" : ""}>${y}</option>`).join("")}</select>
        </label>
        <label>Nombre de la edición en curso<input id="cur-edicion" value="${H(cur.edicion)}" placeholder="ej: II Edición" /></label>
      </div>
      <div class="adm-grid2">
        <label>Fecha y hora del evento (edición en curso)<input id="cur-fecha" type="datetime-local" value="${toLocalInput(cur.ceremonyDate)}" /></label>
        <div></div>
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

    <div class="adm-savebar">
      <button class="adm-save" id="save">💾 Guardar</button>
      <span class="adm-muted">Los cambios se ven en el sitio al recargar.</span>
    </div>`;

  const bind = (id, setter) => { const el = document.getElementById(id); if (el) el.oninput = () => setter(el.value); };
  document.getElementById("cur-year").onchange = (e) => { c.event.currentYear = Number(e.target.value); renderApp(); };
  bind("cur-edicion", (v) => { if (c.editions[String(c.event.currentYear)]) c.editions[String(c.event.currentYear)].edicion = v; });
  bind("cur-fecha", (v) => { if (c.editions[String(c.event.currentYear)]) c.editions[String(c.event.currentYear)].ceremonyDate = fromLocalInput(v); });

  main.querySelector("[data-up='logo']").onclick = () => pickFiles(false, async (files) => {
    const [url] = await uploadFiles(files); c.event.logo = url; renderApp();
  });
  const dl = main.querySelector("[data-dellogo]"); if (dl) dl.onclick = () => { c.event.logo = ""; renderApp(); };

  main.querySelectorAll("[data-mid]").forEach((card) => {
    const m = c.members.find((x) => x.id === card.dataset.mid);
    card.querySelectorAll("[data-f]").forEach((el) => (el.oninput = () => (m[el.dataset.f] = el.value)));
    card.querySelector("[data-upmember]").onclick = () => pickFiles(false, async (files) => {
      const [url] = await uploadFiles(files); m.foto = url; renderApp();
    });
    card.querySelector("[data-delmember]").onclick = () => { c.members = c.members.filter((x) => x !== m); renderApp(); };
  });
  main.querySelector("[data-add='member']").onclick = () => { c.members.push({ id: uid("m"), nombre: "Nuevo", apodo: "", foto: "", desc: "" }); renderApp(); };
  document.getElementById("save").onclick = async () => toast((await saveContent()).ok ? "✅ Guardado" : "❌ Error");
}

// ---------------- TAB: AÑO (edición) ----------------
function tabYear(main, yearStr) {
  const c = state.content;
  const ed = c.editions[yearStr];
  if (!ed) { state.tab = "general"; return renderApp(); }
  const esCurso = Number(yearStr) === c.event.currentYear;

  main.innerHTML = `
    <section class="adm-sec">
      <h2>Edición ${yearStr} ${esCurso ? '<span class="adm-badge">en curso</span>' : ""}</h2>
      <div class="adm-grid2">
        <label>Nombre de la edición<input data-ed="edicion" value="${H(ed.edicion)}" placeholder="ej: I Edición" /></label>
        <label>Fecha del evento<input data-ed="ceremonyDate" type="datetime-local" value="${toLocalInput(ed.ceremonyDate)}" /></label>
      </div>
      <label class="adm-check adm-fin"><input type="checkbox" id="ed-fin" ${ed.finalizada ? "checked" : ""}/> Edición terminada (muestra los ganadores)</label>
    </section>

    <section class="adm-sec">
      <h2>Categorías <button class="adm-add" data-add="cat">+ Agregar</button></h2>
      <div id="cats">${(ed.categorias || []).map(catRow).join("")}</div>
    </section>

    ${ed.finalizada ? `
    <section class="adm-sec">
      <h2>Ganadores</h2>
      <div class="adm-grid2">
        <label>Aullame del Año<input data-aull="ganador" value="${H(ed.aullameDelAnio?.ganador || "")}" /></label>
        <label>Frase<input data-aull="frase" value="${H(ed.aullameDelAnio?.frase || "")}" /></label>
      </div>
      <div id="gans">${(ed.ganadores || []).map(ganRow).join("")}</div>
      <button class="adm-add" data-add="gan">+ Agregar ganador</button>
    </section>` : `
    <section class="adm-sec">
      <p class="adm-muted">Los ganadores salen de la votación. Cuando termine la ceremonia, marcá <b>"Edición terminada"</b> para cargarlos acá.</p>
    </section>`}

    <section class="adm-sec">
      <h2>Recuerdos ${yearStr} — títulos de los meses</h2>
      <p class="adm-muted">Las fotos se suben y gestionan en la <a class="adm-view" href="/galeria.html" target="_blank">Galería</a>. Acá solo ponés el título/descripción de cada mes (aparecen en la timeline del año).</p>
      <div id="months">${(ed.meses || []).map(mesMetaRow).join("")}</div>
      <button class="adm-add" data-add="month">+ Agregar mes</button>
    </section>

    <div class="adm-savebar">
      <button class="adm-save" id="save">💾 Guardar</button>
      ${esCurso ? "" : `<button class="adm-del" id="del-edition">Eliminar edición ${yearStr}</button>`}
    </div>`;

  // meta de la edición
  main.querySelectorAll("[data-ed]").forEach((el) => (el.oninput = () =>
    (ed[el.dataset.ed] = el.dataset.ed === "ceremonyDate" ? fromLocalInput(el.value) : el.value)));
  document.getElementById("ed-fin").onchange = (e) => { ed.finalizada = e.target.checked; renderApp(); };

  // categorías (con reordenamiento por arrastre)
  if (!ed.categorias) ed.categorias = [];
  main.querySelectorAll("#cats [data-cid]").forEach((row, i) => {
    const cat = ed.categorias.find((x) => x.id === row.dataset.cid);
    row.querySelectorAll("[data-f]").forEach((el) => {
      if (el.type === "checkbox") el.onchange = () => { cat[el.dataset.f] = el.checked; renderApp(); };
      else el.oninput = () => (cat[el.dataset.f] = el.value);
    });
    row.querySelector("[data-delcat]").onclick = () => { ed.categorias = ed.categorias.filter((x) => x !== cat); renderApp(); };

    // drag & drop: solo arranca desde el handle
    const handle = row.querySelector(".adm-drag");
    handle.addEventListener("mousedown", () => (row.draggable = true));
    row.querySelectorAll("input,textarea").forEach((el) => el.addEventListener("mousedown", () => (row.draggable = false)));
    row.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", String(i)); row.classList.add("dragging"); });
    row.addEventListener("dragend", () => { row.draggable = false; row.classList.remove("dragging"); });
    row.addEventListener("dragover", (e) => e.preventDefault());
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData("text/plain"));
      if (Number.isNaN(from) || from === i) return;
      const arr = ed.categorias;
      const [moved] = arr.splice(from, 1);
      arr.splice(i, 0, moved);
      renderApp();
    });
  });

  // ganadores
  if (ed.finalizada) {
    if (!ed.aullameDelAnio) ed.aullameDelAnio = { ganador: "", foto: "", frase: "" };
    main.querySelectorAll("[data-aull]").forEach((el) => (el.oninput = () => (ed.aullameDelAnio[el.dataset.aull] = el.value)));
    if (!ed.ganadores) ed.ganadores = [];
    main.querySelectorAll("[data-gan]").forEach((row) => {
      const g = ed.ganadores[+row.dataset.gan];
      row.querySelectorAll("[data-f]").forEach((el) => (el.oninput = () => (g[el.dataset.f] = el.value)));
      row.querySelector("[data-delgan]").onclick = () => { ed.ganadores.splice(+row.dataset.gan, 1); renderApp(); };
    });
  }

  // recuerdos: solo metadatos de meses (título/descripción); las fotos van en la Galería
  if (!ed.meses) ed.meses = [];
  main.querySelectorAll("#months [data-mi]").forEach((row) => {
    const m = ed.meses[+row.dataset.mi];
    row.querySelectorAll("[data-f]").forEach((el) => (el.oninput = () => (m[el.dataset.f] = el.value)));
    row.querySelector("[data-delmonth]").onclick = () => { ed.meses.splice(+row.dataset.mi, 1); renderApp(); };
  });

  // add
  main.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => {
    if (b.dataset.add === "cat") ed.categorias.push({ id: uid("c"), nombre: "Nueva categoría", emoji: "🏆", desc: "", mayor: false, dato: false, nominados: [], imagen: "" });
    if (b.dataset.add === "gan") ed.ganadores.push({ categoria: "", ganador: "", foto: "" });
    if (b.dataset.add === "month") ed.meses.push({ mes: "ENE", titulo: "", desc: "" });
    renderApp();
  }));

  const del = document.getElementById("del-edition");
  if (del) del.onclick = () => {
    if (!confirm(`¿Eliminar la edición ${yearStr}? (no borra las fotos del disco)`)) return;
    delete c.editions[yearStr]; state.tab = "general"; saveContent(); renderApp();
  };

  document.getElementById("save").onclick = async () => toast((await saveContent()).ok ? "✅ Guardado" : "❌ Error");
}

// ---------------- row helpers ----------------
const memberRow = (m) => `
  <div class="adm-card" data-mid="${m.id}">
    <div class="adm-photo">${m.foto ? `<img src="${H(m.foto)}">` : "🐺"}</div>
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
  <div class="adm-catrow ${c.dato ? "is-dato" : ""}" data-cid="${c.id}">
    <span class="adm-drag" title="Arrastrar para ordenar">⠿</span>
    <input class="adm-emoji" data-f="emoji" value="${H(c.emoji)}" />
    <div class="adm-catrow__main">
      <input data-f="nombre" placeholder="Categoría" value="${H(c.nombre)}" />
      <textarea class="adm-catdesc" data-f="desc" placeholder="Descripción" rows="1">${H(c.desc)}</textarea>
    </div>
    <div class="adm-catrow__flags">
      ${c.mayor ? `<span class="adm-badge adm-badge--mayor" title="El premio mayor siempre es el Aullame del Año">⭐ MAYOR</span>`
                : `<label class="adm-check"><input type="checkbox" data-f="dato" ${c.dato ? "checked" : ""}/> Dato (sin votación)</label>`}
      <button class="adm-del" data-delcat>✕</button>
    </div>
  </div>`;

const ganRow = (g, i) => `
  <div class="adm-row" data-gan="${i}">
    <input data-f="categoria" placeholder="Categoría" value="${H(g.categoria)}" />
    <input data-f="ganador" placeholder="Ganador" value="${H(g.ganador)}" />
    <button class="adm-del" data-delgan>✕</button>
  </div>`;

const mesMetaRow = (m, i) => `
  <div class="adm-row" data-mi="${i}">
    <input class="adm-mes" data-f="mes" value="${H(m.mes)}" />
    <input data-f="titulo" placeholder="Título (ej: Escapada a Brasil)" value="${H(m.titulo)}" />
    <input data-f="desc" placeholder="Descripción" value="${H(m.desc)}" />
    <button class="adm-del" data-delmonth>✕</button>
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
      }).join("") || `<span class="adm-muted">Sin fotos.</span>`}
    </div>
  </div>`;

// ---------------- TAB: VOTANTES ----------------
function tabVotantes(main) {
  const vs = state.voteState || { voters: [] };
  const c = state.content;
  const ed = currentEdition(c) || { categorias: [] };
  const origin = location.origin;
  const namesText = vs.voters.map((v) => v.name).join("\n");
  main.innerHTML = `
    <section class="adm-sec">
      <h2>Votantes</h2>
      <p class="adm-muted">Un nombre por línea. Al generar, cada uno recibe un <b>link personal y secreto</b>.</p>
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
    </section>

    <section class="adm-sec">
      <h2>Ternas (nominados por categoría) · edición ${c.event.currentYear}</h2>
      <p class="adm-muted">Definí quiénes están nominados en cada categoría, con una descripción e imagen. En la votación se elige entre estos.</p>
      <div id="ternas">${(ed.categorias || []).map((cat) => ternaRow(cat, c.members)).join("")}</div>
      <button class="adm-save" id="save-ternas">💾 Guardar ternas</button>
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

  // --- ternas ---
  main.querySelectorAll("[data-tcid]").forEach((row) => {
    const cat = (ed.categorias || []).find((x) => x.id === row.dataset.tcid);
    if (!cat) return;
    if (!Array.isArray(cat.nominados)) cat.nominados = [];
    row.querySelector("[data-tf='desc']").oninput = (e) => (cat.desc = e.target.value);
    row.querySelector("[data-terna-img]").onclick = () => pickFiles(false, async (files) => {
      const [url] = await uploadFiles(files); cat.imagen = url; await saveContent(); renderApp();
    });
    const di = row.querySelector("[data-terna-imgdel]");
    if (di) di.onclick = async () => { cat.imagen = ""; await saveContent(); renderApp(); };
    row.querySelectorAll("[data-part]").forEach((chk) => (chk.onchange = () => {
      const id = chk.dataset.part;
      if (chk.checked) { if (!cat.nominados.includes(id)) cat.nominados.push(id); }
      else cat.nominados = cat.nominados.filter((x) => x !== id);
    }));
  });
  document.getElementById("save-ternas").onclick = async () => toast((await saveContent()).ok ? "✅ Ternas guardadas" : "❌ Error");
}

const ternaRow = (cat, members) => `
  <div class="adm-terna" data-tcid="${cat.id}">
    <div class="adm-terna__title">${cat.emoji || "🏆"} ${H(cat.nombre)}</div>
    <div class="adm-terna__grid">
      <div class="adm-terna__img">
        <div class="adm-terna__prev">${cat.imagen ? `<img src="${H(cat.imagen)}">` : "🖼️"}</div>
        <button class="adm-up" data-terna-img>Imagen</button>
        ${cat.imagen ? `<button class="adm-del" data-terna-imgdel>Quitar</button>` : ""}
      </div>
      <div class="adm-terna__body">
        <input data-tf="desc" placeholder="Descripción de la categoría" value="${H(cat.desc || "")}" />
        <div class="adm-terna__parts">
          ${(members || []).map((m) => `
            <label class="adm-check2"><input type="checkbox" data-part="${m.id}" ${(cat.nominados || []).includes(m.id) ? "checked" : ""}/> ${H(m.nombre)}</label>`).join("")}
        </div>
      </div>
    </div>
  </div>`;

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
