import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import ScavengerHuntsList from "./scavenger-hunts";
import ScavengerHuntGame from "./scavenger-hunts.$id";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-1", email: "student@campus.edu" } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { id: "hunt-1", title: "Freshman Orientation Hunt", description: "Find the landmarks!" } }),
        }),
      }),
    }),
    rpc: () => Promise.resolve({
      data: {
        completed_steps: 2,
        total_steps: 5,
        is_completed: false,
        next_clue: "Seek the clock tower where time stands still.",
      },
    }),
  }),
}));

// Mock React Query
vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "scavenger_hunts_list") {
      return {
        data: [
          {
            id: "hunt-1",
            title: "Freshman Orientation Hunt",
            description: "Find the landmarks!",
            hunt_waypoints: [{ id: "wp-1" }, { id: "wp-2" }],
          },
        ],
        isLoading: false,
      };
    }
    if (queryKey[0] === "scavenger_hunt_detail") {
      return {
        data: { id: "hunt-1", title: "Freshman Orientation Hunt", description: "Find the landmarks!" },
        isLoading: false,
      };
    }
    if (queryKey[0] === "scavenger_hunt_progress") {
      return {
        data: {
          completed_steps: 2,
          total_steps: 5,
          is_completed: false,
          next_clue: "Seek the clock tower where time stands still.",
        },
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    return { data: null, isLoading: false };
  },
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

describe("Scavenger Hunts Engine UI (#3338)", () => {
  it("renders ScavengerHuntsList with active hunts card", async () => {
    render(
      <BrowserRouter>
        <ScavengerHuntsList />
      </BrowserRouter>
    );

    // Verify page header
    expect(await screen.findByText("Campus Scavenger Hunts")).toBeInTheDocument();
    // Verify mock hunt title is displayed
    expect(screen.getByText("Freshman Orientation Hunt")).toBeInTheDocument();
    expect(screen.getByText("2 Waypoints")).toBeInTheDocument();
  });

  it("renders ScavengerHuntGame active clue and scan handlers", async () => {
    render(
      <BrowserRouter>
        <ScavengerHuntGame />
      </BrowserRouter>
    );

    // Verify hunt detail header is present
    expect(await screen.findByText("Freshman Orientation Hunt")).toBeInTheDocument();
    // Verify current active clue renders
    expect(screen.getByText("Current Clue: Waypoint #3")).toBeInTheDocument();
    expect(screen.getByText("Seek the clock tower where time stands still.")).toBeInTheDocument();
    // Verify QR scan button is present
    expect(screen.getByRole("button", { name: "Simulate Camera Scanner" })).toBeInTheDocument();
  });
});
