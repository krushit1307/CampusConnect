import { describe, it, expect } from "vitest";
import {
  detectPiiInText,
  cosineSimilarity,
  generateItemEmbedding,
  reportFoundItem,
} from "./lostAndFound";

describe("Digital Lost and Found Image Similarity Search (#2747)", () => {
  describe("PII Screening", () => {
    it("detects credit card numbers in text", () => {
      expect(detectPiiInText("Found wallet with card 4532 1234 5678 9012")).toBe(true);
      expect(detectPiiInText("Found blue hydroflask in room 101")).toBe(false);
    });

    it("detects SSN patterns in text", () => {
      expect(detectPiiInText("ID document with number 123-45-6789")).toBe(true);
      expect(detectPiiInText("Black laptop charger")).toBe(false);
    });

    it("rejects found item submissions containing PII", async () => {
      const piiItem = {
        title: "Found Card",
        description: "Found credit card 4532 1234 5678 9012 at Student Center",
        category: "electronics",
      };

      const res = await reportFoundItem(piiItem);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Personally Identifiable Information");
    });
  });

  describe("Vector Embedding & Cosine Similarity", () => {
    it("generates 512-dimensional normalized vector embeddings", () => {
      const vec = generateItemEmbedding("blue hydroflask with stickers");
      expect(vec.length).toBe(512);

      // Verify magnitude is ~1.0
      const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
      expect(magnitude).toBeCloseTo(1.0, 5);
    });

    it("calculates exact cosine similarity between matching and different vectors", () => {
      const vec1 = generateItemEmbedding("blue hydroflask with stickers");
      const vec2 = generateItemEmbedding("blue hydroflask with stickers");
      const vec3 = generateItemEmbedding("red umbrella");

      const simExact = cosineSimilarity(vec1, vec2);
      const simDiff = cosineSimilarity(vec1, vec3);

      expect(simExact).toBeCloseTo(1.0, 5);
      expect(simDiff).toBeLessThan(1.0);
    });
  });
});
