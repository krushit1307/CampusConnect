// src/lib/secretTiers.test.ts
// Issue: #4672 - Dynamic "Early Bird" Secret Unlock Links
// Tests for secret tier management functions

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSecretTier,
  validateSecretLink,
  getAllTicketTiers,
  getPublicTicketTiers,
  recordSecretTierPurchase,
  checkSecretUnlock,
} from "./secretTiers";

// Mock Supabase client
vi.mock("./supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe("secretTiers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createSecretTier", () => {
    it("should successfully create a secret tier", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: {
          success: true,
          tier_id: "tier-123",
          unlock_hash: "abc123xyz",
          unlock_url: "/events/event-123?unlock_hash=abc123xyz",
          message: "Secret tier created successfully",
        },
        error: null,
      });

      const result = await createSecretTier("event-123", "VIP Early Bird", 1000, 50, 5);

      expect(result.success).toBe(true);
      expect(result.tier_id).toBe("tier-123");
      expect(result.unlock_hash).toBe("abc123xyz");
      expect(result.unlock_url).toBe("/events/event-123?unlock_hash=abc123xyz");
      expect(supabase.rpc).toHaveBeenCalledWith("create_secret_tier", {
        p_event_id: "event-123",
        p_name: "VIP Early Bird",
        p_price: 1000,
        p_capacity: 50,
        p_max_uses: 5,
        p_expires_at: null,
        p_description: null,
        p_start_date: null,
        p_end_date: null,
      });
    });

    it("should handle server errors", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      const result = await createSecretTier("event-123", "VIP", 1000, 50, 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });

    it("should handle validation errors from server", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: { success: false, error: "max_uses must be greater than 0" },
        error: null,
      });

      const result = await createSecretTier("event-123", "VIP", 1000, 50, 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe("max_uses must be greater than 0");
    });
  });

  describe("validateSecretLink", () => {
    it("should successfully validate a secret link", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.functions.invoke as any).mockResolvedValue({
        data: {
          valid: true,
          tier: {
            id: "tier-123",
            name: "VIP Early Bird",
            price: 1000,
            capacity: 50,
            uses_remaining: 5,
          },
        },
        error: null,
      });

      const result = await validateSecretLink("event-123", "abc123xyz");

      expect(result.success).toBe(true);
      expect(result.tier).toEqual({
        id: "tier-123",
        name: "VIP Early Bird",
        price: 1000,
        capacity: 50,
        uses_remaining: 5,
      });
      expect(supabase.functions.invoke).toHaveBeenCalledWith("validate-secret-link", {
        body: { eventId: "event-123", unlockHash: "abc123xyz" },
      });
    });

    it("should handle invalid secret links", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.functions.invoke as any).mockResolvedValue({
        data: { valid: false, message: "Invalid or expired secret link" },
        error: null,
      });

      const result = await validateSecretLink("event-123", "invalid");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid or expired secret link");
    });

    it("should handle server errors", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.functions.invoke as any).mockResolvedValue({
        data: null,
        error: { message: "Function error" },
      });

      const result = await validateSecretLink("event-123", "abc123xyz");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Function error");
    });
  });

  describe("getAllTicketTiers", () => {
    it("should successfully fetch all ticket tiers", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: [
          {
            id: "tier-1",
            name: "General",
            price: 1500,
            capacity: 100,
            is_secret: false,
            sold_count: 50,
          },
          {
            id: "tier-2",
            name: "VIP",
            price: 1000,
            capacity: 50,
            is_secret: true,
            uses_remaining: 5,
          },
        ],
        error: null,
      });

      const result = await getAllTicketTiers("event-123");

      expect(result).toHaveLength(2);
      expect(result?.[0].is_secret).toBe(false);
      expect(result?.[1].is_secret).toBe(true);
    });

    it("should return null on error", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: "Error fetching tiers" },
      });

      const result = await getAllTicketTiers("event-123");

      expect(result).toBeNull();
    });
  });

  describe("getPublicTicketTiers", () => {
    it("should successfully fetch public ticket tiers", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: [
          {
            id: "tier-1",
            name: "General",
            price: 1500,
            capacity: 100,
            sold_count: 50,
          },
        ],
        error: null,
      });

      const result = await getPublicTicketTiers("event-123");

      expect(result).toHaveLength(1);
      expect(result?.[0].name).toBe("General");
    });

    it("should return null on error", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: "Error fetching tiers" },
      });

      const result = await getPublicTicketTiers("event-123");

      expect(result).toBeNull();
    });
  });

  describe("recordSecretTierPurchase", () => {
    it("should successfully record a secret tier purchase", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: {
          success: true,
          uses_remaining: 4,
          message: "Secret tier purchase recorded",
        },
        error: null,
      });

      const result = await recordSecretTierPurchase("tier-123");

      expect(result).toEqual({
        success: true,
        uses_remaining: 4,
        message: "Secret tier purchase recorded",
      });
    });

    it("should return null on error", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: "Error recording purchase" },
      });

      const result = await recordSecretTierPurchase("tier-123");

      expect(result).toBeNull();
    });
  });

  describe("checkSecretUnlock", () => {
    it("should return secret tier info when valid hash is in URL", async () => {
      // Mock window.location
      global.window = {
        location: {
          search: "?unlock_hash=abc123xyz",
        },
      } as any;

      const { supabase } = await import("./supabase/client");
      (supabase.functions.invoke as any).mockResolvedValue({
        data: {
          valid: true,
          tier: {
            id: "tier-123",
            name: "VIP",
            price: 1000,
            capacity: 50,
            uses_remaining: 5,
          },
        },
        error: null,
      });

      const result = await checkSecretUnlock("event-123");

      expect(result).toEqual({
        id: "tier-123",
        name: "VIP",
        price: 1000,
        capacity: 50,
        uses_remaining: 5,
      });
    });

    it("should return null when no unlock hash in URL", async () => {
      global.window = {
        location: {
          search: "",
        },
      } as any;

      const result = await checkSecretUnlock("event-123");

      expect(result).toBeNull();
    });

    it("should return null when window is undefined (SSR)", async () => {
      global.window = undefined as any;

      const result = await checkSecretUnlock("event-123");

      expect(result).toBeNull();
    });

    it("should return null when unlock hash is invalid", async () => {
      global.window = {
        location: {
          search: "?unlock_hash=invalid",
        },
      } as any;

      const { supabase } = await import("./supabase/client");
      (supabase.functions.invoke as any).mockResolvedValue({
        data: { valid: false, message: "Invalid link" },
        error: null,
      });

      const result = await checkSecretUnlock("event-123");

      expect(result).toBeNull();
    });
  });
});
