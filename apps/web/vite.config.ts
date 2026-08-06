import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em dev, o Vite roda em outra origem (localhost:5173) do backend
// (localhost:3000) — o proxy evita CORS e mantém o mesmo padrão de paths
// relativos "/api/..." usado em produção (onde o Caddy faz o mesmo split).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
