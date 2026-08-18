import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateEventRecap,
  publishRecapToClubFeed,
  MIN_ATTENDANCE_THRESHOLD,
} from "./eventRecapGenerator";

const mockInvoke = vi.fn();
const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock("./supabase/client", () => ({
  createClient: () => ({
    functions: {
      invoke: mockInvoke,
    },
    from: (table: string) => {
      if (table === "articles") {
        return {
          insert: mockInsert,
        };
      }
      if (table === "events") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "ev-1", title: "Robotics Expo", clubs: { name: "Robotics Club" } },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "event_rsvps") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
          }),
        };
      }
      return {};
    },
  }),
}));

describe("Event Recap Generator (#2804)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully invokes Edge function and returns recap markdown", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        success: true,
        recapMarkdown: "# Recap: Great Event!",
        heroPhotos: ["https://example.com/p1.jpg"],
        attendanceCount: 15,
        clubId: "club-1",
        eventTitle: "Robotics Expo",
      },
      error: null,
    });

    const res = await generateEventRecap("ev-1", "hype");

    expect(res.success).toBe(true);
    expect(res.recapMarkdown).toBe("# Recap: Great Event!");
    expect(res.attendanceCount).toBe(15);
    expect(res.heroPhotos).toHaveLength(1);
  });

  it("handles DATA_SCARCITY error gracefully", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        error: "DATA_SCARCITY",
        message: "Insufficient event attendance",
      },
      error: null,
    });

    const res = await generateEventRecap("ev-sparse", "professional");
    expect(res.success).toBe(false);
    expect(res.isDataScarcity).toBe(true);
    expect(res.error).toContain("Insufficient");
  });

  it("enforces minimum attendance threshold constant", () => {
    expect(MIN_ATTENDANCE_THRESHOLD).toBe(3);
  });

  it("publishes generated recap with hero images to articles table", async () => {
    const res = await publishRecapToClubFeed(
      "club-123",
      "AI Recap Article",
      "## Great Night",
      ["https://example.com/photo.jpg"],
      "user-1",
    );

    expect(res.success).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        club_id: "club-123",
        author_id: "user-1",
        title: "AI Recap Article",
        content: expect.stringContaining("![Event Photo](https://example.com/photo.jpg)"),
      }),
    );
  });
});
