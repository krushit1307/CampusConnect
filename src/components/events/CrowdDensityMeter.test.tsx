import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CrowdDensityMeter } from "./CrowdDensityMeter";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: (name: string, args: any) => {
      if (name === "get_live_density") {
        return Promise.resolve({
          data: [
            {
              checked_in_count: 30,
              square_footage: 600,
              density_ratio: 0.05, // 1 person per 20 sq ft -> Getting Busy
              density_status: "Getting Busy"
            }
          ],
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
    channel: () => ({
      on: () => ({
        subscribe: () => {}
      })
    }),
    removeChannel: () => {}
  })
}));

// Mock React Query
vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: () => ({
    data: {
      checked_in_count: 30,
      square_footage: 600,
      density_ratio: 0.05,
      density_status: "Getting Busy"
    },
    isLoading: false
  })
}));

describe("Real-Time Crowd Density Estimation Meter UI (#3558)", () => {
  it("renders live crowd density metrics, checkin counts and space quotients", async () => {
    render(<CrowdDensityMeter eventId="event-1" />);

    // Verify component headers and status details are present
    expect(screen.getByText("Live Crowd Density")).toBeInTheDocument();
    expect(screen.getByText("Getting Busy")).toBeInTheDocument();

    // Verify checked-in counts and space per person math results
    expect(screen.getByText("Checked-in: 30 people")).toBeInTheDocument();
    expect(screen.getByText("Space per person: ~20 sq ft")).toBeInTheDocument();
  });
});
