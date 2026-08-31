import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LosslessYieldDonationDashboard } from "../components/finance/LosslessYieldDonationDashboard";
import { DefiLeverageService } from "../services/defiLeverageService";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockGetUser = vi.fn().mockResolvedValue({
  data: {
    user: { id: "user-123" },
  },
  error: null,
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => ({
      select: () => ({
        single: vi.fn().mockResolvedValue({ data: { id: "donation-123" }, error: null }),
      }),
      insert: () => ({
        select: () => ({
          single: vi.fn().mockResolvedValue({ data: { id: "donation-123" }, error: null }),
        }),
      }),
    }),
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

// Mock DefiLeverageService
vi.mock("../services/defiLeverageService", () => {
  return {
    DefiLeverageService: {
      fetchDonations: vi.fn(),
      simulateLeverage: vi.fn(),
    },
  };
});

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("LosslessYieldDonationDashboard Component", () => {
  const dummyDonations = [
    {
      id: "donation-123",
      donor_id: "user-123",
      club_id: "club-123",
      contract_address: "0xDeFiMockContract",
      principal_locked_usdc: 1000000.00,
      total_yield_harvested_usdc: 4500.00,
      apy_rate: 5.0,
      status: "ACTIVE" as const,
      created_at: new Date().toISOString(),
      collateral_asset: "ETH",
      collateral_amount: 333.33,
      debt_amount_dai: 500000.00,
      is_leveraged: true,
      liquidation_ratio: 150.00,
      liquidation_price: 2250.00,
      tax_savings_usd: 208250.00,
      leverage_multiplier: 1.5,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(DefiLeverageService.fetchDonations).mockResolvedValue(dummyDonations);
  });

  it("renders locked collateral assets, borrow inputs, APY rates, and tax savings", async () => {
    render(<LosslessYieldDonationDashboard />);

    // Wait for component to resolve mock database mount
    await waitFor(() => {
      expect(screen.getByTestId("defi-yield-dashboard")).toBeInTheDocument();
    });

    expect(screen.getByText("ETH (Ethereum)")).toBeInTheDocument();
    expect(screen.getByText("$208,250.00")).toBeInTheDocument();
    expect(screen.getByText("1.50x")).toBeInTheDocument();
  });

  it("simulates MakerDAO stablecoin borrowing, updating liquidation prices and leverage details", async () => {
    vi.mocked(DefiLeverageService.simulateLeverage).mockResolvedValue({
      success: true,
      collateral_value: 1200000.00,
      liquidation_price: 2500.00,
      tax_savings: 250000.00,
      leverage_multiplier: 1.6,
    });

    render(<LosslessYieldDonationDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("defi-yield-dashboard")).toBeInTheDocument();
    });

    // Modify inputs
    const collateralInput = screen.getByTestId("collateral-qty-input");
    fireEvent.change(collateralInput, { target: { value: 400 } });

    const borrowInput = screen.getByTestId("dai-borrow-input");
    fireEvent.change(borrowInput, { target: { value: 600000 } });

    // Click lock & leverage button
    const leverageBtn = screen.getByTestId("simulate-leverage-btn");
    fireEvent.click(leverageBtn);

    await waitFor(() => {
      expect(DefiLeverageService.simulateLeverage).toHaveBeenCalledWith(
        "donation-123",
        400,
        600000,
        3000
      );
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("MakerDAO CDP vault updated")
      );
    });
  });
});
