/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type MouseEvent,
} from "react";

export type Theme = "light" | "dark" | "system" | "high-contrast";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: (event?: MouseEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => void;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "campusconnect-theme";

function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" ||
    stored === "dark" ||
    stored === "system" ||
    stored === "high-contrast"
    ? stored
    : null;
}

function getPreferredTheme(): Theme {
  if (typeof window === "undefined") return "light";

  if (window.matchMedia("(prefers-contrast: more)").matches) {
    return "high-contrast";
  }

  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;

  const isHighContrast =
    theme === "high-contrast" ||
    (theme === "system" && window.matchMedia("(prefers-contrast: more)").matches);

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      !isHighContrast &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.classList.toggle("high-contrast", isHighContrast);
  document.documentElement.classList.toggle("dark", isDark && !isHighContrast);
  document.documentElement.style.colorScheme = isHighContrast ? "dark" : isDark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme() ?? getPreferredTheme());

  useEffect(() => {
    const initialTheme = getStoredTheme() ?? getPreferredTheme();
    setThemeState(initialTheme);
    applyTheme(initialTheme);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);

    if (theme === "system") {
      const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const contrastQuery = window.matchMedia("(prefers-contrast: more)");
      const handleChange = () => applyTheme("system");

      colorSchemeQuery.addEventListener("change", handleChange);
      contrastQuery.addEventListener("change", handleChange);
      return () => {
        colorSchemeQuery.removeEventListener("change", handleChange);
        contrastQuery.removeEventListener("change", handleChange);
      };
    }
  }, [theme]);

  const toggleTheme = (event?: MouseEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => {
    const nextTheme =
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
      setThemeState(nextTheme);
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
      setThemeState(nextTheme);
      applyTheme(nextTheme);
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
      setTheme: (nextTheme: Theme) => setThemeState(nextTheme),
    }),
    [theme],
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
