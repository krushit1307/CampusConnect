import { describe, expect, it } from "vitest";
import { calculateReadTime } from "./readTime";

describe("readTime Utility", () => {
  it("returns < 1 min read for empty or whitespace text", () => {
    expect(calculateReadTime("")).toBe("< 1 min read");
    expect(calculateReadTime("   ")).toBe("< 1 min read");
  });

  it("returns < 1 min read for text under 200 words", () => {
    const shortText = "CampusConnect is a platform for student clubs and events.";
    expect(calculateReadTime(shortText)).toBe("< 1 min read");
  });

  it("calculates correct read time for longer text", () => {
    const hundredWords = Array(300).fill("word").join(" ");
    expect(calculateReadTime(hundredWords)).toBe("2 min read");

    const thousandWords = Array(1000).fill("test").join(" ");
    expect(calculateReadTime(thousandWords)).toBe("5 min read");
  });
});
