/* eslint-disable react-refresh/only-export-components */
/**
 * Issue #2689 — Migrate Global State from Context API to Zustand.
 *
 * This file NO LONGER uses React Context. `useTheme()` is now a thin
 * Zustand-selector wrapper around `useThemeStore`. `ThemeProvider` is
 * kept as a passthrough component for backward compatibility with the
 * 20+ existing call sites — it no longer provides any context value,
 * it only mounts the Supabase auth listener and the system-theme media
 * query listener.
 */
import { useEffect, type ReactNode, type MouseEvent } from "react";
import {
  useThemeStore,
  type Theme,
  applyThemeToDom,
} from "../store/useThemeStore";
import { createClient } from "../lib/supabase/client";

export type { Theme };

type SetThemeFn = (theme: Theme) => void;
type ToggleThemeFn = (
  event?: MouseEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
) => void;

/**
 * Selector hook — components re-render ONLY when `theme` or `setTheme`
 * actually change. Replaces the previous `useContext(ThemeContext)`.
 */
export function useTheme(): {
  theme: Theme;
  toggleTheme: ToggleThemeFn;
  setTheme: SetThemeFn;
} {
  const theme = useThemeStore((s) => s.theme);
  const setThemeAction = useThemeStore((s) => s.setTheme);

  const toggleTheme: ToggleThemeFn = (event) => {
    const current = useThemeStore.getState().theme;
    const nextTheme: Theme =
      current === "light"
        ? "dark"
        : current === "dark"
          ? "high-contrast"
          : current === "high-contrast"
            ? "system"
            : "light";

    const isSupported =
      typeof document !== "undefined" && "startViewTransition" in document;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!isSupported || prefersReducedMotion || !event) {
      setThemeAction(nextTheme);
      return;
    }

    const x = event.clientX;
    const y = event.clientY;

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const doc = document as Document & {
      startViewTransition: (callback: () => void) => { ready: Promise<void> };
    };

    const transition = doc.startViewTransition(() => {
      setThemeAction(nextTheme);
      applyThemeToDom(nextTheme);
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        [
          { clipPath: `circle(0px at ${x}px ${y}px)` },
          { clipPath: `circle(${endRadius}px at ${x}px ${y}px)` },
        ],
        {
          duration: 500,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    });
  };

  return { theme, toggleTheme, setTheme: setThemeAction };
}

/**
 * Backward-compat wrapper. No Context. Just mounts the side-effects that
 * previously lived inside `ThemeProvider`'s `useEffect`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const initThemeSync = useThemeStore((s) => s.initThemeSync);
  const cleanupRealtime = useThemeStore((s) => s.cleanupRealtime);

  // Listen for Supabase session changes to initialize user preference sync
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session?.user?.id) {
        void initThemeSync(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        void initThemeSync(session.user.id);
      } else {
        void initThemeSync(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      cleanupRealtime();
    };
  }, [initThemeSync, cleanupRealtime]);

  // Handle system theme changes when theme is set to 'system'
  useEffect(() => {
    applyThemeToDom(theme);

    if (theme === "system" && typeof window !== "undefined") {
      const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const contrastQuery = window.matchMedia("(prefers-contrast: more)");
      const handleChange = () => applyThemeToDom("system");

      colorSchemeQuery.addEventListener("change", handleChange);
      contrastQuery.addEventListener("change", handleChange);
      return () => {
        colorSchemeQuery.removeEventListener("change", handleChange);
        contrastQuery.removeEventListener("change", handleChange);
      };
    }
    // `setTheme` is stable across renders (Zustand never re-creates actions).
    // Including it here satisfies the exhaustive-deps rule without effect.
  }, [theme, setTheme]);

  return <>{children}</>;
}
