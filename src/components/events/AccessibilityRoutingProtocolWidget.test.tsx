import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  AccessibilityRoutingProtocolWidget,
  MOCK_PENDING_REQUEST,
} from "./AccessibilityRoutingProtocolWidget";

describe("AccessibilityRoutingProtocolWidget Component (#4277)", () => {
  it("renders Accessibility Routing Protocol header, locked organizer view, and ticket ID", () => {
    render(
      <AccessibilityRoutingProtocolWidget
        eventTitle="Annual Campus AI Symposium"
        initialRequest={MOCK_PENDING_REQUEST}
      />
    );

    expect(screen.getByText(/Real-Time "Accessibility Need" Routing Protocol — Annual Campus AI Symposium/i)).toBeInTheDocument();
    expect(screen.getByText(/Handled by University Disability Services Admin/i)).toBeInTheDocument();
    expect(screen.getByText("Ticket #DS-9402")).toBeInTheDocument();
  });

  it("displays locked UI banner informing student organizers no action is required", () => {
    render(
      <AccessibilityRoutingProtocolWidget
        eventTitle="Annual Campus AI Symposium"
        initialRequest={MOCK_PENDING_REQUEST}
      />
    );

    expect(screen.getByText(/No action is required on your part\./i)).toBeInTheDocument();
  });

  it("allows Disability Services Admin to enter resolution notes and fulfill ticket", () => {
    const handleFulfill = vi.fn();
    render(
      <AccessibilityRoutingProtocolWidget
        eventTitle="Annual Campus AI Symposium"
        initialRequest={MOCK_PENDING_REQUEST}
        onFulfillRequest={handleFulfill}
      />
    );

    const fulfillBtn = screen.getByRole("button", { name: /Confirm & Fulfill Accommodations/i });
    fireEvent.click(fulfillBtn);

    expect(handleFulfill).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "fulfilled_by_admin",
      })
    );
    expect(screen.getByText(/Fulfillment Confirmed/i)).toBeInTheDocument();
  });
});
