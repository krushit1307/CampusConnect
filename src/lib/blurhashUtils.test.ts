import { describe, it, expect } from "vitest";
import { isValidBlurhash, DEFAULT_FALLBACK_BLURHASH } from "./blurhashUtils";

describe("isValidBlurhash", () => {
  it("returns true for a known-good blurhash", () => {
    expect(isValidBlurhash("LKO2?_%g~q_3t7t7Rjwb_3%M%MWB")).toBe(true);
  });

  it("returns true for the DEFAULT_FALLBACK_BLURHASH constant", () => {
    expect(isValidBlurhash(DEFAULT_FALLBACK_BLURHASH)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isValidBlurhash(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isValidBlurhash(undefined)).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isValidBlurhash("")).toBe(false);
  });

  it("returns false for a string shorter than 6 characters", () => {
    expect(isValidBlurhash("abc")).toBe(false);
  });

  it("returns false for a string longer than 100 characters", () => {
    expect(isValidBlurhash("a".repeat(101))).toBe(false);
  });

  it("returns false for a string with characters outside base83", () => {
    // space is not a base83 character
    expect(isValidBlurhash("LKO2? invalid")).toBe(false);
  });

  it("returns true for a minimum-length valid hash (6 chars from base83 set)", () => {
    // Digits are valid base83 chars; this was broken before the [ escape fix
    expect(isValidBlurhash("L00000")).toBe(true);
  });

  it("returns true for a hash containing base83 bracket chars", () => {
    // Square brackets are valid base83 chars and must be escaped in the regex
    expect(isValidBlurhash("ABC[DE")).toBe(true);
  });

  it("returns false for a string with space (not in base83)", () => {
    expect(isValidBlurhash("inv alid!")).toBe(false);
  });
});
