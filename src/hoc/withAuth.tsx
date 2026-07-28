import React, { useEffect, useState, ComponentType } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";

export interface WithAuthProps {
  user: User;
}

export interface WithAuthOptions {
  redirectTo?: string;
  loadingComponent?: React.ReactNode;
}

/**
 * Higher-Order Component for protecting authenticated routes (#1283).
 * Verifies Supabase authentication status, shows loading indicator while initializing,
 * and automatically redirects unauthenticated users while preserving location state.
 */
export function withAuth<P extends object>(
  WrappedComponent: ComponentType<P & WithAuthProps>,
  options: WithAuthOptions = {}
) {
  const WithAuthComponent: React.FC<P> = (props) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const navigate = useNavigate();
    const location = useLocation();
    const supabase = createClient();

    const redirectPath = options.redirectTo || "/auth";

    useEffect(() => {
      let isMounted = true;

      // 1. Initial Session Check
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!isMounted) return;

        if (!session?.user) {
          const targetUrl = `${location.pathname}${location.search}`;
          navigate(`${redirectPath}?redirectTo=${encodeURIComponent(targetUrl)}`, {
            replace: true,
            state: { from: location },
          });
        } else {
          setUser(session.user);
          setIsLoading(false);
        }
      });

      // 2. Realtime Auth State Listener
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;

        if (!session?.user) {
          const targetUrl = `${location.pathname}${location.search}`;
          navigate(`${redirectPath}?redirectTo=${encodeURIComponent(targetUrl)}`, {
            replace: true,
            state: { from: location },
          });
        } else {
          setUser(session.user);
          setIsLoading(false);
        }
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    }, [navigate, location, redirectPath, supabase]);

    if (isLoading) {
      return (
        options.loadingComponent || (
          <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-white">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
              <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
                Verifying Session...
              </span>
            </div>
          </div>
        )
      );
    }

    if (!user) {
      return null;
    }

    return <WrappedComponent {...(props as P)} user={user} />;
  };

  WithAuthComponent.displayName = `WithAuth(${
    WrappedComponent.displayName || WrappedComponent.name || "Component"
  })`;

  return WithAuthComponent;
}
