/**
 * useUIStore — UI presentation state (sidebar, active tab, command palette).
 *
 * Issue #2689 — split out from the legacy signal-based `globalState.ts`.
 *
 * Why a dedicated store?
 *   - Sidebar toggles fire frequently (mobile gestures, route changes).
 *   - Active tab changes fire on every navigation.
 *   - Neither belongs in the auth or notification stores, which have
 *     different re-render characteristics.
 *
 * Persisted slices: `sidebarOpen` survives a reload so a user who collapsed
 * the sidebar on desktop doesn't see it pop back open.
 */
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { ssrSafeStorage, createJSONStorage } from "./middleware";

export interface UIState {
  /** Mobile / drawer sidebar open state. Desktop is controlled by CSS. */
  sidebarOpen: boolean;
  /** Currently highlighted nav tab (used for ARIA `aria-current`). */
  activeTab: string;
  /** Command palette (Cmd+K) visibility. */
  commandPaletteOpen: boolean;

  // ── Actions ────────────────────────────────────────────────────────────
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  resetUI: () => void;
}

const INITIAL_UI_STATE = {
  sidebarOpen: true,
  activeTab: "overview",
  commandPaletteOpen: false,
} satisfies Pick<UIState, "sidebarOpen" | "activeTab" | "commandPaletteOpen">;

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        ...INITIAL_UI_STATE,

        toggleSidebar: () =>
          set(
            (state) => ({ sidebarOpen: !state.sidebarOpen }),
            false,
            "ui/toggleSidebar",
          ),
        setSidebarOpen: (open) =>
          set({ sidebarOpen: open }, false, "ui/setSidebarOpen"),
        setActiveTab: (tab) =>
          set({ activeTab: tab }, false, "ui/setActiveTab"),
        openCommandPalette: () =>
          set({ commandPaletteOpen: true }, false, "ui/openCommandPalette"),
        closeCommandPalette: () =>
          set({ commandPaletteOpen: false }, false, "ui/closeCommandPalette"),
        toggleCommandPalette: () =>
          set(
            (state) => ({ commandPaletteOpen: !state.commandPaletteOpen }),
            false,
            "ui/toggleCommandPalette",
          ),
        resetUI: () =>
          set({ ...INITIAL_UI_STATE }, false, "ui/reset"),
      }),
      {
        name: "campusconnect-ui",
        storage: createJSONStorage(() => ssrSafeStorage),
        // Only persist user-preference slices; transient modal state resets.
        partialize: (state) => ({
          sidebarOpen: state.sidebarOpen,
          activeTab: state.activeTab,
        }),
        skipHydration: true, // see StoreHydrationGate
      },
    ),
    {
      name: "useUIStore",
      enabled: import.meta.env.DEV,
    },
  ),
);
