import { createSignal, createReactiveObject } from "../lib/signals";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role?: string;
}

export interface GlobalState {
  user: UserProfile | null;
  theme: "light" | "dark" | "system";
  notificationsCount: number;
  unreadMessagesCount: number;
  activeTab: string;
  isSidebarOpen: boolean;
}

const getInitialStoredTheme = (): "light" | "dark" | "system" => {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("campusconnect-theme");
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  }
  return "light";
};

// Fine-grained signal declarations for global state variables
export const [userSignal, setUserSignal] = createSignal<UserProfile | null>(null);
export const [themeSignal, setThemeSignal] = createSignal<"light" | "dark" | "system">(
  getInitialStoredTheme(),
);
export const [notificationsCountSignal, setNotificationsCountSignal] = createSignal<number>(0);
export const [unreadMessagesCountSignal, setUnreadMessagesCountSignal] = createSignal<number>(0);
export const [activeTabSignal, setActiveTabSignal] = createSignal<string>("overview");

// Proxy-backed global state object for direct property dependency tracking
export const globalState = createReactiveObject<GlobalState>({
  user: null,
  theme: getInitialStoredTheme(),
  notificationsCount: 0,
  unreadMessagesCount: 0,
  activeTab: "overview",
  isSidebarOpen: true,
});

/**
 * Updates the current authenticated user in global state signals and store.
 */
export function setUser(user: UserProfile | null): void {
  setUserSignal(user);
  globalState.user = user;
}

/**
 * Updates the current theme in global state signals and store.
 */
export function setTheme(theme: "light" | "dark" | "system"): void {
  setThemeSignal(theme);
  globalState.theme = theme;
  if (typeof window !== "undefined") {
    window.localStorage.setItem("campusconnect-theme", theme);
  }
}

/**
 * Updates the notifications count in global state signals and store.
 */
export function setNotificationsCount(count: number): void {
  setNotificationsCountSignal(count);
  globalState.notificationsCount = count;
}

/**
 * Updates the unread messages count in global state signals and store.
 */
export function setUnreadMessagesCount(count: number): void {
  setUnreadMessagesCountSignal(count);
  globalState.unreadMessagesCount = count;
}

/**
 * Updates the active tab in global state signals and store.
 */
export function setActiveTab(tab: string): void {
  setActiveTabSignal(tab);
  globalState.activeTab = tab;
}

/**
 * Resets the entire global state to default initial values.
 */
export function resetGlobalState(): void {
  setUser(null);
  setTheme("light");
  setNotificationsCount(0);
  setUnreadMessagesCount(0);
  setActiveTab("overview");
  globalState.isSidebarOpen = true;
}
