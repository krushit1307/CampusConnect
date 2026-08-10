// ─── Re-export signals and slice helpers ─────────────────────────────
export type { UserProfile } from "./createAuthSlice";
export { userSignal, setUserSignal, resetAuthSlice } from "./createAuthSlice";
export {
  themeSignal,
  setThemeSignal,
  activeTabSignal,
  setActiveTabSignal,
  resetUISlice,
} from "./createUISlice";
export {
  notificationsCountSignal,
  setNotificationsCountSignal,
  unreadMessagesCountSignal,
  setUnreadMessagesCountSignal,
  resetCacheSlice,
} from "./createCacheSlice";

// ─── Internal imports ─────────────────────────────────────────────────
import { createReactiveObject } from "../lib/signals";
import type { UserProfile } from "./createAuthSlice";
import { createAuthSlice, type AuthSlice } from "./createAuthSlice";
import { createUISlice, type UISlice } from "./createUISlice";
import { createCacheSlice, type CacheSlice } from "./createCacheSlice";

export type Store = AuthSlice & UISlice & CacheSlice;

// ─── Types ────────────────────────────────────────────────────────────
export interface GlobalState {
  user: UserProfile | null;
  theme: "light" | "dark" | "system" | "high-contrast";
  notificationsCount: number;
  unreadMessagesCount: number;
  activeTab: string;
  isSidebarOpen: boolean;
}

const getInitialStoredTheme = (): "light" | "dark" | "system" | "high-contrast" => {
  if (typeof window !== "undefined" && typeof window.localStorage?.getItem === "function") {
    const stored = window.localStorage.getItem("campusconnect-theme");
    if (
      stored === "light" ||
      stored === "dark" ||
      stored === "system" ||
      stored === "high-contrast"
    ) {
      return stored;
    }
  }
  return "light";
};

// Proxy-backed global state object for direct property dependency tracking
export const globalState = createReactiveObject<GlobalState>({
  user: null,
  theme: getInitialStoredTheme(),
  notificationsCount: 0,
  unreadMessagesCount: 0,
  activeTab: "overview",
  isSidebarOpen: true,
});

// ─── Bounded store (slices pattern) ──────────────────────────────────
function createStore(): Store {
  let state: Store = {} as Store;

  const set = (partial: Partial<Store> | ((prev: Store) => Partial<Store>)): void => {
    const patch = typeof partial === "function" ? partial(state) : partial;
    state = { ...state, ...patch };
    Object.assign(globalState, patch);
  };

  const authSlice = createAuthSlice(set as Parameters<typeof createAuthSlice>[0]);
  const uiSlice = createUISlice(set as Parameters<typeof createUISlice>[0]);
  const cacheSlice = createCacheSlice(set as Parameters<typeof createCacheSlice>[0]);

  state = { ...authSlice, ...uiSlice, ...cacheSlice };
  state.theme = getInitialStoredTheme();

  return state;
}

export const store = createStore();

// ─── Public action API ────────────────────────────────────────────────
export function setUser(user: UserProfile | null): void {
  store.setUser(user);
}

/**
 * Updates the current theme in global state signals and store.
 */
export function setTheme(theme: "light" | "dark" | "system" | "high-contrast"): void {
  store.setTheme(theme);
  globalState.theme = theme;
  if (typeof window !== "undefined") {
    window.localStorage.setItem("campusconnect-theme", theme);
  }
}

export function setNotificationsCount(count: number): void {
  store.setNotificationsCount(count);
}

export function setUnreadMessagesCount(count: number): void {
  store.setUnreadMessagesCount(count);
}

export function setActiveTab(tab: string): void {
  store.setActiveTab(tab);
}

export function resetGlobalState(): void {
  store.resetAuthSlice();
  store.resetUISlice();
  store.resetCacheSlice();
  globalState.isSidebarOpen = true;
}
