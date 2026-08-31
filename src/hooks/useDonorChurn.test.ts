import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useDonorChurn } from "./useDonorChurn";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

describe("useDonorChurn", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: "1", risk_score: 90 }],
        error: null,
      }),
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: { processed: 5 },
          error: null,
        }),
      },
    };

    (createClient as any).mockReturnValue(mockSupabase);
  });

  it("should initially fetch predictions if clubId is provided", async () => {
    const { result } = renderHook(() => useDonorChurn("test-club"));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.predictions).toHaveLength(1);
    expect(mockSupabase.from).toHaveBeenCalledWith("donor_churn_predictions");
  });

  it("should not fetch predictions if clubId is null", () => {
    const { result } = renderHook(() => useDonorChurn(null));
    expect(result.current.isLoading).toBe(false);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("should handle fetch errors gracefully", async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: null,
      error: new Error("Database connection failed"),
    });

    const { result } = renderHook(() => useDonorChurn("test-club"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Database connection failed");
    expect(result.current.predictions).toEqual([]);
  });

  it("should trigger the churn modeler and refresh data", async () => {
    const { result } = renderHook(() => useDonorChurn("test-club"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let processedCount;
    await act(async () => {
      processedCount = await result.current.runChurnModeler();
    });

    expect(processedCount).toBe(5);
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("donor-churn-modeler", {
      body: { club_id: "test-club" },
    });

    expect(mockSupabase.from).toHaveBeenCalledTimes(2);
  });

  it("should handle churn modeler failure gracefully", async () => {
    mockSupabase.functions.invoke.mockResolvedValueOnce({
      data: null,
      error: new Error("Edge function timeout"),
    });

    const { result } = renderHook(() => useDonorChurn("test-club"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      try {
        await result.current.runChurnModeler();
      } catch (e) {
        // expected
      }
    });

    expect(result.current.error).toBe("Edge function timeout");
  });
});
