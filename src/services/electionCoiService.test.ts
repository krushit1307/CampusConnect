import { describe, it, expect, vi } from "vitest";
import { verifyCandidateConflictOfInterest } from "./electionCoiService";
import { supabase } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe("electionCoiService (#3601)", () => {
  it("returns conflict when candidate holds competing role", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        has_conflict: true,
        conflicting_club: "Republican Society",
        conflicting_role: "Treasurer",
        message: "You cannot run for this position while holding an executive role in Republican Society.",
      },
      error: null,
    } as any);

    const result = await verifyCandidateConflictOfInterest(
      "club-demo-1",
      "user-123",
      "President"
    );

    expect(result.hasConflict).toBe(true);
    expect(result.conflictingClub).toBe("Republican Society");
    expect(result.message).toContain("You cannot run for this position while holding an executive role in Republican Society.");
  });

  it("returns no conflict when candidate is clear", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        has_conflict: false,
        message: "No conflict of interest detected.",
      },
      error: null,
    } as any);

    const result = await verifyCandidateConflictOfInterest(
      "club-demo-1",
      "user-456",
      "President"
    );

    expect(result.hasConflict).toBe(false);
    expect(result.message).toBe("No conflict of interest detected.");
  });
});
