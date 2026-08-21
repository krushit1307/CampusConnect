# Issue #2393 — Eliminate font-swap layout shift

## Repository-specific implementation

The issue description mentions `next/font`, but CampusConnect is a Vite + React
application, not a Next.js application. The repository's production stack is
Vite/React/TypeScript and already self-hosts Space Grotesk and Space Mono in
`public/fonts`. Therefore adding `next/font` would introduce an incompatible
framework dependency instead of fixing the actual CLS path.

The equivalent Vite implementation is:

1. Keep the existing local WOFF2 fonts.
2. Use `font-display: swap`.
3. Define metric-adjusted local fallback faces with:
   - `size-adjust`
   - `ascent-override`
   - `descent-override`
   - `line-gap-override`
4. Expose those faces through the existing `--font-display` and `--font-mono`
   CSS variables.
5. Preload the regular and bold weights used above the fold.
6. Remove unused Google Fonts preconnects because no Google-hosted font is
   required.

## Why this is the correct adaptation

`next/font` is a Next.js feature. CampusConnect's `package.json` runs Vite,
and its entry point is `index.html` + `src/main.tsx`. Introducing a Next.js
layout just for a font loader would be architecturally incorrect.

The repository already has the same architectural ingredients that a font
loader would provide: local font files, CSS variables, and a root stylesheet.

## Metric values

Space Grotesk:

- `size-adjust: 93.72%`
- `ascent-override: 98.4%`
- `descent-override: 29.2%`
- `line-gap-override: 0%`

Space Mono:

- `size-adjust: 99.2%`
- `ascent-override: 112%`
- `descent-override: 36.1%`
- `line-gap-override: 0%`

The values are deliberately kept on the fallback faces, not on the primary
font face. This causes the browser's initial fallback line boxes to occupy
approximately the same space as the eventual web font.

## Verification

Run:

```bash
npx vitest run src/font-cls.test.ts
npm run typecheck
npm run lint
npm run build
```

Then use Chrome DevTools:

1. Open **Network**.
2. Select **Slow 3G**.
3. Enable **Disable cache**.
4. Reload.
5. Open the **Performance** panel.
6. Record the initial load.
7. Inspect the Layout Shifts track.
8. Confirm the initial fallback text is visible.
9. Wait for Space Grotesk/Space Mono to finish loading.
10. Confirm text style changes without visible movement of surrounding controls,
    cards, headings, or paragraphs.

For a stronger measurement, compare bounding rectangles of a stable text sample
before and after `document.fonts.ready`. The element's `x`, `y`, `width`, and
`height` should remain unchanged (or differ only by sub-pixel rounding).

## Important limitation

No CSS metric override can guarantee literally zero CLS on every operating
system because the availability and exact metrics of local fallback fonts vary
by platform. The goal is to make the fallback metrics match the self-hosted
font closely and then validate CLS on representative browsers/devices.
