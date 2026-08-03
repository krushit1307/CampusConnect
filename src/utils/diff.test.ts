import { describe, it, expect } from "vitest";
import { diffWords } from "./diff";

describe("Word-level Diff Utility", () => {
  it("returns unchanged text with no differences", () => {
    const result = diffWords("hello world", "hello world");
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("hello world");
    expect(result[0].added).toBeUndefined();
    expect(result[0].removed).toBeUndefined();
  });

  it("detects added words correctly", () => {
    const result = diffWords("hello", "hello world");
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe("hello");
    expect(result[1].value).toBe(" world");
    expect(result[1].added).toBe(true);
  });

  it("detects removed words correctly", () => {
    const result = diffWords("hello world", "hello");
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe("hello");
    expect(result[1].value).toBe(" world");
    expect(result[1].removed).toBe(true);
  });
});
