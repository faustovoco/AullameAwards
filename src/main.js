import "./style.css";
import { initTrophy } from "./trophy.js";
import { startCeremony } from "./ceremony.js";
import { renderTimelineMosaic } from "./mosaic.js";
import { loadContent, fechaTexto } from "./content.js";
import { currentEdition, editionYears, editionTimeline } from "./migrate.js";

// ---------- Trofeo 3D ----------
const canvas = document.getElementById("trophy-canvas");
const loading = document.getElementById("trophy-loading");
initTrophy(canvas, (err) => {
  loading.hidden = true;
  if (err) { loading.hidden = false; loading.textContent = "No se pudo cargar el trofeo 3D"; }
});

// ---------- Nav ----------
const nav = document.querySelector(".nav");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 40);
window.addEventListener("scroll", onScroll); onScroll();
document.querySelector("[data-scroll-top]").onclick = () =>
  window.scrollTo({ top: 0, behavior: "smooth" });

// ---------- Countdown ----------
const parts = {
  d: document.querySelector('[data-cd="d"]'), h: document.querySelector('[data-cd="h"]'),
  m: document.querySelector('[data-cd="m"]'), s: document.querySelector('[data-cd="s"]'),
};
const grid = document.getElementById("countdown-grid");
const ready = document.getElementById("countdown-ready");
const pad = (n) => String(n).padStart(2, "0");

function startCountdown(targetDate) {
  const target = new Date(targetDate).getTime();
  (function tick() {
    const diff = target - Date.now();
    if (diff <= 0) { grid.hidden = true; ready.hidden = false; return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    parts.d.textContent = pad(d); parts.h.textContent = pad(h);
    parts.m.textContent = pad(m); parts.s.textContent = pad(s);
    requestAnimationFrame(() => setTimeout(tick, 250));
  })();
}

// ▶ Ceremonia: lanza la presentación (public/ceremonia.html) con los datos
// reales de la votación si están desbloqueados; si no, usa su ejemplo.
async function launchCeremonia() {
  try {
    const r = await fetch("/api/premios");
    if (r.ok) sessionStorage.setItem("AULLAME_PREMIOS", JSON.stringify(await r.json()));
    else sessionStorage.removeItem("AULLAME_PREMIOS");
  } catch { sessionStorage.removeItem("AULLAME_PREMIOS"); }
  // Si aún no generaste la presentación (public/ceremonia.html), cae al modo interno.
  try {
    const head = await fetch("/ceremonia.html", { method: "HEAD" });
    if (head.ok) { window.location.href = "/ceremonia.html"; return; }
  } catch {}
  startCeremony(document.getElementById("ceremony"));
}
document.getElementById("play-btn").onclick = launchCeremonia;

// ---------- Reveal on scroll ----------
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => { if (en.isIntersecting) en.target.classList.add("in"); });
}, { threshold: 0.12 });
const observeReveals = () => document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// ---------- Votación ----------
document.getElementById("vote-btn").onclick = () => {
  window.location.href = "/voto.html";
};

// ---------- Render con el contenido cargado ----------
(async function init() {
  const content = await loadContent();

  // logo
  if (content.event?.logo) {
    const icon = document.getElementById("nav-icon");
    icon.src = content.event.logo;
    icon.hidden = false;
    document.getElementById("nav-icon-fallback").hidden = true;
  }

  // edición en curso
  const ed = currentEdition(content) || { categorias: [], timeline: [], ceremonyDate: "" };

  // fecha + countdown
  document.getElementById("hero-date").textContent = fechaTexto(ed.ceremonyDate).toUpperCase();
  startCountdown(ed.ceremonyDate);

  // footer: edición + fecha en curso (lo que se configura desde admin), acorde al hero
  const [fDia, fMes, fAnio] = fechaTexto(ed.ceremonyDate).split(" ");
  const fMesTitle = fMes ? fMes.charAt(0) + fMes.slice(1).toLowerCase() : "";
  const footerLine = document.getElementById("footer-line");
  if (footerLine) footerLine.textContent =
    ["AULLAME AWARDS", ed.edicion, `${fDia} ${fMesTitle} ${fAnio}`].filter(Boolean).join(" · ");

  // integrantes
  document.getElementById("members-grid").innerHTML = content.members.map((m) => `
    <article class="member">
      <div class="member__photo">${m.foto ? `<img src="${m.foto}" alt="${m.nombre}">` : "🐺"}</div>
      <div class="member__body">
        <div class="member__name">${m.nombre}</div>
        <div class="member__apodo">${m.apodo || ""}</div>
        <div class="member__desc">${m.desc || ""}</div>
      </div>
    </article>`).join("");

  // categorías (de la edición en curso)
  document.getElementById("cats-grid").innerHTML = (ed.categorias || []).map((c) => `
    <div class="cat ${c.mayor ? "cat--major" : ""}">
      <div class="cat__emoji">${c.emoji}</div>
      <div>
        <div class="cat__name">${c.nombre}</div>
        <div class="cat__desc">${c.desc || ""}</div>
      </div>
    </div>`).join("");

  // timeline mosaico (recuerdos de la edición en curso, desde la galería)
  renderTimelineMosaic(document.getElementById("timeline-list"), editionTimeline(content, content.event.currentYear));

  // Ediciones anteriores: página propia
  const past = editionYears(content).filter((y) => y !== content.event.currentYear);
  const btn = document.getElementById("btn-2025");
  if (past.length) {
    btn.textContent = past.length === 1 ? `Edición ${past[0]}` : "Ediciones";
    btn.onclick = () => { window.location.href = `/2025.html?year=${past[0]}`; };
  } else { btn.hidden = true; }

  observeReveals();
})();
