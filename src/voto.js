import "./style.css";

const page = document.getElementById("vote-page");
const params = new URLSearchParams(location.search);
const token = params.get("t");

const H = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function shell(inner) { page.innerHTML = `<div class="vote-card">${inner}</div>`; }

async function main() {
  if (!token) {
    return shell(`<div class="vote-head"><h1>🐺</h1><p class="vote-msg">Falta tu link personal de votación.</p></div>`);
  }
  let data;
  try {
    const r = await fetch(`/api/ballot/${encodeURIComponent(token)}`);
    data = await r.json();
    if (!r.ok) throw new Error(data.error || "Error");
  } catch (e) {
    return shell(`<div class="vote-head"><h1>🐺</h1><p class="vote-msg">${H(e.message || "Link inválido")}</p>
      <p class="vote-sub">Pedile al organizador tu link correcto.</p></div>`);
  }

  if (data.alreadyVoted) return thanks(data.voter.name, true);

  renderBallot(data);
}

function renderBallot(data) {
  const cats = data.categories;
  const votables = cats.filter((c) => !c.dato && (c.nominados || []).length > 0);
  shell(`
    <div class="vote-head">
      <div class="vote-kicker">AULLAME AWARDS · VOTACIÓN SECRETA</div>
      <h1 class="vote-title">Hola, ${H(data.voter.name)}</h1>
      <p class="vote-sub">Elegí un ganador por categoría entre los nominados. Tu voto es anónimo.</p>
    </div>
    <form id="ballot"></form>
    <div class="vote-actions">
      <button class="vote-submit" id="submit" disabled>Enviar mi voto</button>
      <p class="vote-note" id="progress"></p>
    </div>
  `);

  const form = document.getElementById("ballot");
  form.innerHTML = cats.map((c) => `
    <fieldset class="vote-cat ${c.dato ? "vote-cat--dato" : ""}" data-cat="${c.id}">
      <legend><span class="vote-emoji">${c.emoji || "🏆"}</span> ${H(c.nombre)}${c.dato ? ` <span class="vote-dato-tag">se decide por datos</span>` : ""}</legend>
      ${c.imagen ? `<div class="vote-cat__img"><img src="${H(c.imagen)}" alt=""></div>` : ""}
      ${c.desc ? `<p class="vote-cat__desc">${H(c.desc)}</p>` : ""}
      ${c.dato ? `<p class="vote-dato-note">Este premio no se vota — se decide por datos del año. Se muestra para que lo conozcas.</p>` : `
      <div class="vote-options">
        ${(c.nominados || []).map((m) => `
          <label class="vote-opt">
            <input type="radio" name="${c.id}" value="${m.id}" />
            <span class="vote-opt__box">
              <span class="vote-opt__photo">${m.foto ? `<img src="${H(m.foto)}" alt="">` : "🐺"}</span>
              <span class="vote-opt__name">${H(m.nombre)}</span>
              ${m.apodo ? `<span class="vote-opt__apodo">${H(m.apodo)}</span>` : ""}
            </span>
          </label>`).join("")}
      </div>`}
    </fieldset>`).join("");

  const submit = document.getElementById("submit");
  const progress = document.getElementById("progress");
  const total = votables.length;
  const update = () => {
    const done = votables.filter((c) => form.querySelector(`input[name="${c.id}"]:checked`)).length;
    progress.textContent = `${done} de ${total} categorías elegidas`;
    submit.disabled = done < total;
  };
  form.addEventListener("change", update);
  update();

  submit.onclick = async () => {
    const votes = {};
    votables.forEach((c) => {
      const sel = form.querySelector(`input[name="${c.id}"]:checked`);
      if (sel) votes[c.id] = sel.value;
    });
    submit.disabled = true; submit.textContent = "Enviando…";
    try {
      const r = await fetch(`/api/ballot/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votes }),
      });
      const res = await r.json();
      if (!r.ok) throw new Error(res.error || "Error");
      thanks(data.voter.name, false);
    } catch (e) {
      submit.disabled = false; submit.textContent = "Enviar mi voto";
      alert(e.message || "No se pudo enviar el voto");
    }
  };
}

function thanks(name, already) {
  shell(`
    <div class="vote-head vote-thanks">
      <h1>🐺</h1>
      <div class="vote-title">${already ? "Ya habías votado" : "¡Gracias, " + H(name) + "!"}</div>
      <p class="vote-sub">Tu voto quedó registrado en secreto.<br/>Los resultados se revelan la noche de la ceremonia.</p>
      <a class="vote-back" href="/">Volver al inicio</a>
    </div>
  `);
}

main();
