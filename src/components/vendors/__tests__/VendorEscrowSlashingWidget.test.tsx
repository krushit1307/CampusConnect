import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { VendorEscrowSlashingWidget } from "../VendorEscrowSlashingWidget";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      insert: () => Promise.resolve({ data: null, error: null }),
    }),
  }),
}));

describe("VendorEscrowSlashingWidget Component", () => {
  it("renders contract title, vendor name, and total escrow budget", () => {
    render(
      <VendorEscrowSlashingWidget
        contractId="ctr-test-1"
        initialContract={{
          eventName: "Spring Music Fest",
          vendorName: "Apex Lighting Systems",
          totalEscrowAmount: 2500,
        }}
      />,
    );

    expect(screen.getByText("Vendor Escrow Slashing Controls")).toBeInTheDocument();
    expect(screen.getByText("Spring Music Fest")).toBeInTheDocument();
    expect(screen.getByText("Apex Lighting Systems")).toBeInTheDocument();
    expect(screen.getByText("$2,500")).toBeInTheDocument();
  });

  it("updates real-time preview when quick delay buttons are clicked", () => {
    render(
      <VendorEscrowSlashingWidget
        contractId="ctr-test-2"
        initialContract={{ totalEscrowAmount: 1000 }}
      />,
    );

    const btn60m = screen.getByRole("button", { name: "+60m" });
    fireEvent.click(btn60m);

    expect(screen.getByText("60 Minutes")).toBeInTheDocument();
    expect(screen.getByText("Slashing Penalty: 50%")).toBeInTheDocument();
  });

  it("opens confirmation modal when enforce button is clicked", () => {
    render(
      <VendorEscrowSlashingWidget
        contractId="ctr-test-3"
        initialContract={{ totalEscrowAmount: 1000 }}
      />,
    );

    const executeBtn = screen.getByTestId("execute-slashing-btn");
    fireEvent.click(executeBtn);

    expect(screen.getByText("Confirm Escrow Penalty")).toBeInTheDocument();
    expect(screen.getByTestId("confirm-slashing-submit-btn")).toBeInTheDocument();
  });

  it("executes slashing transaction when confirmed in modal", async () => {
    render(
      <VendorEscrowSlashingWidget
        contractId="ctr-test-4"
        initialContract={{ totalEscrowAmount: 1000, vendorName: "DJ Pulse" }}
      />,
    );

    const executeBtn = screen.getByTestId("execute-slashing-btn");
    fireEvent.click(executeBtn);

    const confirmBtn = screen.getByTestId("confirm-slashing-submit-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Slashed/i)).toBeInTheDocument();
    });
  });
});
