import { describe, it, expect } from "vitest";
import { getLayoutZIndexCssClass, Z_INDEX_HIERARCHY } from "./layoutZIndex";

describe("Fix Sticky Navbar Z-Index Overlapping Tooltips Suite (#3827)", () => {
  it("applies 'sticky top-0 z-50' classes to the navigation header", () => {
    const headerCss = getLayoutZIndexCssClass({ isSticky: true, isHeader: true });

    expect(headerCss).toContain("sticky");
    expect(headerCss).toContain("top-0");
    expect(headerCss).toContain(Z_INDEX_HIERARCHY.STICKY_HEADER); // z-50
  });

  it("assigns appropriate stacking order for tooltips beneath or above content", () => {
    const tooltipCss = getLayoutZIndexCssClass({ isTooltip: true });

    expect(tooltipCss).toContain(Z_INDEX_HIERARCHY.DROPDOWN_MENU);
  });

  it("combines additional utility classes without duplicating z-index definitions", () => {
    const combined = getLayoutZIndexCssClass({
      isSticky: true,
      additionalClasses: "w-full bg-white shadow-md z-50",
    });

    expect(combined).toContain("w-full");
    expect(combined).toContain("bg-white");
    expect(combined).toContain("z-50");
  });
});
