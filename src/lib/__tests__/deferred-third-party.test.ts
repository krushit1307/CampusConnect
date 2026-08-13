import { describe, expect, it } from "vitest";

describe("deferred third-party loading contract", () => {
  it("keeps the implementation dependency-free and load/idle based", async () => {
    const source = await fetch("/defer-third-party.js").then((response) => response.text());

    expect(source).toContain('window.addEventListener("load"');
    expect(source).toContain("requestIdleCallback");
    expect(source).toContain("/js/gtm.js");
    expect(source).toContain("/js/fb-pixel.js");
    expect(source).toContain("/js/hotjar.js");
  });
});
