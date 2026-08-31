import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { PlatformCreditLedgerWidget } from "./PlatformCreditLedgerWidget";

const mockRefresh = vi.fn();
const mockResolveClaim = vi.fn();

const mockUsePlatformCredit = vi.fn();

vi.mock("../../hooks/usePlatformCredit", () => ({
  usePlatformCredit: () => mockUsePlatformCredit(),
}));

describe("PlatformCreditLedgerWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders platform credit balance and ledger transactions", () => {
    mockUsePlatformCredit.mockReturnValue({
      balance: {
        user_id: "usr-1",
        balance_cents: 5500,
        lifetime_credited_cents: 5500,
        lifetime_spent_cents: 2000,
        bonus_earned_cents: 500,
        updated_at: "2026-08-25T12:00:00Z",
      },
      balanceDollars: 55,
      ledger: [
        {
          id: "tx-1",
          user_id: "usr-1",
          amount_cents: 5500,
          balance_after_cents: 5500,
          transaction_type: "cancellation_credit",
          description: "10% bonus credit for cancelled event",
          bonus_amount_cents: 500,
          created_at: "2026-08-25T12:00:00Z",
        },
      ],
      pendingClaims: [],
      isLoading: false,
      error: null,
      refresh: mockRefresh,
      resolveClaim: mockResolveClaim,
      calculateBonus: vi.fn(),
    });

    render(<PlatformCreditLedgerWidget />);

    expect(screen.getByText("CampusConnect Platform Balance")).toBeInTheDocument();
    expect(screen.getByText("$55.00")).toBeInTheDocument();
    expect(screen.getByText("+$5.00")).toBeInTheDocument(); // Bonus
    expect(screen.getByText("10% bonus credit for cancelled event")).toBeInTheDocument();
    expect(screen.getByText("Cancellation Credit")).toBeInTheDocument();
    expect(screen.getByText("+$55.00")).toBeInTheDocument();
  });

  it("renders pending cancellation refund claims banner", () => {
    mockUsePlatformCredit.mockReturnValue({
      balance: {
        user_id: "usr-1",
        balance_cents: 0,
        lifetime_credited_cents: 0,
        lifetime_spent_cents: 0,
        bonus_earned_cents: 0,
        updated_at: "2026-08-25T12:00:00Z",
      },
      balanceDollars: 0,
      ledger: [],
      pendingClaims: [
        {
          id: "claim-1",
          event_id: "evt-1",
          rsvp_id: "rsvp-1",
          user_id: "usr-1",
          original_amount_cents: 5000,
          bonus_percentage: 10,
          credit_amount_cents: 5500,
          status: "pending_choice",
          created_at: "2026-08-25T12:00:00Z",
          event_title: "Campus Hackathon",
        },
      ],
      isLoading: false,
      error: null,
      refresh: mockRefresh,
      resolveClaim: mockResolveClaim,
      calculateBonus: vi.fn(),
    });

    render(<PlatformCreditLedgerWidget />);

    expect(screen.getByText(/Pending Refund Choice/i)).toBeInTheDocument();
    expect(screen.getByText("Campus Hackathon")).toBeInTheDocument();
    expect(screen.getByText(/Choose between/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Select Option/i })).toBeInTheDocument();

    // Clicking button opens modal
    fireEvent.click(screen.getByRole("button", { name: /Select Option/i }));
    expect(screen.getByText("Choose Your Refund")).toBeInTheDocument();
  });
});
