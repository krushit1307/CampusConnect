import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dispatchWebhook, isSSRFBlocked } from "./webhook";

describe("Webhook Utility", () => {
  describe("SSRF Protection", () => {
    it("blocks localhost", () => {
      expect(isSSRFBlocked("http://localhost:3000")).toBe(true);
      expect(isSSRFBlocked("https://localhost")).toBe(true);
    });

    it("blocks 127.0.0.0/8", () => {
      expect(isSSRFBlocked("http://127.0.0.1")).toBe(true);
      expect(isSSRFBlocked("http://127.123.0.1")).toBe(true);
    });

    it("blocks 10.0.0.0/8", () => {
      expect(isSSRFBlocked("http://10.0.0.1")).toBe(true);
      expect(isSSRFBlocked("http://10.255.255.255")).toBe(true);
    });

    it("blocks AWS metadata endpoint", () => {
      expect(isSSRFBlocked("http://169.254.169.254/latest/meta-data/")).toBe(true);
    });

    it("allows valid external URLs", () => {
      expect(isSSRFBlocked("https://api.github.com/webhook")).toBe(false);
      expect(isSSRFBlocked("https://example.com/api")).toBe(false);
    });

    it("blocks invalid URLs", () => {
      expect(isSSRFBlocked("not-a-url")).toBe(true);
    });
  });

  describe("dispatchWebhook", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.clearAllMocks();
    });

    it("dispatches successfully", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const promise = dispatchWebhook("https://example.com", { data: "test" });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: "test" }),
        }),
      );
    });

    it("handles timeout correctly without crashing", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
        (url: string, options: { signal: AbortSignal }) => {
          return new Promise((_, reject) => {
            options.signal.addEventListener("abort", () => {
              const error = new Error("The operation was aborted");
              error.name = "AbortError";
              reject(error);
            });
          });
        },
      );

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const promise = dispatchWebhook("https://example.com", { data: "test" });

      // Fast-forward past the 5000ms timeout
      await vi.advanceTimersByTimeAsync(5000);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook Delivery Timeout");
      expect(consoleWarnSpy).toHaveBeenCalledWith("Webhook Delivery Timeout");

      consoleWarnSpy.mockRestore();
    });

    it("rejects SSRF URLs immediately without fetching", async () => {
      const result = await dispatchWebhook("http://localhost:8080", { data: "test" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Blocked by SSRF protection");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("handles general fetch errors safely", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network error"));

      const promise = dispatchWebhook("https://example.com", { data: "test" });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });
  });
});
