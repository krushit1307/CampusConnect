import { describe, expect, it } from "vitest";
import {
  getLegalNameValidationMessage,
  isValidLegalName,
  normalizeLegalName,
} from "./constitutionRatification";

describe("constitution ratification helpers", () => {
  it("normalizes repeated whitespace around a legal name", () => {
    expect(normalizeLegalName("  Alex   Morgan ")).toBe("Alex Morgan");
  });

  it("accepts a name with first and last name", () => {
    expect(isValidLegalName("Alex Morgan")).toBe(true);
    expect(getLegalNameValidationMessage("Alex Morgan")).toBeNull();
  });

  it("rejects an incomplete legal name", () => {
    expect(isValidLegalName("Alex")).toBe(false);
    expect(getLegalNameValidationMessage("Alex")).toContain("first and last name");
  });

  it("rejects blank input", () => {
    expect(isValidLegalName("   ")).toBe(false);
    expect(getLegalNameValidationMessage("   ")).toBeTruthy();
  });
});
