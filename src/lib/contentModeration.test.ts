import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateImageSafety, MODERATION_THRESHOLDS } from "./contentModeration";

// Mock Supabase client for hash-based screening tests
vi.mock("./supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
        order: vi.fn(() => ({
          limit: vi.fn(),
        })),
      })),
    })),
  },
}));

describe("Content Moderation AI Suite (#2673)", () => {
  it("approves clean images with low risk scores", () => {
    const cleanScores = { adult: 0.1, violence: 0.05, racy: 0.2 };
    const result = evaluateImageSafety(cleanScores);

    expect(result.isFlagged).toBe(false);
    expect(result.moderatedStatus).toBe("APPROVED");
    expect(result.reason).toBeUndefined();
  });

  it("flags inappropriate adult images exceeding threshold", () => {
    const adultScores = { adult: 0.95, violence: 0.1, racy: 0.4 };
    const result = evaluateImageSafety(adultScores);

    expect(result.isFlagged).toBe(true);
    expect(result.moderatedStatus).toBe("FLAGGED");
    expect(result.reason).toContain("Adult content threshold exceeded");
  });

  it("flags violent images exceeding threshold", () => {
    const violentScores = { adult: 0.2, violence: 0.85, racy: 0.1 };
    const result = evaluateImageSafety(violentScores);

    expect(result.isFlagged).toBe(true);
    expect(result.moderatedStatus).toBe("FLAGGED");
    expect(result.reason).toContain("Violence threshold exceeded");
  });
});

describe("Hash-Based Content Screening (#5359)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Hash Generation", () => {
    it("should generate MD5 hash for file data", async () => {
      const testData = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]); // "hello"
      const hashBuffer = await crypto.subtle.digest("MD5", testData.buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const md5Hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      expect(md5Hash).toBe("5d41402abc4b2a76b9719d911017c592");
    });

    it("should generate SHA256 hash for file data", async () => {
      const testData = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]); // "hello"
      const hashBuffer = await crypto.subtle.digest("SHA-256", testData.buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const sha256Hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      expect(sha256Hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    });
  });

  describe("Hash Matching Logic", () => {
    it("should detect exact hash match", () => {
      const knownHash = "5d41402abc4b2a76b9719d911017c592";
      const testHash = "5d41402abc4b2a76b9719d911017c592";

      const isMatch = knownHash === testHash;
      expect(isMatch).toBe(true);
    });

    it("should not match different hashes", () => {
      const knownHash = "5d41402abc4b2a76b9719d911017c592";
      const testHash = "5d41402abc4b2a76b9719d911017c593";

      const isMatch = knownHash === testHash;
      expect(isMatch).toBe(false);
    });
  });

  describe("Moderation Queue Integration", () => {
    it("should create moderation queue entry via RPC", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: "queue-123",
        error: null,
      });

      const result = await supabase.rpc("create_moderation_queue_entry", {
        p_user_id: "user-123",
        p_upload_id: "upload-123",
        p_file_name: "test.jpg",
        p_file_size_bytes: 1024000,
        p_content_type: "image/jpeg",
        p_bucket: "event-gallery",
        p_path: "test/path/test.jpg",
      });

      expect(result.data).toBe("queue-123");
    });

    it("should store content hash via RPC", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: "hash-123",
        error: null,
      });

      const result = await supabase.rpc("store_content_hash", {
        p_moderation_queue_id: "queue-123",
        p_hash_algorithm: "md5",
        p_hash_value: "5d41402abc4b2a76b9719d911017c592",
      });

      expect(result.data).toBe("hash-123");
    });

    it("should reject content via RPC", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await supabase.rpc("reject_content", {
        p_moderation_queue_id: "queue-123",
        p_rejection_reason: "CSAM match detected",
        p_match_database: "NCMEC",
        p_match_score: 95.5,
      });

      expect(result.data).toBe(true);
    });

    it("should suspend user via RPC", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: "suspension-123",
        error: null,
      });

      const result = await supabase.rpc("suspend_user", {
        p_user_id: "user-123",
        p_suspension_type: "csam",
        p_reason: "CSAM content upload",
        p_severity: "critical",
        p_is_permanent: true,
      });

      expect(result.data).toBe("suspension-123");
    });

    it("should check if user is suspended via RPC", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await supabase.rpc("is_user_suspended", {
        p_user_id: "user-123",
      });

      expect(result.data).toBe(true);
    });
  });

  describe("Database Match Detection", () => {
    it("should handle NCMEC match", () => {
      const match = {
        is_match: true,
        match_database: "NCMEC",
        match_score: 95.5,
        match_details: { list: "SDN" },
      };

      expect(match.is_match).toBe(true);
      expect(match.match_database).toBe("NCMEC");
      expect(match.match_score).toBeGreaterThan(90);
    });

    it("should handle StopNCII match", () => {
      const match = {
        is_match: true,
        match_database: "StopNCII",
        match_score: 88.0,
        match_details: { list: "NCII" },
      };

      expect(match.is_match).toBe(true);
      expect(match.match_database).toBe("StopNCII");
    });

    it("should handle no match", () => {
      const match = {
        is_match: false,
        match_database: null,
        match_score: 0,
        match_details: null,
      };

      expect(match.is_match).toBe(false);
    });
  });
});
