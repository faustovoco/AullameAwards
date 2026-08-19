// Modo ceremonia: revela cada categoría (nominados -> 2do -> ganador),
// cerrando con el Aullame del Año. Sonido sintetizado + confeti dorado.
import { CEREMONY_2026 } from "./data.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function startCeremony(root) {
  root.hidden = false;
  document.body.style.overflow = "hidden";

  root.innerHTML = `
    <canvas class="cer-fx" id="cer-confetti"></canvas>
    <div class="cer__stage" id="cer-stage"></div>
    <button class="cer__skip" id="cer-skip">SALTAR ▶</button>
  `;
  const stage = root.querySelector("#cer-stage");
  const confetti = new Confetti(root.querySelector("#cer-confetti"));
  const audio = new Sound();

  let skipped = false;
  root.querySelector("#cer-skip").onclick = () => { skipped = true; };
  const skippable = async (ms) => { const step = 60; let e = 0; while (e < ms && !skipped) { await wait(step); e += step; } };

  async function getCategories() {
    // intenta traer los resultados reales (solo si el organizador desbloqueó)
    try {
      const r = await fetch("/api/ceremony");
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data) && data.length) return data;
      }
    } catch (e) { /* sin backend: usamos ejemplo */ }
    return CEREMONY_2026;
  }

  async function run() {
    await intro();
    const cats = await getCategories();
    for (const cat of cats) {
      skipped = false;
      await revealCategory(cat);
    }
    skipped = false;
    await outro();
  }

  async function intro() {
    stage.innerHTML = `
      <div class="cer-kicker fx-in">AULLAME AWARDS · II EDICIÓN</div>
      <div class="cer-cat fx-up" style="margin-top:16px">2026</div>
      <div class="cer-place fx-up" style="animation-delay:.4s">Que comience la ceremonia</div>`;
    audio.swell();
    await skippable(3200);
  }

  async function revealCategory(cat) {
    const major = !!cat.mayor;
    // 1) título de la categoría
    stage.innerHTML = `
      <div class="cer-emoji fx-in">${cat.emoji}</div>
      <div class="cer-kicker fx-up" style="animation-delay:.2s">PREMIO A</div>
      <div class="cer-cat fx-up" style="animation-delay:.35s">${cat.categoria}</div>`;
    audio.ding();
    await skippable(major ? 3000 : 2400);

    // 2) nominados
    stage.innerHTML = `
      <div class="cer-kicker fx-in">${cat.emoji} ${cat.categoria}</div>
      <div class="cer-place fx-up" style="margin-top:8px">Los nominados</div>
      <ul class="cer-nominees" id="noms"></ul>`;
    const ul = stage.querySelector("#noms");
    for (let i = 0; i < cat.nominados.length; i++) {
      if (skipped) break;
      const li = document.createElement("li");
      li.textContent = cat.nominados[i];
      li.style.animation = "fxUp .6s cubic-bezier(.2,.7,.2,1) both";
      ul.appendChild(li);
      audio.tick();
      await skippable(700);
    }
    await skippable(1200);

    // 3) segundo puesto
    stage.innerHTML = `
      <div class="cer-place fx-in">SEGUNDO PUESTO</div>
      <div class="cer-second fx-up" style="animation-delay:.2s">🥈 ${cat.segundo}</div>`;
    audio.ding();
    await skippable(2600);

    // 4) ganador con tensión
    stage.innerHTML = `<div class="cer-place fx-in">Y EL GANADOR ES…</div>`;
    audio.tension();
    await skippable(major ? 3200 : 2200);

    stage.innerHTML = `
      <div class="cer-emoji fx-in">${major ? "🏆" : "🥇"}</div>
      <div class="cer-place fx-up">${cat.categoria}</div>
      <div class="cer-winner fx-up" style="animation-delay:.15s">${cat.primero}</div>`;
    audio.win(major);
    confetti.burst(major ? 320 : 140);
    await skippable(major ? 6000 : 3600);
  }

  async function outro() {
    stage.innerHTML = `
      <div class="cer-kicker fx-in">GRACIAS POR UN AÑO MÁS</div>
      <div class="cer-cat fx-up" style="margin-top:14px">🐺</div>
      <div class="cer-place fx-up" style="animation-delay:.3s">Nos vemos en la III Edición</div>
      <button class="cer__skip" style="position:static;margin-top:34px" id="cer-exit">VOLVER AL INICIO</button>`;
    confetti.burst(200);
    stage.querySelector("#cer-exit").onclick = close;
  }

  function close() {
    confetti.stop();
    audio.close();
    root.hidden = true;
    root.innerHTML = "";
    document.body.style.overflow = "";
  }

  run();
  return { close };
}

// ---- Confeti dorado en canvas ----
class Confetti {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    this.parts = [];
    this.running = true;
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.loop();
  }
  resize() { this.c.width = window.innerWidth; this.c.height = window.innerHeight; }
  burst(n) {
    const cols = ["#f6e6b4", "#e8c874", "#c9a24b", "#2fd0c4", "#ffffff"];
    for (let i = 0; i < n; i++) {
      this.parts.push({
        x: this.c.width / 2 + (Math.random() - 0.5) * 200,
        y: this.c.height / 2,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 1) * 15,
        g: 0.28 + Math.random() * 0.2,
        s: 3 + Math.random() * 5,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        col: cols[(Math.random() * cols.length) | 0],
        life: 1,
      });
    }
  }
  loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this.loop());
    const { ctx, c } = this;
    ctx.clearRect(0, 0, c.width, c.height);
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.parts) {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 0.006;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.col;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 1.6);
      ctx.restore();
    }
  }
  stop() { this.running = false; this.ctx.clearRect(0, 0, this.c.width, this.c.height); }
}

// ---- Sonido sintetizado (sin archivos externos) ----
class Sound {
  constructor() {
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { this.ctx = null; }
  }
  note(freq, dur, type = "sine", gain = 0.15, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  tick() { this.note(880, 0.12, "triangle", 0.08); }
  ding() { this.note(587.33, 0.5, "sine", 0.12); this.note(880, 0.6, "sine", 0.08, 0.02); }
  swell() { [261.6, 329.6, 392, 523.2].forEach((f, i) => this.note(f, 1.6, "sine", 0.09, i * 0.12)); }
  tension() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(110, t);
    o.frequency.linearRampToValueAtTime(240, t + 2.2);
    g.gain.setValueAtTime(0.06, t); g.gain.linearRampToValueAtTime(0.12, t + 2.2);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + 2.4);
  }
  win(major) {
    const seq = major ? [523.2, 659.2, 784, 1046.5, 1318.5] : [523.2, 659.2, 784, 1046.5];
    seq.forEach((f, i) => this.note(f, 0.9, "sine", 0.13, i * 0.12));
    seq.forEach((f, i) => this.note(f / 2, 1.0, "triangle", 0.06, i * 0.12));
  }
  close() { if (this.ctx) this.ctx.close(); }
}
