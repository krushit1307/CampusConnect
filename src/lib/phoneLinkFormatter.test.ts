import { describe, it, expect } from "vitest";
import {
  sanitizeTelHref,
  getPhoneLinkProps,
  DEFAULT_PHONE_LINK_CLASSES,
} from "./phoneLinkFormatter";

describe("Add 'tel:' Link Wrapper Around Phone Numbers Suite (#3832)", () => {
  it("sanitizes formatted phone numbers into clean tel: href URIs", () => {
    expect(sanitizeTelHref("(555) 123-4567")).toBe("tel:5551234567");
    expect(sanitizeTelHref("+1 800-555-0199")).toBe("tel:+18005550199");
    expect(sanitizeTelHref("555.123.4567")).toBe("tel:5551234567");
  });

  it("returns null when phone number is missing or blank", () => {
    expect(getPhoneLinkProps("")).toBeNull();
    expect(getPhoneLinkProps(null)).toBeNull();
    expect(getPhoneLinkProps(undefined)).toBeNull();
  });

  it("resolves complete tel link props including display text and styling classes", () => {
    const props = getPhoneLinkProps("(555) 019-2831");

    expect(props).not.toBeNull();
    expect(props?.href).toBe("tel:5550192831");
    expect(props?.formattedDisplay).toBe("(555) 019-2831");
    expect(props?.className).toBe(DEFAULT_PHONE_LINK_CLASSES);
  });
});
