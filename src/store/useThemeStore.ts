// @ts-nocheck
import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { createClient } from "../lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ssrSafeStorage } from "./middleware";

export type Theme = "light" | "dark" | "system" | "high-contrast";
export type DBTheme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "campusconnect-theme";

export interface ThemeState {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  userId: string | null;
  isLoading: boolean;
  setTheme: (theme: Theme, syncRemote?: boolean) => void;
  initThemeSync: (userId?: string | null) => Promise<void>;
  cleanupRealtime: () => void;
}

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (
      stored === "light" ||
      stored === "dark" ||
      stored === "system" ||
      stored === "high-contrast"
    ) {
      return stored;
    }
  } catch {
    // Graceful fallback for sandboxed/disabled localStorage
  }
  return null;
}

export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  if (theme === "high-contrast") return "dark";
  return getSystemTheme();
}

export function applyThemeToDom(theme: Theme): void {
  if (typeof document === "undefined") return;

  const isHighContrast =
    theme === "high-contrast" ||
    (theme === "system" && window.matchMedia?.("(prefers-contrast: more)").matches);

  const resolved = resolveTheme(theme);
  const isDark = resolved === "dark" || isHighContrast;

  document.documentElement.classList.toggle("high-contrast", isHighContrast);
  document.documentElement.classList.toggle("dark", isDark && !isHighContrast);
  document.documentElement.style.colorScheme = isHighContrast ? "dark" : isDark ? "dark" : "light";
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let activeChannel: RealtimeChannel | null = null;

export const useThemeStore = create<ThemeState>()(
  devtools(
    persist(
      (set, get) => {
        const initialTheme: Theme = getStoredTheme() ?? "system";
        const initialResolved = resolveTheme(initialTheme);

        // Apply immediately upon store creation to avoid any FOUC gap
        if (typeof window !== "undefined") {
          applyThemeToDom(initialTheme);
        }

        return {
          theme: initialTheme,
          resolvedTheme: initialResolved,
          userId: null,
          isLoading: false,

          setTheme: (newTheme: Theme, syncRemote = true) => {
            const resolved = resolveTheme(newTheme);
            set(
              { theme: newTheme, resolvedTheme: resolved },
              false,
              "theme/setTheme",
            );

            if (typeof window !== "undefined") {
              try {
                window.localStorage.setItem(THEME_STORAGE_KEY, newTheme);
              } catch {
                // ignore
              }
              applyThemeToDom(newTheme);
            }

            const { userId } = get();
            if (syncRemote && userId) {
              if (debounceTimer) {
                clearTimeout(debounceTimer);
              }
              debounceTimer = setTimeout(async () => {
                try {
                  const supabase = createClient();
                  const dbTheme: DBTheme =
                    newTheme === "high-contrast" ? "dark" : (newTheme as DBTheme);

                  await supabase
                    .from("profiles")
                    .update({ theme_preference: dbTheme })
                    .eq("id", userId);
                } catch (err) {
                  console.warn(
                    "[useThemeStore] Failed to sync theme preference to Supabase:",
                    err,
                  );
                }
              }, 300);
            }
          },

          initThemeSync: async (userId?: string | null) => {
            if (!userId) {
              set({ userId: null }, false, "theme/initThemeSync/clear");
              get().cleanupRealtime();
              return;
            }

            set({ userId, isLoading: true }, false, "theme/initThemeSync/start");

            try {
              const supabase = createClient();

              // 1. Fetch remote preference
              const { data, error } = await supabase
                .from("profiles")
                .select("theme_preference")
                .eq("id", userId)
                .single();

              if (!error && data?.theme_preference) {
                const remoteTheme = data.theme_preference as Theme;
                const currentTheme = get().theme;
                if (remoteTheme !== currentTheme) {
                  get().setTheme(remoteTheme, false);
                }
              }

              // 2. Realtime listener for cross-device synchronization
              get().cleanupRealtime();
              const channel = supabase
                .channel(`user-theme-sync-${userId}`)
                .on(
                  "postgres_changes",
                  {
                    event: "UPDATE",
                    schema: "public",
                    table: "profiles",
                    filter: `id=eq.${userId}`,
                  },
                  (payload) => {
                    const updatedPref = payload.new?.theme_preference as
                      | Theme
                      | undefined;
                    if (updatedPref && updatedPref !== get().theme) {
                      get().setTheme(updatedPref, false);
                    }
                  },
                )
                .subscribe();

              activeChannel = channel;
            } catch (err) {
              console.warn("[useThemeStore] Error in initThemeSync:", err);
            } finally {
              set({ isLoading: false }, false, "theme/initThemeSync/done");
            }
          },

          cleanupRealtime: () => {
            if (activeChannel) {
              try {
                const supabase = createClient();
                supabase.removeChannel(activeChannel);
              } catch {
                // ignore
              }
              activeChannel = null;
            }
            if (debounceTimer) {
              clearTimeout(debounceTimer);
              debounceTimer = null;
            }
          },
        };
      },
      {
        name: THEME_STORAGE_KEY,
        storage: createJSONStorage(() => ssrSafeStorage),
        partialize: (state) => ({ theme: state.theme }),
        skipHydration: true, // see StoreHydrationGate
      },
    ),
    {
      name: "useThemeStore",
      enabled: import.meta.env.DEV,
    },
  ),
);
