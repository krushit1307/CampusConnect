let storybookConfig = {};
try {
  const storybook = await import("eslint-plugin-storybook");
  storybookConfig = storybook.default?.configs?.["flat/recommended"] || {};
} catch {
  // storybook plugin optional
}

import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import noCrossPageImports from "./tools/eslint-rules/no-cross-page-imports.js";

const localRulesPlugin = {
  rules: {
    "no-cross-page-imports": noCrossPageImports,
  },
};

export default tseslint.config(
  {
    ignores: [
      "dist",
      "dist-events",
      ".output",
      ".vinxi",
      "supabase/functions",
      ".history/**",
      "wasm/image-compressor/pkg",
      "public/~partytown/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "local-rules": localRulesPlugin,
    },
    rules: {
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "local-rules/no-cross-page-imports": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "date-fns",
              message:
                "Please import date-fns functions individually from subpaths, e.g. `import format from 'date-fns/format'` instead of destructured imports.",
            },
            {
              name: "date-fns/locale",
              message:
                "Please import specific locales individually from subpaths, e.g. `import enUS from 'date-fns/locale/en-US'` instead of root locales.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportNamespaceSpecifier[parent.source.value='lucide-react']",
          message:
            'Import icons individually, e.g. `import { ChevronDown } from "lucide-react"`. A wildcard import (`import * as Icons from "lucide-react"`) pulls the entire icon library into the bundle and defeats tree-shaking.',
        },
      ],
    },
  },
  {
    files: ["graphql/**/*.{ts,tsx}", "services/**/*.{ts,tsx}"],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: [
      "scripts/**/*.{ts,js,mjs,cjs}",
      "**/*.test.{ts,tsx}",
      "**/*.cy.{ts,tsx}",
      "cypress/**/*.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  eslintPluginPrettier,
  storybookConfig,
);
