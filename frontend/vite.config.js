import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: { port: Number(process.env.PORT) || 5173 },
  build: {
    rollupOptions: {
      output: {
        // Split rarely-changing third-party libraries into their own chunk,
        // separate from app code — browsers cache this chunk across
        // deploys where only src/ changed, instead of re-downloading
        // framer-motion/html-to-image/socket.io-client every time.
        manualChunks: {
          vendor: [
            "react",
            "react-dom",
            "react-router-dom",
            "framer-motion",
            "html-to-image",
            "socket.io-client",
          ],
        },
      },
    },
  },
});
