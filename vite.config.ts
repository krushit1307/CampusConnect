import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";
import { federation } from "@module-federation/vite";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from "vite-plugin-pwa";

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
      remotes: {
        eventsApp: "http://localhost:4174/remoteEntry.js",
      },
      shared: {
        react: {
          singleton: true,
          requiredVersion: "^19.2.7",
        },
        "react-dom": {
          singleton: true,
          requiredVersion: "^19.2.0",
        },
        "react-router-dom": {
          singleton: true,
          requiredVersion: "^7.18.1",
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
            return "vendor";
          }
        },
      },
    },
  },
});
