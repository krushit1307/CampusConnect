import { describe, it, expect, vi } from "vitest";
import { duplicateEvent } from "./duplicateEvent";

describe("duplicateEvent", () => {
  it("should duplicate event metadata and shift dates by 7 days", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementationOnce(() => ({
        data: {
          id: "old-id",
          title: "Test Event",
          description: "Desc",
          banner_url: "url",
          event_date: "2024-03-09T18:00:00.000Z",
          start_date: "2024-03-09T18:00:00.000Z",
          end_date: "2024-03-09T20:00:00.000Z",
          created_at: "old-date",
          updated_at: "old-date",
          created_by: "old-user",
          status: "published",
        },
        error: null,
      })).mockImplementationOnce(() => ({
        data: { id: "new-id" },
        error: null,
      })),
      insert: vi.fn().mockReturnThis(),
    };

    const newId = await duplicateEvent(mockSupabase as any, "old-id", "new-user");

    expect(newId).toBe("new-id");
    expect(mockSupabase.insert).toHaveBeenCalledWith({
      title: "Test Event",
      description: "Desc",
      banner_url: "url",
      created_by: "new-user",
      status: "draft",
      event_date: "2024-03-16T18:00:00.000Z",
      start_date: "2024-03-16T18:00:00.000Z",
      end_date: "2024-03-16T20:00:00.000Z",
    });
  });
});
