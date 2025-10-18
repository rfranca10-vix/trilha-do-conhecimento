import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Config simples e estável para Vercel
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false
  },
  server: {
    port: 5173
  }
});
