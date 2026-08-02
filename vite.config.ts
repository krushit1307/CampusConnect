import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import svgr from "vite-plugin-svgr";
import { fileURLToPath } from "url";
import { federation } from "@module-federation/vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function lucideImportOptimizer() {
  return {
    name: "lucide-import-optimizer",
    transform(code: string, id: string) {
      if (!id.includes("/src/") || !/\.[jt]sx?$/.test(id)) {
        return null;
      }

      // Matches imports like: import { ... } from "lucide-react";
      // Excludes "import type { ... }" by checking negative lookahead (?!type\s+)
      const regex = /import\s+(?!type\s+)\{([\s\S]*?)\}\s+from\s+['"]lucide-react['"];?/g;

      let hasChanged = false;
      const newCode = code.replace(regex, (match, specifiers) => {
        if (!specifiers) return match;

        const icons = specifiers
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);

        const newImports = icons.map((icon: string) => {
          let iconName = icon;
          let aliasName = icon;

          if (icon.includes(" as ")) {
            const parts = icon.split(" as ");
            iconName = parts[0].trim();
            aliasName = parts[1].trim();
          }

          if (iconName.startsWith("type ")) {
            const cleanTypeName = iconName.slice(5).trim();
            return `import type { ${cleanTypeName} } from 'lucide-react';`;
          }

          // Map camelCase/PascalCase to kebab-case
          const kebabName = iconName
            .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
            .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
            .toLowerCase();

          return `import ${aliasName} from 'lucide-react/dist/esm/icons/${kebabName}';`;
        });

        hasChanged = true;
        return newImports.join("\n");
      });

      if (hasChanged) {
        return {
          code: newCode,
          map: null,
        };
      }
      return null;
    },
  };
}

/**
 * Vite configuration for CampusConnect
 * Handles custom asset inclusion for dotLottie compressed animations,
 * optimizes chunk splitting, and configures Workbox for offline PWA capabilities.
 */
export default defineConfig({
  server: {
    port: 3000,
    host: true,
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
  // Ensure Vite treats .lottie and .json files as raw static assets
  assetsInclude: ["**/*.lottie", "**/*.json"],
  // Storybook sets STORYBOOK=true. Skip the PWA service-worker generation in
  // Storybook builds — it precaches Storybook's own 3MB+ manager bundle and
  // fails on the default 2MiB workbox limit.
  plugins: [
    lucideImportOptimizer(),
    viteReact(),
    tailwindcss(),
    ...(process.env.STORYBOOK === "true"
      ? []
      : [
          VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
            manifest: {
              name: "CampusConnect",
              short_name: "CampusConnect",
              description: "CampusConnect PWA App",
              theme_color: "#ffffff",
              icons: [
                {
                  src: "pwa-192x192.png",
                  sizes: "192x192",
                  type: "image/png",
                },
                {
                  src: "pwa-512x512.png",
                  sizes: "512x512",
                  type: "image/png",
                },
              ],
            },
            workbox: {
              globPatterns: ["**/*.{js,css,html,ico,png,svg,json,lottie}"],
              runtimeCaching: [
                {
                  urlPattern: ({ request }) =>
                    request.destination === "style" ||
                    request.destination === "script" ||
                    request.destination === "worker",
                  handler: "StaleWhileRevalidate",
                  options: {
                    cacheName: "static-resources",
                    expiration: {
                      maxEntries: 50,
                      maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
                    },
                  },
                },
                {
                  urlPattern: ({ url, request }) =>
                    request.method === "GET" && url.pathname.startsWith("/api/"),
                  handler: "StaleWhileRevalidate",
                  options: {
                    cacheName: "api-get-cache",
                    expiration: {
                      maxEntries: 100,
                      maxAgeSeconds: 24 * 60 * 60, // 24 Hours
                    },
                    cacheableResponse: {
                      statuses: [0, 200],
                    },
                  },
                },
                {
                  urlPattern: ({ request }) => request.destination === "image",
                  handler: "CacheFirst",
                  options: {
                    cacheName: "images-cache",
                    expiration: {
                      maxEntries: 60,
                      maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
                    },
                  },
                },
              ],
            },
          }),
        ]),
    ...(process.env.STORYBOOK === "true"
      ? []
      : [
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
        ]),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "pdf-lib": path.resolve(__dirname, "./node_modules/pdf-lib/dist/pdf-lib.esm.js"),
    },
  },
  optimizeDeps: {
    include: ["pdf-lib", "@tanstack/react-virtual"],
  },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 1000,
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
plugins: [react(), svgr()];
