// =============================================================================
// File: src/services/eventRoiCalculatorService.ts
// Issue: #3941 - Build an 'Interactive Event Budget ROI' Calculator
// Description: Algorithmic break-even analysis, financial sensitivity matrices,
//              safety margin computations, and exportable financial summaries.
// =============================================================================

import { supabase } from "@/lib/supabase";
import type {
  ExpenseItem,
  EventFinancialInputs,
  BreakEvenAnalysisResult,
  SensitivityMatrixCell,
  RoiScenarioComparison,
} from "@/types/eventRoiCalculator";

/**
 * Standard baseline expenses for campus club events (formals, hackathons, galas).
 */
export function getDefaultExpenseItems(): ExpenseItem[] {
  return [
    {
      id: "exp-venue",
      name: "Grand Ballroom / Venue Rental",
      category: "venue",
      amount: 1200,
      isVariablePerAttendee: false,
    },
    {
      id: "exp-av",
      name: "DJ, Lighting & Audio/Visual Rigging",
      category: "production",
      amount: 600,
      isVariablePerAttendee: false,
    },
    {
      id: "exp-security",
      name: "Campus Police & EMT Standby Permit",
      category: "permits",
      amount: 350,
      isVariablePerAttendee: false,
    },
    {
      id: "exp-marketing",
      name: "Flyers, Vinyl Banner & Social Ads",
      category: "marketing",
      amount: 200,
      isVariablePerAttendee: false,
    },
    {
      id: "exp-photo",
      name: "Photo Booth & Backdrop Hire",
      category: "production",
      amount: 400,
      isVariablePerAttendee: false,
    },
    {
      id: "exp-catering-base",
      name: "Buffet & Hors d'oeuvres (Per Attendee)",
      category: "catering",
      amount: 0,
      isVariablePerAttendee: true,
      costPerAttendee: 8.5,
    },
    {
      id: "exp-drinks",
      name: "Mocktail & Refreshment Station (Per Attendee)",
      category: "catering",
      amount: 0,
      isVariablePerAttendee: true,
      costPerAttendee: 3.5,
    },
  ];
}

/**
 * Standard default financial inputs for an upcoming campus event.
 */
export function getDefaultEventFinancialInputs(eventId: string = "evt-demo-1"): EventFinancialInputs {
  return {
    eventId,
    eventTitle: "Annual Spring Gala & Awards Night",
    venueCapacity: 300,
    expectedAttendanceRate: 0.8, // 80% capacity = 240 attendees
    averageTicketPrice: 25.0, // $25 per ticket
    confirmedSponsorshipRevenue: 500.0, // $500 external corporate sponsor
    studentGovtGrant: 600.0, // $600 Student Union Activity Grant
    fixedExpenses: getDefaultExpenseItems().filter((e) => !e.isVariablePerAttendee),
    variableCostPerAttendee: 12.0, // $8.50 food + $3.50 drinks
  };
}

/**
 * Core Algorithmic Break-Even and Net Profit Calculation Engine.
 */
export function calculateEventBreakEven(inputs: EventFinancialInputs): BreakEvenAnalysisResult {
  const projectedAttendees = Math.round(inputs.venueCapacity * inputs.expectedAttendanceRate);

  // 1. Calculate Total Fixed Costs
  const totalFixedCosts = inputs.fixedExpenses.reduce((sum, item) => sum + item.amount, 0);

  // 2. Calculate Total Variable Costs
  const totalVariableCosts = projectedAttendees * inputs.variableCostPerAttendee;

  // 3. Calculate Total Outflow Expenses
  const totalEstimatedExpenses = totalFixedCosts + totalVariableCosts;

  // 4. Calculate Inflow Revenues
  const grossTicketRevenue = projectedAttendees * inputs.averageTicketPrice;
  const externalSubsidies = inputs.confirmedSponsorshipRevenue + inputs.studentGovtGrant;
  const totalRevenue = grossTicketRevenue + externalSubsidies;

  // 5. Calculate Profit / Loss & Margins
  const netProfitOrLoss = totalRevenue - totalEstimatedExpenses;
  const isProfitable = netProfitOrLoss >= 0;
  const profitMarginPercent = totalRevenue > 0 ? (netProfitOrLoss / totalRevenue) * 100 : 0;
  const roiPercentage =
    totalEstimatedExpenses > 0 ? (netProfitOrLoss / totalEstimatedExpenses) * 100 : 0;

  // 6. Calculate Break-Even Metric: Q_be = (Fixed Costs - Subsidies) / (Price - Variable Cost)
  const contributionMarginPerTicket = inputs.averageTicketPrice - inputs.variableCostPerAttendee;
  const netFixedCostToCover = Math.max(0, totalFixedCosts - externalSubsidies);

  let breakEvenTicketCount = 0;
  if (contributionMarginPerTicket > 0) {
    breakEvenTicketCount = Math.ceil(netFixedCostToCover / contributionMarginPerTicket);
  } else if (netFixedCostToCover === 0) {
    breakEvenTicketCount = 0;
  } else {
    // Ticket price is lower than variable cost per head, impossible to break even on tickets alone
    breakEvenTicketCount = 9999;
  }

  const breakEvenAttendanceRate =
    inputs.venueCapacity > 0 ? (breakEvenTicketCount / inputs.venueCapacity) * 100 : 0;

  // 7. Margin of Safety
  const marginOfSafetyTickets = projectedAttendees - breakEvenTicketCount;
  const marginOfSafetyPercent =
    projectedAttendees > 0 ? (marginOfSafetyTickets / projectedAttendees) * 100 : 0;

  return {
    totalFixedCosts,
    variableCostPerAttendee: inputs.variableCostPerAttendee,
    totalVariableCosts,
    totalEstimatedExpenses,
    grossTicketRevenue,
    totalRevenue,
    netProfitOrLoss,
    isProfitable,
    profitMarginPercent: Number(profitMarginPercent.toFixed(1)),
    roiPercentage: Number(roiPercentage.toFixed(1)),
    breakEvenTicketCount,
    breakEvenAttendanceRate: Number(breakEvenAttendanceRate.toFixed(1)),
    marginOfSafetyTickets,
    marginOfSafetyPercent: Number(marginOfSafetyPercent.toFixed(1)),
    projectedAttendees,
  };
}

/**
 * Generates a 2D Sensitivity Matrix (5 Ticket Price points x 5 Attendance rates)
 * to help treasurers stress-test different pricing and turnout scenarios.
 */
export function generateSensitivityMatrix(
  inputs: EventFinancialInputs,
  priceDeltas: number[] = [-10, -5, 0, 5, 10],
  attendanceRates: number[] = [0.5, 0.65, 0.8, 0.9, 1.0]
): {
  prices: number[];
  attendanceRates: number[];
  cells: SensitivityMatrixCell[][];
} {
  const basePrice = inputs.averageTicketPrice;
  const calculatedPrices = priceDeltas
    .map((d) => Math.max(5, basePrice + d))
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a - b);

  const cells: SensitivityMatrixCell[][] = calculatedPrices.map((price) => {
    return attendanceRates.map((rate) => {
      const scenarioInputs: EventFinancialInputs = {
        ...inputs,
        averageTicketPrice: price,
        expectedAttendanceRate: rate,
      };
      const result = calculateEventBreakEven(scenarioInputs);
      return {
        ticketPrice: price,
        attendancePercent: Math.round(rate * 100),
        projectedAttendees: result.projectedAttendees,
        totalRevenue: result.totalRevenue,
        netProfit: result.netProfitOrLoss,
        isProfitable: result.isProfitable,
      };
    });
  });

  return {
    prices: calculatedPrices,
    attendanceRates,
    cells,
  };
}

/**
 * Computes 3-Scenario comparisons: Worst Case (50%), Realistic (80%), Best Case (100%).
 */
export function generateScenarioComparisons(inputs: EventFinancialInputs): RoiScenarioComparison[] {
  const scenarios: { name: "pessimistic" | "base" | "optimistic"; rate: number }[] = [
    { name: "pessimistic", rate: 0.5 },
    { name: "base", rate: inputs.expectedAttendanceRate },
    { name: "optimistic", rate: 1.0 },
  ];

  return scenarios.map((s) => {
    const res = calculateEventBreakEven({ ...inputs, expectedAttendanceRate: s.rate });
    return {
      scenarioName: s.name,
      attendanceRate: Math.round(s.rate * 100),
      attendeeCount: res.projectedAttendees,
      grossRevenue: res.totalRevenue,
      totalExpenses: res.totalEstimatedExpenses,
      netProfit: res.netProfitOrLoss,
      marginPercent: res.profitMarginPercent,
    };
  });
}

/**
 * Export Financial Break-Even Plan as CSV.
 */
export function exportEventBudgetRoiCSV(
  inputs: EventFinancialInputs,
  result: BreakEvenAnalysisResult,
  fileName: string = "event_budget_roi_plan.csv"
): void {
  const lines = [
    `Event Financial Feasibility & Break-Even Analysis`,
    `Event Name,${inputs.eventTitle}`,
    `Venue Capacity,${inputs.venueCapacity}`,
    `Expected Attendance Rate,${(inputs.expectedAttendanceRate * 100).toFixed(0)}%`,
    `Projected Attendees,${result.projectedAttendees}`,
    `Average Ticket Price,$${inputs.averageTicketPrice.toFixed(2)}`,
    `\n-- REVENUE BREAKDOWN --`,
    `Gross Ticket Revenue,$${result.grossTicketRevenue.toFixed(2)}`,
    `Confirmed Sponsorships,$${inputs.confirmedSponsorshipRevenue.toFixed(2)}`,
    `Student Govt Activity Grant,$${inputs.studentGovtGrant.toFixed(2)}`,
    `Total Projected Revenue,$${result.totalRevenue.toFixed(2)}`,
    `\n-- EXPENSE BREAKDOWN --`,
    ...inputs.fixedExpenses.map((e) => `"${e.name}",$${e.amount.toFixed(2)}`),
    `Variable Catering & Drinks ($${inputs.variableCostPerAttendee}/head),$${result.totalVariableCosts.toFixed(2)}`,
    `Total Estimated Expenses,$${result.totalEstimatedExpenses.toFixed(2)}`,
    `\n-- PROFITABILITY & BREAK-EVEN --`,
    `Net Profit / (Loss),$${result.netProfitOrLoss.toFixed(2)}`,
    `Profit Margin,${result.profitMarginPercent}%`,
    `Return on Investment (ROI),${result.roiPercentage}%`,
    `Break-Even Ticket Count,${result.breakEvenTicketCount} tickets`,
    `Break-Even Capacity Rate,${result.breakEvenAttendanceRate}%`,
    `Margin of Safety,${result.marginOfSafetyTickets} tickets (${result.marginOfSafetyPercent}%)`,
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Persist Event Budget Forecast to Supabase.
 */
export async function saveEventBudgetForecast(
  inputs: EventFinancialInputs,
  result: BreakEvenAnalysisResult
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = {
      event_id: inputs.eventId,
      venue_capacity: inputs.venueCapacity,
      expected_attendance_rate: inputs.expectedAttendanceRate,
      average_ticket_price: inputs.averageTicketPrice,
      sponsorship_revenue: inputs.confirmedSponsorshipRevenue,
      student_grant_amount: inputs.studentGovtGrant,
      fixed_costs_total: result.totalFixedCosts,
      variable_cost_per_attendee: inputs.variableCostPerAttendee,
      break_even_tickets: result.breakEvenTicketCount,
      projected_profit: result.netProfitOrLoss,
      fixed_expenses_json: inputs.fixedExpenses,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("event_budget_projections")
      .upsert(payload, { onConflict: "event_id" });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save event budget forecast" };
  }
}
