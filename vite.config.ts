import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";
import { copyLibFiles } from "@builder.io/partytown/utils";
import { partytownSnippet } from "@builder.io/partytown/integration";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function partytownPlugin() {
  return {
    name: "partytown-plugin",
    async buildStart() {
      await copyLibFiles(path.resolve(__dirname, "public/~partytown"));
    },
    transformIndexHtml(html: string) {
      return html.replace(
        "<head>",
        `<head>
    <script>
      window.partytown = {
        lib: "/~partytown/",
        forward: ["dataLayer.push", "fbq"]
      };
    </script>
    <script>${partytownSnippet()}</script>`,
      );
    },
  };
}

const CSP_VALUE =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.google-analytics.com https://www.googletagmanager.com https://connect.facebook.net https://*.hotjar.com https://script.hotjar.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https: https://www.facebook.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.supabase.co https://s3.amazonaws.com https://images.unsplash.com https://www.google-analytics.com https://www.googletagmanager.com https://connect.facebook.net https://*.hotjar.com https://script.hotjar.com https://vars.hotjar.com; frame-src 'self' https://js.stripe.com https://vars.hotjar.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none';";

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
      "Content-Security-Policy": CSP_VALUE,
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    headers: {
      "Content-Security-Policy": CSP_VALUE,
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    },
  },
  // Ensure Vite treats .lottie and .json files as raw static assets
  assetsInclude: ["**/*.lottie", "**/*.json"],
  // Storybook sets STORYBOOK=true. Skip the PWA service-worker generation in
  // Storybook builds — it precaches Storybook's own 3MB+ manager bundle and
  // fails on the default 2MiB workbox limit.
  plugins: [
    // lucideImportOptimizer(),
    viteReact(),
    tailwindcss(),
    partytownPlugin(),
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
    // ...(process.env.STORYBOOK === "true"
    //   ? []
    //   : [
    //       federation({
    //         name: "host",
    //         remotes: {},
    //         shared: {
    //           react: {
    //             singleton: true,
    //             requiredVersion: "^19.2.7",
    //           },
    //           "react-dom": {
    //             singleton: true,
    //             requiredVersion: "^19.2.0",
    //           },
    //         },
    //       }),
    //     ]),
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
    // Raises warning threshold (optional, e.g. set to 1000kB / 1MB)
    chunkSizeWarningLimit: 1000,
    // Bundler options for chunking
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("recharts") || id.includes("echarts") || id.includes("chart.js")) {
              return "chunk-admin-charts";
            }
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
