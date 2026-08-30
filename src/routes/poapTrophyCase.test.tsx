import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PoapTrophyCase } from "../components/gamification/PoapTrophyCase";
import { PoapService } from "../services/poapService";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockGetProfile = vi.fn().mockResolvedValue({
  data: { wallet_address: "0x1234567890123456789012345678901234567890" },
  error: null,
});

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: mockGetProfile,
            }),
          }),
        };
      }
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

// Mock PoapService
vi.mock("../services/poapService", () => {
  return {
    PoapService: {
      fetchUserClaims: vi.fn(),
      saveWalletAddress: vi.fn(),
      runSimulatedWorker: vi.fn(),
    },
  };
});

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("PoapTrophyCase Component", () => {
  const dummyClaims = [
    {
      id: "claim-1",
      poap_event_id: "poap-event-1",
      user_id: "user-1",
      wallet_address: "0x1234567890123456789012345678901234567890",
      token_id: "12345",
      transaction_hash: "0xtxhash",
      minted_at: new Date().toISOString(),
      poap_events: {
        id: "poap-event-1",
        event_id: "event-1",
        poap_id: 8899,
        badge_title: "Prestige Graduate",
        badge_image_url: "https://poap.gallery/image.png",
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(PoapService.fetchUserClaims).mockResolvedValue(dummyClaims);
  });

  it("renders wooden shelf layout, user wallet, and verified badges", async () => {
    render(<PoapTrophyCase userId="user-1" isOwnProfile={true} />);

    // Wait for mock data rendering
    await waitFor(() => {
      expect(screen.getByTestId("poap-trophy-case")).toBeInTheDocument();
    });

    expect(screen.getByText("Prestige Graduate")).toBeInTheDocument();
    expect(screen.getByText(/0x1234567890123456789012345678901234567890/i)).toBeInTheDocument();
  });

  it("handles wallet input changes and updates profiles", async () => {
    vi.mocked(PoapService.saveWalletAddress).mockResolvedValue(true);

    render(<PoapTrophyCase userId="user-1" isOwnProfile={true} />);

    await waitFor(() => {
      expect(screen.getByTestId("poap-trophy-case")).toBeInTheDocument();
    });

    // Open wallet edit form
    const editBtn = screen.getByTestId("edit-wallet-btn");
    fireEvent.click(editBtn);

    // Modify wallet input
    const walletInput = screen.getByTestId("wallet-input") as HTMLInputElement;
    fireEvent.change(walletInput, { target: { value: "0x0000000000000000000000000000000000000000" } });

    // Save
    const saveBtn = screen.getByTestId("save-wallet-btn");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(PoapService.saveWalletAddress).toHaveBeenCalledWith(
        "user-1",
        "0x0000000000000000000000000000000000000000"
      );
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("wallet address successfully linked")
      );
    });
  });

  it("runs background worker simulating SQS mint queue validations", async () => {
    vi.mocked(PoapService.runSimulatedWorker).mockResolvedValue(1);

    render(<PoapTrophyCase userId="user-1" isOwnProfile={true} />);

    await waitFor(() => {
      expect(screen.getByTestId("poap-trophy-case")).toBeInTheDocument();
    });

    const runWorkerBtn = screen.getByTestId("run-poap-worker-btn");
    fireEvent.click(runWorkerBtn);

    await waitFor(() => {
      expect(PoapService.runSimulatedWorker).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Successfully processed 1 pending POAP NFT claims")
      );
    });
  });
});
