import { describe, it, expect, vi } from "vitest";
import { checkEventConflicts } from "./checkEventConflicts";

describe("checkEventConflicts", () => {
  it("should return empty array if capacity <= 100", async () => {
    const supabase = {} as any;
    const formData = { capacity: 100, tags: ["tech"], startDate: "2026-10-10", endDate: "2026-10-11" } as any;
    const result = await checkEventConflicts(supabase, formData);
    expect(result).toEqual([]);
  });

  it("should return empty array if no tags", async () => {
    const supabase = {} as any;
    const formData = { capacity: 150, tags: [], startDate: "2026-10-10", endDate: "2026-10-11" } as any;
    const result = await checkEventConflicts(supabase, formData);
    expect(result).toEqual([]);
  });

  it("should detect conflicts correctly", async () => {
    const mockData = [
      { id: "1", title: "E1", max_attendees: 200, tags: ["tech", "ai"], clubs: { id: "c1", name: "C1", created_by: "u1" } },
      { id: "2", title: "E2", max_attendees: 150, tags: ["sports"], clubs: { id: "c2", name: "C2", created_by: "u2" } }
    ];
    
    const gt = vi.fn().mockReturnThis();
    const lt = vi.fn().mockReturnThis();
    const neq = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnThis();
    const from = vi.fn().mockReturnValue({ select, neq, gt, lt });
    
    // override the last call to return data
    lt.mockResolvedValue({ data: mockData, error: null });
    // actually, gt is the last one in the chain:
    gt.mockResolvedValue({ data: mockData, error: null });

    const supabase = { from } as any;
    const formData = { capacity: 150, tags: ["tech"], startDate: "2026-10-10", endDate: "2026-10-11" } as any;
    
    const result = await checkEventConflicts(supabase, formData);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("1");
  });
});
