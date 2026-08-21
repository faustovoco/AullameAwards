// Mosaico de recuerdos: muchas fotitos/videos uno al lado del otro.
// Hover -> se agranda en un visor PEGADO AL CURSOR que lo sigue (los videos
//          se reproducen mudos). Click -> queda fijo y centrado (y el video suena).
// Fijado -> 2 flechas doradas a los costados para ir pasando (o ← → del teclado).
// Otro click o Esc -> se suelta.

const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i;

// normaliza cualquier formato de entrada a { kind, tile, view, video, color }
function norm(f) {
  if (typeof f === "string") {
    if (VIDEO_RE.test(f)) return { kind: "video", video: f };
    return { kind: "img", tile: f, view: f };
  }
  if (f.color) return { kind: "color", color: f.color };
  if (f.video) return { kind: "video", video: f.video, tile: f.t || f.poster || "" };
  return { kind: "img", tile: f.t || f.v, view: f.v || f.t };
}

export function renderTimelineMosaic(container, timeline, opts = {}) {
  container.classList.add("mosaic-wrap");
  container.innerHTML = `
    <div class="mosaic-viewer" id="mosaic-viewer" hidden>
      <img id="mosaic-viewer-img" alt="" />
      <video id="mosaic-viewer-vid" muted loop playsinline hidden></video>
      <div class="mosaic-viewer__hint" id="mosaic-hint">Click para fijar · Esc para soltar</div>
    </div>
    <button class="mosaic-nav mosaic-nav--prev" id="mnav-prev" aria-label="Anterior" hidden>‹</button>
    <button class="mosaic-nav mosaic-nav--next" id="mnav-next" aria-label="Siguiente" hidden>›</button>
    <div class="mosaic-months" id="mosaic-months"></div>
  `;
  const months = container.querySelector("#mosaic-months");
  const viewer = container.querySelector("#mosaic-viewer");
  const viewerImg = container.querySelector("#mosaic-viewer-img");
  const viewerVid = container.querySelector("#mosaic-viewer-vid");
  const hint = container.querySelector("#mosaic-hint");
  const navPrev = container.querySelector("#mnav-prev");
  const navNext = container.querySelector("#mnav-next");

  let pinned = false;
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  const flat = [];        // lista plana de todos los recuerdos, en orden
  let currentIndex = -1;  // índice fijado

  // hover: el visor sigue al cursor
  function positionViewer() {
    const w = viewer.offsetWidth || 300, h = viewer.offsetHeight || 300;
    const pad = 14, gap = 22;
    let px = mouseX + gap;
    if (px + w + pad > window.innerWidth) px = mouseX - gap - w;
    px = Math.max(pad, Math.min(px, window.innerWidth - w - pad));
    let py = Math.max(pad, Math.min(mouseY - h / 2, window.innerHeight - h - pad));
    viewer.style.transform = `translate(${px}px, ${py}px)`;
  }
  // fijado: centrado en el medio de la pantalla
  function centerViewer() {
    viewer.style.left = "50%"; viewer.style.top = "50%";
    viewer.style.transform = "translate(-50%, -50%)";
  }

  function setContent(n, withSound = false) {
    if (n.kind === "color") {
      viewerVid.hidden = true; viewerVid.pause();
      viewerImg.hidden = false; viewerImg.removeAttribute("src"); viewerImg.style.background = n.color;
    } else if (n.kind === "video") {
      viewerImg.hidden = true; viewerImg.removeAttribute("src");
      viewerVid.hidden = false;
      if (viewerVid.getAttribute("src") !== n.video) viewerVid.src = n.video;
      viewerVid.muted = !withSound; viewerVid.controls = withSound;
      viewerVid.play().catch(() => {});
    } else {
      viewerVid.hidden = true; viewerVid.pause();
      viewerImg.hidden = false; viewerImg.style.background = ""; viewerImg.src = n.view || n.tile;
    }
  }
  function showViewer(n) {
    if (pinned) return;
    setContent(n, false);
    viewer.hidden = false;
    positionViewer();
    requestAnimationFrame(() => { if (!viewer.hidden) viewer.style.opacity = "1"; });
  }
  function hideViewer() {
    if (pinned) return;
    viewer.style.opacity = "0"; viewerVid.pause();
    setTimeout(() => { if (!pinned && viewer.style.opacity === "0") viewer.hidden = true; }, 240);
  }

  function setActiveTile(tile) {
    document.querySelectorAll(".mtile.active").forEach((t) => t.classList.remove("active"));
    if (tile) tile.classList.add("active");
  }

  function pinAt(idx) {
    if (!flat.length) return;
    currentIndex = (idx + flat.length) % flat.length; // envuelve
    const { n, tile } = flat[currentIndex];
    pinned = true;
    setContent(n, n.kind === "video");
    viewer.hidden = false; viewer.style.opacity = "1";
    viewer.classList.add("pinned");
    centerViewer();
    hint.textContent = "📌 Fijado · flechas para pasar · Esc para soltar";
    navPrev.hidden = false; navNext.hidden = false;
    setActiveTile(tile);
  }
  function unpin() {
    pinned = false;
    viewer.classList.remove("pinned");
    viewer.style.left = "0"; viewer.style.top = "0"; // volver al modo "seguir cursor"
    viewerVid.controls = false; viewerVid.muted = true;
    navPrev.hidden = true; navNext.hidden = true;
    setActiveTile(null);
    hint.textContent = "Click para fijar · Esc para soltar";
    hideViewer();
  }

  navPrev.addEventListener("click", (e) => { e.stopPropagation(); pinAt(currentIndex - 1); });
  navNext.addEventListener("click", (e) => { e.stopPropagation(); pinAt(currentIndex + 1); });

  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX; mouseY = e.clientY;
    if (!pinned && !viewer.hidden) positionViewer();
  });

  const marks = [];        // marcas para el deslizador (años, o meses si no hay años)
  let lastSection = null;
  timeline.forEach((mes, mi) => {
    // encabezado de año/sección: se muestra 1 sola vez (no repetido por mes)
    if (mes.sectionLabel != null && mes.sectionLabel !== lastSection) {
      lastSection = mes.sectionLabel;
      const yr = document.createElement("div");
      yr.className = "mrow-year";
      yr.textContent = mes.sectionLabel;
      months.appendChild(yr);
      marks.push({ label: mes.sectionLabel, el: yr });
    }
    const raw = (mes.fotos && mes.fotos.length) ? mes.fotos : placeholderTiles(mi);
    const items = raw.map(norm);
    const row = document.createElement("div");
    row.className = "mrow";
    if (lastSection == null) marks.push({ label: mes.mes, el: row }); // timeline de un año: marcas por mes
    row.innerHTML = `
      <div class="mrow__label">
        <span class="mrow__mes">${mes.mes}</span>
        <span class="mrow__titulo">${mes.titulo || ""}</span>
      </div>
      <div class="mrow__grid"></div>`;
    const grid = row.querySelector(".mrow__grid");

    items.forEach((n) => {
      const tile = document.createElement("div");
      tile.className = "mtile";
      if (n.kind === "color") {
        tile.style.background = n.color;
      } else if (n.kind === "video") {
        tile.classList.add("mtile--video");
        if (n.tile) { const img = document.createElement("img"); img.loading = "lazy"; img.src = n.tile; tile.appendChild(img); }
      } else {
        const img = document.createElement("img");
        img.loading = "lazy"; img.decoding = "async"; img.src = n.tile;
        tile.appendChild(img);
      }

      const idx = flat.length;
      flat.push({ n, tile });

      tile.addEventListener("mouseenter", () => showViewer(n));
      tile.addEventListener("mouseleave", hideViewer);
      tile.addEventListener("click", (e) => {
        e.stopPropagation();
        if (pinned) { unpin(); return; }
        pinAt(idx);
      });
      grid.appendChild(tile);
    });
    months.appendChild(row);
  });

  // El deslizador solo se usa donde el mosaico es el contenido principal (galería).
  // En páginas donde es una sección más (inicio, 2025) las marcas se calculan mal.
  if (opts.scrubber === true) buildScrubber(container, marks);

  document.addEventListener("keydown", (e) => {
    if (!pinned) return;
    if (e.key === "Escape") unpin();
    else if (e.key === "ArrowLeft") { e.preventDefault(); pinAt(currentIndex - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); pinAt(currentIndex + 1); }
  });
  viewer.addEventListener("click", (e) => { if (pinned && e.target !== viewerVid) unpin(); });
}

// ---------- Deslizador tipo Google Fotos ----------
// Riel a la derecha con una pastilla que sigue el scroll (muestra el año/mes),
// arrastrable para saltar, con marcas de años. Aparece al hacer scroll o al
// acercarse al borde derecho, y se esconde solo.
let scrubTeardown = null;
function buildScrubber(container, marks) {
  if (scrubTeardown) { scrubTeardown(); scrubTeardown = null; }
  document.querySelectorAll(".scrub").forEach((s) => s.remove());
  if (marks.length < 2) return;

  const rail = document.createElement("div");
  rail.className = "scrub";
  rail.innerHTML = `
    <div class="scrub__hot"></div>
    <div class="scrub__track"></div>
    <div class="scrub__thumb"><span></span></div>`;
  document.body.appendChild(rail);
  const track = rail.querySelector(".scrub__track");
  const thumb = rail.querySelector(".scrub__thumb");
  const thumbLabel = thumb.querySelector("span");

  const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;
  function range() {
    const top = docTop(container);
    const end = Math.max(top + 1, top + container.offsetHeight - window.innerHeight);
    return { top, end };
  }
  function renderMarks() {
    const { top, end } = range();
    const span = Math.max(1, end - top);
    track.innerHTML = marks.map((m) => {
      const p = Math.min(1, Math.max(0, (docTop(m.el) - top) / span));
      return `<div class="scrub__mark" style="top:${(p * 100).toFixed(2)}%">${m.label}</div>`;
    }).join("");
  }
  function currentLabel() {
    const y = window.scrollY + 100;
    let cur = marks[0].label;
    for (const m of marks) { if (docTop(m.el) <= y) cur = m.label; else break; }
    return cur;
  }
  function inView() {
    const r = container.getBoundingClientRect();
    return r.bottom > 60 && r.top < window.innerHeight - 40;
  }
  function updateThumb() {
    const { top, end } = range();
    const p = Math.min(1, Math.max(0, (window.scrollY - top) / (end - top)));
    thumb.style.top = (p * 100).toFixed(2) + "%";
    thumbLabel.textContent = currentLabel();
  }

  let dragging = false, hideT;
  function show() { if (!inView()) return; rail.classList.add("on"); clearTimeout(hideT); hideT = setTimeout(() => { if (!dragging) rail.classList.remove("on"); }, 1500); }
  function scrubTo(clientY) {
    const r = rail.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    const { top, end } = range();
    window.scrollTo({ top: top + p * (end - top), behavior: "instant" });
  }
  const onDown = (e) => { dragging = true; try { rail.setPointerCapture(e.pointerId); } catch {} rail.classList.add("dragging"); scrubTo(e.clientY); e.preventDefault(); };
  const onMove = (e) => { if (dragging) scrubTo(e.clientY); };
  const onUp = () => { dragging = false; rail.classList.remove("dragging"); show(); };
  thumb.addEventListener("pointerdown", onDown);
  rail.querySelector(".scrub__track").addEventListener("pointerdown", onDown);
  rail.addEventListener("pointermove", onMove);
  rail.addEventListener("pointerup", onUp);
  rail.addEventListener("pointerenter", () => { if (inView()) { rail.classList.add("on"); clearTimeout(hideT); } });
  rail.addEventListener("pointerleave", () => { if (!dragging) show(); });

  const onScroll = () => { updateThumb(); show(); };
  const onResize = () => { renderMarks(); updateThumb(); };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("load", onResize);

  renderMarks(); updateThumb();
  setTimeout(() => { renderMarks(); updateThumb(); }, 700);   // reacomoda tras cargar imágenes

  scrubTeardown = () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("load", onResize);
    rail.remove();
  };
}

// Teselas de color como placeholder (meses sin fotos todavía).
function placeholderTiles(seed) {
  const n = 120 + ((seed * 37) % 60);
  const tiles = [];
  for (let i = 0; i < n; i++) {
    const h = (seed * 47 + i * 13) % 360;
    const s = 30 + ((i * 7) % 40);
    const l = 22 + ((i * 11) % 30);
    tiles.push({ color: `hsl(${h} ${s}% ${l}%)` });
  }
  return tiles;
}
