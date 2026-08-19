# 🚀 Deploy — que voten desde el celu

Tenés dos caminos. Para una premiación entre amigos, el **Camino A (túnel)** es el
más simple y seguro: los votos quedan en TU compu (secretos, sin riesgo de perderse)
y no hay que subir los 539 MB de fotos a ningún servidor.

---

## Camino A — Túnel desde tu compu (recomendado)

Tu compu corre el sitio y un "túnel" le da una dirección web pública `https://…`
que abrís en cualquier celu. Ideal para la ventana de votación (tené la compu
prendida mientras votan) y para la noche del evento.

### 1) Compilar y levantar el sitio (una vez)
```bash
npm install
npm run build
npm start
```
Queda sirviendo TODO (sitio + votación + API) en `http://localhost:8787`.

### 2) Abrir el túnel (en OTRA terminal, dejando la de arriba corriendo)

**Opción recomendada — Cloudflare (mejor experiencia, sin páginas molestas):**
```bash
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:8787
```
Te da una URL tipo `https://algo-al-azar.trycloudflare.com`. Esa es la que compartís.

**Opción sin instalar nada — localtunnel:**
```bash
npm run share
```
Te da una URL `https://xxxx.loca.lt`. (La primera vez, a cada visitante le puede
aparecer una pantalla de aviso donde tiene que apretar "Click to Continue"; si te
pide una "password", es la IP que te muestra la terminal al abrir el túnel.)

### 3) Repartir los links de votación
1. Abrí el panel en **esa URL pública** + `/admin.html` (ej: `https://algo.trycloudflare.com/admin.html`), clave `aullame2026`.
2. Pestaña **Votantes** → escribí los 8 nombres → **Generar links**.
3. Copiá el link de cada uno y mandáselo. Cada uno vota desde su celu.
   > Importante: generá los links entrando por la URL pública (no por localhost),
   > así los links llevan la dirección correcta.

### 4) La noche del evento
- Cerrás la votación (panel → **Resultados → Desbloquear**).
- Apretás **▶** y la presentación arranca con los ganadores reales.

> Mientras el túnel esté abierto y tu compu prendida, cualquiera entra desde el celu.
> Al cerrar la terminal, la URL deja de funcionar (y tus datos quedan guardados en tu compu).

---

## Camino B — Hosting permanente (Render.com)

Siempre online, sin depender de tu compu. Es gratis pero tiene 2 detalles a tener en
cuenta (ver abajo). Necesitás una cuenta en [render.com] y subir el proyecto a GitHub.

1. Subí el proyecto a un repo de GitHub (sin la carpeta `node_modules`).
2. En Render: **New → Web Service** → conectá el repo.
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment:** agregá `ADMIN_KEY` con una clave secreta tuya.
3. Deploy. Render te da una URL `https://aullame-awards.onrender.com`.

**⚠️ 2 detalles importantes en el plan gratis de Render:**
- **Los votos se pueden borrar:** el disco del plan gratis se reinicia en cada
  redeploy/reinicio, y ahí se pierden `data/votes.json` y las subidas. Para que los
  votos sean confiables, agregá un **Persistent Disk** (Render, ~US$1/mes) montado en
  la carpeta del proyecto, o usá el **Camino A** durante la votación.
- **Las 539 MB de fotos** tienen que ir al repo/host (tarda en subir). Si no las
  necesitás online, podés dejar el timeline liviano y correr el sitio completo local.

Por eso, para los votos, lo más práctico sigue siendo el **Camino A**.

---

## Cambiar la clave del panel
En cualquiera de los dos: entrá al panel → **Ajustes → Cambiar clave**. En Render
también podés fijarla con la variable `ADMIN_KEY`.
