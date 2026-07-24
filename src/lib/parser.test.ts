import { describe, it, expect } from "vitest";
import { parseFlyer } from "./parser";

describe("parseFlyer", () => {
  it("should extract title from the first non-empty line", () => {
    const text = `

  Hackathon 2026
Join us for an amazing event!
    `;
    const result = parseFlyer(text);
    expect(result.title).toBe("Hackathon 2026");
  });

  it("should extract dates", () => {
    const text = `
Event Title
12/05/2026
We are excited!
    `;
    const result = parseFlyer(text);
    expect(result.date).toBe("12/05/2026");
  });

  it("should handle hyphenated dates", () => {
    const text = `
Another Event
Date: 12-05-2026
    `;
    const result = parseFlyer(text);
    expect(result.date).toBe("12-05-2026");
  });

  it("should return empty date if none found", () => {
    const text = `
Event without date
Just some text
    `;
    const result = parseFlyer(text);
    expect(result.date).toBe("");
  });

  it("should set description to the full trimmed text", () => {
    const text = `  My Event\n12/12/2026\nAwesome  `;
    const result = parseFlyer(text);
    expect(result.description).toBe(text.trim());
  });
});
