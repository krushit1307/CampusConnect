import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
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
          // ArrowRight -> arrow-right
          // CheckCircle2 -> check-circle-2
          // Axis3D -> axis-3-d
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
 * Handles custom asset inclusion for dotLottie compressed animations
 * and optimizes chunk splitting for large SVG/JSON assets.
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
  plugins: [
    lucideImportOptimizer(),
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
});
