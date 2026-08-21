import { describe, it, expect } from "vitest";
import { getNavLinkCssClass, DEFAULT_HOVER_CLASS, ACTIVE_NAV_LINK_CLASS } from "./navLinkStyles";

describe("Change Hover Text Color on Main Navigation Links Suite (#3825)", () => {
  it("applies brand hover class 'hover:text-blue-600' and transition classes by default", () => {
    const css = getNavLinkCssClass();

    expect(css).toContain("hover:text-blue-600");
    expect(css).toContain("transition-colors");
    expect(css).toContain("duration-150");
  });

  it("handles active nav link state correctly", () => {
    const activeCss = getNavLinkCssClass({ isActive: true });

    expect(activeCss).toContain("text-blue-600");
    expect(activeCss).toContain("font-semibold");
  });

  it("allows custom hover color overrides when specified", () => {
    const customCss = getNavLinkCssClass({ customHoverColorClass: "hover:text-indigo-600" });

    expect(customCss).toContain("hover:text-indigo-600");
  });
});
