// ***********************************************************
// Cypress Component Testing support (issue #1851).
//
// Runs once before each CT spec. We import the project's global
// stylesheet here so utility classes (Tailwind, custom brand
// colors, etc.) actually apply to the mounted component.
//
// Without this the component would render without styling, making
// it impossible to assert on visible / clickable behavior — see
// the "Tailwind CSS" edge case in issue #1851.
//
// The actual side-effect imports happen in component-index.html via
// the Vite dev server, so this file is intentionally minimal.
// ***********************************************************

// Side-effect import is wired via the html support file (component-
// index.html). When additional component-only helpers land they
// should be registered in cypress/support/component-commands/ and
// re-exported here.

export {};
