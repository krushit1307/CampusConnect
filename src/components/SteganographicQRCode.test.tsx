import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SteganographicQRCode } from "./SteganographicQRCode";
import { useState } from "react";

// Mock signTicketPayload and embedLSBData if needed
vi.mock("@/lib/steganography", () => ({
  signTicketPayload: vi.fn().mockResolvedValue({
    rsvpId: "rsvp-123",
    timestamp: Date.now(),
    signature: "mock-signature-1234567890",
  }),
  embedLSBData: vi.fn().mockImplementation((imageData) => imageData),
}));

describe("SteganographicQRCode Component", () => {
  it("renders correctly and displays download button", async () => {
    render(<SteganographicQRCode rsvpId="rsvp-123" />);

    expect(screen.getByText("Hidden LSB Signature Active")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download Authentic Ticket/i })).toBeInTheDocument();
  });

  it("does not cause an infinite re-render loop when passed an unmemoized callback", async () => {
    let renderCount = 0;
    const payloadHandlerCount = vi.fn();

    function ParentWrapper() {
      const [, setState] = useState(0);
      renderCount++;

      return (
        <SteganographicQRCode
          rsvpId="rsvp-123"
          onPayloadGenerated={(payload) => {
            payloadHandlerCount(payload);
            // Trigger state change in parent to mimic inline function re-render
            setState((prev) => prev + 1);
          }}
        />
      );
    }

    render(<ParentWrapper />);

    await waitFor(() => {
      expect(payloadHandlerCount).toHaveBeenCalled();
    });

    // Verify render count does not blow up (infinite loop would exceed maximum update depth or thousands of renders)
    expect(renderCount).toBeLessThan(10);
  });
});
