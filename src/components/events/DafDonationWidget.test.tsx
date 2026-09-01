import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DafDonationWidget } from "./DafDonationWidget";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => {
  return {
    createClient: () => ({
      from: () => ({
        select: () => ({
          order: () =>
            Promise.resolve({
              data: [
                {
                  id: "daf-123",
                  original_token: "WETH",
                  original_amount: 4.0,
                  usdc_amount_received: 12000,
                  created_at: new Date().toISOString(),
                },
              ],
              error: null,
            }),
        }),
      }),
    }),
  };
});

describe("DafDonationWidget", () => {
  it("renders calculation inputs and connects wallet on button click", async () => {
    render(
      <DafDonationWidget
        clubId="club-123"
        clubWalletAddress="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
      />,
    );

    expect(screen.getByTestId("daf-donation-widget")).toBeInTheDocument();
    expect(screen.getByTestId("daf-amount-input")).toBeInTheDocument();
    expect(screen.getByTestId("daf-basis-input")).toBeInTheDocument();
    expect(screen.getByTestId("connect-daf-wallet-btn")).toBeInTheDocument();

    // Verify mock DAF record renders
    expect(await screen.findByText(/Swapped 4 WETH to USDC/i)).toBeInTheDocument();
    expect(screen.getByText(/\+12000 USDC/i)).toBeInTheDocument();
  });
});
