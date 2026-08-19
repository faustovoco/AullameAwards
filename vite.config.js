import { defineConfig } from "vite";
import { resolve } from "path";

// Multi-página: sitio principal, votación y panel de edición.
export default defineConfig({
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  build: {
    // No copiar public/ (539MB de fotos) al build: el server los sirve en vivo.
    copyPublicDir: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        voto: resolve(__dirname, "voto.html"),
        admin: resolve(__dirname, "admin.html"),
        e2025: resolve(__dirname, "2025.html"),
        subir: resolve(__dirname, "subir.html"),
      },
    },
  },
});
