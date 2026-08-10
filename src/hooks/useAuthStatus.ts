import { useEffect, useState } from "react";
import { SessionManager } from "../lib/SessionManager";
export function useAuthStatus() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const sessionManager = SessionManager.getInstance();
    const handleLogout = () => {
      setIsAuthenticated(false);
      setToken(null);
      // Clean up local auth storage here (e.g., localStorage.removeItem('supabase.auth.token'))
      // Force instant redirect across all tabs to satisfy Acceptance Criteria #1
      window.location.href = "/login";
    };
    const handleTokenUpdate = (newToken: string) => {
      setToken(newToken);
      setIsAuthenticated(true);
    };
    sessionManager.setCallbacks(handleLogout, handleTokenUpdate);
    return () => {
      // the Singleton needs to survive component unmounts.
    };
  }, []);
  // Use this function in your UI (e.g., a "Logout" button onClick)
  const triggerLogout = () => {
    const sessionManager = SessionManager.getInstance();
    sessionManager.broadcastLogout();
  };
  return {
    isAuthenticated,
    token,
    triggerLogout,
  };
}
