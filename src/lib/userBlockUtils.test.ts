import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  invalidateUserBlocksCache,
  getBlockedUserIds,
  isUserBlocked,
  filterBlockedContent,
  blockUser,
  unblockUser,
  validateDirectMessageSend,
  type GenericContentItem,
} from "./userBlockUtils";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return {
    createClient: () => ({
      from: mockFrom,
      rpc: mockRpc,
    }),
    mockFrom,
    mockRpc,
  };
});

describe("userBlockUtils", () => {
  beforeEach(() => {
    invalidateUserBlocksCache();
    vi.clearAllMocks();
  });

  describe("isUserBlocked", () => {
    it("returns true when targetUserId is in blockedSet", () => {
      const blockedSet = new Set(["user_b", "user_c"]);
      expect(isUserBlocked(blockedSet, "user_b")).toBe(true);
    });

    it("returns false when targetUserId is not in blockedSet", () => {
      const blockedSet = new Set(["user_b", "user_c"]);
      expect(isUserBlocked(blockedSet, "user_a")).toBe(false);
    });

    it("returns false for empty or invalid targetUserId", () => {
      const blockedSet = new Set(["user_b"]);
      expect(isUserBlocked(blockedSet, "")).toBe(false);
    });
  });

  describe("filterBlockedContent", () => {
    it("filters out posts/items authored by blocked users", () => {
      const blockedSet = new Set(["user_b"]);
      const posts: GenericContentItem[] = [
        { id: "post_1", author_id: "user_a" },
        { id: "post_2", author_id: "user_b" },
        { id: "post_3", author_id: "user_c" },
      ];

      const filtered = filterBlockedContent(posts, blockedSet);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((p) => p.id)).toEqual(["post_1", "post_3"]);
    });

    it("filters out items based on profiles nested object structure", () => {
      const blockedSet = new Set(["user_b"]);
      const comments: GenericContentItem[] = [
        { id: "c_1", profiles: { id: "user_a" } },
        { id: "c_2", profiles: { id: "user_b" } },
        { id: "c_3", profiles: [{ id: "user_b" }] },
        { id: "c_4", profiles: [{ id: "user_d" }] },
      ];

      const filtered = filterBlockedContent(comments, blockedSet);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((c) => c.id)).toEqual(["c_1", "c_4"]);
    });

    it("returns all items unchanged if blockedSet is empty", () => {
      const blockedSet = new Set<string>();
      const posts: GenericContentItem[] = [
        { id: "post_1", author_id: "user_a" },
        { id: "post_2", author_id: "user_b" },
      ];

      const filtered = filterBlockedContent(posts, blockedSet);
      expect(filtered).toHaveLength(2);
    });
  });

  describe("blockUser and unblockUser validation", () => {
    it("prevents self-blocking", async () => {
      const result = await blockUser("user_a", "user_a");
      expect(result.success).toBe(false);
      expect(result.error).toBe("You cannot block yourself.");
    });
  });
});
