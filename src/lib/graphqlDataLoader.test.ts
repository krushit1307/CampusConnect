import { describe, it, expect, vi } from "vitest";
import { BatchDataLoader, validateQueryDepth } from "./graphqlDataLoader";

describe("GraphQL DataLoader & Query Depth Utilities (#2652)", () => {
  describe("BatchDataLoader", () => {
    it("batches multiple load requests into a single batch function call (solves N+1 problem)", async () => {
      const batchFn = vi.fn(async (keys: readonly string[]) => {
        return keys.map((key) => ({ id: key, name: `Entity ${key}` }));
      });

      const loader = new BatchDataLoader<string, { id: string; name: string }>(batchFn);

      // Trigger 3 concurrent entity requests
      const p1 = loader.load("id_1");
      const p2 = loader.load("id_2");
      const p3 = loader.load("id_3");

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      // Verify batchFn was invoked EXACTLY ONCE with all 3 keys (N+1 query problem solved)
      expect(batchFn).toHaveBeenCalledTimes(1);
      expect(batchFn).toHaveBeenCalledWith(["id_1", "id_2", "id_3"]);

      expect(r1).toEqual({ id: "id_1", name: "Entity id_1" });
      expect(r2).toEqual({ id: "id_2", name: "Entity id_2" });
      expect(r3).toEqual({ id: "id_3", name: "Entity id_3" });
    });

    it("caches results for previously loaded keys", async () => {
      const batchFn = vi.fn(async (keys: readonly string[]) => {
        return keys.map((key) => ({ id: key, name: `Entity ${key}` }));
      });

      const loader = new BatchDataLoader<string, { id: string; name: string }>(batchFn);

      await loader.load("id_1");
      expect(batchFn).toHaveBeenCalledTimes(1);

      // Subsequent call for cached key does not re-trigger batchFn
      const cached = await loader.load("id_1");
      expect(cached).toEqual({ id: "id_1", name: "Entity id_1" });
      expect(batchFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("validateQueryDepth", () => {
    it("approves shallow queries within maxDepth limit", () => {
      const query = `
        query GetProfile {
          profile(id: "1") {
            first_name
            last_name
          }
        }
      `;

      const result = validateQueryDepth(query, 5);
      expect(result.valid).toBe(true);
      expect(result.depth).toBeLessThanOrEqual(5);
    });

    it("rejects deeply nested recursive queries exceeding maxDepth limit", () => {
      const deeplyNestedQuery = `
        query DeepQuery {
          events {
            organizer {
              events {
                organizer {
                  events {
                    organizer {
                      id
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const result = validateQueryDepth(deeplyNestedQuery, 5);
      expect(result.valid).toBe(false);
      expect(result.depth).toBeGreaterThan(5);
    });
  });
});
