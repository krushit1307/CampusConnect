import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getMentorAvailability,
  setMentorAvailability,
  generateAvailableTimeSlots,
  generateIcsInvite,
  bookMentorshipSession,
} from "../alumniMentorshipService";
import type { MentorshipSession } from "@/types/database";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

describe("Interactive Alumni Mentorship Portal Service (#3885)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMentorAvailability", () => {
    it("retrieves active mentorship availability rules for an alumnus", async () => {
      const mockRules = [
        {
          id: "rule-1",
          mentor_id: "alum-101",
          day_of_week: "Tuesday",
          start_time: "18:00",
          end_time: "20:00",
          slot_duration_minutes: 15,
          is_active: true,
        },
      ];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        eq2: vi.fn().mockResolvedValue({ data: mockRules, error: null }),
      });

      const selectMock = vi.fn().mockReturnThis();
      const eqMock1 = vi.fn().mockReturnThis();
      const eqMock2 = vi.fn().mockResolvedValue({ data: mockRules, error: null });

      mockFrom.mockReturnValue({ select: selectMock });
      selectMock.mockReturnValue({ eq: eqMock1 });
      eqMock1.mockReturnValue({ eq: eqMock2 });

      const result = await getMentorAvailability("alum-101");

      expect(mockFrom).toHaveBeenCalledWith("alumni_mentorship_availability");
      expect(result).toHaveLength(1);
      expect(result[0].day_of_week).toBe("Tuesday");
      expect(result[0].start_time).toBe("18:00");
    });
  });

  describe("generateAvailableTimeSlots", () => {
    it("splits availability window into 15-minute slots and filters out booked slots", async () => {
      const mockAvailability = [
        {
          id: "rule-1",
          mentor_id: "alum-101",
          day_of_week: "Tuesday",
          start_time: "18:00",
          end_time: "19:00",
          slot_duration_minutes: 15,
          is_active: true,
        },
      ];

      // 18:15 - 18:30 is already booked
      const mockBookedSessions = [
        {
          start_time: "2026-09-01T18:15:00Z",
          end_time: "2026-09-01T18:30:00Z",
        },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === "alumni_mentorship_availability") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            eq2: vi.fn().mockReturnThis(),
            then: (cb: any) =>
              cb({
                data: mockAvailability,
                error: null,
              }),
          };
        }
        if (table === "mentorship_sessions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({ data: mockBookedSessions, error: null }),
          };
        }
        return {};
      });

      // 2026-09-01 is a Tuesday
      const slots = await generateAvailableTimeSlots("alum-101", "2026-09-01");

      expect(slots.length).toBe(4); // 18:00, 18:15, 18:30, 18:45
      expect(slots[0].isAvailable).toBe(true);
      expect(slots[1].isAvailable).toBe(false); // 18:15 booked
      expect(slots[2].isAvailable).toBe(true);
      expect(slots[3].isAvailable).toBe(true);
    });
  });

  describe("generateIcsInvite", () => {
    it("constructs a valid RFC 5545 .ics calendar string with meeting link", () => {
      const mockSession: MentorshipSession = {
        id: "sess-777",
        mentor_id: "alum-101",
        mentee_id: "student-202",
        start_time: "2026-09-01T18:00:00.000Z",
        end_time: "2026-09-01T18:15:00.000Z",
        topic: "Software Engineering Resume Review",
        meeting_link: "https://meet.jit.si/campusconnect-mentorship-sess-777",
        status: "scheduled",
        created_at: "2026-08-22T12:00:00.000Z",
      };

      const csString = generateIcsInvite(mockSession, "Alice Alum", "Bob Student");

      expect(csString).toContain("BEGIN:VCALENDAR");
      expect(csString).toContain("SUMMARY:15-Min Alumni Coffee Chat with Alice Alum");
      expect(csString).toContain("LOCATION:https://meet.jit.si/campusconnect-mentorship-sess-777");
      expect(csString).toContain("Software Engineering Resume Review");
      expect(csString).toContain("END:VCALENDAR");
    });
  });

  describe("bookMentorshipSession", () => {
    it("executes booking transaction and deducts 100 gamification points", async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          session_id: "sess-999",
          mentor_id: "alum-101",
          mentee_id: "student-202",
          meeting_link: "https://meet.jit.si/campusconnect-mentorship-sess-999",
          points_deducted: 100,
          remaining_points: 450,
        },
        error: null,
      });

      const result = await bookMentorshipSession(
        "alum-101",
        "student-202",
        "2026-09-01T18:00:00Z",
        "2026-09-01T18:15:00Z",
        "Mock Interview Prep",
      );

      expect(mockRpc).toHaveBeenCalledWith("book_mentorship_session_transaction", {
        p_mentor_id: "alum-101",
        p_mentee_id: "student-202",
        p_start_time: "2026-09-01T18:00:00Z",
        p_end_time: "2026-09-01T18:15:00Z",
        p_topic: "Mock Interview Prep",
      });

      expect(result.success).toBe(true);
      expect(result.points_deducted).toBe(100);
      expect(result.remaining_points).toBe(450);
      expect(result.meeting_link).toContain("https://meet.jit.si/");
    });

    it("returns error if mentee has insufficient gamification points (< 100)", async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: false,
          error: "Insufficient gamification points. 100 points required to book a mentorship chat.",
          current_points: 40,
          required_points: 100,
        },
        error: null,
      });

      const result = await bookMentorshipSession(
        "alum-101",
        "student-low-points",
        "2026-09-01T18:00:00Z",
        "2026-09-01T18:15:00Z",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("100 points required");
    });
  });
});
