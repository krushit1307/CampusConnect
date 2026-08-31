// =============================================================================
// File: src/utils/colorBlindnessSimulator.ts
// Feature: Real-Time Accessibility Need Color Blindness Simulation Engine
// Description: Provides SVG feColorMatrix transforms, CVD vision mode definitions,
//              simulated color math, and WCAG AAA/AA diagnostic contrast checks.
// =============================================================================

export type CvdMode =
  | "normal"
  | "deuteranopia"
  | "deuteranomaly"
  | "protanopia"
  | "protanomaly"
  | "tritanopia"
  | "tritanomaly"
  | "achromatopsia";

export interface CvdProfile {
  id: CvdMode;
  name: string;
  category: "Red-Green" | "Blue-Yellow" | "Monochromacy" | "Standard";
  description: string;
  populationPercentage: string;
  affectedCones: string;
  svgMatrix: string;
  filterId: string;
}

/**
 * Standardized SVG feColorMatrix matrices for CVD simulation.
 * Matrices map original [R G B A] to simulated [R' G' B' A'].
 */
export const CVD_PROFILES: Record<CvdMode, CvdProfile> = {
  normal: {
    id: "normal",
    name: "Normal Vision (Trichromacy)",
    category: "Standard",
    description: "Standard trichromatic vision with all 3 functional cone types (L, M, S).",
    populationPercentage: "~92% of global population",
    affectedCones: "None",
    svgMatrix: `
      1 0 0 0 0
      0 1 0 0 0
      0 0 1 0 0
      0 0 0 1 0
    `,
    filterId: "cvd-filter-normal",
  },
  deuteranopia: {
    id: "deuteranopia",
    name: "Deuteranopia (Green-Blind)",
    category: "Red-Green",
    description: "Complete absence of M-cones (green medium-wavelength). Green/red hues appear yellow/brown.",
    populationPercentage: "~1.2% of males, ~0.01% of females",
    affectedCones: "M-cone (Green) missing",
    svgMatrix: `
      0.625 0.375 0     0 0
      0.7   0.3   0     0 0
      0     0.3   0.7   0 0
      0     0     0     1 0
    `,
    filterId: "cvd-filter-deuteranopia",
  },
  deuteranomaly: {
    id: "deuteranomaly",
    name: "Deuteranomaly (Green-Weak)",
    category: "Red-Green",
    description: "Mutated M-cones with shifted sensitivity. Most common color vision deficiency.",
    populationPercentage: "~5.0% of males, ~0.35% of females",
    affectedCones: "M-cone (Green) shifted",
    svgMatrix: `
      0.8     0.2     0       0 0
      0.25833 0.74167 0       0 0
      0       0.14167 0.85833 0 0
      0       0       0       1 0
    `,
    filterId: "cvd-filter-deuteranomaly",
  },
  protanopia: {
    id: "protanopia",
    name: "Protanopia (Red-Blind)",
    category: "Red-Green",
    description: "Complete absence of L-cones (red long-wavelength). Reds appear dark brown or charcoal.",
    populationPercentage: "~1.3% of males, ~0.02% of females",
    affectedCones: "L-cone (Red) missing",
    svgMatrix: `
      0.56667 0.43333 0       0 0
      0.55833 0.44167 0       0 0
      0       0.24167 0.75833 0 0
      0       0       0       1 0
    `,
    filterId: "cvd-filter-protanopia",
  },
  protanomaly: {
    id: "protanomaly",
    name: "Protanomaly (Red-Weak)",
    category: "Red-Green",
    description: "Mutated L-cones. Reds, oranges, and greens appear less bright and distinguishable.",
    populationPercentage: "~1.0% of males, ~0.03% of females",
    affectedCones: "L-cone (Red) shifted",
    svgMatrix: `
      0.81667 0.18333 0     0 0
      0.33333 0.66667 0     0 0
      0       0.125   0.875 0 0
      0       0       0     1 0
    `,
    filterId: "cvd-filter-protanomaly",
  },
  tritanopia: {
    id: "tritanopia",
    name: "Tritanopia (Blue-Blind)",
    category: "Blue-Yellow",
    description: "Absence of S-cones (blue short-wavelength). Blues appear greenish, yellow appears pink/grey.",
    populationPercentage: "~0.01% of population (rare)",
    affectedCones: "S-cone (Blue) missing",
    svgMatrix: `
      0.95 0.05    0       0 0
      0    0.43333 0.56667 0 0
      0    0.475   0.525   0 0
      0    0       0       1 0
    `,
    filterId: "cvd-filter-tritanopia",
  },
  tritanomaly: {
    id: "tritanomaly",
    name: "Tritanomaly (Blue-Weak)",
    category: "Blue-Yellow",
    description: "Mutated S-cones. Reduced sensitivity to blue/yellow hue differences.",
    populationPercentage: "~0.01% of population",
    affectedCones: "S-cone (Blue) shifted",
    svgMatrix: `
      0.96667 0.03333 0       0 0
      0       0.73333 0.26667 0 0
      0       0.18333 0.81667 0 0
      0       0       0       1 0
    `,
    filterId: "cvd-filter-tritanomaly",
  },
  achromatopsia: {
    id: "achromatopsia",
    name: "Achromatopsia (Total Monochromacy)",
    category: "Monochromacy",
    description: "Total color blindness; vision perceived entirely in shades of gray, black, and white.",
    populationPercentage: "~0.003% of population",
    affectedCones: "All cones non-functional",
    svgMatrix: `
      0.299 0.587 0.114 0 0
      0.299 0.587 0.114 0 0
      0.299 0.587 0.114 0 0
      0     0     0     1 0
    `,
    filterId: "cvd-filter-achromatopsia",
  },
};

export interface DiagnosticAccessibilityCheck {
  id: string;
  type: "contrast_fail" | "color_only_warning" | "pass";
  severity: "error" | "warning" | "success";
  title: string;
  message: string;
  wcagLevel: "WCAG AAA" | "WCAG AA" | "Fail";
  contrastRatio?: number;
  recommendation: string;
}

/**
 * Parses hex (#RRGGBB or #RGB) into RGB [0..255]
 */
export function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  let clean = hex.trim().replace(/^#/, "");
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  if (isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Calculates relative luminance according to WCAG 2.1 specifications.
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const rs = r / 255;
  const gs = g / 255;
  const bs = b / 255;

  const R = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
  const G = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
  const B = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Calculates WCAG contrast ratio between two RGB colors (1:1 to 21:1).
 */
export function calculateContrastRatio(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number }
): number {
  const l1 = getRelativeLuminance(fg.r, fg.g, fg.b);
  const l2 = getRelativeLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Simulates RGB color transform using the CVD 3x3 matrix approximation.
 */
export function transformColorForCvd(
  rgb: { r: number; g: number; b: number },
  mode: CvdMode
): { r: number; g: number; b: number } {
  if (mode === "normal") return rgb;

  const profile = CVD_PROFILES[mode];
  if (!profile) return rgb;

  // Parse matrix 4x5 rows
  const rawValues = profile.svgMatrix
    .trim()
    .split(/\s+/)
    .map(Number);

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const rSim = rawValues[0] * r + rawValues[1] * g + rawValues[2] * b;
  const gSim = rawValues[5] * r + rawValues[6] * g + rawValues[7] * b;
  const bSim = rawValues[10] * r + rawValues[11] * g + rawValues[12] * b;

  return {
    r: Math.min(255, Math.max(0, Math.round(rSim * 255))),
    g: Math.min(255, Math.max(0, Math.round(gSim * 255))),
    b: Math.min(255, Math.max(0, Math.round(bSim * 255))),
  };
}

/**
 * Runs diagnostic accessibility evaluation for event editor color schemes under simulated CVD vision.
 */
export function evaluateEventPageAccessibility(
  primaryColorHex: string = "#10B981",
  bgColorHex: string = "#FFFFFF",
  textColorHex: string = "#000000",
  mode: CvdMode = "deuteranopia"
): DiagnosticAccessibilityCheck[] {
  const checks: DiagnosticAccessibilityCheck[] = [];

  const textRgb = parseHexColor(textColorHex) || { r: 0, g: 0, b: 0 };
  const bgRgb = parseHexColor(bgColorHex) || { r: 255, g: 255, b: 255 };
  const brandRgb = parseHexColor(primaryColorHex) || { r: 16, g: 185, b: 129 };

  // Simulated colors
  const simTextRgb = transformColorForCvd(textRgb, mode);
  const simBgRgb = transformColorForCvd(bgRgb, mode);
  const simBrandRgb = transformColorForCvd(brandRgb, mode);

  const simContrast = calculateContrastRatio(simTextRgb, simBgRgb);
  const brandContrast = calculateContrastRatio(simBrandRgb, simBgRgb);

  // 1. Text vs Background Contrast Check
  if (simContrast < 4.5) {
    checks.push({
      id: "text-contrast-fail",
      type: "contrast_fail",
      severity: "error",
      title: "Low Text Contrast Under Simulation",
      message: `Contrast ratio is ${simContrast.toFixed(2)}:1 under ${CVD_PROFILES[mode].name}. WCAG AA requires at least 4.5:1 for body text.`,
      wcagLevel: "Fail",
      contrastRatio: Math.round(simContrast * 100) / 100,
      recommendation: "Increase contrast between text and background colors by using a darker text or lighter background.",
    });
  } else if (simContrast >= 7.0) {
    checks.push({
      id: "text-contrast-aaa",
      type: "pass",
      severity: "success",
      title: "WCAG AAA Compliant Text Contrast",
      message: `Excellent text readability (${simContrast.toFixed(2)}:1 ratio) under ${CVD_PROFILES[mode].name}.`,
      wcagLevel: "WCAG AAA",
      contrastRatio: Math.round(simContrast * 100) / 100,
      recommendation: "Color scheme provides optimal legibility across all vision spectrums.",
    });
  } else {
    checks.push({
      id: "text-contrast-aa",
      type: "pass",
      severity: "success",
      title: "WCAG AA Compliant Text Contrast",
      message: `Passes standard readability (${simContrast.toFixed(2)}:1 ratio) under ${CVD_PROFILES[mode].name}.`,
      wcagLevel: "WCAG AA",
      contrastRatio: Math.round(simContrast * 100) / 100,
      recommendation: "Meets WCAG AA standards. For enhanced readability, consider boosting contrast to 7.0:1.",
    });
  }

  // 2. Brand Accent / Action Button Visibility Check
  if (brandContrast < 3.0) {
    checks.push({
      id: "brand-button-contrast-fail",
      type: "contrast_fail",
      severity: "warning",
      title: "Low Action Button Visibility",
      message: `Brand action elements have low contrast (${brandContrast.toFixed(2)}:1) against the page background under ${CVD_PROFILES[mode].name}.`,
      wcagLevel: "Fail",
      contrastRatio: Math.round(brandContrast * 100) / 100,
      recommendation: "Add a high-contrast dark border (#000000) or adjust brand button luminosity.",
    });
  }

  // 3. Color-Only Information Warning
  if (mode === "deuteranopia" || mode === "protanopia") {
    checks.push({
      id: "color-only-indicator-warning",
      type: "color_only_warning",
      severity: "warning",
      title: "Avoid Color-Only Status Indicators",
      message: `Under Red-Green vision deficiencies, red and green status badges look nearly identical.`,
      wcagLevel: "WCAG AA",
      recommendation: "Accompany status colors with text labels or explicit icons (e.g. ✓, ⚠️, ❌).",
    });
  }

  return checks;
}
