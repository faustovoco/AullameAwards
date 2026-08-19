# 🐺 Aullame Awards — Web

Sitio de la premiación Aullame Awards (II Edición 2026). Hero cinematográfico con el
trofeo del lobo en 3D, countdown, integrantes, categorías, timeline del año, edición
2025 y modo ceremonia.

## Cómo correrlo

```bash
npm install       # solo la primera vez
npm run dev       # levanta el backend (8787) + la web (5173) juntos
```

Para que voten desde el celu (túnel público o hosting), ver **[DEPLOY.md](DEPLOY.md)**.
Producción en un solo proceso: `npm run build` y después `npm start` (sitio + API en :8787).

Abrí **http://localhost:5173**. Otras páginas:
- **Panel de edición:** http://localhost:5173/admin.html (clave inicial `aullame2026`)
- **Votación:** http://localhost:5173/voto.html?t=TOKEN (cada uno recibe su link desde el panel)

## Editar TODO desde el panel (recomendado)

Entrá a `/admin.html` con la clave y desde ahí:
- **Contenido:** integrantes, categorías, recuerdos (subís muchas fotos por mes para el mosaico),
  ganadores 2025, fecha del evento y el **logo/ícono** del sitio (Subir logo → elegí tu lobo dorado).
- **Votantes:** escribís los 8 nombres → "Generar links" → copiás y le mandás a cada uno SU link secreto.
- **Resultados:** ves el conteo interno en vivo. Está **bloqueado** por defecto (la ceremonia muestra
  ejemplos). La **noche del evento** tocás "Desbloquear" y la ceremonia revela los ganadores reales.
- **Ajustes:** cambiás la clave de organizador.

Lo que edites en el panel se guarda en `data/content.json` y se ve en el sitio al recargar.

Para la versión final lista para publicar:

```bash
npm run build     # genera la carpeta /dist
npm run preview   # la prueba localmente
```

## Dónde editar el contenido (todo en un solo archivo)

Todo el contenido editable está en **`src/data.js`**:

| Qué | Variable |
|-----|----------|
| ⭐ Fecha de la ceremonia (countdown) | `CEREMONY_DATE` |
| Los 8 integrantes (nombre, apodo, foto, descripción) | `MEMBERS` |
| Categorías de premios | `CATEGORIES` |
| Timeline del año (recuerdos, cumpleaños) | `TIMELINE` |
| Ganadores de la Edición 2025 | `EDITION_2025` |
| Guion de la ceremonia 2026 (nominados/ganadores) | `CEREMONY_2026` |

### La fecha
Editá **solo** la línea `CEREMONY_DATE`. El texto que aparece en el hero
("19 DICIEMBRE 2026") se calcula solo a partir de esa fecha.
Recordá: el mes va de **0 a 11** (0=enero … 11=diciembre).

> Nota: el reloj de tu compu está en agosto 2026. La fecha placeholder es
> 19/12/2026 para que el countdown corra. Cambiala por la fecha real del evento.
> Cuando el countdown llega a cero, aparece el botón **"Comenzar la ceremonia"**.

### Fotos y videos del timeline (mosaico) — carga masiva
La forma más rápida de cargar MUCHOS recuerdos:
1. En la carpeta **`fotos/`** hay una subcarpeta por mes (`01-enero`, `02-febrero`, …).
2. Arrastrá las fotos y videos de cada mes a su subcarpeta.
   - Fotos: jpg, png, webp, gif · Videos: **mp4 / webm** (los `.mov` solo andan en Safari).
3. Corré:
   ```bash
   npm run import:fotos
   ```
Esto copia todo a `public/img/timeline/<MES>/` y lo engancha al mes en el mosaico.
Es re-ejecutable (podés agregar fotos y volver a correrlo). En el mosaico, los videos
se reproducen mudos al pasar el mouse y **con sonido al hacerles click**.

### Recuerdos 2025 (timeline por meses — carga masiva)
Igual que el 2026, pero para el año pasado:
1. Arrastrá las fotos/videos a **`fotos-2025/<mes>/`** (subcarpetas `01-enero`, `02-febrero`…).
2. Corré:
   ```bash
   npm run import:2025
   ```
Se optimizan y aparecen por mes, debajo de los ganadores, al abrir "Edición 2025".
(También podés cargarlas desde el panel `/admin.html` → "Recuerdos 2025".)

### Foto de cada ganador 2025 (una por premio, sale en su tarjeta)
1. Dejá las fotos en **`fotos-2025-ganadores/`** con los nombres del `LEEME.txt`
   (`aullame-del-anio.jpg`, `mejor-anecdota.jpg`, `mala-leche.jpg`, etc.).
2. Corré:
   ```bash
   npm run import:2025-ganadores
   ```

### Fotos sueltas (integrantes, ganadores, logo)
Se cargan desde el **panel** (`/admin.html`), con el botón de subir foto en cada campo.
También podés dejarlas en `public/img/` y referenciarlas como `/img/archivo.jpg`.

## La presentación de la ceremonia (ceremonia.html)

La presentación del día del evento se diseña aparte (herramienta de diseño) y se
**exporta como HTML** a `C:\Users\faust\Desktop\Aullame Awards.html`. Para integrarla:

```bash
npm run build:ceremonia
```

Esto lee ese export y genera `public/ceremonia.html` con un cambio quirúrgico: el array
`PREMIOS` (las ternas: nominados/ganador/segundo por categoría) usa los **datos reales de
la votación** si están disponibles, y si no, tus datos de ejemplo.

**Cada vez que re-exportes la presentación, volvé a correr `npm run build:ceremonia`.**
(Requisito: en la presentación, el array debe seguir llamándose `const PREMIOS = [...]`.)

Flujo el día del evento:
1. Cerrás la votación y en el panel (`/admin.html` → Resultados) tocás **Desbloquear**.
2. El botón **▶** del sitio abre la presentación autocompletada con los ganadores reales.
   (Con la votación bloqueada, la presentación muestra los datos de ejemplo.)
3. También podés abrirla directo en `/ceremonia.html` para ensayar.

## Qué falta (segunda etapa)
- **Votación real**: hoy el botón "Ir a votar" es un aviso. Falta conectar el backend
  (links personales por integrante + votos secretos + conteo interno). Recomendado: Supabase.
- **3D**: el modelo actual es `public/models/trophy.glb` (1.6 MB, optimizado del STL).
  Para regenerarlo desde el STL: `python scripts/convert_trophy.py`.
- **Música de la ceremonia**: hoy usa sonido sintetizado. Se puede reemplazar por
  canciones/animaciones reales.

## Estructura
```
index.html          estructura de la página
src/
  main.js           conecta todo (countdown, render, overlays, scroll)
  trophy.js         escena 3D del trofeo (Three.js)
  ceremony.js       modo ceremonia (revelado + confeti + sonido)
  data.js           👈 TODO el contenido editable
  style.css         estilos (paleta negro/teal/dorado)
public/
  models/trophy.glb modelo 3D del lobo
  img/              tus fotos (creála)
scripts/
  convert_trophy.py convierte el STL pesado a GLB liviano
```
