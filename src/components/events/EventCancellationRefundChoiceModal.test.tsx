import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { EventCancellationRefundChoiceModal } from "./EventCancellationRefundChoiceModal";
import type { CancellationRefundClaim } from "../../types/platformCredit";

describe("EventCancellationRefundChoiceModal", () => {
  const mockClaim: CancellationRefundClaim = {
    id: "claim-1",
    event_id: "evt-1",
    rsvp_id: "rsvp-1",
    user_id: "usr-1",
    original_amount_cents: 5000, // $50.00
    bonus_percentage: 10,
    credit_amount_cents: 5500, // $55.00
    status: "pending_choice",
    created_at: "2026-08-25T12:00:00Z",
    event_title: "Campus Concert",
  };

  const mockOnClose = vi.fn();
  const mockOnSelectChoice = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with credit (+10% bonus) and card options", () => {
    render(
      <EventCancellationRefundChoiceModal
        claim={mockClaim}
        isOpen={true}
        onClose={mockOnClose}
        onSelectChoice={mockOnSelectChoice}
        onSuccess={mockOnSuccess}
      />,
    );

    expect(screen.getByText("Choose Your Refund")).toBeInTheDocument();
    expect(screen.getByText("$55.00 in CampusConnect Credit")).toBeInTheDocument();
    expect(screen.getByText("+10% Bonus")).toBeInTheDocument();
    expect(screen.getByText("Full Refund to Card ($50.00)")).toBeInTheDocument();
  });

  it("submits platform credit selection by default", async () => {
    mockOnSelectChoice.mockResolvedValueOnce({
      success: true,
      choice: "credit",
      credit_amount_cents: 5500,
      bonus_amount_cents: 500,
      new_balance_cents: 5500,
      message: "Credit issued",
    });

    render(
      <EventCancellationRefundChoiceModal
        claim={mockClaim}
        isOpen={true}
        onClose={mockOnClose}
        onSelectChoice={mockOnSelectChoice}
        onSuccess={mockOnSuccess}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /Claim \$55\.00 Credit/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnSelectChoice).toHaveBeenCalledWith("claim-1", "credit");
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(screen.getByText("Platform Credit Issued!")).toBeInTheDocument();
    });
  });

  it("submits card refund option when card radio is selected", async () => {
    mockOnSelectChoice.mockResolvedValueOnce({
      success: true,
      choice: "card",
      original_amount_cents: 5000,
      message: "Card refund initiated",
    });

    render(
      <EventCancellationRefundChoiceModal
        claim={mockClaim}
        isOpen={true}
        onClose={mockOnClose}
        onSelectChoice={mockOnSelectChoice}
        onSuccess={mockOnSuccess}
      />,
    );

    const cardRadio = screen.getByDisplayValue("card");
    fireEvent.click(cardRadio);

    const submitBtn = screen.getByRole("button", { name: /Refund \$50\.00 to Card/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnSelectChoice).toHaveBeenCalledWith("claim-1", "card");
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(screen.getByText("Card Refund Initiated")).toBeInTheDocument();
    });
  });
});
