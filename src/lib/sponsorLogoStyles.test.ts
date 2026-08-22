import { describe, it, expect } from "vitest";
import { getSponsorLogoCssClass, DEFAULT_SPONSOR_HOVER_CLASSES } from "./sponsorLogoStyles";

describe("Add Subtle Hover Scale Effect to Sponsor Logos Suite (#3834)", () => {
  it("applies 'transition-transform duration-200 hover:scale-105' by default", () => {
    const css = getSponsorLogoCssClass();

    expect(css).toContain("transition-transform");
    expect(css).toContain("duration-200");
    expect(css).toContain("hover:scale-105");
  });

  it("includes inline-block object-contain styling to prevent flexbox layout breaks", () => {
    const css = getSponsorLogoCssClass();

    expect(css).toContain("inline-block");
    expect(css).toContain("object-contain");
  });

  it("merges additional custom utility classes cleanly", () => {
    const merged = getSponsorLogoCssClass({ additionalClasses: "grayscale hover:grayscale-0" });

    expect(merged).toContain("grayscale");
    expect(merged).toContain("hover:grayscale-0");
    expect(merged).toContain("hover:scale-105");
  });
});
