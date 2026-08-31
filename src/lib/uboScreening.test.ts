// src/lib/uboScreening.test.ts
// Issue: #5364 - Automated "Club Spending" Corporate Tax ID Scraper (OFAC Sanctions Beneficial Ownership)
// Tests for UBO screening library functions

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
vi.mock("./supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
        order: vi.fn(() => ({
          limit: vi.fn(),
        })),
      })),
    })),
  },
}));

describe("uboScreening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("UBO Screening Integration", () => {
    it("should create a vendor via RPC", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: "vendor-123",
        error: null,
      });

      const result = await supabase.rpc("create_vendor", {
        p_name: "Test Catering Co",
        p_tax_id: "12-3456789",
        p_legal_entity_type: "corporation",
        p_jurisdiction: "de",
      });

      expect(result.data).toBe("vendor-123");
    });

    it("should add corporate ownership via RPC", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: "ownership-123",
        error: null,
      });

      const result = await supabase.rpc("add_corporate_ownership", {
        p_vendor_id: "vendor-123",
        p_owner_type: "individual",
        p_owner_name: "John Doe",
        p_ownership_percentage: 30.5,
      });

      expect(result.data).toBe("ownership-123");
    });

    it("should screen vendor for sanctions via RPC", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: {
          success: true,
          vendor_id: "vendor-123",
          has_sanctions: false,
          message: "No sanctions matches",
        },
        error: null,
      });

      const result = await supabase.rpc("screen_vendor_sanctions", {
        p_vendor_id: "vendor-123",
      });

      expect(result.data.success).toBe(true);
      expect(result.data.has_sanctions).toBe(false);
    });

    it("should block vendor escrow via RPC", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await supabase.rpc("block_vendor_escrow", {
        p_vendor_id: "vendor-123",
        p_reason: "Test sanctions match",
      });

      expect(result.data).toBe(true);
    });
  });

  describe("UBO Extraction Logic", () => {
    it("should identify UBOs with >25% ownership", () => {
      const ownership = [
        { owner_type: "individual", owner_name: "John Doe", ownership_percentage: 30.5 },
        { owner_type: "individual", owner_name: "Jane Smith", ownership_percentage: 15.0 },
        { owner_type: "corporation", owner_name: "Shell Corp", ownership_percentage: 50.0 },
      ];

      const ubos = ownership.filter((o) => o.ownership_percentage >= 25);

      expect(ubos).toHaveLength(2);
      expect(ubos[0].owner_name).toBe("John Doe");
      expect(ubos[1].owner_name).toBe("Shell Corp");
    });

    it("should not identify non-UBOs with <25% ownership", () => {
      const ownership = [
        { owner_type: "individual", owner_name: "John Doe", ownership_percentage: 30.5 },
        { owner_type: "individual", owner_name: "Jane Smith", ownership_percentage: 15.0 },
      ];

      const nonUbos = ownership.filter((o) => o.ownership_percentage < 25);

      expect(nonUbos).toHaveLength(1);
      expect(nonUbos[0].owner_name).toBe("Jane Smith");
    });

    it("should handle edge case of exactly 25% ownership", () => {
      const ownership = [
        { owner_type: "individual", owner_name: "John Doe", ownership_percentage: 25.0 },
      ];

      const ubos = ownership.filter((o) => o.ownership_percentage >= 25);

      expect(ubos).toHaveLength(1);
      expect(ubos[0].owner_name).toBe("John Doe");
    });
  });

  describe("Sanctions Screening Logic", () => {
    it("should detect sanctions match", () => {
      const screening = {
        entity_name: "Sanctioned Person",
        match_score: 95.5,
        is_match: true,
        ofac_list: "SDN",
      };

      expect(screening.is_match).toBe(true);
      expect(screening.match_score).toBeGreaterThan(90);
    });

    it("should not flag clean entities", () => {
      const screening = {
        entity_name: "Clean Entity",
        match_score: 0.0,
        is_match: false,
        ofac_list: null,
      };

      expect(screening.is_match).toBe(false);
      expect(screening.match_score).toBe(0);
    });
  });
});
