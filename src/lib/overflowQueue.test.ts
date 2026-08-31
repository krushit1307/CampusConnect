import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateOverflowQrPayload,
  isEventAtCapacity,
} from "./overflowQueue";

// Mock supabase
vi.mock("./supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          head: vi.fn(() => Promise.resolve({ count: 0, error: null })),
        })),
      })),
    })),
    functions: {
      invoke: vi.fn(() =>
        Promise.resolve({ data: { success: true }, error: null })
      ),
    },
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn(() => ({})),
      })),
    })),
    removeChannel: vi.fn(),
  },
}));

describe("overflowQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateOverflowQrPayload", () => {
    it("should generate a valid JSON payload with overflow_queue type", () => {
      const eventId = "test-event-id-123";
      const payload = generateOverflowQrPayload(eventId);
      const parsed = JSON.parse(payload);

      expect(parsed.type).toBe("overflow_queue");
      expect(parsed.event_id).toBe(eventId);
      expect(parsed.timestamp).toBeTypeOf("number");
    });

    it("should include a recent timestamp", () => {
      const before = Date.now();
      const payload = generateOverflowQrPayload("event-1");
      const after = Date.now();
      const parsed = JSON.parse(payload);

      expect(parsed.timestamp).toBeGreaterThanOrEqual(before);
      expect(parsed.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("isEventAtCapacity", () => {
    it("should return false when max_attendees is null (unlimited)", async () => {
      const { supabase } = await import("./supabase");

      // First call returns event with null max_attendees
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: { max_attendees: null },
              error: null,
            })
          ),
        })),
      }));

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: mockSelect,
      });

      const result = await isEventAtCapacity("event-1");
      expect(result).toBe(false);
    });
  });
});
