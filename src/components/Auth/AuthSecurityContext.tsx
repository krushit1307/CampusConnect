import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { SessionManager } from "@/lib/SessionManager";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

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

const AuthSecurityContext = createContext<AuthSecurityContextType | undefined>(undefined);

export const AuthSecurityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [token, setToken] = useState<string | null>(null);
  const [isLeaderTab, setIsLeaderTab] = useState<boolean>(false);
  const [mfaVerified, setMfaVerified] = useState<boolean>(true);
  const [sessionTimeoutWarning, setSessionTimeoutWarning] = useState<boolean>(false);

  const supabase = createClient();

  useEffect(() => {
    const sessionManager = SessionManager.getInstance();
    setIsLeaderTab(sessionManager.isLeader);

    const handleLogout = () => {
      setIsAuthenticated(false);
      setToken(null);
      toast.info("Session expired or signed out from another tab.");
    };

    const handleTokenUpdate = (newToken: string) => {
      setToken(newToken);
      setIsAuthenticated(true);
    };

    sessionManager.setCallbacks(handleLogout, handleTokenUpdate);

    // Initial auth check with Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAuthenticated(true);
        setToken(session.access_token);
      }
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsAuthenticated(true);
        setToken(session.access_token);
      } else {
        setIsAuthenticated(false);
        setToken(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const triggerLogout = () => {
    const sessionManager = SessionManager.getInstance();
    sessionManager.broadcastLogout();
    supabase.auth.signOut().then(() => {
      setIsAuthenticated(false);
      setToken(null);
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

  return (
    <AuthSecurityContext.Provider
      value={{
        isAuthenticated,
        token,
        isLeaderTab,
        mfaVerified,
        sessionTimeoutWarning,
        triggerLogout,
        verifyMfaSession,
        extendSession,
      }}
    >
      {children}
    </AuthSecurityContext.Provider>
  );
};

export const useAuthSecurity = () => {
  const context = useContext(AuthSecurityContext);
  if (!context) {
    throw new Error("useAuthSecurity must be used within an AuthSecurityProvider");
  }
  return context;
};
