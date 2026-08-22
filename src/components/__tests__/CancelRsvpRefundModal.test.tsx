import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { CancelRsvpRefundModal } from "../events/CancelRsvpRefundModal";
import { processPaidRsvpCancellation } from "@/services/refundCalculatorService";

vi.mock("@/services/refundCalculatorService", async () => {
  const actual = await vi.importActual("@/services/refundCalculatorService");
  return {
    ...actual,
    processPaidRsvpCancellation: vi.fn(),
  };
});

describe("CancelRsvpRefundModal Component (#3688)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders cancellation warning modal with 0% refund ($0) when cancelling 24 hours before event", () => {
    const eventStartTime = new Date(Date.now() + 24 * 3600 * 1000); // 24 hours from now

    render(
      <CancelRsvpRefundModal
        isOpen={true}
        onClose={vi.fn()}
        rsvpId="rsvp-101"
        eventId="event-gala-1"
        userId="user-1"
        eventTitle="Annual Spring Gala"
        eventStartTime={eventStartTime}
        ticketPriceDollars={100}
      />,
    );

    expect(screen.getByTestId("cancel-rsvp-refund-modal")).toBeInTheDocument();
    expect(screen.getByTestId("refund-policy-warning-banner")).toBeInTheDocument();
    expect(screen.getByText(/You are cancelling 24 hours before the event/i)).toBeInTheDocument();
    expect(screen.getAllByText(/0% refund/i)[0]).toBeInTheDocument();
    expect(screen.getByTestId("confirm-cancel-rsvp-btn")).toBeInTheDocument();
  });

  it("triggers processPaidRsvpCancellation when Confirm Cancellation button is clicked", async () => {
    (processPaidRsvpCancellation as any).mockResolvedValue({
      success: true,
      calculation: {
        hours_before_event: 24,
        refund_percentage: 0,
        refund_amount_dollars: 0,
        cancellation_fee_dollars: 100,
        policy_description:
          "You are cancelling 24 hours before the event. Per the policy, you will receive a 0% refund ($0).",
      },
    });

    const mockClose = vi.fn();
    const mockComplete = vi.fn();
    const eventStartTime = new Date(Date.now() + 24 * 3600 * 1000);

    render(
      <CancelRsvpRefundModal
        isOpen={true}
        onClose={mockClose}
        rsvpId="rsvp-101"
        eventId="event-gala-1"
        userId="user-1"
        eventTitle="Annual Spring Gala"
        eventStartTime={eventStartTime}
        ticketPriceDollars={100}
        onCancellationComplete={mockComplete}
      />,
    );

    fireEvent.click(screen.getByTestId("confirm-cancel-rsvp-btn"));

    await waitFor(() => {
      expect(processPaidRsvpCancellation).toHaveBeenCalledWith(
        "rsvp-101",
        "event-gala-1",
        "user-1",
        100,
        expect.anything(),
      );
      expect(mockComplete).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
    });
  });
});
