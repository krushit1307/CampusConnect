import { describe, it, expect } from "vitest";
import {
  getButtonAccessibilityCssClass,
  HIG_TOUCH_TARGET_CLASS,
  BUTTON_SIZE_CLASSES,
} from "./mobileButtonStyles";

describe("Increase Padding on Mobile Buttons (Apple HIG Compliance) Suite (#3847)", () => {
  it("applies 'py-2 px-3' and 'min-h-[44px]' padding for 'sm' button size variant", () => {
    const smCss = getButtonAccessibilityCssClass({ size: "sm" });

    expect(smCss).toContain("py-2");
    expect(smCss).toContain("px-3");
    expect(smCss).toContain("min-h-[44px]");
    expect(smCss).toContain("min-w-[44px]");
  });

  it("enforces minimum 44px HIG touch target constraints across all button sizes", () => {
    const mdCss = getButtonAccessibilityCssClass({ size: "md" });
    const lgCss = getButtonAccessibilityCssClass({ size: "lg" });

    expect(mdCss).toContain(HIG_TOUCH_TARGET_CLASS);
    expect(lgCss).toContain(HIG_TOUCH_TARGET_CLASS);
  });

  it("merges custom styling classes while maintaining HIG compliance", () => {
    const mergedCss = getButtonAccessibilityCssClass({
      size: "sm",
      additionalClasses: "bg-blue-600 text-white hover:bg-blue-700",
    });

    expect(mergedCss).toContain("bg-blue-600");
    expect(mergedCss).toContain("min-h-[44px]");
    expect(mergedCss).toContain("py-2");
  });
});
