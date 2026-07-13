// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { defineConfig as vitestDefineConfig } from "vitest/config";
import { fileURLToPath, URL } from "url";

// When running under Vitest, skip the full lovable/TanStack plugin stack
// (it pulls in browser-only plugins that crash in a Node test environment).
export default process.env.VITEST
  ? vitestDefineConfig({
      resolve: { alias: { "@": fileURLToPath(new URL("src", import.meta.url)) } },
    })
  : defineConfig({
      tanstackStart: {
        // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
        // nitro/vite builds from this
        server: { entry: "server" },
      },
    });
