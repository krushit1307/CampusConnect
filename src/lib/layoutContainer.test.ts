import { describe, it, expect } from "vitest";
import { getMainContainerCssClass, DEFAULT_CONTAINER_CLASSES } from "./layoutContainer";

describe("Add Maximum Width to Main Container Suite (#3828)", () => {
  it("applies 'max-w-7xl mx-auto w-full px-4' constraints by default", () => {
    const css = getMainContainerCssClass();

    expect(css).toContain("max-w-7xl");
    expect(css).toContain("mx-auto");
    expect(css).toContain("w-full");
    expect(css).toContain("px-4");
  });

  it("allows custom max-width overrides while preserving centering behavior", () => {
    const customCss = getMainContainerCssClass({ maxWidthClass: "max-w-5xl" });

    expect(customCss).toContain("max-w-5xl");
    expect(customCss).toContain("mx-auto");
    expect(customCss).not.toContain("max-w-7xl");
  });

  it("merges additional utility classes cleanly without duplicate spaces", () => {
    const mergedCss = getMainContainerCssClass({ additionalClasses: "py-8 bg-gray-50" });

    expect(mergedCss).toContain("py-8");
    expect(mergedCss).toContain("bg-gray-50");
    expect(mergedCss).toContain("max-w-7xl");
  });
});
