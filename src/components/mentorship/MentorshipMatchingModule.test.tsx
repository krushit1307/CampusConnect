import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MentorshipMatchingModule } from "./MentorshipMatchingModule";
import * as mentorshipLib from "../../lib/mentorshipMatching";

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "mentee-1" } },
      }),
    },
    from: (table: string) => {
      if (table === "mentorship_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  user_id: "mentee-1",
                  role: "mentee",
                  major: "Computer Science",
                  interests: ["AI", "Web"],
                  bio: "Freshman looking for a mentor",
                  capacity: 1,
                  is_active: true,
                },
                error: null,
              }),
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === "mentorship_pairs") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        };
      }
      return {};
    },
    rpc: vi.fn(),
  }),
}));

describe("MentorshipMatchingModule Component (#2803)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders mentee profile and recommended mentors list", async () => {
    vi.spyOn(mentorshipLib, "fetchRecommendedMentors").mockResolvedValueOnce({
      success: true,
      data: [
        {
          mentor_id: "mentor-1",
          full_name: "Senior Jane",
          avatar_url: null,
          major: "Computer Science",
          interests: ["AI", "Cloud"],
          bio: "Senior interested in ML research",
          capacity: 2,
          active_mentees: 1,
          compatibility_score: 60,
          shared_interests_count: 1,
        },
      ],
    });

    render(<MentorshipMatchingModule />);

    await waitFor(() => {
      expect(screen.getByText(/Peer & Alumni Mentorship Hub/i)).toBeInTheDocument();
      expect(screen.getByText("Senior Jane")).toBeInTheDocument();
      expect(screen.getByText("60 pts Match")).toBeInTheDocument();
      expect(screen.getByText(/Accepting \(1\/2\)/i)).toBeInTheDocument();
    });
  });

  it("disables request button when mentor is at max capacity", async () => {
    vi.spyOn(mentorshipLib, "fetchRecommendedMentors").mockResolvedValueOnce({
      success: true,
      data: [
        {
          mentor_id: "mentor-2",
          full_name: "Full Mentor",
          avatar_url: null,
          major: "Computer Science",
          interests: ["AI"],
          bio: "Busy senior",
          capacity: 2,
          active_mentees: 2,
          compatibility_score: 60,
          shared_interests_count: 1,
        },
      ],
    });

    render(<MentorshipMatchingModule />);

    await waitFor(() => {
      expect(screen.getByText("Full Mentor")).toBeInTheDocument();
      expect(screen.getByText(/At Capacity \(2\/2\)/i)).toBeInTheDocument();
      const requestBtn = screen.getByRole("button", {
        name: /Request Mentorship/i,
      });
      expect(requestBtn).toBeDisabled();
    });
  });
});
