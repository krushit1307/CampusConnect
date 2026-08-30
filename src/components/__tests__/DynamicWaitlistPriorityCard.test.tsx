import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DynamicWaitlistPriorityCard } from "../events/DynamicWaitlistPriorityCard";
import { getRankedWaitlistForEvent } from "@/services/dynamicWaitlistPriorityService";

vi.mock("@/services/dynamicWaitlistPriorityService", async () => {
  const actual = await vi.importActual("@/services/dynamicWaitlistPriorityService");
  return {
    ...actual,
    getRankedWaitlistForEvent: vi.fn(),
  };
});

describe("DynamicWaitlistPriorityCard Component (#3874)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dynamic waitlist card with rank position, priority score, and reputation breakdown", async () => {
    (getRankedWaitlistForEvent as any).mockResolvedValue({
      userRank: {
        id: "w-1",
        event_id: "event-1",
        user_id: "user-super",
        user_full_name: "Super User",
        priority_score: 215,
        rank_position: 1,
        total_waitlisted: 12,
        gamification_points: 40,
        attendance_count: 5,
        no_show_count: 0,
        created_at: new Date().toISOString(),
        score_breakdown: {
          base_time_score: 65,
          gamification_bonus: 100,
          attendance_bonus: 50,
          no_show_penalty: 0,
          final_priority_score: 215,
        },
      },
      allWaitlist: [],
    });

    render(
      <DynamicWaitlistPriorityCard
        eventId="event-1"
        userId="user-super"
        userGamificationPoints={40}
        userAttendanceCount={5}
        userNoShowCount={0}
      />,
    );

    await waitFor(() => {
      const card = screen.getByTestId("dynamic-waitlist-priority-card");
      expect(card).toBeInTheDocument();
      expect(card.textContent).toContain("DYNAMIC WAITLIST PRIORITY");
      expect(card.textContent).toContain("#1 of 12");
      expect(card.textContent).toContain("215");
      expect(screen.getByTestId("dynamic-priority-explanation-banner")).toBeInTheDocument();
    });
  });
});
