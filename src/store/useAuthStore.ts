import { create } from "zustand";

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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "idle",
  error: null,
  isAuthenticated: false,

  login: async (email, password = "password") => {
    set({ status: "loading", error: null });
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

      set({
        user: data.user,
        status: "success",
        error: null,
        isAuthenticated: true,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      set({
        user: null,
        status: "error",
        error: errorMessage,
        isAuthenticated: false,
      });
    }
  },

  logout: async () => {
    set({ status: "loading", error: null });
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      set({
        user: null,
        status: "idle",
        error: null,
        isAuthenticated: false,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Logout failed";
      set({
        status: "error",
        error: errorMessage,
      });
    }
  },

  fetchCurrentUser: async (token?: string) => {
    set({ status: "loading", error: null });
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

      set({
        user: data.user,
        status: "success",
        error: null,
        isAuthenticated: true,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Authentication error";
      set({
        user: null,
        status: "error",
        error: errorMessage,
        isAuthenticated: false,
      });
    }
  },

  reset: () => {
    set({
      user: null,
      status: "idle",
      error: null,
      isAuthenticated: false,
    });
  },
}));
