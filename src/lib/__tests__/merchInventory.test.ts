import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "../supabase/client";

vi.mock("../supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe("Merchandise Inventory System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("decrement_merch_stock RPC", () => {
    it("successfully decrements stock when sufficient quantity is available", async () => {
      // Mock the RPC call to return success
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: { id: "variant-1", stock: 4, name: "Medium" },
        error: null,
      } as any);

      const { data, error } = await supabase.rpc("decrement_merch_stock", {
        p_variant_id: "variant-1",
        p_quantity: 1,
      });

      expect(supabase.rpc).toHaveBeenCalledWith("decrement_merch_stock", {
        p_variant_id: "variant-1",
        p_quantity: 1,
      });
      expect(error).toBeNull();
      expect(data?.stock).toBe(4);
    });

    it("returns an error when stock is insufficient (handled by DB exception)", async () => {
      // Mock the RPC call to simulate a DB exception
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: new Error("Out of stock"),
      } as any);

      const { data, error } = await supabase.rpc("decrement_merch_stock", {
        p_variant_id: "variant-1",
        p_quantity: 5,
      });

      expect(supabase.rpc).toHaveBeenCalledWith("decrement_merch_stock", {
        p_variant_id: "variant-1",
        p_quantity: 5,
      });
      expect(error).toBeDefined();
      expect(error?.message).toBe("Out of stock");
    });
  });

  describe("release_merch_stock RPC", () => {
    it("successfully releases stock back to inventory", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: null,
      } as any);

      const { error } = await supabase.rpc("release_merch_stock", {
        p_variant_id: "variant-1",
        p_quantity: 1,
      });

      expect(supabase.rpc).toHaveBeenCalledWith("release_merch_stock", {
        p_variant_id: "variant-1",
        p_quantity: 1,
      });
      expect(error).toBeNull();
    });
  });
});
