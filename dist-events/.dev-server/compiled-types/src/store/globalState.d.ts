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
export declare const userSignal: import("../lib/signals").SignalGetter<UserProfile | null>,
  setUserSignal: import("../lib/signals").SignalSetter<UserProfile | null>;
export declare const themeSignal: import("../lib/signals").SignalGetter<
    "light" | "dark" | "system"
  >,
  setThemeSignal: import("../lib/signals").SignalSetter<"light" | "dark" | "system">;
export declare const notificationsCountSignal: import("../lib/signals").SignalGetter<number>,
  setNotificationsCountSignal: import("../lib/signals").SignalSetter<number>;
export declare const unreadMessagesCountSignal: import("../lib/signals").SignalGetter<number>,
  setUnreadMessagesCountSignal: import("../lib/signals").SignalSetter<number>;
export declare const activeTabSignal: import("../lib/signals").SignalGetter<string>,
  setActiveTabSignal: import("../lib/signals").SignalSetter<string>;
export declare const globalState: GlobalState;
/**
 * Updates the current authenticated user in global state signals and store.
 */
export declare function setUser(user: UserProfile | null): void;
/**
 * Updates the current theme in global state signals and store.
 */
export declare function setTheme(theme: "light" | "dark" | "system"): void;
/**
 * Updates the notifications count in global state signals and store.
 */
export declare function setNotificationsCount(count: number): void;
/**
 * Updates the unread messages count in global state signals and store.
 */
export declare function setUnreadMessagesCount(count: number): void;
/**
 * Updates the active tab in global state signals and store.
 */
export declare function setActiveTab(tab: string): void;
/**
 * Resets the entire global state to default initial values.
 */
export declare function resetGlobalState(): void;
