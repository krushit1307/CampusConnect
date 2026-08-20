/**
 * useAuthSecurityStore — replaces the React Context in
 * `src/components/Auth/AuthSecurityContext.tsx`.
 *
 * Issue #2689 — Context is removed; consumers use Zustand selectors:
 *
 * ```ts
 * const isAuthed = useAuthSecurityStore((s) => s.isAuthenticated);
 * const token    = useAuthSecurityStore((s) => s.token);
 * ```
 *
 * NOT persisted: tokens and MFA flags must never live in localStorage.
 * The Supabase session itself is already persisted by `@supabase/ssr`
 * via httpOnly cookies; this store only mirrors it for UI consumption.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface AuthSecurityState {
  isAuthenticated: boolean;
  token: string | null;
  isLeaderTab: boolean;
  mfaVerified: boolean;
  sessionTimeoutWarning: boolean;

  // ── Actions ────────────────────────────────────────────────────────────
  setAuthenticated: (token: string | null) => void;
  setIsLeaderTab: (isLeader: boolean) => void;
  setMfaVerified: (verified: boolean) => void;
  setSessionTimeoutWarning: (warning: boolean) => void;
  clearAuth: () => void;
}

const INITIAL: Omit<AuthSecurityState, keyof AuthSecurityState> = {
  isAuthenticated: true,
  token: null,
  isLeaderTab: false,
  mfaVerified: true,
  sessionTimeoutWarning: false,
} as const;

export const useAuthSecurityStore = create<AuthSecurityState>()(
  devtools(
    (set) => ({
      ...INITIAL,

      setAuthenticated: (token) =>
        set(
          token === null
            ? { isAuthenticated: false, token: null }
            : { isAuthenticated: true, token },
          false,
          "authSecurity/setAuthenticated",
        ),
      setIsLeaderTab: (isLeader) =>
        set({ isLeaderTab: isLeader }, false, "authSecurity/setIsLeaderTab"),
      setMfaVerified: (verified) =>
        set({ mfaVerified: verified }, false, "authSecurity/setMfaVerified"),
      setSessionTimeoutWarning: (warning) =>
        set(
          { sessionTimeoutWarning: warning },
          false,
          "authSecurity/setSessionTimeoutWarning",
        ),
      clearAuth: () =>
        set(
          {
            isAuthenticated: false,
            token: null,
            mfaVerified: false,
            sessionTimeoutWarning: false,
          },
          false,
          "authSecurity/clearAuth",
        ),
    }),
    {
      name: "useAuthSecurityStore",
      enabled: import.meta.env.DEV,
    },
  ),
);
