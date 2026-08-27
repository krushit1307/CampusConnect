import { describe, it, expect } from "vitest";
import {
  calculateBudget,
  calculateStripeFeePerTicket,
  calculateTotalStripeFees,
  getProfitStatusMessage,
  generateScenarioAnalysis,
} from "./budgetCalculator";

describe("Budget Calculator", () => {
  describe("calculateStripeFeePerTicket", () => {
    it("should calculate Stripe fees correctly", () => {
      // $10 ticket: 10 * 0.029 + 0.30 = 0.59
      expect(calculateStripeFeePerTicket(10)).toBeCloseTo(0.59, 2);

      // $15 ticket: 15 * 0.029 + 0.30 = 0.735
      expect(calculateStripeFeePerTicket(15)).toBeCloseTo(0.735, 2);

      // $0 ticket should be 0.30
      expect(calculateStripeFeePerTicket(0)).toBe(0.3);
    });
  });

  describe("calculateTotalStripeFees", () => {
    it("should calculate total fees for multiple attendees", () => {
      // 100 attendees * $10 tickets
      // 100 * (10 * 0.029 + 0.30) = 100 * 0.59 = 59
      expect(calculateTotalStripeFees(100, 10)).toBeCloseTo(59, 2);
    });

    it("should handle zero attendees", () => {
      expect(calculateTotalStripeFees(0, 10)).toBe(0);
    });

    it("should handle zero ticket price", () => {
      expect(calculateTotalStripeFees(100, 0)).toBe(0);
    });
  });

  describe("calculateBudget", () => {
    it("should calculate profit correctly", () => {
      const result = calculateBudget({
        expectedAttendees: 100,
        ticketPrice: 15,
        fixedCosts: [
          { id: "1", name: "Venue", amount: 200 },
          { id: "2", name: "Catering", amount: 300 },
        ],
      });

      // Gross: 100 * 15 = 1500
      expect(result.grossRevenue).toBeCloseTo(1500, 0);

      // Stripe fees: 100 * (15 * 0.029 + 0.30) = 100 * 0.735 = 73.5
      expect(result.stripeFees).toBeCloseTo(73.5, 1);

      // Net: 1500 - 73.5 = 1426.5
      expect(result.netRevenue).toBeCloseTo(1426.5, 1);

      // Fixed costs: 200 + 300 = 500
      expect(result.totalFixedCosts).toBe(500);

      // Profit: 1426.5 - 500 = 926.5
      expect(result.projectedProfit).toBeCloseTo(926.5, 1);

      expect(result.breakeven.status).toBe("profit");
    });

    it("should handle loss scenario", () => {
      const result = calculateBudget({
        expectedAttendees: 30,
        ticketPrice: 10,
        fixedCosts: [{ id: "1", name: "Venue", amount: 500 }],
      });

      // Gross: 30 * 10 = 300
      expect(result.grossRevenue).toBe(300);

      // Stripe fees: 30 * 0.59 = 17.7
      expect(result.stripeFees).toBeCloseTo(17.7, 1);

      // Profit: 300 - 17.7 - 500 = -217.7 (LOSS)
      expect(result.projectedProfit).toBeLessThan(0);
      expect(result.breakeven.status).toBe("loss");
    });

    it("should calculate breakeven attendees correctly", () => {
      const result = calculateBudget({
        expectedAttendees: 100,
        ticketPrice: 10,
        fixedCosts: [{ id: "1", name: "Venue", amount: 500 }],
      });

      // Net per ticket: 10 - 0.59 = 9.41
      // Breakeven attendees: 500 / 9.41 ≈ 53
      expect(result.breakeven.attendeesNeeded).toBeLessThanOrEqual(54);
      expect(result.breakeven.attendeesNeeded).toBeGreaterThanOrEqual(52);
    });

    it("should handle early bird pricing", () => {
      const result = calculateBudget({
        expectedAttendees: 100,
        ticketPrice: 15,
        fixedCosts: [],
        earlyBirdPercentage: 0.4, // 40% buy early bird
        earlyBirdPrice: 10,
      });

      // 40 attendees * $10 + 60 attendees * $15 = 400 + 900 = 1300
      expect(result.grossRevenue).toBe(1300);

      // 40 * (10 * 0.029 + 0.30) + 60 * (15 * 0.029 + 0.30)
      // = 40 * 0.59 + 60 * 0.735 = 23.6 + 44.1 = 67.7
      expect(result.stripeFees).toBeCloseTo(67.7, 1);

      expect(result.netRevenue).toBeCloseTo(1232.3, 1);
    });

    it("should calculate profit margin", () => {
      const result = calculateBudget({
        expectedAttendees: 100,
        ticketPrice: 20,
        fixedCosts: [{ id: "1", name: "Venue", amount: 200 }],
      });

      // Gross: 2000
      // Profit: should be around 1620
      // Margin: 1620 / 2000 = 81%
      expect(result.profitMargin).toBeGreaterThan(80);
    });
  });

  describe("getProfitStatusMessage", () => {
    it("should return profit message for positive profit", () => {
      const message = getProfitStatusMessage(150, 0);
      expect(message).toContain("+$150");
      expect(message).toContain("Profit");
    });

    it("should return loss message with suggested ticket price", () => {
      const message = getProfitStatusMessage(-200, 15);
      expect(message).toContain("−$200");
      expect(message).toContain("Loss");
      expect(message).toContain("$15");
    });

    it("should return breakeven message", () => {
      const message = getProfitStatusMessage(0, 0);
      expect(message).toContain("Break Even");
    });
  });

  describe("generateScenarioAnalysis", () => {
    it("should generate three scenarios", () => {
      const scenarios = generateScenarioAnalysis({
        expectedAttendees: 100,
        ticketPrice: 15,
        fixedCosts: [{ id: "1", name: "Venue", amount: 500 }],
      });

      // Worst: 50 attendees
      expect(scenarios.worst.projectedProfit).toBeLessThan(scenarios.base.projectedProfit);

      // Base: 100 attendees
      expect(scenarios.base.expectedAttendees).toBe(undefined); // Not stored in output

      // Best: 150 attendees
      expect(scenarios.best.projectedProfit).toBeGreaterThan(scenarios.base.projectedProfit);
    });
  });
});
