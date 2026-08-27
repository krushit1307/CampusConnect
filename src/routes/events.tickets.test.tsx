import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import EventDetailsPage from "./events.$eventId";
import EventDashboard from "./events.$eventId.dashboard";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-1", email: "student@campus.edu" } } }),
      getSession: () => Promise.resolve({ data: { session: { access_token: "token-1" } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { id: "event-1", title: "Test Hackathon" } }),
          order: () => Promise.resolve({ data: [] }),
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
      }),
      insert: () => Promise.resolve({ error: null }),
    }),
    channel: () => ({
      on: () => ({
        subscribe: vi.fn(),
      }),
    }),
    removeChannel: vi.fn(),
  }),
}));

// Mock React Query
vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "event_details") {
      return { data: { id: "event-1", title: "Test Hackathon" }, isLoading: false };
    }
    if (queryKey[0] === "event_analytics") {
      return { data: { id: "event-1", title: "Test Hackathon" }, isLoading: false };
    }
    if (queryKey[0] === "event_top_promoters") {
      return { data: [], isLoading: false };
    }
    return { data: null, isLoading: false };
  },
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

describe("Live Support Ticketing System UI (#3344)", () => {
  it("renders Live Support Reporting card on EventDetailsPage", async () => {
    render(
      <BrowserRouter>
        <EventDetailsPage />
      </BrowserRouter>
    );

    // Assert that the Live Support section header is rendered
    expect(await screen.findByText("Event Live Support 🚨")).toBeInTheDocument();
    // Assert quick-report buttons exist
    expect(screen.getByText("🎙️ Mic Broken")).toBeInTheDocument();
    expect(screen.getByText("❄️ Too Cold")).toBeInTheDocument();
  });

  it("renders Live Support Ticketing panel on EventDashboard", async () => {
    render(
      <BrowserRouter>
        <EventDashboard />
      </BrowserRouter>
    );

    // Assert dashboard support cards render
    expect(await screen.findByText("🚨 Live Support Ticketing")).toBeInTheDocument();
    expect(screen.getByText("Open Tickets (0)")).toBeInTheDocument();
    expect(screen.getByText("Resolved Tickets (0)")).toBeInTheDocument();
  });
});
