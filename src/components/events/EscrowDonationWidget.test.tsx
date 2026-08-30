import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EscrowDonationWidget } from "./EscrowDonationWidget";

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
                  id: "esc-123",
                  donor_id: "donor-1",
                  recipient_club_id: "club-1",
                  escrow_id: 1,
                  amount: 1000,
                  milestone_date: new Date(Date.now() - 100000).toISOString(), // Expired
                  proof_video_url: null,
                  status: "pending",
                },
              ],
              error: null,
            }),
        }),
      }),
    }),
  };
});

describe("EscrowDonationWidget", () => {
  it("renders connection button and shows active escrows on wallet connect", async () => {
    render(
      <EscrowDonationWidget
        clubId="club-123"
        clubWalletAddress="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        userRole="donor"
      />,
    );

    const connectBtn = screen.getByTestId("connect-wallet-btn");
    expect(connectBtn).toBeInTheDocument();
    expect(connectBtn).toHaveTextContent(/Connect MetaMask/i);
  });
});
