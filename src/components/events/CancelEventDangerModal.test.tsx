import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CancelEventDangerModal } from "./CancelEventDangerModal";
import { FILE_CLAIM_PROMPT } from "../../lib/eventInsuranceClaim";

const getEventInsurancePolicyId = vi.fn();
const cancelEventAndRefund = vi.fn();
const processBatchRefunds = vi.fn();

vi.mock("../../services/eventCancellationService", () => ({
  validateCancellationConfirmation: (title: string, typed: string) =>
    typed.trim().toUpperCase() === `CANCEL ${title.trim()}`.toUpperCase(),
  getEventInsurancePolicyId: (...args: unknown[]) => getEventInsurancePolicyId(...args),
  cancelEventAndRefund: (...args: unknown[]) => cancelEventAndRefund(...args),
  processBatchRefunds: (...args: unknown[]) => processBatchRefunds(...args),
}));

describe("CancelEventDangerModal insurance claim (#4727)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processBatchRefunds.mockResolvedValue({ success: true, processed: 0 });
    cancelEventAndRefund.mockResolvedValue({ success: true, total_rsvps_cancelled: 0 });
  });

  it("uses a reason dropdown and prompts to file a claim when a policy is active", async () => {
    getEventInsurancePolicyId.mockResolvedValue("pol_next_123");

    render(
      <CancelEventDangerModal
        eventId="evt-1"
        eventTitle="Winter Festival"
        isOpen
        onClose={() => undefined}
      />,
    );

    expect(screen.getByLabelText("Reason for Cancellation")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Severe Weather" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Venue Damage" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText(FILE_CLAIM_PROMPT)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(FILE_CLAIM_PROMPT));
    fireEvent.change(screen.getByPlaceholderText(/Type: CANCEL WINTER FESTIVAL/i), {
      target: { value: "CANCEL WINTER FESTIVAL" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Cancel Event & Refund All/i }));

    await waitFor(() => {
      expect(cancelEventAndRefund).toHaveBeenCalledWith(
        "evt-1",
        "Severe Weather",
        "Winter Festival",
        true,
      );
    });
  });

  it("does not show the claim prompt when the club has no policy", async () => {
    getEventInsurancePolicyId.mockResolvedValue(null);

    render(
      <CancelEventDangerModal
        eventId="evt-2"
        eventTitle="Club Mixer"
        isOpen
        onClose={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(getEventInsurancePolicyId).toHaveBeenCalledWith("evt-2");
    });
    expect(screen.queryByLabelText(FILE_CLAIM_PROMPT)).not.toBeInTheDocument();
  });
});
