// =============================================================================
// Hook: useMiniApp
// Issue: #2729 - Develop a Micro-Frontend Architecture for Club-Specific Mini-Apps
// Description: Manages the lifecycle of loading a remote micro-frontend.
// Handles loading states, error states, and passes the shared context (theme, user).
// =============================================================================

import { useState, useEffect, useContext } from "react";
import { loadRemoteModule, MiniAppSharedScope } from "../lib/federation";
import { ThemeContext } from "../contexts/ThemeContext"; // Assumed existing context
import { useAuth } from "./useAuth"; // Assumed existing auth hook

interface UseMiniAppOptions {
  remoteUrl: string | null;
  moduleName?: string;
  clubId: string;
}

interface UseMiniAppReturn {
  RemoteComponent: React.ComponentType<any> | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

export function useMiniApp({
  remoteUrl,
  moduleName = "./App",
  clubId,
}: UseMiniAppOptions): UseMiniAppReturn {
  const [RemoteComponent, setRemoteComponent] = useState<React.ComponentType<any> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get host app context to pass down to the remote app
  const { theme } = useContext(ThemeContext);
  const { user } = useAuth();

  const loadApp = async () => {
    if (!remoteUrl) {
      setRemoteComponent(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Dynamically import React and ReactDOM to pass as shared scope
      // This ensures the remote app uses the exact same React instance
      const React = await import("react");
      const ReactDOM = await import("react-dom");

      const sharedScope: MiniAppSharedScope = {
        react: React,
        "react-dom": ReactDOM,
        theme: theme || "light",
        userId: user?.id || "anonymous",
        clubId,
      };

      const Component = await loadRemoteModule(remoteUrl, moduleName, sharedScope);
      setRemoteComponent(() => Component);
    } catch (err: any) {
      console.error("[useMiniApp] Load failed:", err);
      setError(err.message || "Failed to load mini-app. Please check the remote URL.");
      setRemoteComponent(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApp();

    // Cleanup function
    return () => {
      // Optional: Clear cache or perform cleanup when component unmounts
    };
  }, [remoteUrl, moduleName, clubId, theme, user?.id]);

  return {
    RemoteComponent,
    isLoading,
    error,
    retry: loadApp,
  };
}
