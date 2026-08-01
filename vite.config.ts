import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";
import { federation } from "@module-federation/vite";
import { visualizer } from "rollup-plugin-visualizer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  plugins: [
    viteReact(),
    tailwindcss(),
    VitePWA({ registerType: "autoUpdate" }),
    federation({
      name: "host",
      remotes: {},
      shared: {
        react: {
          singleton: true,
          requiredVersion: "^19.2.7",
        },
        "react-dom": {
          singleton: true,
          requiredVersion: "^19.2.0",
        },
      },
    }),
    visualizer({
      filename: "stats.html",
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "pdf-lib": path.resolve(__dirname, "./node_modules/pdf-lib/dist/pdf-lib.esm.js"),
    },
  },
  optimizeDeps: {
    include: ["pdf-lib"],
  },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom")) {
              return "vendor-react";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            return "vendor";
          }
        },
      },
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
