import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScavengerHuntWidget } from "./ScavengerHuntWidget";
import { useSupabaseSubscription } from "@/hooks/useSupabaseSubscription";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => {
  const rpcMock = vi.fn();
  return {
    createClient: () => ({
      rpc: rpcMock,
    }),
  };
});

vi.mock("@/hooks/useSupabaseSubscription", () => ({
  useSupabaseSubscription: vi.fn(),
}));

// Provide a mock for geolocation
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
};

Object.defineProperty(global.navigator, "geolocation", {
  value: mockGeolocation,
  configurable: true,
});

describe("ScavengerHuntWidget (#4043)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loader initially", () => {
    (createClient().rpc as any).mockReturnValue(new Promise(() => {})); // pending promise
    render(<ScavengerHuntWidget eventId="test-1" />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders nothing if not a scavenger hunt or no steps", async () => {
    (createClient().rpc as any).mockResolvedValue({
      data: { success: false, message: "Not found", total_steps: 0 },
      error: null,
    });

    const { container } = render(<ScavengerHuntWidget eventId="test-1" />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("renders the clue when active", async () => {
    (createClient().rpc as any).mockImplementation(async (method: string) => {
      if (method === "get_current_scavenger_hunt_clue") {
        return {
          data: {
            success: true,
            is_completed: false,
            completed_steps: 0,
            total_steps: 3,
            clue_text: "Find the hidden fountain.",
          },
          error: null,
        };
      }
      if (method === "get_scavenger_hunt_leaderboard") {
        return { data: [], error: null };
      }
    });

    render(<ScavengerHuntWidget eventId="test-1" />);

    await waitFor(() => {
      expect(screen.getByText("Find the hidden fountain.")).toBeInTheDocument();
      expect(screen.getByText("Step 1 / 3")).toBeInTheDocument();
    });
  });

  it("handles geolocation error", async () => {
    (createClient().rpc as any).mockImplementation(async (method: string) => {
      if (method === "get_current_scavenger_hunt_clue") {
        return {
          data: {
            success: true,
            is_completed: false,
            completed_steps: 0,
            total_steps: 3,
            clue_text: "Find the hidden fountain.",
          },
          error: null,
        };
      }
      return { data: [], error: null };
    });

    mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
      error({ code: 1, PERMISSION_DENIED: 1 });
    });

    render(<ScavengerHuntWidget eventId="test-1" />);

    await waitFor(() => {
      expect(screen.getByText("Verify My Location")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Verify My Location"));

    await waitFor(() => {
      expect(
        screen.getByText("Location permission denied. Please allow location access to play."),
      ).toBeInTheDocument();
    });
  });
});
