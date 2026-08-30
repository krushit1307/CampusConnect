import { describe, it, expect } from "vitest";
import {
  tokenizeAndClean,
  extractNGrams,
  calculateSimilarityScore,
  categorizeFreeTextResponses,
  addResponseToClusters,
  RawPollResponse,
} from "../livePollingCategorizerService";

describe("Live Polling NLP Categorizer Service", () => {
  describe("tokenizeAndClean", () => {
    it("lowercases, strips punctuation, and removes English stopwords", () => {
      const input = "The rent is way too high and campus housing is very expensive!";
      const tokens = tokenizeAndClean(input);

      expect(tokens).toContain("rent");
      expect(tokens).toContain("way");
      expect(tokens).toContain("high");
      expect(tokens).toContain("campus");
      expect(tokens).toContain("housing");
      expect(tokens).toContain("expensive");

      // Verify stopwords removed
      expect(tokens).not.toContain("the");
      expect(tokens).not.toContain("is");
      expect(tokens).not.toContain("and");
    });
  });

  describe("extractNGrams", () => {
    it("extracts unigrams and bigrams from tokens", () => {
      const tokens = ["campus", "housing", "rent"];
      const nGrams = extractNGrams(tokens);

      expect(nGrams).toContain("campus");
      expect(nGrams).toContain("housing");
      expect(nGrams).toContain("rent");
      expect(nGrams).toContain("campus housing");
      expect(nGrams).toContain("housing rent");
    });
  });

  describe("calculateSimilarityScore", () => {
    it("computes Jaccard similarity between token sets", () => {
      const tokensA = ["housing", "rent", "expensive"];
      const tokensB = ["housing", "rent", "cheap"];
      const tokensC = ["food", "dining", "pizza"];

      const highSim = calculateSimilarityScore(tokensA, tokensB);
      const lowSim = calculateSimilarityScore(tokensA, tokensC);

      expect(highSim).toBeGreaterThan(0.4);
      expect(lowSim).toBe(0);
    });
  });

  describe("categorizeFreeTextResponses", () => {
    it("groups free-text responses into distinct topic clusters on the fly", () => {
      const sampleResponses: RawPollResponse[] = [
        // Topic 1: Housing & Rent (4 items)
        { id: "r1", text: "Rent for off-campus apartments is way too high" },
        { id: "r2", text: "Campus housing rent costs are crazy expensive" },
        { id: "r3", text: "We need cheaper housing options and lower rent" },
        { id: "r4", text: "Housing deposit fees and rent are unreasonable" },

        // Topic 2: Dining & Food (3 items)
        { id: "r5", text: "Dining hall food quality is terrible and cold" },
        { id: "r6", text: "Cafeteria food options need more vegan dining" },
        { id: "r7", text: "The food served in student dining center tastes awful" },

        // Topic 3: Exams & Grading (3 items)
        { id: "r8", text: "Midterm exam study guide was super confusing" },
        { id: "r9", text: "The chemistry midterm test was extremely difficult" },
        { id: "r10", text: "Professors need to release midterm exam solutions" },
      ];

      const result = categorizeFreeTextResponses(sampleResponses, "Campus Priorities Poll", "poll-99");

      expect(result.totalResponses).toBe(10);
      expect(result.clusters.length).toBeGreaterThanOrEqual(2);

      // Verify top cluster contains housing responses
      const housingCluster = result.clusters.find((c) =>
        c.keywords.some((k) => k === "housing" || k === "rent")
      );
      expect(housingCluster).toBeDefined();
      expect(housingCluster?.responseCount).toBeGreaterThanOrEqual(3);
      expect(housingCluster?.sampleQuotes.length).toBeGreaterThan(0);
    });

    it("handles empty or single-item response arrays gracefully", () => {
      const emptyResult = categorizeFreeTextResponses([], "Empty Poll");
      expect(emptyResult.totalResponses).toBe(0);
      expect(emptyResult.clusters.length).toBe(0);

      const singleResult = categorizeFreeTextResponses([{ id: "s1", text: "Great event!" }], "Single Poll");
      expect(singleResult.totalResponses).toBe(1);
      expect(singleResult.clusters.length).toBe(1);
    });
  });

  describe("addResponseToClusters", () => {
    it("incrementally categorizes incoming streaming responses", () => {
      const initialResponses: RawPollResponse[] = [
        { id: "1", text: "Housing costs are high" },
        { id: "2", text: "Rent is expensive" },
      ];

      const initialAnalysis = categorizeFreeTextResponses(initialResponses, "Live Poll");
      expect(initialAnalysis.totalResponses).toBe(2);

      const newResponse: RawPollResponse = { id: "3", text: "Dining hall food is cold" };
      const updatedAnalysis = addResponseToClusters(newResponse, initialAnalysis);

      expect(updatedAnalysis.totalResponses).toBe(3);
    });
  });
});
