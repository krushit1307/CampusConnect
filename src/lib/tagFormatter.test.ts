import { describe, it, expect } from "vitest";
import { formatEventTagLabel, getEventTagCssClass } from "./tagFormatter";

describe("Capitalize Tags on Event Cards Suite (#3822)", () => {
  it("capitalizes the first letter of single and multi-word lowercase tags", () => {
    expect(formatEventTagLabel("tech")).toBe("Tech");
    expect(formatEventTagLabel("free food")).toBe("Free Food");
    expect(formatEventTagLabel("workshop & seminar")).toBe("Workshop & Seminar");
    expect(formatEventTagLabel("")).toBe("");
  });

  it("returns Tailwind CSS class containing 'capitalize' transform rule", () => {
    const cssClass = getEventTagCssClass("bg-blue-100 text-blue-800");

    expect(cssClass).toContain("capitalize");
    expect(cssClass).toContain("bg-blue-100 text-blue-800");
  });
});
