import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkOrganizerPostMortemGate,
  saveEventPostMortem,
  searchClubPostMortems,
  findHistoricalRetrospectiveSuggestions,
  type EventPostMortem,
} from "@/services/eventPostMortemService";

const { mockFrom, mockRpc, mockGetUser } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => {
  return {
    createClient: vi.fn(() => ({
      from: mockFrom,
      rpc: mockRpc,
      auth: {
        getUser: mockGetUser,
      },
    })),
  };
});

describe("eventPostMortemService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkOrganizerPostMortemGate", () => {
    it("returns gating status and pending events from RPC", async () => {
      const mockGatingData = {
        is_locked: true,
        pending_count: 1,
        pending_events: [
          {
            event_id: "evt-gala",
            title: "Annual Gala 2025",
            event_date: "2025-05-01",
            club_id: "club-1",
            hours_since_end: 36,
          },
        ],
      };

      mockRpc.mockResolvedValue({ data: mockGatingData, error: null });

      const res = await checkOrganizerPostMortemGate("usr-1", "club-1");

      expect(mockRpc).toHaveBeenCalledWith("check_pending_post_mortems", {
        p_user_id: "usr-1",
        p_club_id: "club-1",
      });
      expect(res.is_locked).toBe(true);
      expect(res.pending_count).toBe(1);
    });
  });

  describe("saveEventPostMortem", () => {
    it("saves 5-question retrospective for authenticated user", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "usr-1" } } });

      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({
        upsert: upsertMock,
      } as any);

      const postMortemData: EventPostMortem = {
        event_id: "evt-hackathon",
        club_id: "club-1",
        what_went_well: "High participant turnout and good sponsor engagement",
        what_failed: "Ran out of pizzas at midnight",
        advice_for_next_year: "Order 75 pizzas instead of 50",
        logistics_score: 4,
        budget_accuracy_score: 3,
      };

      const res = await saveEventPostMortem(postMortemData);

      expect(mockFrom).toHaveBeenCalledWith("event_post_mortems");
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: "evt-hackathon",
          club_id: "club-1",
          what_failed: "Ran out of pizzas at midnight",
          advice_for_next_year: "Order 75 pizzas instead of 50",
        }),
        { onConflict: "event_id" },
      );
      expect(res.success).toBe(true);
    });
  });

  describe("searchClubPostMortems", () => {
    it("searches retrospectives by keyword or club", async () => {
      const mockResults = [
        {
          id: "pm-1",
          event_id: "evt-pizza",
          event_title: "Coding Night",
          what_went_well: "Lots of code written",
          what_failed: "Not enough pizza",
          advice_for_next_year: "Order 75 pizzas",
          logistics_score: 4,
          budget_accuracy_score: 4,
        },
      ];

      mockRpc.mockResolvedValue({
        data: { club_id: "club-1", post_mortems: mockResults },
        error: null,
      });

      const res = await searchClubPostMortems("club-1", "pizza");

      expect(mockRpc).toHaveBeenCalledWith("search_club_post_mortems", {
        p_club_id: "club-1",
        p_query: "pizza",
      });
      expect(res).toEqual(mockResults);
    });
  });

  describe("findHistoricalRetrospectiveSuggestions", () => {
    it("suggests past advice matching draft text keywords", () => {
      const retros: EventPostMortem[] = [
        {
          event_id: "evt-hackathon-2025",
          club_id: "club-1",
          event_title: "Hackathon 2025",
          what_went_well: "Great coding atmosphere",
          what_failed: "50 pizzas wasn't enough for 100 students",
          advice_for_next_year: "Order 75 pizzas and provide gluten-free options",
          logistics_score: 3,
          budget_accuracy_score: 4,
        },
      ];

      const suggestions = findHistoricalRetrospectiveSuggestions(
        "Hackathon 2026",
        "Join us for 24h coding with free pizza for everyone!",
        retros,
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].eventTitle).toBe("Hackathon 2025");
      expect(suggestions[0].advice).toContain("Order 75 pizzas");
      expect(suggestions[0].keyword).toBe("pizza");
    });
  });
});
