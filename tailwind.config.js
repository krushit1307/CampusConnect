import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            /**
             * OPTIMIZATION: Issue #2322 — Shrink CSS bundle by purging unused typography rules.
             *
             * The @tailwindcss/typography plugin generates CSS for every conceivable
             * HTML element. We disable only elements our platform genuinely does not support
             * to avoid shipping dead CSS to users.
             *
             * DISABLED — no table extension in Tiptap, no <table> rendered anywhere:
             */
            table: false,
            thead: false,
            tbody: false,
            tfoot: false,
            tr: false,
            th: false,
            td: false,
            /**
             * DISABLED — "lead" is a special prose variant for large introductory paragraphs
             * (renders via class="lead"). We do not use this class anywhere in the codebase.
             */
            ".lead": false,
            /**
             * KEPT — code and pre ARE actively used. The Tiptap StarterKit includes inline
             * Code and CodeBlock nodes, and the editor toolbar exposes a Code button.
             * Disabling these would break code rendering in posts and notes.
             *
             * If code blocks are ever removed from the editor, disable the following:
             *   code: false,
             *   pre: false,
             *   "pre code": false,
             *   "code::before": false,
             *   "code::after": false,
             */
          },
        },
      },
    },
  },
  plugins: [typography],
};
