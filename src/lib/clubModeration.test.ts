import { describe, expect, it } from "vitest";
import { formatSubmissionDate, mergeClubSubmitters } from "./clubModeration";

describe("club moderation utilities", () => {
  it("adds submitter names without mutating club data", () => {
    const result = mergeClubSubmitters(
      [
        {
          id: "club-1",
          name: "AI Club",
          slug: "ai-club",
          description: "Build useful models",
          created_by: "user-1",
          created_at: "2026-07-18T10:00:00.000Z",
        },
      ],
      [{ id: "user-1", first_name: "Jidnyasa", last_name: "Patil" }],
    );

    expect(result[0].submitterName).toBe("Jidnyasa Patil");
  });

  it("falls back safely for missing profiles", () => {
    const result = mergeClubSubmitters(
      [
        {
          id: "club-1",
          name: "AI Club",
          slug: "ai-club",
          description: null,
          created_by: "missing-user",
          created_at: "2026-07-18T10:00:00.000Z",
        },
      ],
      [],
    );

    expect(result[0].submitterName).toBe("Unknown user");
  });

  it("handles invalid dates", () => {
    expect(formatSubmissionDate("not-a-date")).toBe("Unknown date");
  });
});
