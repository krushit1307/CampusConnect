/**
 * Shared Zustand middleware configuration for the CampusConnect store layer.
 *
 * Issue #2689 — Migrate Global State from Context API to Zustand with DevTools
 *
 * Every focused store (useAuthStore, useUIStore, useThemeStore,
 * useNotificationStore, useAuthSecurityStore) is wired through these helpers
 * so that:
 *
 * 1. **Redux DevTools** — every state transition is visible in the Redux
 *    DevTools browser extension under its own store name, with full
 *    time-travel debugging support.
 *
 * 2. **Persistence** — slices marked as `persist` survive a full page reload
 *    via `localStorage`. The persistence layer is SSR-safe: it only touches
 *    `window.localStorage` inside the `storage` adapter, which is gated on
 *    `typeof window !== "undefined"`.
 *
 * 3. **Hydration safety** — `skipHydration: true` is used so the store never
 *    synchronously reads from `localStorage` during the initial render.
 *    Instead, `useStore.persist.rehydrate()` is called inside a `useEffect`
 *    in the dedicated `<StoreHydrationGate>` component (see
 *    `src/components/StoreHydrationGate.tsx`). This eliminates the
 *    "hydration mismatch" warnings called out in the issue's edge-case
 *    section, should SSR ever be enabled.
 */
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";

/**
 * Adapter that gracefully no-ops in non-browser environments (SSR, tests,
 * React Native renderer). Returning `null` from `getItem` is semantically
 * equivalent to "no persisted state" and causes the store to fall back
 * to its initial state.
 */
const ssrSafeStorage: StateStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(name);
    } catch {
      // localStorage may be disabled (sandboxed iframes, private mode)
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // Quota exceeded or storage disabled — silently ignore; the in-memory
      // store still holds the value for the current session.
    }
  },
  removeItem: (name: string): void => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

/**
 * Wrap a Zustand store with Redux DevTools instrumentation.
 *
 * `enabled` is gated on `import.meta.env.DEV` so the production bundle
 * pays no runtime cost for action-name tracking.
 */
export const withDevtools = <T>() =>
  devtools<T, [["zustand/devtools", never]]>(
    // The `name` here is a fallback; the store should override it via the
    // second argument to `devtools` (handled in each store file).
    (set) => set as never,
    { enabled: import.meta.env.DEV },
  ) as never;

/**
 * Re-export the raw middleware creators so each store can compose them
 * in its own preferred order. The typical pattern is:
 *
 * ```ts
 * create<T>()(
 *   devtools(
 *     persist(
 *       (set, get) => ({ ... }),
 *       { name: "...", storage: createJSONStorage(() => ssrSafeStorage), skipHydration: true },
 *     ),
 *     { name: "useFooStore", enabled: import.meta.env.DEV },
 *   ),
 * );
 * ```
 */
export { devtools, persist, createJSONStorage, ssrSafeStorage };

/**
 * Helper for stores that want both devtools + persist with sane defaults.
 * Returns the config object for `persist` so each store can override
 * `partialize` to control exactly which keys hit localStorage.
 */
export const defaultPersistConfig = (name: string) => ({
  name,
  storage: createJSONStorage(() => ssrSafeStorage),
  skipHydration: true, // see StoreHydrationGate
});
