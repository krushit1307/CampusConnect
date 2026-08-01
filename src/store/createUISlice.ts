import { createSignal } from "../lib/signals";

export const [themeSignal, setThemeSignal] = createSignal<
  "light" | "dark" | "system" | "high-contrast"
>("light");
export const [activeTabSignal, setActiveTabSignal] = createSignal<string>("overview");

export function resetUISlice(): void {
  setThemeSignal("light");
  setActiveTabSignal("overview");
}

// ─── Slice factory for composition ───────────────────────────────────

export interface UISlice {
  theme: "light" | "dark" | "system" | "high-contrast";
  activeTab: string;
  isSidebarOpen: boolean;
  setTheme: (theme: "light" | "dark" | "system" | "high-contrast") => void;
  setActiveTab: (tab: string) => void;
  toggleSidebar: () => void;
  resetUISlice: () => void;
}

type SetState<T> = (state: Partial<T> | ((prev: T) => Partial<T>)) => void;

export function createUISlice(set: SetState<UISlice>): UISlice {
  return {
    theme: "light",
    activeTab: "overview",
    isSidebarOpen: true,
    setTheme: (theme: "light" | "dark" | "system" | "high-contrast") => {
      setThemeSignal(theme);
      set({ theme });
      if (typeof window !== "undefined") {
        window.localStorage.setItem("campusconnect-theme", theme);
      }
    },
    setActiveTab: (tab: string) => {
      setActiveTabSignal(tab);
      set({ activeTab: tab });
    },
    toggleSidebar: () => {
      set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
    },
    resetUISlice: () => {
      setThemeSignal("light");
      setActiveTabSignal("overview");
      set({ theme: "light", activeTab: "overview", isSidebarOpen: true });
    },
  };
}
