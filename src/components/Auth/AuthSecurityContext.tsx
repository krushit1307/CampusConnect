/**
 * Issue #2689 — Migrate Global State from Context API to Zustand.
 *
 * This file NO LONGER uses React Context. `useAuthSecurity()` is now a
 * thin selector wrapper around `useAuthSecurityStore`. The
 * `AuthSecurityProvider` is kept as a passthrough for backward compat —
 * it only mounts the Supabase auth listener + SessionManager callbacks.
 */
import { useEffect, type ReactNode } from "react";
import { SessionManager } from "@/lib/SessionManager";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ensureKeyPair } from "@/lib/crypto/ticketCrypto";
import { useAuthSecurityStore } from "@/store/useAuthSecurityStore";

interface AuthSecurityContextType {
  isAuthenticated: boolean;
  token: string | null;
  isLeaderTab: boolean;
  mfaVerified: boolean;
  sessionTimeoutWarning: boolean;
  triggerLogout: () => void;
  verifyMfaSession: () => void;
  extendSession: () => void;
}

/**
 * Selector hook — components re-render ONLY when the specific slice they
 * consume changes. Replaces the previous `useContext(AuthSecurityContext)`.
 */
export const useAuthSecurity = (): AuthSecurityContextType => {
  const isAuthenticated = useAuthSecurityStore((s) => s.isAuthenticated);
  const token = useAuthSecurityStore((s) => s.token);
  const isLeaderTab = useAuthSecurityStore((s) => s.isLeaderTab);
  const mfaVerified = useAuthSecurityStore((s) => s.mfaVerified);
  const sessionTimeoutWarning = useAuthSecurityStore((s) => s.sessionTimeoutWarning);
  const setAuthenticated = useAuthSecurityStore((s) => s.setAuthenticated);
  const setIsLeaderTab = useAuthSecurityStore((s) => s.setIsLeaderTab);
  const setMfaVerified = useAuthSecurityStore((s) => s.setMfaVerified);
  const setSessionTimeoutWarning = useAuthSecurityStore((s) => s.setSessionTimeoutWarning);
  const clearAuth = useAuthSecurityStore((s) => s.clearAuth);

  const triggerLogout = () => {
    const sessionManager = SessionManager.getInstance();
    sessionManager.broadcastLogout();
    const supabase = createClient();
    supabase.auth.signOut().then(() => {
      clearAuth();
      window.location.href = "/auth";
    });
  };

  const verifyMfaSession = () => {
    setMfaVerified(true);
  };

  const extendSession = () => {
    setSessionTimeoutWarning(false);
    toast.success("Session successfully extended!");
  };

  return {
    isAuthenticated,
    token,
    isLeaderTab,
    mfaVerified,
    sessionTimeoutWarning,
    triggerLogout,
    verifyMfaSession,
    extendSession,
    // Note: `setAuthenticated` / `setIsLeaderTab` are not part of the
    // public AuthSecurityContextType — they are internal actions used by
    // <AuthSecurityProvider>. Including them would widen the public API.
    // We accept the small TS wart below by casting.
  } as AuthSecurityContextType;
};

/**
 * Backward-compat wrapper. No Context. Just mounts the side-effects.
 */
export const AuthSecurityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const setAuthenticated = useAuthSecurityStore((s) => s.setAuthenticated);
  const setIsLeaderTab = useAuthSecurityStore((s) => s.setIsLeaderTab);
  const clearAuth = useAuthSecurityStore((s) => s.clearAuth);

  useEffect(() => {
    const sessionManager = SessionManager.getInstance();
    setIsLeaderTab(sessionManager.isLeader);

    const handleLogout = () => {
      clearAuth();
      toast.info("Session expired or signed out from another tab.");
    };

    const handleTokenUpdate = (newToken: string) => {
      setAuthenticated(newToken);
    };

    sessionManager.setCallbacks(handleLogout, handleTokenUpdate);

    const supabase = createClient();

    // Initial auth check with Supabase
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setAuthenticated(session.access_token);
        
        try {
          const { publicKeyBase64, isNew } = await ensureKeyPair();
          if (isNew && publicKeyBase64) {
            await supabase
              .from("profiles")
              .update({ public_key: publicKeyBase64 })
              .eq("id", session.user.id);
          }
        } catch (err) {
          console.error("Failed to setup decentralized ticketing keys:", err);
        }
      }
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setAuthenticated(session.access_token);

        
        // Ensure the user has a local cryptographic key pair for decentralized ticketing
        try {
          const { publicKeyBase64, isNew } = await ensureKeyPair();
          if (isNew && publicKeyBase64) {
            // Upload the newly generated public key to the server
            await supabase
              .from("profiles")
              .update({ public_key: publicKeyBase64 })
              .eq("id", session.user.id);
          }
        } catch (err) {
          console.error("Failed to setup decentralized ticketing keys:", err);
        }
      } else {
        setAuthenticated(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setAuthenticated, setIsLeaderTab, clearAuth]);

  return <>{children}</>;
};
