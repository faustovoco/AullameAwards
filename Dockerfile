# ---- Aullame Awards — imagen para EasyPanel / Docker ----
FROM node:22-bookworm-slim

# ffmpeg-static y sharp traen sus binarios; no hace falta instalar ffmpeg del sistema.
WORKDIR /app

# 1) deps (se cachea si no cambió package.json)
COPY package.json package-lock.json ./
RUN npm ci

# 2) código
COPY . .

# 3) build del frontend (genera dist/)
RUN npm run build

# El server escucha en PORT (EasyPanel lo setea) o 8787 por defecto.
ENV NODE_ENV=production
EXPOSE 8787

# Sirve sitio + API en un solo proceso.
CMD ["node", "server/index.js", "--serve"]
