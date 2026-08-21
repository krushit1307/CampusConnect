import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import EventDashboard from "./events.$eventId.dashboard";
import ClubManageRoute from "./clubs.$slug.manage";

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
          single: () => Promise.resolve({ data: { id: "club-1", name: "Coding Club", slug: "coding-club" } }),
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
    rpc: () => Promise.resolve({ data: [] }),
  }),
}));

// Mock React Query
vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "google_sheets_integration") {
      return { data: { id: "int-1", updated_at: "2026-08-16T12:00:00Z" }, isLoading: false };
    }
    if (queryKey[0] === "event_analytics") {
      return { data: { id: "event-1", title: "Sheets Event" }, isLoading: false };
    }
    if (queryKey[0] === "club_manage") {
      return { data: { id: "club-1", name: "Coding Club" }, isLoading: false };
    }
    return { data: null, isLoading: false };
  },
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

describe("Google Sheets Integration UI (#3335)", () => {
  it("renders Google Sheets Live Sync widget on EventDashboard", async () => {
    render(
      <BrowserRouter>
        <EventDashboard />
      </BrowserRouter>
    );

    // Assert that the Google Sheets Sync panel header is rendered
    expect(await screen.findByText("Google Sheets Live Sync 📊")).toBeInTheDocument();
  });

  it("renders Google Sheets Integration card in ClubManageRoute settings tab", async () => {
    render(
      <BrowserRouter>
        <ClubManageRoute />
      </BrowserRouter>
    );

    // Assert that Google Sheets Card header in Club Settings renders
    expect(await screen.findByText("Google Sheets Integration 📊")).toBeInTheDocument();
    expect(screen.getByText("Connected with Google Sheets ✅")).toBeInTheDocument();
  });
});
