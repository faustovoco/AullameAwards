import "./style.css";
import { renderTimelineMosaic } from "./mosaic.js";
import { loadContent } from "./content.js";
import { editionYears, editionTimeline } from "./migrate.js";

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

  // ediciones pasadas (todas menos la en curso), más nuevas primero
  const past = editionYears(content).filter((y) => y !== content.event.currentYear);
  if (!past.length) { page.innerHTML = `<div class="e25__head"><div class="e25__title">Todavía no hay ediciones anteriores</div></div>`; return; }

  const wanted = Number(new URLSearchParams(location.search).get("year"));
  let year = past.includes(wanted) ? wanted : past[0];

  function render() {
    const e = content.editions[String(year)] || {};
    const recuerdos = editionTimeline(content, year);
    const selector = past.length > 1 ? `
      <div class="e25__years">
        ${past.map((y) => `<button class="e25__year ${y === year ? "on" : ""}" data-year="${y}">${y}</button>`).join("")}
      </div>` : "";

    page.innerHTML = `
      <div class="e25__head">
        <div class="e25__kicker">EDICIÓN ${e.anio || year} · ${H(e.edicion || "")}</div>
        <div class="e25__title">Los Ganadores</div>
        ${selector}
      </div>
      <div class="e25__major">
        <div class="cat__emoji">🐺</div>
        <h3>AULLAME DEL AÑO</h3>
        <div class="e25__winner">${H(e.aullameDelAnio?.ganador)}</div>
        <div class="e25__frase">${e.aullameDelAnio?.frase ? `"${H(e.aullameDelAnio.frase)}"` : ""}</div>
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
      ${recuerdos.length ? `
        <div class="e25__recuerdos">
          <h2 class="section__title">Recuerdos ${year}</h2>
          <div id="e25-mosaic"></div>
        </div>` : ""}
    `;

    if (recuerdos.length) renderTimelineMosaic(document.getElementById("e25-mosaic"), recuerdos);
    page.querySelectorAll("[data-year]").forEach((b) => (b.onclick = () => {
      year = Number(b.dataset.year);
      history.replaceState(null, "", `?year=${year}`);
      render();
    }));
  }
  render();
})();
