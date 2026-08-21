// Per-club brand color helpers (dynamic club branding).
//
// Only strictly validated hex values may ever reach the generated CSS, so
// clubs can never inject `#FFF; display:none` or similar payloads.

import type { CSSProperties } from "react";

/** Strict 3- or 6-digit hex pattern. Everything else is rejected. */
export const HEX_COLOR_PATTERN = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

// CampusConnect's current brand colors. Used as the fallback whenever a
// club has no custom colors configured so existing clubs keep rendering
// exactly as they did before this feature. These mirror the old hardcoded
// classes: the header logo was `bg-lime text-black`, while the Join and
// confirm buttons were `bg-black text-cream`.
export const DEFAULT_CLUB_PRIMARY_COLOR = "#6f8000";
export const DEFAULT_CLUB_SECONDARY_COLOR = "#000000";
export const DEFAULT_CLUB_PRIMARY_FOREGROUND = "#000000";
export const DEFAULT_CLUB_SECONDARY_FOREGROUND = "#f3f1e4";

// `CSSProperties` keeps these assignable to a `style` prop (e.g. the club
// profile's framer-motion `motion.div`), whose `MotionStyle` type is otherwise
// closed to `--*` custom properties.
export type ClubThemeVars = {
  "--theme-primary": string;
  "--theme-primary-foreground": string;
  "--theme-secondary": string;
  "--theme-secondary-foreground": string;
} & CSSProperties;

/**
 * Validate a value as a hex color. Backend (DB CHECK constraint) validation
 * remains authoritative; this mirrors the same rule for the frontend.
 */
export function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value);
}

/** Expand a 3-digit hex shorthand (`#abc` → `#aabbcc`). */
export function expandHexShorthand(hex: string): string {
  if (!isValidHexColor(hex) || hex.length === 7) return hex;
  return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
}

function srgbChannelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * WCAG 2.x relative luminance of a hex color in the range 0 (black) to
 * 1 (white). Returns `null` for anything that is not a valid hex color.
 */
export function getRelativeLuminance(hex: string): number | null {
  if (!isValidHexColor(hex)) return null;
  const full = expandHexShorthand(hex);
  const r = srgbChannelToLinear(parseInt(full.slice(1, 3), 16));
  const g = srgbChannelToLinear(parseInt(full.slice(3, 5), 16));
  const b = srgbChannelToLinear(parseInt(full.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Return the text color (`#000000` or `#FFFFFF`) that has the best WCAG
 * contrast ratio against the given background color.
 *
 *   getContrastTextColor("#FFFFFF") → "#000000"
 *   getContrastTextColor("#000000") → "#FFFFFF"
 *
 * Invalid input falls back to `#000000` (callers are expected to validate
 * first, and validated colors are the only ones that reach the CSS).
 */
export function getContrastTextColor(hex: string): "#000000" | "#FFFFFF" {
  const luminance = getRelativeLuminance(hex);
  if (luminance === null) return "#000000";
  // White text is higher contrast whenever luminance < 0.179 (where
  // 1.05/(L+0.05) overtakes (L+0.05)/0.05).
  return luminance > 0.179 ? "#000000" : "#FFFFFF";
}

/**
 * Build the CSS variables applied to a club's public profile. Validated
 * colors are injected; anything else falls back to the CampusConnect
 * defaults so unthemed clubs look identical to before.
 */
export function getClubThemeVars(
  primary: string | null | undefined,
  secondary: string | null | undefined,
): ClubThemeVars {
  const safePrimary = isValidHexColor(primary) ? primary : null;
  const safeSecondary = isValidHexColor(secondary) ? secondary : null;

  return {
    "--theme-primary": safePrimary ?? DEFAULT_CLUB_PRIMARY_COLOR,
    "--theme-primary-foreground": safePrimary
      ? getContrastTextColor(safePrimary)
      : DEFAULT_CLUB_PRIMARY_FOREGROUND,
    "--theme-secondary": safeSecondary ?? DEFAULT_CLUB_SECONDARY_COLOR,
    "--theme-secondary-foreground": safeSecondary
      ? getContrastTextColor(safeSecondary)
      : DEFAULT_CLUB_SECONDARY_FOREGROUND,
  };
}
