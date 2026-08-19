import "./style.css";

const $ = (id) => document.getElementById(id);
const filesInput = $("files");
const dropText = $("drop-text");
const send = $("send");
const status = $("status");

let chosen = [];

filesInput.addEventListener("change", () => {
  chosen = [...filesInput.files];
  dropText.textContent = chosen.length ? `${chosen.length} archivo${chosen.length > 1 ? "s" : ""} elegido${chosen.length > 1 ? "s" : ""} — tocá para cambiar` : "📸 Tocá para elegir fotos y videos";
  send.disabled = chosen.length === 0;
});

send.onclick = async () => {
  if (!chosen.length) return;
  const year = $("year").value;
  const mes = $("mes").value;
  send.disabled = true;
  status.className = "subir-status show";
  status.textContent = `Subiendo y optimizando ${chosen.length}… (puede tardar un poco)`;

  const fd = new FormData();
  chosen.forEach((f) => fd.append("files", f));

  try {
    const r = await fetch(`/api/contribute?year=${year}&mes=${mes}`, { method: "POST", body: fd });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Error");
    status.className = "subir-status ok show";
    status.innerHTML = `✅ ¡Listo! Se agregaron <b>${j.count}</b> recuerdos a ${mesNombre(mes)} ${year}.<br/>Podés subir más o volver al inicio.`;
    chosen = []; filesInput.value = "";
    dropText.textContent = "📸 Tocá para elegir más fotos";
  } catch (e) {
    status.className = "subir-status err show";
    status.textContent = "❌ " + (e.message || "No se pudo subir. Reintentá.");
    send.disabled = false;
  }
};

function mesNombre(code) {
  return ({ ENE: "Enero", FEB: "Febrero", MAR: "Marzo", ABR: "Abril", MAY: "Mayo", JUN: "Junio",
    JUL: "Julio", AGO: "Agosto", SEP: "Septiembre", OCT: "Octubre", NOV: "Noviembre", DIC: "Diciembre" }[code] || code);
}
