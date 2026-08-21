import { describe, it, expect } from "vitest";
import { formatSuggestionStatusLabel, type SuggestionStatus } from "./suggestionBox";

describe("Digital Suggestion Box for Clubs (#3013)", () => {
  it("formats status labels and CSS badge classes correctly", () => {
    const pending = formatSuggestionStatusLabel("pending");
    expect(pending.label).toBe("Under Review");
    expect(pending.colorClass).toContain("amber");

    const planned = formatSuggestionStatusLabel("planned");
    expect(planned.label).toBe("Planned");
    expect(planned.colorClass).toContain("blue");

    const completed = formatSuggestionStatusLabel("completed");
    expect(completed.label).toBe("Completed");
    expect(completed.colorClass).toContain("emerald");

    const rejected = formatSuggestionStatusLabel("rejected");
    expect(rejected.label).toBe("Declined");
    expect(rejected.colorClass).toContain("destructive");
  });

  it("handles unknown status gracefully by returning pending fallback", () => {
    const unknown = formatSuggestionStatusLabel("unknown" as SuggestionStatus);
    expect(unknown.label).toBe("Under Review");
  });
});
