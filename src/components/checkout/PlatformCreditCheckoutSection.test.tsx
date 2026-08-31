import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { PlatformCreditCheckoutSection } from "./PlatformCreditCheckoutSection";

vi.mock("../../hooks/usePlatformCredit", () => ({
  usePlatformCredit: () => ({
    balance: {
      user_id: "usr-1",
      balance_cents: 5500,
      lifetime_credited_cents: 5500,
      lifetime_spent_cents: 0,
      bonus_earned_cents: 500,
      updated_at: "2026-08-25T12:00:00Z",
    },
    isLoading: false,
  }),
}));

describe("PlatformCreditCheckoutSection", () => {
  it("renders 100% covered state when platform balance exceeds order total", () => {
    // Balance is $55.00 (5500 cents), Order is $50.00 (5000 cents)
    render(<PlatformCreditCheckoutSection orderTotalCents={5000} />);

    expect(screen.getByText("CampusConnect Platform Credit")).toBeInTheDocument();
    expect(screen.getByText("Available: $55.00")).toBeInTheDocument();
    expect(screen.getByText("100% Covered")).toBeInTheDocument();
    expect(screen.getByText("-$50.00")).toBeInTheDocument();
    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(screen.getByText(/No credit card required/i)).toBeInTheDocument();
  });

  it("renders partial deduction when balance is less than order total", () => {
    // Balance is $20.00 (2000 cents), Order is $50.00 (5000 cents)
    render(
      <PlatformCreditCheckoutSection
        orderTotalCents={5000}
        customBalanceCents={2000}
      />,
    );

    expect(screen.getByText("Available: $20.00")).toBeInTheDocument();
    expect(screen.getByText("Auto-Applied")).toBeInTheDocument();
    expect(screen.getByText("-$20.00")).toBeInTheDocument();
    expect(screen.getByText("$30.00")).toBeInTheDocument();
    expect(screen.getByText(/The remaining \$30\.00 will be charged to your card/i)).toBeInTheDocument();
  });

  it("renders zero credit available message when balance is 0", () => {
    render(
      <PlatformCreditCheckoutSection
        orderTotalCents={5000}
        customBalanceCents={0}
      />,
    );

    expect(screen.getByText("Available: $0.00")).toBeInTheDocument();
    expect(
      screen.getByText(/No platform credit available\. Checkouts will be charged directly to your card\./i),
    ).toBeInTheDocument();
  });
});
