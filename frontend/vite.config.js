import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: "0.0.0.0",
    strictPort: true,
    open: false,
    hmr: {
      host: process.env.HMR_HOST || "localhost",
      port: 3000,
    },
    allowedHosts: [
      ".trycloudflare.com", // Allow all Cloudflare tunnel domains
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    "import.meta.env.VITE_API_URL": JSON.stringify(
      process.env.VITE_API_URL || "",
    ),
  },
});
