import { describe, it, expect } from "vitest";
import { expandCampusSynonyms } from "./searchSynonyms";

describe("expandCampusSynonyms", () => {
  it("returns original query for empty or whitespace strings", () => {
    expect(expandCampusSynonyms("")).toBe("");
    expect(expandCampusSynonyms("   ")).toBe("   ");
  });

  it("expands 'CS' to 'computer science'", () => {
    expect(expandCampusSynonyms("CS")).toBe("computer science");
    expect(expandCampusSynonyms("CS Club")).toBe("computer science Club");
    expect(expandCampusSynonyms("cs society")).toBe("computer science society");
  });

  it("expands 'Comp Sci' to 'computer science'", () => {
    expect(expandCampusSynonyms("Comp Sci")).toBe("computer science");
    expect(expandCampusSynonyms("comp sci event")).toBe("computer science event");
  });

  it("expands 'SWE' to 'software engineering'", () => {
    expect(expandCampusSynonyms("SWE")).toBe("software engineering");
    expect(expandCampusSynonyms("swe club")).toBe("software engineering club");
  });

  it("expands 'EECS' to 'electrical engineering'", () => {
    expect(expandCampusSynonyms("EECS")).toBe("electrical engineering");
  });

  it("does not expand substrings inside unrelated words (e.g. 'disc' or 'process')", () => {
    expect(expandCampusSynonyms("process")).toBe("process");
    expect(expandCampusSynonyms("discuss")).toBe("discuss");
  });

  it("supports custom synonym maps", () => {
    const customMap = { ai: "artificial intelligence" };
    expect(expandCampusSynonyms("AI workshop", customMap)).toBe("artificial intelligence workshop");
  });
});
