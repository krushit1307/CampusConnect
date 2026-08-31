import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateAnonymizedUserPayload,
  executeCryptographicAnonymization,
} from "../accountAnonymizationService";

const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockGetSession = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
    auth: {
      getSession: mockGetSession,
    },
  }),
}));

describe("Automated Data Privacy Account Deletion Pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateAnonymizedUserPayload", () => {
    it("generates correct anonymized shell user metadata", () => {
      const userId = "usr-12345-abcde";
      const payload = generateAnonymizedUserPayload(userId);

      expect(payload.name).toBe("Anonymous User");
      expect(payload.email).toBe("deleted_user_usr-12345-abcde@campusconnect.edu");
      expect(payload.avatar_url).toBeNull();
      expect(payload.bio).toBeNull();
      expect(payload.phone).toBeNull();
      expect(payload.anonymized_at).toBeDefined();
    });
  });

  describe("executeCryptographicAnonymization", () => {
    it("successfully calls RPC anonymize_user_account and returns pipeline counts", async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          user_id: "usr-999",
          anonymized_email: "deleted_user_usr-999@campusconnect.edu",
          purged_messages: 14,
          purged_photos: 5,
          retained_rsvps: 8,
          retained_transactions: 3,
        },
        error: null,
      });

      const result = await executeCryptographicAnonymization("usr-999");

      expect(result.success).toBe(true);
      expect(result.userId).toBe("usr-999");
      expect(result.anonymizedEmail).toBe("deleted_user_usr-999@campusconnect.edu");
      expect(result.purgedChatMessagesCount).toBe(14);
      expect(result.purgedPhotosCount).toBe(5);
      expect(result.retainedRsvpsCount).toBe(8);
      expect(result.retainedLedgerTransactionsCount).toBe(3);
    });

    it("handles graceful client fallback if RPC is not immediately present in mock environment", async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "RPC function public.anonymize_user_account() does not exist" },
      });

      const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) });
      const mockDelete = vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({}) });

      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") return { update: mockUpdate };
        if (table === "direct_messages") return { delete: mockDelete };
        return { select: vi.fn() };
      });

      const result = await executeCryptographicAnonymization("usr-fallback-1");

      expect(result.success).toBe(true);
      expect(result.userId).toBe("usr-fallback-1");
      expect(result.anonymizedEmail).toContain("deleted_user_usr-fallback-1@campusconnect.edu");
    });
  });
});
