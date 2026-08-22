import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  queryRegistrarDirectory,
  purgeInactiveStudentAccount,
  runRegistrarBatchSync,
} from "../registrarVerificationService";
import { createClient } from "../../lib/supabase/client";

const mockFrom = vi.fn();

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

describe("Automated Registrar Verification Service (#3691)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("queryRegistrarDirectory", () => {
    it("returns enrollmentStatus: 'active' for active enrolled student", () => {
      const result = queryRegistrarDirectory("STD-9001", "student@university.edu");
      expect(result.enrollmentStatus).toBe("active");
    });

    it("returns enrollmentStatus: 'inactive' for expelled or inactive student", () => {
      const result = queryRegistrarDirectory("STD-INACTIVE-808", "expelled_student@university.edu");
      expect(result.enrollmentStatus).toBe("inactive");
    });
  });

  describe("purgeInactiveStudentAccount", () => {
    it("locks profile, revokes sessions, purges club rosters, and formats president notification", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
            }),
          };
        }
        if (table === "club_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ club_id: "club-film" }, { club_id: "club-scifi" }],
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
            }),
          };
        }
        if (table === "registrar_sync_logs") {
          return {
            insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
          };
        }
        return {};
      });

      const result = await purgeInactiveStudentAccount(
        "user-expelled-1",
        "STD-EX-999",
        "John Doe",
        "Student expelled",
      );

      expect(result.success).toBe(true);
      expect(result.accountLocked).toBe(true);
      expect(result.clubsPurgedCount).toBe(2);
      expect(result.notificationMessage).toBe(
        "User John Doe has been automatically removed from your roster due to a change in university enrollment status.",
      );
    });
  });

  describe("runRegistrarBatchSync", () => {
    it("batches active profiles and purges inactive student accounts", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "user-1",
                      full_name: "Alice Smith",
                      email: "alice@univ.edu",
                      student_id: "STD-101",
                    },
                    {
                      id: "user-2",
                      full_name: "Bob Inactive",
                      email: "bob.inactive@univ.edu",
                      student_id: "STD-EX-102",
                    },
                  ],
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
            }),
          };
        }
        if (table === "club_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ club_id: "club-1" }] }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
            }),
          };
        }
        if (table === "registrar_sync_logs") {
          return {
            insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
          };
        }
        return {};
      });

      const res = await runRegistrarBatchSync();

      expect(res.totalSynced).toBe(2);
      expect(res.activeCount).toBe(1);
      expect(res.purgedCount).toBe(1);
      expect(res.logs.length).toBe(1);
      expect(res.logs[0].user_full_name).toBe("Bob Inactive");
    });
  });
});
