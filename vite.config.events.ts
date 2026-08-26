import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";
import { federation } from "@module-federation/vite";
import { VitePWA } from "vite-plugin-pwa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    viteReact(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectRegister: "auto",
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: "CampusConnect",
        short_name: "CampusConnect",
        start_url: "/",
        display: "standalone",
        background_color: "#faf7f0",
        theme_color: "#000000",
        icons: [
          {
            src: "/favicon.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
      },
    }),
    federation({
      name: "eventsApp",
      filename: "remoteEntry.js",
      exposes: {
        "./remoteEntry": "./src/micro-frontends/events/remoteEntry.ts",
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
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "esnext",
    outDir: "dist-events",
  },
});
