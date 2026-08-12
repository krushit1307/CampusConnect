# Error Boundary

Issue #197 adds a React Error Boundary so a component-level render error does
not turn the entire app into a blank white screen.

## What is covered

- `src/components/ErrorBoundary.tsx` catches render-time React errors.
- The fallback screen shows a friendly **Something went wrong** message.
- Users can reload the page, try a soft reset, or return home.
- Error details are available behind a collapsible disclosure for debugging.
- `RouteErrorBoundary` handles route loader/render errors from React Router.
- `src/App.tsx` wraps the application shell with `ErrorBoundary`.
- Route definitions use `errorElement={<RouteErrorBoundary />}`.

## Manual testing

1. Start the app with `npm run dev`.
2. Temporarily throw an error from any route/component render body.
3. Confirm the app shows the friendly fallback screen instead of a blank page.
4. Confirm **Reload Page** reloads the browser.
5. Confirm **Try Again** resets the boundary.
6. Confirm **Go Home** navigates to `/`.
7. Confirm route-level errors render through `RouteErrorBoundary`.
8. Run the focused unit test file.

## Commands

```powershell
npx vitest run src/components/ErrorBoundary.test.tsx
npm run typecheck
npm run lint
npm run build
```
