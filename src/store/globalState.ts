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
export {
  safetyLockSignal,
  setSafetyLockSignal,
  threatLevelSignal,
  setThreatLevelSignal,
  calibrationStatusSignal,
  setCalibrationStatusSignal,
  resetSafetySlice,
  type ThreatLevel,
  type CalibrationStatus,
  type SafetyLockState,
} from "./createSafetySlice";

// ─── Internal imports ─────────────────────────────────────────────────
import { createReactiveObject } from "../lib/signals";
import type { UserProfile } from "./createAuthSlice";
import { createAuthSlice, type AuthSlice } from "./createAuthSlice";
import { createUISlice, type UISlice } from "./createUISlice";
import { createCacheSlice, type CacheSlice } from "./createCacheSlice";
import { createSafetySlice, type SafetySlice } from "./createSafetySlice";

export type Store = AuthSlice & UISlice & CacheSlice & SafetySlice;

// ─── Types ────────────────────────────────────────────────────────────
export interface GlobalState {
  user: UserProfile | null;
  theme: "light" | "dark" | "system" | "high-contrast";
  notificationsCount: number;
  unreadMessagesCount: number;
  activeTab: string;
  isSidebarOpen: boolean;
  safetyLock: SafetySlice["safetyLock"];
  threatLevel: SafetySlice["threatLevel"];
  calibrationStatus: SafetySlice["calibrationStatus"];
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
  safetyLock: { isLocked: false, duressFlag: false },
  threatLevel: "normal",
  calibrationStatus: "idle",
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
  const safetySlice = createSafetySlice(set as Parameters<typeof createSafetySlice>[0]);

  state = { ...authSlice, ...uiSlice, ...cacheSlice, ...safetySlice };
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

export function setSafetyLock(state: SafetySlice["safetyLock"]): void {
  store.setSafetyLock(state);
}

export function setThreatLevel(level: ThreatLevel): void {
  store.setThreatLevel(level);
}

export function setCalibrationStatus(status: CalibrationStatus): void {
  store.setCalibrationStatus(status);
}

export function resetGlobalState(): void {
  store.resetAuthSlice();
  store.resetUISlice();
  store.resetCacheSlice();
  store.resetSafetySlice();
  globalState.isSidebarOpen = true;
}
