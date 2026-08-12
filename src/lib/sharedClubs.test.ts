import { describe, it, expect, vi } from "vitest";
import { getSharedClubs } from "./sharedClubs";

describe("getSharedClubs helper (#1564)", () => {
  it("returns empty array if userAId or userBId is missing or equal", async () => {
    const mockSupabase = { rpc: vi.fn() } as any;

    expect(await getSharedClubs(mockSupabase, "", "user-2")).toEqual([]);
    expect(await getSharedClubs(mockSupabase, "user-1", "")).toEqual([]);
    expect(await getSharedClubs(mockSupabase, "user-1", "user-1")).toEqual([]);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it("calls get_shared_clubs RPC with user_a and user_b parameters", async () => {
    const mockClubs = [
      {
        id: "club-1",
        name: "Robotics Club",
        slug: "robotics",
        logo_url: "https://example.com/logo.png",
        description: "Building autonomous bots",
        category: "STEM",
      },
      {
        id: "club-2",
        name: "Chess Club",
        slug: "chess",
        logo_url: null,
        description: "Strategy and tournaments",
        category: "Recreation",
      },
    ];

    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: mockClubs, error: null }),
    } as any;

    const result = await getSharedClubs(mockSupabase, "user-aaa", "user-bbb");

    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_shared_clubs", {
      user_a: "user-aaa",
      user_b: "user-bbb",
    });
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Robotics Club");
    expect(result[1].name).toBe("Chess Club");
  });

  it("throws error if RPC returns an error response", async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "RPC error" } }),
    } as any;

    await expect(getSharedClubs(mockSupabase, "user-aaa", "user-bbb")).rejects.toThrow(
      "Failed to fetch shared clubs: RPC error",
    );
  });
});
