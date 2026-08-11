import { describe, expect, it } from "vitest";
import {
  HEX_COLOR_PATTERN,
  DEFAULT_CLUB_PRIMARY_COLOR,
  DEFAULT_CLUB_SECONDARY_COLOR,
  DEFAULT_CLUB_PRIMARY_FOREGROUND,
  DEFAULT_CLUB_SECONDARY_FOREGROUND,
  getContrastTextColor,
  getClubThemeVars,
  getRelativeLuminance,
  isValidHexColor,
} from "./clubTheming";

describe("hex color validation", () => {
  it("accepts 3-digit and 6-digit hex colors", () => {
    expect(isValidHexColor("#FFF")).toBe(true);
    expect(isValidHexColor("#fff")).toBe(true);
    expect(isValidHexColor("#FFFFFF")).toBe(true);
    expect(isValidHexColor("#123456")).toBe(true);
    expect(isValidHexColor("#abcdef")).toBe(true);
  });

  it("rejects CSS injection and other non-hex values", () => {
    expect(isValidHexColor("#FFF; display:none;")).toBe(false);
    expect(isValidHexColor("#FFF;background:red")).toBe(false);
    expect(isValidHexColor("red")).toBe(false);
    expect(isValidHexColor("rgb(255,0,0)")).toBe(false);
    expect(isValidHexColor("rgba(255,0,0,0.5)")).toBe(false);
    expect(isValidHexColor("url(https://evil.example)")).toBe(false);
    expect(isValidHexColor("javascript:alert(1)")).toBe(false);
    expect(isValidHexColor("#12345")).toBe(false);
    expect(isValidHexColor("#1234567")).toBe(false);
  });

  it("rejects empty, null, and non-string values", () => {
    expect(isValidHexColor("")).toBe(false);
    expect(isValidHexColor(null)).toBe(false);
    expect(isValidHexColor(undefined)).toBe(false);
    expect(isValidHexColor(42)).toBe(false);
  });

  it("exposes the strict regex used by validation", () => {
    expect(HEX_COLOR_PATTERN.test("#123456")).toBe(true);
    expect(HEX_COLOR_PATTERN.test("#1234567")).toBe(false);
  });
});

describe("getContrastTextColor", () => {
  it("returns black text on white backgrounds", () => {
    expect(getContrastTextColor("#FFFFFF")).toBe("#000000");
    expect(getContrastTextColor("#FFF")).toBe("#000000");
    expect(getContrastTextColor("#F8F8F8")).toBe("#000000");
  });

  it("returns white text on dark backgrounds", () => {
    expect(getContrastTextColor("#000000")).toBe("#FFFFFF");
    expect(getContrastTextColor("#000")).toBe("#FFFFFF");
    expect(getContrastTextColor("#0A0A0A")).toBe("#FFFFFF");
  });

  it("returns white text on dark brand colors and black on light brand colors", () => {
    expect(getContrastTextColor("#123456")).toBe("#FFFFFF");
    expect(getContrastTextColor("#0d1b2a")).toBe("#FFFFFF");
    expect(getContrastTextColor("#000080")).toBe("#FFFFFF");
    expect(getContrastTextColor("#F1C40F")).toBe("#000000");
    expect(getContrastTextColor("#DDF25C")).toBe("#000000");
  });

  it("falls back to black for invalid input", () => {
    expect(getContrastTextColor("red")).toBe("#000000");
    expect(getContrastTextColor("#FFF;display:none")).toBe("#000000");
  });
});

describe("getRelativeLuminance", () => {
  it("computes luminance for light and dark colors", () => {
    expect(getRelativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(getRelativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
    expect(getRelativeLuminance("#6f8000")).toBeGreaterThan(0);
    expect(getRelativeLuminance("#6f8000")).toBeLessThan(0.5);
  });

  it("handles 3-digit shorthand consistently with 6-digit", () => {
    expect(getRelativeLuminance("#FFF")).toBe(getRelativeLuminance("#FFFFFF"));
    expect(getRelativeLuminance("#000")).toBe(getRelativeLuminance("#000000"));
  });

  it("returns null for invalid colors", () => {
    expect(getRelativeLuminance("#12345")).toBeNull();
    expect(getRelativeLuminance("nope")).toBeNull();
  });
});

describe("getClubThemeVars", () => {
  it("uses CampusConnect defaults for clubs without custom colors", () => {
    const vars = getClubThemeVars(null, null);
    expect(vars["--theme-primary"]).toBe(DEFAULT_CLUB_PRIMARY_COLOR);
    expect(vars["--theme-secondary"]).toBe(DEFAULT_CLUB_SECONDARY_COLOR);
  });

  it("applies validated custom colors with computed contrast foregrounds", () => {
    const vars = getClubThemeVars("#123456", "#DDF25C");
    expect(vars["--theme-primary"]).toBe("#123456");
    expect(vars["--theme-primary-foreground"]).toBe("#FFFFFF");
    expect(vars["--theme-secondary"]).toBe("#DDF25C");
    expect(vars["--theme-secondary-foreground"]).toBe("#000000");
  });

  it("never injects unvalidated values into the CSS variables", () => {
    const vars = getClubThemeVars("#FFF; display:none", "red");
    expect(vars["--theme-primary"]).toBe(DEFAULT_CLUB_PRIMARY_COLOR);
    expect(vars["--theme-secondary"]).toBe(DEFAULT_CLUB_SECONDARY_COLOR);
    expect(vars["--theme-primary-foreground"]).toBe(DEFAULT_CLUB_PRIMARY_FOREGROUND);
    expect(vars["--theme-secondary-foreground"]).toBe(DEFAULT_CLUB_SECONDARY_FOREGROUND);
  });
});
