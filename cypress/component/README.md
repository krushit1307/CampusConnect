# Cypress Component Testing (issue #1851)

This directory holds the Cypress Component Testing setup for
components that need a real browser to test (canvas, pointer
events, WebGL, etc.).

## Running

```sh
# Headless run
pnpm test:cypress:component

# Interactive Cypress UI
pnpm test:cypress:component:open

# Typecheck only (no browser)
pnpm typecheck:cypress
```

The CT mode uses `@cypress/vite-dev-server` so mounted components
inherit the project's Vite config (Tailwind, path aliases, etc.).

## Layout

| Path | Purpose |
| --- | --- |
| `cypress.config.ts` | Both-mode Cypress config (e2e + component) |
| `cypress/support/component.ts` | Per-spec support file for CT |
| `cypress/support/component-index.html` | Iframe mount target |
| `cypress/component/*.cy.tsx` | Component test specs |

## Adding a new CT spec

1. Drop a `*.cy.tsx` file in `cypress/component/`.
2. Use `cy.mount(<MyComponent ... />)` to render in the real browser.
3. Use the standard Cypress matchers (`cy.get`, `cy.should`, etc.).

## When to use CT vs RTL + Vitest

| Need | Use |
| --- | --- |
| Logic, props, conditional rendering | Vitest + RTL |
| Canvas / WebGL / getUserMedia | CT |
| Real pointer / drag physics | CT |
| Supabase network interception | e2e |

## Why not both?

The Vitest + RTL suite (`src/**/*.test.tsx`) still covers the bulk
of the codebase because it's faster and runs in plain Node. CT is
reserved for the components RTL can't fake — see
`cypress/component/VideoThumbnail.cy.tsx` for the first such case.
