// src/services/__tests__/clubAffiliationService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClubAffiliationService } from "../clubAffiliationService";
import { isExecutiveRole } from "@/types/clubAffiliation";

const mockRpc = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: mockRpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: mockSelect,
        }),
      }),
    }),
  }),
}));

describe("ClubAffiliationService", () => {
  const mockUserId = "user-exec-123";

  beforeEach(() => {
    vi.clearAllMocks();
    ClubAffiliationService.clearCache();
  });

  it("identifies executive roles correctly", () => {
    expect(isExecutiveRole("President")).toBe(true);
    expect(isExecutiveRole("Vice President")).toBe(true);
    expect(isExecutiveRole("Treasurer")).toBe(true);
    expect(isExecutiveRole("Member")).toBe(false);
    expect(isExecutiveRole("general member")).toBe(false);
    expect(isExecutiveRole("subscriber")).toBe(false);
  });

  it("fetches user affiliations via RPC", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          club_id: "club-1",
          club_name: "CS Society",
          club_slug: "cs-society",
          club_logo_url: null,
          role_name: "President",
        },
        {
          club_id: "club-2",
          club_name: "Chess Club",
          club_slug: "chess-club",
          club_logo_url: null,
          role_name: "Treasurer",
        },
      ],
      error: null,
    });

    const affiliations = await ClubAffiliationService.getUserAffiliations(mockUserId);

    expect(affiliations.length).toBe(2);
    expect(affiliations[0].club_name).toBe("CS Society");
    expect(affiliations[0].role_name).toBe("President");
    expect(affiliations[1].club_name).toBe("Chess Club");
    expect(affiliations[1].role_name).toBe("Treasurer");
  });

  it("caches affiliations for consecutive calls", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          club_id: "club-1",
          club_name: "CS Society",
          role_name: "President",
        },
      ],
      error: null,
    });

    await ClubAffiliationService.getUserAffiliations(mockUserId);
    await ClubAffiliationService.getUserAffiliations(mockUserId);

    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});
