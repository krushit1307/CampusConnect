import { describe, it, expect } from "vitest";
import {
  normalizeSearchQuery,
  buildClubEmbeddingText,
  processSemanticSearchResults,
  SemanticSearchResult,
} from "./semanticSearch";

describe("Develop Dynamic Club Tag Semantic Search Suite (#4494)", () => {
  it("normalizes user search queries by stripping special characters", () => {
    expect(normalizeSearchQuery("  #Programming!!  ")).toBe("programming");
    expect(normalizeSearchQuery("CS & Software-Dev")).toBe("cs software-dev");
  });

  it("builds a rich text representation of a club for embedding generation", () => {
    const embeddingText = buildClubEmbeddingText("Computer Science Society", "We build software.", [
      "#Coding",
      "Tech",
    ]);
    expect(embeddingText).toBe(
      "Club: Computer Science Society. Description: We build software.. Tags: Coding, Tech.",
    );
  });

  it("filters and sorts semantic search results by similarity threshold", () => {
    const mockResults: SemanticSearchResult[] = [
      { id: "1", name: "Gardening", description: "", tags: [], similarity: 0.15 },
      { id: "2", name: "CS Club", description: "", tags: ["Coding"], similarity: 0.89 },
      { id: "3", name: "Robotics", description: "", tags: ["Hardware"], similarity: 0.65 },
    ];

    const processed = processSemanticSearchResults(mockResults, 0.4);

    expect(processed.length).toBe(2);
    expect(processed[0].name).toBe("CS Club"); // Highest similarity first
    expect(processed[1].name).toBe("Robotics");

    // Gardening should be filtered out (0.15 < 0.4)
    expect(processed.find((p) => p.name === "Gardening")).toBeUndefined();
  });
});
