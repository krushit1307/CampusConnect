/**
 * StoreHydrationGate — explicitly rehydrates persisted Zustand stores
 * AFTER React has mounted, eliminating hydration-mismatch warnings.
 *
 * Issue #2689 — Edge case:
 * > "Be careful with hydration mismatch errors if persisting state to
 * >  localStorage and rendering on the server (if SSR is ever implemented)."
 *
 * Every persisted store uses `skipHydration: true` in its `persist` config,
 * so the initial render uses the in-memory defaults. Then this component
 * calls `.persist.rehydrate()` inside a `useEffect`, which triggers a
 * single state update that React can reconcile without warnings.
 */
import { useEffect, type ReactNode } from "react";
import { useUIStore } from "@/store/useUIStore";
import { useThemeStore } from "@/store/useThemeStore";
import { useAuthStore } from "@/store/useAuthStore";

interface PersistCapable {
  persist?: {
    rehydrate?: () => Promise<unknown> | unknown;
  };
}

function rehydrateSafe(store: PersistCapable, label: string): void {
  try {
    const rehydrate = store.persist?.rehydrate;
    if (typeof rehydrate === "function") {
      Promise.resolve(rehydrate()).catch((err) => {
        console.warn(`[StoreHydrationGate] ${label} rehydrate failed:`, err);
      });
    }
  } catch (err) {
    console.warn(`[StoreHydrationGate] ${label} rehydrate threw:`, err);
  }
}

/**
 * Wraps the app. Renders children immediately (no blocking), then kicks
 * off async rehydration of every persisted store.
 */
export function StoreHydrationGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    rehydrateSafe(useUIStore as unknown as PersistCapable, "useUIStore");
    rehydrateSafe(useThemeStore as unknown as PersistCapable, "useThemeStore");
    rehydrateSafe(useAuthStore as unknown as PersistCapable, "useAuthStore");
  }, []);

  return <>{children}</>;
}
