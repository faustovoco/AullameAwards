# 🐳 Deploy en Hostinger + EasyPanel (Docker)

Flujo: **el código va por GitHub** (yo actualizo → vos apretás "Deploy"), y **las fotos + datos
viven en un volumen** del server (se suben una vez y sobreviven a cada deploy).

Por qué separado: las fotos pesan ~2.4 GB y hay videos de +200 MB → GitHub no los acepta
(límite 100 MB por archivo). El código son ~2.5 MB.

---

## 1) Subir el código a GitHub (una vez)
Esto lo hacés vos (yo no tengo acceso a tu GitHub):
1. Creá un repo nuevo y **privado** en GitHub (ej: `aullame-awards`), vacío.
2. En la carpeta del proyecto, conectá y subí:
   ```bash
   git remote add origin https://github.com/TU-USUARIO/aullame-awards.git
   git branch -M main
   git push -u origin main
   ```
> Para que después "yo actualice y vos relances": cada cambio que haga, lo dejo commiteado;
> vos corrés `git push` y en EasyPanel apretás **Deploy** (o activás auto-deploy, ver paso 5).

## 2) Crear la App en EasyPanel
1. **Create → App** → fuente **GitHub**, elegí el repo `aullame-awards`, branch `main`.
2. **Build:** tipo **Dockerfile** (EasyPanel detecta el `Dockerfile` de la raíz).
3. **Port / Proxy:** puerto del contenedor **8787** (el server escucha ahí).

## 3) Variables de entorno (en la App → Environment)
```
ADMIN_KEY = (una clave secreta tuya para el panel)
```
(No hace falta setear PORT; si EasyPanel lo inyecta, el server lo usa igual.)

## 4) Volúmenes persistentes (App → Mounts / Volumes)  ⭐ CLAVE
Agregá **dos volúmenes** (así los votos y las fotos NO se borran en cada deploy):

| Montar en (Mount path) | Qué guarda |
|---|---|
| `/app/data` | `content.json` (contenido en vivo) y `votes.json` (votos) |
| `/app/public/img` | Todas las fotos y videos optimizados |

## 5) Deploy y auto-deploy
- Apretá **Deploy**. EasyPanel construye la imagen y levanta el sitio.
- Opcional: activá **Auto Deploy on Push** (con el webhook de GitHub) → cada `git push` redeploya solo.

## 6) Cargar las fotos y el contenido al volumen (una vez)
El volumen arranca vacío. Hay que copiarle, UNA vez, lo que ya tenés local:
- `data/content.json`  → al volumen `/app/data`
- todo `public/img/`    → al volumen `/app/public/img`

Formas de subirlo (elegí una):
- **SFTP** a tu VPS (FileZilla) hacia las carpetas de los volúmenes de EasyPanel.
- **Rsync** (más rápido para GB): `rsync -avz public/img/ usuario@tu-server:/ruta/volumen/img/`
- El **file manager** de EasyPanel (más lento para GB).

> 💡 Muy recomendado: **comprimir los videos antes** (algunos pesan +200 MB y son `.mov`).
> Baja los ~2.4 GB a una fracción y carga más rápido en el celu de todos. Avisame y lo hago.

## 7) Dominio
En EasyPanel → **Domains**, poné tu dominio o el subdominio que te da Hostinger. Listo.

---

## El día a día (actualizar)
1. Yo hago cambios y los dejo commiteados.
2. Vos: `git push`  →  EasyPanel **Deploy** (o auto-deploy).
3. Las fotos y los votos quedan intactos (están en el volumen).

## Notas
- El modelo 3D del lobo (`public/models/trophy.glb`) SÍ va en la imagen (pesa poco).
- `sharp` y `ffmpeg` vienen como binarios en las dependencias (no hay que instalar nada en el server).
- Para votar/subir fotos desde el celu ya no hace falta túnel: el sitio queda online 24/7.
