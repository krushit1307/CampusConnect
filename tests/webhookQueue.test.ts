// tests/webhookQueue.test.ts
// Tests for CRM Webhook Fallback Queue
// Issue #4989

import { describe, it, expect, vi, beforeEach } from "vitest";

// All mocks must be hoisted so vi.mock factories can reference them
const { mockQuery, mockRelease, mockClient } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockRelease = vi.fn();
  const mockClient: any = {};
  // Wire client.query to the shared mock so transaction calls work
  mockClient.query = mockQuery;
  mockClient.release = mockRelease;
  return { mockQuery, mockRelease, mockClient };
});

vi.mock("pg", () => ({
  Pool: class MockPool {
    constructor() {}
    query = mockQuery;
    async connect() {
      return mockClient;
    }
  },
}));

vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>();
  return {
    ...actual,
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue("mock-hash-12345"),
    })),
  };
});

import {
  generatePayloadHash,
  calculateNextRetryTime,
  enqueueWebhook,
  deliverWebhook,
  scheduleNextRetryOrDLQ,
  generateDLQCSV,
  WebhookPayload,
} from "../server/services/webhookQueueService";

describe("webhookQueueService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generatePayloadHash", () => {
    it("returns a hash string for valid payload", () => {
      const payload: WebhookPayload = {
        eventType: "LEAD_CREATED",
        studentId: "student-123",
        studentName: "John Doe",
        email: "john@example.com",
      };
      const hash = generatePayloadHash(payload);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("calculateNextRetryTime", () => {
    it("returns a date in the future", () => {
      const now = Date.now();
      const nextRetry = calculateNextRetryTime(5);
      expect(nextRetry).toBeInstanceOf(Date);
      expect(nextRetry.getTime()).toBeGreaterThan(now);
    });

    it("uses increasing delays for higher attempt numbers", () => {
      const retry0 = calculateNextRetryTime(0);
      const retry5 = calculateNextRetryTime(5);
      const retry9 = calculateNextRetryTime(9);
      expect(retry5.getTime()).toBeGreaterThanOrEqual(retry0.getTime());
      expect(retry9.getTime()).toBeGreaterThanOrEqual(retry5.getTime());
    });

    it("caps at maximum delay for high attempt numbers", () => {
      const retry9 = calculateNextRetryTime(9);
      const retry100 = calculateNextRetryTime(100);
      const diff9 = retry9.getTime() - Date.now();
      const diff100 = retry100.getTime() - Date.now();
      expect(diff100).toBeGreaterThanOrEqual(diff9 * 0.8);
      expect(diff100).toBeLessThanOrEqual(diff9 * 1.2);
    });
  });

  describe("enqueueWebhook", () => {
    it("enqueues a new webhook payload", async () => {
      const payload: WebhookPayload = {
        eventType: "LEAD_CREATED",
        studentId: "student-123",
        studentName: "John Doe",
      };

      // No duplicate
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Insert success
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "queue-123",
            sponsor_id: "sponsor-456",
            status: "pending",
            attempt_count: 0,
            next_retry_at: new Date(),
          },
        ],
      });

      const result = await enqueueWebhook(
        "sponsor-456",
        "https://crm.example.com/webhook",
        payload,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe("queue-123");
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it("returns existing queue item for duplicate payloads", async () => {
      const payload: WebhookPayload = {
        eventType: "LEAD_CREATED",
        studentId: "student-123",
      };

      // Duplicate found
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: "existing-queue-123" }],
      });

      const result = await enqueueWebhook(
        "sponsor-456",
        "https://crm.example.com/webhook",
        payload,
      );

      expect(result.id).toBe("existing-queue-123");
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe("deliverWebhook", () => {
    it("returns success for 2xx responses", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        text: vi.fn().mockResolvedValue("OK"),
      });
      const result = await deliverWebhook(
        "https://crm.example.com/webhook",
        { eventType: "LEAD_CREATED" },
        1,
      );
      expect(result.success).toBe(true);
      expect(result.httpStatus).toBe(200);
    });

    it("returns failure for non-2xx responses", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 503,
        text: vi.fn().mockResolvedValue("Service Unavailable"),
      });
      const result = await deliverWebhook(
        "https://crm.example.com/webhook",
        { eventType: "LEAD_CREATED" },
        1,
      );
      expect(result.success).toBe(false);
      expect(result.httpStatus).toBe(503);
      expect(result.error).toContain("503");
    });

    it("handles network errors gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
      const result = await deliverWebhook(
        "https://crm.example.com/webhook",
        { eventType: "LEAD_CREATED" },
        1,
      );
      expect(result.success).toBe(false);
      expect(result.httpStatus).toBeNull();
      expect(result.error).toContain("Network error");
    });
  });

  describe("scheduleNextRetryOrDLQ", () => {
    it("schedules next retry when under max attempts", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await scheduleNextRetryOrDLQ("queue-123", 3, "Error");
      expect(result.shouldRetry).toBe(true);
      expect(result.moveToDLQ).toBe(false);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it("moves to DLQ when max attempts exceeded", async () => {
      // moveToDeadLetterQueue uses a transaction:
      // BEGIN → SELECT queue item → INSERT dlq → UPDATE status → COMMIT
      mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockQuery.mockResolvedValueOnce({
        // SELECT queue item
        rows: [
          {
            id: "queue-123",
            attempt_count: 10,
            created_at: new Date(),
            last_attempt_at: new Date(),
          },
        ],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT dlq
      mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE status
      mockQuery.mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await scheduleNextRetryOrDLQ("queue-123", 10, "Max retries exceeded");
      expect(result.shouldRetry).toBe(false);
      expect(result.moveToDLQ).toBe(true);
    });
  });

  describe("generateDLQCSV", () => {
    it("generates valid CSV content", () => {
      const items = [
        {
          id: "queue-1",
          payload: {
            eventType: "LEAD_CREATED",
            studentName: "John Doe",
            email: "john@example.com",
            jobTitle: "Software Engineer",
          },
          createdAt: new Date("2026-01-15"),
          attemptCount: 10,
          finalError: "HTTP 503: Service Unavailable",
        },
        {
          id: "queue-2",
          payload: {
            eventType: "LEAD_CREATED",
            studentName: "Jane Smith",
            email: "jane@example.com",
            jobTitle: "Data Scientist",
          },
          createdAt: new Date("2026-01-16"),
          attemptCount: 8,
          finalError: "Connection timeout",
        },
      ];

      const csv = generateDLQCSV(items as any);

      expect(csv).toContain("ID,Event Type,Student Name,Email,Job Title");
      expect(csv).toContain("John Doe");
      expect(csv).toContain("john@example.com");
      expect(csv).toContain("Jane Smith");
      expect(csv).toContain("jane@example.com");

      const lines = csv.split("\n");
      expect(lines.length).toBe(3);
    });

    it("handles special characters in CSV", () => {
      const items = [
        {
          id: "queue-1",
          payload: {
            eventType: "LEAD_CREATED",
            studentName: 'John "Johnny" Doe',
            email: "john@example.com",
            jobTitle: "Software Engineer, Senior",
          },
          createdAt: new Date(),
          attemptCount: 5,
          finalError: null,
        },
      ];

      const csv = generateDLQCSV(items as any);
      expect(csv).toContain('"John ""Johnny"" Doe"');
      expect(csv).toContain('"Software Engineer, Senior"');
    });
  });

  describe("retry delay calculation", () => {
    it("implements correct exponential backoff schedule", () => {
      const expectedDelays = [1, 5, 30, 120, 360, 720, 1440, 1440, 1440, 1440];

      // Skip first two (short delays where jitter can dominate)
      for (let i = 2; i < expectedDelays.length; i++) {
        const before = Date.now();
        const retry = calculateNextRetryTime(i);
        const diffMs = retry.getTime() - before;
        const diffMinutes = diffMs / (1000 * 60);

        expect(diffMinutes).toBeGreaterThanOrEqual(expectedDelays[i] * 0.85);
        expect(diffMinutes).toBeLessThanOrEqual(expectedDelays[i] * 1.15);
      }
    });
  });
});
