import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [viteReact(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Raises warning threshold (optional, e.g. set to 1000kB / 1MB)
    chunkSizeWarningLimit: 1000,
    // Bundler options for chunking
    rolldownOptions: {
      output: {
        manualChunks(id) {
          // Separates third-party packages from node_modules into vendor chunks
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom")) {
              return "vendor-react";
            }
            return "vendor";
          }
        },
      },
    },
  },
});
