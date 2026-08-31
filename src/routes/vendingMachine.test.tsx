import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { VendingMachineIntegration } from "../components/events/VendingMachineIntegration";
import { VendingMachineService } from "../services/vendingMachineService";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    channel: () => ({
      on: () => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      }),
    }),
    removeChannel: vi.fn(),
  },
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

// Mock VendingMachineService
vi.mock("../services/vendingMachineService", () => {
  return {
    VendingMachineService: {
      fetchAllocationForEvent: vi.fn(),
      fetchOrCreateUserCredit: vi.fn(),
      dispenseVendingItem: vi.fn(),
      createVendingAllocation: vi.fn(),
      fetchDispenseLogsForCredit: vi.fn(),
    },
  };
});

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("VendingMachineIntegration Component", () => {
  const dummyAllocation = {
    id: "alloc-1",
    event_id: "event-1",
    allocated_amount: 500,
    spent_amount: 150,
    per_user_limit: 10,
    created_at: new Date().toISOString(),
  };

  const dummyCredit = {
    id: "credit-1",
    allocation_id: "alloc-1",
    user_id: "user-1",
    spent_balance: 2.50,
    qr_code_token: "qr-token-hack-123",
    expires_at: new Date(Date.now() + 24 * 3600000).toISOString(),
    created_at: new Date().toISOString(),
  };

  const dummyLogs = [
    {
      id: "log-1",
      credit_id: "credit-1",
      vending_machine_id: "VEND-CAMPUS-HUB-1",
      product_name: "Snickers Bar",
      amount_deducted: 2.50,
      dispensed_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(VendingMachineService.fetchAllocationForEvent).mockResolvedValue(dummyAllocation);
    vi.mocked(VendingMachineService.fetchOrCreateUserCredit).mockResolvedValue(dummyCredit);
    vi.mocked(VendingMachineService.fetchDispenseLogsForCredit).mockResolvedValue(dummyLogs);
  });

  it("renders vending credits, QR code container, and simulated dispense buttons", async () => {
    render(<VendingMachineIntegration eventId="event-1" userId="user-1" isOrganizer={false} />);

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByTestId("vending-integration-card")).toBeInTheDocument();
    });

    expect(screen.getByText("$7.50")).toBeInTheDocument(); // $10 limit - $2.50 spent
    expect(screen.getByTestId("vending-qr-container")).toBeInTheDocument();
    expect(screen.getByText("Snickers Bar")).toBeInTheDocument();
  });

  it("allows organizers to configure new budget allocations", async () => {
    vi.mocked(VendingMachineService.fetchAllocationForEvent).mockResolvedValue(null);
    vi.mocked(VendingMachineService.createVendingAllocation).mockResolvedValue({
      id: "alloc-2",
      event_id: "event-1",
      allocated_amount: 500,
      spent_amount: 0,
      per_user_limit: 10,
      created_at: new Date().toISOString(),
    });

    render(<VendingMachineIntegration eventId="event-1" userId="user-1" isOrganizer={true} />);

    await waitFor(() => {
      expect(screen.getByTestId("vending-integration-card")).toBeInTheDocument();
    });

    const configBtn = screen.getByTestId("configure-allocation-btn");
    fireEvent.click(configBtn);

    await waitFor(() => {
      expect(VendingMachineService.createVendingAllocation).toHaveBeenCalledWith("event-1", 500, 10);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("allocation successfully created")
      );
    });
  });

  it("triggers simulated POS vending dispense scan actions", async () => {
    vi.mocked(VendingMachineService.dispenseVendingItem).mockResolvedValue({
      success: true,
      product_name: "Snickers Bar",
      amount_deducted: 2.50,
      remaining_credit: 5.00,
    });

    render(<VendingMachineIntegration eventId="event-1" userId="user-1" isOrganizer={false} />);

    await waitFor(() => {
      expect(screen.getByTestId("vending-integration-card")).toBeInTheDocument();
    });

    const triggerBtn = screen.getByTestId("simulate-dispense-btn");
    fireEvent.click(triggerBtn);

    await waitFor(() => {
      expect(VendingMachineService.dispenseVendingItem).toHaveBeenCalledWith(
        "qr-token-hack-123",
        "VEND-CAMPUS-HUB-1",
        "Snickers Bar",
        2.50
      );
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Dispensed Snickers Bar")
      );
    });
  });
});
