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
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
      }),
    }),
  }),
}));

// Mock React Query
vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "event_details") {
      return { data: { id: "event-1", title: "Test Hackathon" }, isLoading: false };
    }
    if (queryKey[0] === "event_top_promoters") {
      return {
        data: [
          { referrer_id: "user-1", referrer_name: "Alice Promoter", referrer_handle: "alice", referral_count: 5 },
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

describe("Peer-to-Peer Event Referral System UI (#3294)", () => {
  it("renders Referral Invite Link block on EventDetailsPage", async () => {
    render(
      <BrowserRouter>
        <EventDetailsPage />
      </BrowserRouter>
    );

    // Assert that the Referral section header is rendered
    expect(await screen.findByText("Referral Invite Link 🎁")).toBeInTheDocument();
  });

  it("renders Top Promoters Leaderboard on EventDashboard", async () => {
    render(
      <BrowserRouter>
        <EventDashboard />
      </BrowserRouter>
    );

    // Assert leaderboard headers and mock promoters are shown
    expect(await screen.findByText("🏆 Top Promoters Leaderboard")).toBeInTheDocument();
    expect(screen.getByText("Alice Promoter")).toBeInTheDocument();
    expect(screen.getByText("5 invites")).toBeInTheDocument();
  });
});
