import "./style.css";
import { renderTimelineMosaic } from "./mosaic.js";
import { loadContent } from "./content.js";

const page = document.getElementById("e2025-page") || document.getElementById("e25-page");
const H = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

(async function init() {
  document.querySelector(".nav")?.classList.add("scrolled");
  const content = await loadContent();

  // logo del nav
  if (content.event?.logo) {
    const icon = document.getElementById("nav-icon");
    icon.src = content.event.logo; icon.hidden = false;
    document.getElementById("nav-icon-fallback").hidden = true;
  }

  const e = content.edition2025 || {};
  const timeline2025 = (e.timeline || []).filter((m) => (m.fotos && m.fotos.length) || m.titulo);

  page.innerHTML = `
    <div class="e25__head">
      <div class="e25__kicker">EDICIÓN ${e.anio || 2025} · I EDICIÓN</div>
      <div class="e25__title">Los Ganadores</div>
    </div>
    <div class="e25__major">
      <div class="cat__emoji">🐺</div>
      <h3>AULLAME DEL AÑO</h3>
      <div class="e25__winner">${H(e.aullameDelAnio?.ganador)}</div>
      <div class="e25__frase">"${H(e.aullameDelAnio?.frase)}"</div>
      ${e.aullameDelAnio?.foto ? `<div class="e25__photo e25__photo--major"><img src="${H(e.aullameDelAnio.foto)}" alt=""></div>` : ""}
    </div>
    <div class="e25__grid">
      ${(e.ganadores || []).map((g) => `
        <div class="e25__card">
          <div class="e25__cat">${H(g.categoria)}</div>
          <div class="e25__gan">${H(g.ganador)}</div>
          <div class="e25__label">GANADOR</div>
          ${g.foto ? `<div class="e25__photo"><img src="${H(g.foto)}" alt=""></div>` : ""}
        </div>`).join("")}
    </div>
    ${timeline2025.length ? `
      <div class="e25__recuerdos">
        <h2 class="section__title">Recuerdos 2025</h2>
        <div id="e25-mosaic"></div>
      </div>` : ""}
  `;

  if (timeline2025.length) {
    renderTimelineMosaic(document.getElementById("e25-mosaic"), timeline2025);
  }
})();
