import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DroneMaintenanceLedger } from "../components/equipment/DroneMaintenanceLedger";
import { DroneMaintenanceService } from "../services/droneMaintenanceService";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: "tech-1" } },
  error: null,
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: (table: string) => {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    },
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

vi.mock("sonner", () => ({
  toast: {
    error: (msg: string) => mockToastError(msg),
    success: (msg: string) => mockToastSuccess(msg),
  },
}));

// Mock DroneMaintenanceService
vi.mock("../services/droneMaintenanceService", () => {
  return {
    DroneMaintenanceService: {
      fetchInventoryItemsForClub: vi.fn(),
      fetchMaintenanceLogs: vi.fn(),
      logEquipmentRepair: vi.fn(),
    },
  };
});

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("DroneMaintenanceLedger Component", () => {
  const dummyItems = [
    {
      id: "drone-1",
      name: "Camera Drone v2",
      category: "drones",
      barcode: "SN-DRN-11",
      condition_status: "NEEDS_REPAIR",
      daily_rental_rate: 1500,
    },
  ];

  const dummyLogs = [
    {
      id: "log-1",
      item_id: "drone-1",
      technician_id: "tech-1",
      parts_used: "OEM Carbon Propellers",
      serial_numbers: "SN-PROP-55",
      digital_signature: "John Doe, FAA UAS Tech",
      maintenance_hash: "8f5a6b0c2e...",
      blockchain_tx_hash: "0xtxhash123",
      recorded_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(DroneMaintenanceService.fetchInventoryItemsForClub).mockResolvedValue(dummyItems);
    vi.mocked(DroneMaintenanceService.fetchMaintenanceLogs).mockResolvedValue(dummyLogs);
  });

  it("renders selects, parts inputs, and verified audit history logs", async () => {
    render(<DroneMaintenanceLedger myClubId="club-1" />);

    // Wait for mock data rendering
    await waitFor(() => {
      expect(screen.getByTestId("drone-maintenance-ledger")).toBeInTheDocument();
    });

    expect(screen.getByText("Camera Drone v2 (drones) - NEEDS_REPAIR")).toBeInTheDocument();
    expect(screen.getByText("OEM Carbon Propellers")).toBeInTheDocument();
    expect(screen.getByText("John Doe, FAA UAS Tech")).toBeInTheDocument();
  });

  it("handles form submission and calls blockchain repair logger", async () => {
    vi.mocked(DroneMaintenanceService.logEquipmentRepair).mockResolvedValue({
      success: true,
      log_id: "log-2",
      maintenance_hash: "hash-new",
      blockchain_tx_hash: "tx-new",
    });

    render(<DroneMaintenanceLedger myClubId="club-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("drone-maintenance-ledger")).toBeInTheDocument();
    });

    // Fill form fields
    const partsInput = screen.getByTestId("parts-input");
    const serialsInput = screen.getByTestId("serials-input");
    const signatureInput = screen.getByTestId("signature-input");

    fireEvent.change(partsInput, { target: { value: "Replacement Battery" } });
    fireEvent.change(serialsInput, { target: { value: "BATT-990" } });
    fireEvent.change(signatureInput, { target: { value: "John Doe, FAA Lic 55" } });

    // Submit
    const submitBtn = screen.getByTestId("log-repair-btn");
    fireEvent.submit(screen.getByTestId("parts-input").closest("form")!);

    await waitFor(() => {
      expect(DroneMaintenanceService.logEquipmentRepair).toHaveBeenCalledWith(
        "drone-1",
        "tech-1",
        "Replacement Battery",
        "BATT-990",
        "John Doe, FAA Lic 55"
      );
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("tamper-proof repair payload successfully logged")
      );
    });
  });
});
