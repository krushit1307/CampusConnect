/**
 * Dark Mode Toggle & System Preference Sync Engine (#3185).
 * Manages flicker-free theme switching, Anti-FOIT head scripts,
 * OS-level media query listeners, and chart color adaptation.
 */

export type ThemeMode = "light" | "dark" | "system";

export interface ChartThemeColors {
  textColor: string;
  gridColor: string;
  backgroundColor: string;
  tooltipBackground: string;
  tooltipText: string;
  accentColor: string;
}

export const THEME_STORAGE_KEY = "campusconnect_theme";

/**
 * Resolves the active effective theme ('light' | 'dark') based on user preference
 * and OS-level system preferences.
 */
export function getResolvedTheme(
  themeMode: ThemeMode,
  systemPrefersDark: boolean,
): "light" | "dark" {
  if (themeMode === "dark") return "dark";
  if (themeMode === "light") return "light";
  return systemPrefersDark ? "dark" : "light";
}

/**
 * Generates a zero-dependency, synchronous inline JavaScript snippet for injection into
 * document <head> to prevent Flash of Incorrect Theme (FOIT) prior to React hydration.
 */
export function generateAntiFoitScript(storageKey = THEME_STORAGE_KEY): string {
  return `(function(){try{var t=localStorage.getItem('${storageKey}')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})();`;
}

/**
 * Applies or removes the '.dark' CSS class on document element.
 */
export function applyThemeClassToElement(
  resolvedTheme: "light" | "dark",
  element?: HTMLElement,
): void {
  const target = element || (typeof document !== "undefined" ? document.documentElement : null);
  if (!target) return;

  if (resolvedTheme === "dark") {
    target.classList.add("dark");
  } else {
    target.classList.remove("dark");
  }
}

/**
 * Dynamic Chart Theme Colors: Returns accessible contrast-compliant color tokens
 * for data visualizations (Recharts, Nivo, Canvas) depending on active theme.
 */
export function getChartThemeColors(resolvedTheme: "light" | "dark"): ChartThemeColors {
  if (resolvedTheme === "dark") {
    return {
      textColor: "#9CA3AF", // gray-400
      gridColor: "#374151", // gray-700
      backgroundColor: "#111827", // gray-900
      tooltipBackground: "#1F2937", // gray-800
      tooltipText: "#F9FAFB", // gray-50
      accentColor: "#60A5FA", // blue-400
    };
  }

  return {
    textColor: "#4B5563", // gray-600
    gridColor: "#E5E7EB", // gray-200
    backgroundColor: "#FFFFFF",
    tooltipBackground: "#FFFFFF",
    tooltipText: "#111827", // gray-900
    accentColor: "#2563EB", // blue-600
  };
}
