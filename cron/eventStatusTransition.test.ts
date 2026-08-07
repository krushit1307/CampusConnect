import { describe, it, expect, vi, beforeEach } from "vitest";
import { transitionEventStatuses } from "./eventStatusTransition";
import { query } from "../graphql/db";

// Mock the graphql/db query helper
vi.mock("../graphql/db", () => ({
  query: vi.fn(),
  closePool: vi.fn(),
}));

describe("Event Status Transition Cron Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should run UPDATE queries to transition event statuses", async () => {
    const mockQuery = vi.mocked(query);

    // Mock query database results
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 3 }); // ONGOING transition count
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 5 }); // COMPLETED transition count

    await transitionEventStatuses();

    // Verify first query updates UPCOMING to ONGOING
    expect(mockQuery).toHaveBeenNthCalledWith(1, expect.stringContaining("UPDATE events"));
    expect(mockQuery).toHaveBeenNthCalledWith(1, expect.stringContaining("status = 'ONGOING'"));
    expect(mockQuery).toHaveBeenNthCalledWith(1, expect.stringContaining("status = 'UPCOMING'"));

    // Verify second query updates to COMPLETED
    expect(mockQuery).toHaveBeenNthCalledWith(2, expect.stringContaining("UPDATE events"));
    expect(mockQuery).toHaveBeenNthCalledWith(2, expect.stringContaining("status = 'COMPLETED'"));
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("status IN ('UPCOMING', 'ONGOING')"),
    );
  });

  it("should throw error if query fails", async () => {
    const mockQuery = vi.mocked(query);
    mockQuery.mockRejectedValueOnce(new Error("Database connection lost"));

    await expect(transitionEventStatuses()).rejects.toThrow("Database connection lost");
  });
});
