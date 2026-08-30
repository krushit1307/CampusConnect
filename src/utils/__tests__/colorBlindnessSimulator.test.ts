import { describe, it, expect } from "vitest";
import {
  CVD_PROFILES,
  parseHexColor,
  getRelativeLuminance,
  calculateContrastRatio,
  transformColorForCvd,
  evaluateEventPageAccessibility,
  type CvdMode,
} from "../colorBlindnessSimulator";

describe("Color Blindness Simulator Utilities", () => {
  describe("CVD_PROFILES", () => {
    it("contains profile definitions for all 8 CVD modes", () => {
      const modes: CvdMode[] = [
        "normal",
        "deuteranopia",
        "deuteranomaly",
        "protanopia",
        "protanomaly",
        "tritanopia",
        "tritanomaly",
        "achromatopsia",
      ];

      modes.forEach((mode) => {
        const prof = CVD_PROFILES[mode];
        expect(prof).toBeDefined();
        expect(prof.id).toBe(mode);
        expect(prof.svgMatrix.length).toBeGreaterThan(10);
        expect(prof.filterId).toContain("cvd-filter-");
      });
    });
  });

  describe("parseHexColor", () => {
    it("parses 6-digit and 3-digit hex strings into RGB objects", () => {
      expect(parseHexColor("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
      expect(parseHexColor("#000000")).toEqual({ r: 0, g: 0, b: 0 });
      expect(parseHexColor("#FFF")).toEqual({ r: 255, g: 255, b: 255 });
      expect(parseHexColor("#10B981")).toEqual({ r: 16, g: 185, b: 129 });
    });

    it("returns null for invalid hex colors", () => {
      expect(parseHexColor("invalid")).toBeNull();
      expect(parseHexColor("")).toBeNull();
    });
  });

  describe("getRelativeLuminance & calculateContrastRatio", () => {
    it("calculates WCAG contrast ratio for black on white as 21:1", () => {
      const black = { r: 0, g: 0, b: 0 };
      const white = { r: 255, g: 255, b: 255 };
      const ratio = calculateContrastRatio(black, white);
      expect(Math.round(ratio)).toBe(21);
    });

    it("calculates contrast ratio for white on white as 1:1", () => {
      const white = { r: 255, g: 255, b: 255 };
      const ratio = calculateContrastRatio(white, white);
      expect(ratio).toBe(1);
    });
  });

  describe("transformColorForCvd", () => {
    it("returns identical RGB for normal mode", () => {
      const rgb = { r: 200, g: 100, b: 50 };
      expect(transformColorForCvd(rgb, "normal")).toEqual(rgb);
    });

    it("transforms RGB under deuteranopia green-blind simulation", () => {
      const red = { r: 255, g: 0, b: 0 };
      const simRed = transformColorForCvd(red, "deuteranopia");
      expect(simRed).toBeDefined();
      expect(simRed.r).toBeLessThan(255);
      expect(simRed.g).toBeGreaterThan(0);
    });

    it("transforms RGB to grayscale under achromatopsia monochromacy", () => {
      const blue = { r: 0, g: 0, b: 255 };
      const simBlue = transformColorForCvd(blue, "achromatopsia");
      expect(simBlue.r).toBe(simBlue.g);
      expect(simBlue.g).toBe(simBlue.b);
    });
  });

  describe("evaluateEventPageAccessibility", () => {
    it("returns WCAG AAA compliant status for black text on white background", () => {
      const checks = evaluateEventPageAccessibility("#10B981", "#FFFFFF", "#000000", "deuteranopia");
      expect(checks.length).toBeGreaterThan(0);

      const textCheck = checks.find((c) => c.id.startsWith("text-contrast"));
      expect(textCheck).toBeDefined();
      expect(textCheck?.wcagLevel).toBe("WCAG AAA");
    });

    it("flags low text contrast failure when text color is too light", () => {
      const checks = evaluateEventPageAccessibility("#10B981", "#FFFFFF", "#E2E8F0", "deuteranopia");
      const contrastFail = checks.find((c) => c.id === "text-contrast-fail");
      expect(contrastFail).toBeDefined();
      expect(contrastFail?.severity).toBe("error");
    });
  });
});
