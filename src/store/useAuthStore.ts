import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { ssrSafeStorage } from "./middleware";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export type AuthStatus = "idle" | "loading" | "success" | "error";

export interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
  isAuthenticated: boolean;

  // Asynchronous actions
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchCurrentUser: (token?: string) => Promise<void>;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        status: "idle",
        error: null,
        isAuthenticated: false,

        login: async (email, password = "password") => {
          set({ status: "loading", error: null }, false, "auth/login/start");
          try {
            const res = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
              throw new Error(data.error || "Login failed");
            }

            set(
              {
                user: data.user,
                status: "success",
                error: null,
                isAuthenticated: true,
              },
              false,
              "auth/login/success",
            );
          } catch (err: unknown) {
            const errorMessage =
              err instanceof Error ? err.message : "An error occurred";
            set(
              {
                user: null,
                status: "error",
                error: errorMessage,
                isAuthenticated: false,
              },
              false,
              "auth/login/error",
            );
          }
        },

        logout: async () => {
          set({ status: "loading", error: null }, false, "auth/logout/start");
          try {
            await fetch("/api/auth/logout", { method: "POST" });
            set(
              {
                user: null,
                status: "idle",
                error: null,
                isAuthenticated: false,
              },
              false,
              "auth/logout/success",
            );
          } catch (err: unknown) {
            const errorMessage =
              err instanceof Error ? err.message : "Logout failed";
            set({ status: "error", error: errorMessage }, false, "auth/logout/error");
          }
        },

        fetchCurrentUser: async (token?: string) => {
          set({ status: "loading", error: null }, false, "auth/fetchMe/start");
          try {
            const headers: Record<string, string> = {};
            if (token) {
              headers["Authorization"] = `Bearer ${token}`;
            }

            const res = await fetch("/api/auth/me", { headers });
            const data = await res.json();

            if (!res.ok) {
              throw new Error(data.error || "Failed to fetch user");
            }

            set(
              {
                user: data.user,
                status: "success",
                error: null,
                isAuthenticated: true,
              },
              false,
              "auth/fetchMe/success",
            );
          } catch (err: unknown) {
            const errorMessage =
              err instanceof Error ? err.message : "Authentication error";
            set(
              {
                user: null,
                status: "error",
                error: errorMessage,
                isAuthenticated: false,
              },
              false,
              "auth/fetchMe/error",
            );
          }
        },

        reset: () => {
          set(
            {
              user: null,
              status: "idle",
              error: null,
              isAuthenticated: false,
            },
            false,
            "auth/reset",
          );
        },
      }),
      {
        name: "campusconnect-auth",
        storage: createJSONStorage(() => ssrSafeStorage),
        // Persist ONLY the user object — never tokens / errors / status.
        // The Supabase session lives in httpOnly cookies managed by
        // @supabase/ssr, so rehydrating `user` is a UX nicety (keeps the
        // navbar from flashing the logged-out state on F5).
        partialize: (state) => ({ user: state.user }),
        skipHydration: true, // see StoreHydrationGate
      },
    ),
    {
      name: "useAuthStore",
      enabled: import.meta.env.DEV,
    },
  ),
);
