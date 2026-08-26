/**
 * Budget Calculator for Event Planning
 * Accurately calculates profit/loss considering Stripe fees and fixed costs
 */

export interface BudgetInput {
  expectedAttendees: number;
  ticketPrice: number;
  fixedCosts: Array<{
    id: string;
    name: string;
    amount: number;
  }>;
  earlyBirdPercentage?: number; // % of attendees buying early bird tickets
  earlyBirdPrice?: number;
}

export interface BudgetOutput {
  grossRevenue: number;
  stripeFees: number;
  netRevenue: number;
  totalFixedCosts: number;
  projectedProfit: number;
  breakeven: {
    attendeesNeeded: number;
    ticketPriceNeeded: number;
    status: "profit" | "breakeven" | "loss";
  };
  profitMargin: number; // percentage
}

/**
 * Stripe fee structure: 2.9% + $0.30 per transaction
 * This is the standard for US-based Stripe accounts
 */
const STRIPE_PERCENTAGE_FEE = 0.029;
const STRIPE_FIXED_FEE = 0.3;

/**
 * Calculate Stripe fees for a single ticket
 */
export function calculateStripeFeePerTicket(ticketPrice: number): number {
  return ticketPrice * STRIPE_PERCENTAGE_FEE + STRIPE_FIXED_FEE;
}

/**
 * Calculate total Stripe fees for all tickets
 */
export function calculateTotalStripeFees(
  expectedAttendees: number,
  ticketPrice: number,
  earlyBirdPercentage = 0,
  earlyBirdPrice = 0,
): number {
  if (expectedAttendees <= 0 || ticketPrice <= 0) return 0;

  let totalFees = 0;

  if (earlyBirdPercentage > 0 && earlyBirdPercentage < 1 && earlyBirdPrice > 0) {
    const earlyBirdAttendees = Math.round(expectedAttendees * earlyBirdPercentage);
    const regularAttendees = expectedAttendees - earlyBirdAttendees;

    totalFees += earlyBirdAttendees * calculateStripeFeePerTicket(earlyBirdPrice);
    totalFees += regularAttendees * calculateStripeFeePerTicket(ticketPrice);
  } else {
    totalFees = expectedAttendees * calculateStripeFeePerTicket(ticketPrice);
  }

  return totalFees;
}

/**
 * Main budget calculator function
 */
export function calculateBudget(input: BudgetInput): BudgetOutput {
  const {
    expectedAttendees,
    ticketPrice,
    fixedCosts,
    earlyBirdPercentage = 0,
    earlyBirdPrice = 0,
  } = input;

  // Calculate gross revenue
  let grossRevenue = 0;
  if (earlyBirdPercentage > 0 && earlyBirdPercentage < 1 && earlyBirdPrice > 0) {
    const earlyBirdAttendees = Math.round(expectedAttendees * earlyBirdPercentage);
    const regularAttendees = expectedAttendees - earlyBirdAttendees;
    grossRevenue = earlyBirdAttendees * earlyBirdPrice + regularAttendees * ticketPrice;
  } else {
    grossRevenue = expectedAttendees * ticketPrice;
  }

  // Calculate Stripe fees
  const stripeFees = calculateTotalStripeFees(
    expectedAttendees,
    ticketPrice,
    earlyBirdPercentage,
    earlyBirdPrice,
  );

  // Calculate net revenue after Stripe fees
  const netRevenue = grossRevenue - stripeFees;

  // Calculate total fixed costs
  const totalFixedCosts = fixedCosts.reduce((sum, cost) => sum + Math.max(0, cost.amount), 0);

  // Calculate projected profit/loss
  const projectedProfit = netRevenue - totalFixedCosts;

  // Calculate profit margin
  const profitMargin = grossRevenue > 0 ? (projectedProfit / grossRevenue) * 100 : 0;

  // Calculate breakeven points
  const breakeven = calculateBreakeven(ticketPrice, stripeFees, expectedAttendees, totalFixedCosts);

  return {
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    stripeFees: Math.round(stripeFees * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    totalFixedCosts: Math.round(totalFixedCosts * 100) / 100,
    projectedProfit: Math.round(projectedProfit * 100) / 100,
    breakeven,
    profitMargin: Math.round(profitMargin * 100) / 100,
  };
}

/**
 * Calculate breakeven points
 */
function calculateBreakeven(
  ticketPrice: number,
  totalStripeFees: number,
  currentAttendees: number,
  totalFixedCosts: number,
): BudgetOutput["breakeven"] {
  const feePerTicket = calculateStripeFeePerTicket(ticketPrice);
  const netPerTicket = ticketPrice - feePerTicket;

  // Attendees needed to break even
  let attendeesNeeded = 0;
  if (netPerTicket > 0) {
    attendeesNeeded = Math.ceil(totalFixedCosts / netPerTicket);
  }

  // Ticket price needed to break even with current attendees
  let ticketPriceNeeded = 0;
  if (currentAttendees > 0) {
    // Solve: (P - (P * 0.029 + 0.30)) * attendees = fixed costs
    // P * (1 - 0.029) - 0.30 = fixed costs / attendees
    // P * 0.971 = (fixed costs / attendees) + 0.30
    const avgFixedCostPerAttendee = totalFixedCosts / currentAttendees;
    ticketPriceNeeded = (avgFixedCostPerAttendee + STRIPE_FIXED_FEE) / (1 - STRIPE_PERCENTAGE_FEE);
    ticketPriceNeeded = Math.max(0, Math.round(ticketPriceNeeded * 100) / 100);
  }

  // Determine status
  const currentProfit = (ticketPrice - feePerTicket) * currentAttendees - totalFixedCosts;
  const status: "profit" | "breakeven" | "loss" =
    currentProfit > 0.01 ? "profit" : currentProfit < -0.01 ? "loss" : "breakeven";

  return {
    attendeesNeeded: Math.max(0, attendeesNeeded),
    ticketPriceNeeded,
    status,
  };
}

/**
 * Get a readable string for the profit status
 */
export function getProfitStatusMessage(projectedProfit: number, ticketPriceNeeded: number): string {
  if (Math.abs(projectedProfit) < 0.01) {
    return "Break Even!";
  }

  if (projectedProfit > 0) {
    return `+$${Math.abs(projectedProfit).toFixed(2)} Profit 🎉`;
  }

  if (ticketPriceNeeded > 0) {
    return `−$${Math.abs(projectedProfit).toFixed(2)} Loss (Try $${ticketPriceNeeded.toFixed(2)}/ticket)`;
  }

  return `−$${Math.abs(projectedProfit).toFixed(2)} Loss`;
}

/**
 * Generate scenario analysis (worst case, best case, expected case)
 */
export function generateScenarioAnalysis(
  baseInput: BudgetInput,
  worstCasePercentage = 0.5,
  bestCasePercentage = 1.5,
) {
  const worst = calculateBudget({
    ...baseInput,
    expectedAttendees: Math.round(baseInput.expectedAttendees * worstCasePercentage),
  });

  const base = calculateBudget(baseInput);

  const best = calculateBudget({
    ...baseInput,
    expectedAttendees: Math.round(baseInput.expectedAttendees * bestCasePercentage),
  });

  return { worst, base, best };
}
