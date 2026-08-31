import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateBudgetVariances,
  formatMoney,
  getEventBudgetVarianceReport,
} from "@/services/eventBudgetVarianceService";

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => {
  return {
    createClient: vi.fn(() => ({
      from: mockFrom,
      rpc: mockRpc,
    })),
  };
});

describe("eventBudgetVarianceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("formatMoney", () => {
    it("formats numbers as USD currency", () => {
      expect(formatMoney(5000)).toBe("$5,000.00");
      expect(formatMoney(2500.5)).toBe("$2,500.50");
      expect(formatMoney(0)).toBe("$0.00");
    });
  });

  describe("calculateBudgetVariances", () => {
    it("compares draft estimates vs actual ledger expenses accurately", () => {
      const estimates = [
        { category: "Food & Catering", amount: 2000 },
        { category: "Audio/Visual", amount: 1500 },
        { category: "Marketing", amount: 500 },
      ];

      const actuals = [
        { category: "Food & Catering", amount: 2800 }, // Overspent by 800
        { category: "Audio/Visual", amount: 1200 }, // Under by 300
        { category: "Venue Rental", amount: 1000 }, // Unexpected actual
      ];

      const report = calculateBudgetVariances(estimates, actuals);

      expect(report.total_estimated).toBe(4000);
      expect(report.total_actual).toBe(5000);
      expect(report.total_variance).toBe(-1000);
      expect(report.is_overspent).toBe(true);

      const foodRow = report.categories.find((c) => c.category === "Food & Catering");
      expect(foodRow?.estimated).toBe(2000);
      expect(foodRow?.actual).toBe(2800);
      expect(foodRow?.variance).toBe(-800);
      expect(foodRow?.is_overspent).toBe(true);
      expect(foodRow?.percentage_variance).toBe(40); // 40% over

      const avRow = report.categories.find((c) => c.category === "Audio/Visual");
      expect(avRow?.estimated).toBe(1500);
      expect(avRow?.actual).toBe(1200);
      expect(avRow?.variance).toBe(300);
      expect(avRow?.is_overspent).toBe(false);

      const venueRow = report.categories.find((c) => c.category === "Venue Rental");
      expect(venueRow?.estimated).toBe(0);
      expect(venueRow?.actual).toBe(1000);
      expect(venueRow?.is_overspent).toBe(true);
    });
  });

  describe("getEventBudgetVarianceReport", () => {
    it("calls get_event_budget_variance_report RPC function", async () => {
      const mockResult = {
        event_id: "evt-1",
        event_title: "Annual Gala",
        total_estimated: 5000,
        total_actual: 7500,
        total_variance: -2500,
        is_overspent: true,
        categories: [
          {
            category: "Catering",
            estimated: 3000,
            actual: 5000,
            variance: -2000,
            percentage_variance: 66.7,
            is_overspent: true,
          },
        ],
      };

      mockRpc.mockResolvedValue({ data: mockResult, error: null });

      const res = await getEventBudgetVarianceReport("evt-1");

      expect(mockRpc).toHaveBeenCalledWith("get_event_budget_variance_report", {
        p_event_id: "evt-1",
      });
      expect(res).toEqual(mockResult);
    });
  });
});
