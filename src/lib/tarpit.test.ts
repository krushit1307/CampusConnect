// src/lib/tarpit.test.ts
// Issue: #4995 - Dynamic "Early Bird" Rate-Limiting Tarpit
// Tests for tarpit library functions

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isInTarpit,
  startTarpitSession,
  endTarpitSession,
  getTarpitConfig,
  getTarpitStats,
  shouldTarpit,
  redirectToTarpit,
} from "./tarpit";

// Mock Supabase client
vi.mock("./supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe("tarpit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isInTarpit", () => {
    it("should return true when IP is in tarpit", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: [{ in_tarpit: true, session_id: "session-123", remaining_seconds: 120 }],
        error: null,
      });

      const result = await isInTarpit("192.168.1.1");

      expect(result.inTarpit).toBe(true);
      expect(result.sessionId).toBe("session-123");
      expect(result.remainingSeconds).toBe(120);
    });

    it("should return false when IP is not in tarpit", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: [{ in_tarpit: false }],
        error: null,
      });

      const result = await isInTarpit("192.168.1.1");

      expect(result.inTarpit).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      const result = await isInTarpit("192.168.1.1");

      expect(result.inTarpit).toBe(false);
    });
  });

  describe("startTarpitSession", () => {
    it("should start a tarpit session successfully", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: "session-123",
        error: null,
      });

      const sessionId = await startTarpitSession(
        "192.168.1.1",
        "Mozilla/5.0",
        "fp-123",
        "default",
        "honey_pot",
      );

      expect(sessionId).toBe("session-123");
      expect(supabase.rpc).toHaveBeenCalledWith("start_tarpit_session", {
        p_ip_address: "192.168.1.1",
        p_user_agent: "Mozilla/5.0",
        p_fingerprint: "fp-123",
        p_config_name: "default",
        p_trigger_reason: "honey_pot",
      });
    });

    it("should return null on error", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: "Error" },
      });

      const sessionId = await startTarpitSession("192.168.1.1");

      expect(sessionId).toBeNull();
    });
  });

  describe("endTarpitSession", () => {
    it("should end a tarpit session successfully", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        error: null,
      });

      await endTarpitSession("session-123", 1024);

      expect(supabase.rpc).toHaveBeenCalledWith("end_tarpit_session", {
        p_session_id: "session-123",
        p_bytes_sent: 1024,
      });
    });

    it("should handle errors gracefully", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        error: { message: "Error" },
      });

      // Should not throw
      await expect(endTarpitSession("session-123")).resolves.not.toThrow();
    });
  });

  describe("getTarpitConfig", () => {
    it("should return tarpit configuration", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: [
          {
            bytes_per_second: 0.1,
            max_duration: 300,
            chunk_size: 1,
            initial_delay: 1000,
          },
        ],
        error: null,
      });

      const config = await getTarpitConfig("default");

      expect(config).toEqual({
        bytesPerSecond: 0.1,
        maxDuration: 300,
        chunkSize: 1,
        initialDelay: 1000,
      });
    });

    it("should return null when no config found", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: [],
        error: null,
      });

      const config = await getTarpitConfig();

      expect(config).toBeNull();
    });
  });

  describe("getTarpitStats", () => {
    it("should return tarpit statistics", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: [
          {
            total_sessions: 100,
            active_sessions: 5,
            total_duration_seconds: 50000,
            total_bytes_sent: 1000000,
            avg_duration_seconds: 500,
            unique_ips: 50,
            unique_fingerprints: 30,
            top_trigger_reasons: [
              { reason: "honey_pot", count: 80 },
              { reason: "rate_limit", count: 20 },
            ],
          },
        ],
        error: null,
      });

      const stats = await getTarpitStats(7);

      expect(stats).toEqual({
        totalSessions: 100,
        activeSessions: 5,
        totalDurationSeconds: 50000,
        totalBytesSent: 1000000,
        avgDurationSeconds: 500,
        uniqueIps: 50,
        uniqueFingerprints: 30,
        topTriggerReasons: [
          { reason: "honey_pot", count: 80 },
          { reason: "rate_limit", count: 20 },
        ],
      });
    });

    it("should return null on error", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: "Error" },
      });

      const stats = await getTarpitStats();

      expect(stats).toBeNull();
    });
  });

  describe("shouldTarpit", () => {
    it("should return false if bot is not detected", () => {
      const result = shouldTarpit(false, false, "medium");
      expect(result).toBe(false);
    });

    it("should return false if already in tarpit", () => {
      const result = shouldTarpit(true, true, "medium");
      expect(result).toBe(false);
    });

    it("should always return true for high severity", () => {
      const result = shouldTarpit(true, false, "high");
      expect(result).toBe(true);
    });

    it("should return true 80% of the time for medium severity", () => {
      let trueCount = 0;
      for (let i = 0; i < 1000; i++) {
        if (shouldTarpit(true, false, "medium")) {
          trueCount++;
        }
      }
      // Allow for some variance (should be around 800)
      expect(trueCount).toBeGreaterThan(700);
      expect(trueCount).toBeLessThan(900);
    });

    it("should return true 30% of the time for low severity", () => {
      let trueCount = 0;
      for (let i = 0; i < 1000; i++) {
        if (shouldTarpit(true, false, "low")) {
          trueCount++;
        }
      }
      // Allow for some variance (should be around 300)
      expect(trueCount).toBeGreaterThan(200);
      expect(trueCount).toBeLessThan(400);
    });
  });

  describe("redirectToTarpit", () => {
    it("should redirect to tarpit function with default config", () => {
      const originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = { href: "" };

      redirectToTarpit();

      expect(window.location.href).toContain("/functions/v1/tarpit");

      window.location = originalLocation;
    });

    it("should redirect with custom config", () => {
      const originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = { href: "" };

      redirectToTarpit({
        bytesPerSecond: 0.05,
        maxDuration: 600,
        chunkSize: 2,
        initialDelay: 2000,
      });

      const url = window.location.href;
      expect(url).toContain("bps=0.05");
      expect(url).toContain("maxDuration=600");
      expect(url).toContain("chunkSize=2");
      expect(url).toContain("initialDelay=2000");

      window.location = originalLocation;
    });
  });
});
