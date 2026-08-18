import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import AnalyticsAdmin from "./admin.analytics";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-1" } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { role: "system_admin" } }),
        }),
        order: () => Promise.resolve({ data: [{ id: "sem-1", name: "Fall 2026" }] }),
      }),
    }),
    rpc: () => Promise.resolve({
      data: [
        { day_of_week: 1, hour_of_day: 10, concurrent_events: 5, total_attendees: 120 },
      ],
    }),
  }),
}));

// Mock React Query
vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "admin_semesters") {
      return { data: [{ id: "sem-1", name: "Fall 2026" }], isLoading: false };
    }
    if (queryKey[0] === "event_collision_matrix") {
      return {
        data: [
          { day_of_week: 1, hour_of_day: 10, concurrent_events: 5, total_attendees: 120 },
        ],
        isLoading: false,
      };
    }
    return { data: null, isLoading: false };
  },
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

describe("AnalyticsAdmin - Automated Event Collision Matrix (#3320)", () => {
  it("renders the Collision Matrix card component successfully", async () => {
    render(
      <BrowserRouter>
        <AnalyticsAdmin />
      </BrowserRouter>
    );

    // Verify main header title
    expect(await screen.findByText("Automated Event Collision Matrix")).toBeInTheDocument();
    // Verify that day names are rendered
    expect(screen.getByText("Monday")).toBeInTheDocument();
    expect(screen.getByText("Sunday")).toBeInTheDocument();
  });
});
