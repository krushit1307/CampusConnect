// src/services/__tests__/eventLogisticsService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventLogisticsService } from "../eventLogisticsService";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  }),
}));

describe("EventLogisticsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks event publication eligibility based on critical tasks", async () => {
    mockSelect.mockReturnValue({
      eq: () => ({
        order: () => ({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "t1",
                title: "Submit Campus Security Request Form",
                is_critical: true,
                status: "todo",
              },
              {
                id: "t2",
                title: "Order Decorations",
                is_critical: false,
                status: "todo",
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    const result = await EventLogisticsService.canPublishEvent("evt-100");

    expect(result.canPublish).toBe(false);
    expect(result.incompleteTasks.length).toBe(1);
    expect(result.incompleteTasks[0].title).toContain("Campus Security");
  });

  it("allows publication when all critical tasks are done", async () => {
    mockSelect.mockReturnValue({
      eq: () => ({
        order: () => ({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "t1",
                title: "Submit Campus Security Request Form",
                is_critical: true,
                status: "done",
              },
              {
                id: "t2",
                title: "Order Decorations",
                is_critical: false,
                status: "in_progress",
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    const result = await EventLogisticsService.canPublishEvent("evt-100");

    expect(result.canPublish).toBe(true);
    expect(result.incompleteTasks.length).toBe(0);
  });
});
