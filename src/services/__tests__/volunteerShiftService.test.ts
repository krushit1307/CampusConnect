import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getEventVolunteerShifts,
  createVolunteerShift,
  claimVolunteerShift,
  cancelVolunteerShiftClaim,
} from "../volunteerShiftService";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

describe("Dynamic Volunteer Shift Scheduler Service (#3892)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getEventVolunteerShifts", () => {
    it("fetches shifts for an event and attaches claimed count and user claim status", async () => {
      const mockShifts = [
        {
          id: "shift-1",
          event_id: "evt-hackathon-1",
          role_name: "Registration Desk",
          start_time: "2026-09-01T08:00:00Z",
          end_time: "2026-09-01T10:00:00Z",
          capacity: 2,
          points_per_hour: 50,
          created_at: "2026-08-20T00:00:00Z",
        },
      ];

      const mockClaims = [
        {
          shift_id: "shift-1",
          user_id: "user-vol-1",
          status: "claimed",
        },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === "volunteer_shifts") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockShifts, error: null }),
          };
        }
        if (table === "shift_claims") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockClaims, error: null }),
          };
        }
        return {};
      });

      const result = await getEventVolunteerShifts("evt-hackathon-1", "user-vol-1");

      expect(result).toHaveLength(1);
      expect(result[0].role_name).toBe("Registration Desk");
      expect(result[0].claimed_count).toBe(1);
      expect(result[0].user_has_claimed).toBe(true);
    });
  });

  describe("claimVolunteerShift", () => {
    it("claims a shift atomically and awards gamification points (50 pts/hr)", async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          claim_id: "claim-101",
          shift_id: "shift-1",
          user_id: "user-vol-1",
          role_name: "Registration Desk",
          duration_hours: 2.0,
          points_awarded: 100,
        },
        error: null,
      });

      const result = await claimVolunteerShift("shift-1", "user-vol-1");

      expect(mockRpc).toHaveBeenCalledWith("claim_volunteer_shift_transaction", {
        p_shift_id: "shift-1",
        p_user_id: "user-vol-1",
      });

      expect(result.success).toBe(true);
      expect(result.duration_hours).toBe(2.0);
      expect(result.points_awarded).toBe(100);
    });

    it("returns error on time-collision when user has an overlapping claimed shift", async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: false,
          error:
            "Time collision: You already have a claimed volunteer shift overlapping with this time slot.",
        },
        error: null,
      });

      const result = await claimVolunteerShift("shift-overlapping", "user-vol-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Time collision");
    });

    it("returns error when shift capacity is full", async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: false,
          error: "Shift is already at full capacity.",
        },
        error: null,
      });

      const result = await claimVolunteerShift("shift-full", "user-vol-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("full capacity");
    });
  });

  describe("cancelVolunteerShiftClaim", () => {
    it("cancels a claimed shift", async () => {
      const updateMock = vi.fn().mockReturnThis();
      const eqMock1 = vi.fn().mockReturnThis();
      const eqMock2 = vi.fn().mockResolvedValue({ error: null });

      mockFrom.mockReturnValue({ update: updateMock });
      updateMock.mockReturnValue({ eq: eqMock1 });
      eqMock1.mockReturnValue({ eq: eqMock2 });

      const result = await cancelVolunteerShiftClaim("claim-101", "user-vol-1");

      expect(mockFrom).toHaveBeenCalledWith("shift_claims");
      expect(result.success).toBe(true);
    });
  });
});
