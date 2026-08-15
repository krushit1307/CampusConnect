import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  detectPiiInText,
  cosineSimilarity,
  generateItemEmbedding,
  reportFoundItem,
  reportLostItem,
} from "./lostAndFound";

// Mock Supabase client to avoid database connections during unit tests
const mockInsert = vi.fn();

vi.mock("./supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      insert: mockInsert,
    }),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

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

  describe("Matching Metadata Propagation (#3249)", () => {
    const itemPayload = {
      title: "AirPods Pro",
      description: "Lost my white AirPods Pro case.",
      category: "Electronics",
      location_found: "Gala Main Hall",
      event_id: "00000000-0000-0000-0000-0000000000e1",
      lat: 40.7128,
      lng: -74.0060,
    };

    it("reportFoundItem correctly propagates 'found' type and metadata", async () => {
      mockInsert.mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({ data: { id: "mock-id", type: "found", ...itemPayload }, error: null }),
        }),
      });

      const res = await reportFoundItem(itemPayload);
      expect(res.success).toBe(true);
      expect(res.data?.type).toBe("found");
      expect(res.data?.event_id).toBe(itemPayload.event_id);
      expect(res.data?.lat).toBe(itemPayload.lat);
      expect(res.data?.lng).toBe(itemPayload.lng);
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          type: "found",
          event_id: itemPayload.event_id,
          lat: itemPayload.lat,
          lng: itemPayload.lng,
        }),
      ]);
    });

    it("reportLostItem correctly propagates 'lost' type and metadata", async () => {
      mockInsert.mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({ data: { id: "mock-id", type: "lost", ...itemPayload }, error: null }),
        }),
      });

      const res = await reportLostItem(itemPayload);
      expect(res.success).toBe(true);
      expect(res.data?.type).toBe("lost");
      expect(res.data?.event_id).toBe(itemPayload.event_id);
      expect(res.data?.lat).toBe(itemPayload.lat);
      expect(res.data?.lng).toBe(itemPayload.lng);
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          type: "lost",
          event_id: itemPayload.event_id,
          lat: itemPayload.lat,
          lng: itemPayload.lng,
        }),
      ]);
    });
  });
});

