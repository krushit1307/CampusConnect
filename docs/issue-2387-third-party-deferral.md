# Issue #2387 — Defer heavy third-party support/tracking widgets

## Repository-specific implementation

CampusConnect is a Vite/React application rather than a Next.js application.
The current entry point is `index.html`, and the existing third-party scripts
are:

- Google Tag Manager: `/js/gtm.js`
- Facebook Pixel: `/js/fb-pixel.js`
- Hotjar: `/js/hotjar.js`

They were previously declared directly in the HTML head, which puts their
processing on the initial document path.

The implementation replaces those immediate script tags with one tiny,
first-party loader: `/defer-third-party.js`.

## Loading strategy

The loader:

1. creates lightweight `dataLayer`, `fbq`, and `hj` queues immediately;
2. waits for `window.load`;
3. waits for `requestIdleCallback` when supported;
4. falls back to a two-second timeout where `requestIdleCallback` is absent;
5. injects the three third-party scripts asynchronously;
6. treats third-party loading failures as non-fatal.

This means the React application and its critical resources do not wait for
the external analytics/tracking downloads.

## Why not `next/script`?

The repository does not use Next.js. Its package scripts use Vite and the
application mounts through `src/main.tsx`. Therefore `next/script` and
`strategy="lazyOnload"` are not valid implementation choices here. The
equivalent browser-level behavior is implemented with `window.load` plus
`requestIdleCallback`.

## Scope

No live chat/Intercom/Drift script is currently present in the inspected
repository. The optimization therefore covers every existing third-party
tracking/analytics script found in `index.html`.

If a future support/chat widget is added, it should be registered with the
same deferred loader instead of adding a blocking `<script>` to `index.html`.

## Manual verification

Use Chrome DevTools:

1. Open Network.
2. Enable Disable cache.
3. Reload the homepage.
4. Filter for `googletagmanager`, `facebook`, and `hotjar`.
5. Confirm these requests are absent during the initial critical document/app
   startup.
6. Wait for `load` and browser idle time.
7. Confirm the requests then appear.
8. Confirm the main UI is usable before those requests complete.
9. Interact with the app while the third-party requests are pending.
10. Confirm no application errors are produced if a third-party request fails.

## Lighthouse

Run a baseline trace on the current main branch, then run the same trace on
the implementation branch using the same device/network profile. Compare:

- Total Blocking Time
- Time to Interactive
- Largest Contentful Paint
- Main-thread JavaScript execution
- Third-party blocking time

A numerical improvement should only be claimed after the two traces have been
run under equivalent conditions.
