import { describe, it, expect } from "vitest";
import {
  getResolvedTheme,
  generateAntiFoitScript,
  getChartThemeColors,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from "./themeProvider";

describe("Dark Mode Toggle & System Preference Sync (#3185)", () => {
  describe("Theme Resolution Logic", () => {
    it("resolves explicit 'dark' preference to 'dark'", () => {
      expect(getResolvedTheme("dark", false)).toBe("dark");
      expect(getResolvedTheme("dark", true)).toBe("dark");
    });

    it("resolves explicit 'light' preference to 'light'", () => {
      expect(getResolvedTheme("light", false)).toBe("light");
      expect(getResolvedTheme("light", true)).toBe("light");
    });

    it("resolves 'system' preference based on OS-level dark mode status", () => {
      expect(getResolvedTheme("system", true)).toBe("dark");
      expect(getResolvedTheme("system", false)).toBe("light");
    });
  });

  describe("Anti-FOIT Inline Script Generator", () => {
    it("generates synchronous inline script string targeting storage key", () => {
      const script = generateAntiFoitScript();

      expect(script).toContain(THEME_STORAGE_KEY);
      expect(script).toContain("prefers-color-scheme: dark");
      expect(script).toContain("document.documentElement.classList");
    });
  });

  describe("Dynamic Chart Theme Color Adaptation", () => {
    it("provides contrast-compliant chart color tokens for dark mode", () => {
      const darkColors = getChartThemeColors("dark");

      expect(darkColors.backgroundColor).toBe("#111827");
      expect(darkColors.textColor).toBe("#9CA3AF");
      expect(darkColors.tooltipText).toBe("#F9FAFB");
    });

    it("provides clean chart color tokens for light mode", () => {
      const lightColors = getChartThemeColors("light");

      expect(lightColors.backgroundColor).toBe("#FFFFFF");
      expect(lightColors.textColor).toBe("#4B5563");
      expect(lightColors.tooltipText).toBe("#111827");
    });
  });
});
