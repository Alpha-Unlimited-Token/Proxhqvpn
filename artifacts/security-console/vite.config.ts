import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "path";

const port = Number(process.env.PORT) || 5174;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../ghost-vpn/src"),
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
