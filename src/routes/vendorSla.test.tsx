import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { VendorEscrowViewer } from "../components/vendors/VendorEscrowViewer";
import { VendorSlaService } from "../services/vendorSlaService";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: () => ({
        subscribe: vi.fn(),
      }),
    }),
    removeChannel: vi.fn(),
  }),
}));

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastInfo = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (msg: string) => mockToastError(msg),
    success: (msg: string) => mockToastSuccess(msg),
    info: (msg: string) => mockToastInfo(msg),
  },
}));

// Mock VendorSlaService
vi.mock("../services/vendorSlaService", () => {
  return {
    VendorSlaService: {
      fetchContractsForClub: vi.fn(),
      executeSlaPayout: vi.fn(),
      configureSlaContract: vi.fn(),
    },
  };
});

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("VendorEscrowViewer SLA integration", () => {
  const dummyContracts = [
    {
      id: "contract-1",
      club_id: "club-1",
      vendor_name: "Pizza Plaza",
      amount: 100.00,
      delivery_deadline: new Date(Date.now() + 2 * 3600000).toISOString(),
      gps_arrival_time: null,
      min_temp_limit: 140.00,
      min_recorded_temp: null,
      slashed_amount: 0.00,
      oracle_sig: null,
      status: "PENDING" as const,
      created_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(VendorSlaService.fetchContractsForClub).mockResolvedValue(dummyContracts);
  });

  it("renders vendor name, SLA parameters, and interactive payout panel", async () => {
    render(<VendorEscrowViewer clubId="club-1" />);

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByTestId("vendor-escrow-viewer")).toBeInTheDocument();
    });

    expect(screen.getByText("Pizza Plaza")).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
    expect(screen.getByText(/Min Temp \ge 140°F/)).toBeInTheDocument();
  });

  it("triggers simulated payout with a cold temperature resulting in a 50% slash", async () => {
    vi.mocked(VendorSlaService.executeSlaPayout).mockResolvedValue({
      success: true,
      payout_status: "SLASHED",
      amount_paid: 50.00,
      amount_slashed: 50.00,
      reason: "SLA Violation: Food temperature fell below 140°F threshold.",
    });

    render(<VendorEscrowViewer clubId="club-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("vendor-escrow-viewer")).toBeInTheDocument();
    });

    // Simulate inputting cold temperature
    const tempInput = screen.getByTestId("sim-temp-input-contract-1");
    fireEvent.change(tempInput, { target: { value: 120 } });

    // Execute payout trigger
    const executeBtn = screen.getByTestId("execute-payout-btn-contract-1");
    fireEvent.click(executeBtn);

    await waitFor(() => {
      expect(VendorSlaService.executeSlaPayout).toHaveBeenCalledWith(
        "contract-1",
        expect.any(String),
        120,
        "consensus-sla-oracle-signature-v1"
      );
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining("SLA VIOLATION: Food was cold ($50.00 slashed & refunded)")
      );
    });
  });
});
