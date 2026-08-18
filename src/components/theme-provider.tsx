/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
  type MouseEvent,
} from "react";
import {
  useThemeStore,
  type Theme,
  applyThemeToDom,
  THEME_STORAGE_KEY,
} from "../store/useThemeStore";
import { createClient } from "../lib/supabase/client";

export type { Theme };

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: (event?: MouseEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => void;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, setTheme, initThemeSync, cleanupRealtime } = useThemeStore();

  // Listen for Supabase session changes to initialize user preference sync
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session?.user?.id) {
        initThemeSync(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        initThemeSync(session.user.id);
      } else {
        initThemeSync(null);
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
  }, [theme]);

  const toggleTheme = (event?: MouseEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => {
    const nextTheme: Theme =
      theme === "light"
        ? "dark"
        : theme === "dark"
          ? "high-contrast"
          : theme === "high-contrast"
            ? "system"
            : "light";

    const isSupported = typeof document !== "undefined" && "startViewTransition" in document;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!isSupported || prefersReducedMotion || !event) {
      setTheme(nextTheme);
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
      setTheme(nextTheme);
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

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      setTheme: (nextTheme: Theme) => setTheme(nextTheme),
    }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
