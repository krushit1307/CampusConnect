import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  VendorRfpManager,
  MOCK_INITIAL_RFPS,
  MOCK_INITIAL_BIDS,
} from "./VendorRfpManager";

describe("VendorRfpManager Component (#3559)", () => {
  it("renders Vendor RFP Manager header and submitted vendor proposals", () => {
    render(
      <VendorRfpManager
        clubName="Engineering Society"
        initialRfps={MOCK_INITIAL_RFPS}
        initialBids={MOCK_INITIAL_BIDS}
      />
    );

    expect(screen.getAllByText("Catering for 300-Person Annual Gala Banquet").length).toBeGreaterThan(0);
    expect(screen.getByText("TacoCorp Catering")).toBeInTheDocument();
    expect(screen.getByText(/Saves \$350/i)).toBeInTheDocument(); // $2000 - $1650 = $350
  });

  it("opens create RFP modal", () => {
    render(
      <VendorRfpManager
        clubName="Engineering Society"
        initialRfps={MOCK_INITIAL_RFPS}
      />
    );

    const postBtn = screen.getByRole("button", { name: /Post New RFP/i });
    fireEvent.click(postBtn);

    expect(screen.getByRole("heading", { name: /Post Procurement RFP/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Procurement Job Title \*/i)).toBeInTheDocument();
  });

  it("opens submit vendor quote modal", () => {
    render(
      <VendorRfpManager
        clubName="Engineering Society"
        initialRfps={MOCK_INITIAL_RFPS}
      />
    );

    const quoteBtn = screen.getByRole("button", { name: /Submit Vendor Quote/i });
    fireEvent.click(quoteBtn);

    expect(screen.getByRole("heading", { name: /Submit Vendor Quote/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Vendor \/ Business Name \*/i)).toBeInTheDocument();
  });

  it("accepts winning bid and updates RFP status", () => {
    const handleAccept = vi.fn();
    render(
      <VendorRfpManager
        clubName="Engineering Society"
        initialRfps={MOCK_INITIAL_RFPS}
        initialBids={MOCK_INITIAL_BIDS}
        onBidAccepted={handleAccept}
      />
    );

    const acceptButtons = screen.getAllByRole("button", { name: /Accept Bid/i });
    fireEvent.click(acceptButtons[0]);

    expect(handleAccept).toHaveBeenCalledWith("rfp-1", "bid-1");
    expect(screen.getByText(/Bid awarded to TacoCorp Catering/i)).toBeInTheDocument();
  });
});
