// =============================================================================
// Tests: AliasInheritancePrompt (#4425)
// The successor-facing "Do you want to inherit the 'president@' alias?" prompt.
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AliasInheritancePrompt, AliasOfferView } from "./AliasInheritancePrompt";

const OFFERS: AliasOfferView[] = [
  {
    offerId: "offer-1",
    aliasAddress: "president@techclub.campusconnect.edu",
    roleTitle: "President",
    outgoingHolderName: "Aarav Sharma",
    expiresAt: "2026-09-07T00:00:00.000Z",
  },
  {
    offerId: "offer-2",
    aliasAddress: "treasurer@techclub.campusconnect.edu",
    roleTitle: "Treasurer",
    outgoingHolderName: "Rohan Mehta",
    expiresAt: "2026-09-07T00:00:00.000Z",
  },
];

describe("AliasInheritancePrompt (#4425)", () => {
  it("renders nothing when there are no pending offers", () => {
    const { container } = render(<AliasInheritancePrompt offers={[]} onDecide={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("asks the successor whether they want to inherit each alias", () => {
    render(<AliasInheritancePrompt offers={OFFERS} onDecide={vi.fn()} />);

    expect(screen.getByTestId("alias-inheritance-prompt")).toBeInTheDocument();
    expect(screen.getByText(/president@techclub\.campusconnect\.edu/)).toBeInTheDocument();
    expect(screen.getByText(/treasurer@techclub\.campusconnect\.edu/)).toBeInTheDocument();

    // The exact question from #4425, per alias.
    expect(screen.getByText(/do you want to inherit the ‘president’ alias\?/i)).toBeInTheDocument();
    expect(screen.getByText(/do you want to inherit the ‘treasurer’ alias\?/i)).toBeInTheDocument();
  });

  it("reports both decisions back to the caller", () => {
    const onDecide = vi.fn();
    render(<AliasInheritancePrompt offers={OFFERS} onDecide={onDecide} />);

    fireEvent.click(screen.getByTestId("alias-accept-offer-1"));
    fireEvent.click(screen.getByTestId("alias-decline-offer-2"));

    expect(onDecide).toHaveBeenNthCalledWith(1, "offer-1", "ACCEPTED");
    expect(onDecide).toHaveBeenNthCalledWith(2, "offer-2", "DECLINED");
  });
});
