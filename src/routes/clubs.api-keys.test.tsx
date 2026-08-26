import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import ClubManageRoute from "./clubs.$slug.manage";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-1", email: "admin@campus.edu" } } }),
      getSession: () => Promise.resolve({ data: { session: { access_token: "token-1" } } }),
    },
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [{ id: "key-1", name: "Discord Key", prefix: "cc_ab12cd", created_at: "2026-08-16T12:00:00Z" }] }),
        eq: () => ({
          single: () => Promise.resolve({ data: { id: "club-1", name: "Coding Club", slug: "coding-club" } }),
        }),
      }),
    }),
  }),
}));

// Mock React Query
vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "club_manage") {
      return {
        data: {
          id: "club-1",
          name: "Coding Club",
          slug: "coding-club",
          club_members: [{ user_id: "user-1", role: "admin", status: "approved" }],
        },
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    if (queryKey[0] === "club_api_keys") {
      return {
        data: [
          { id: "key-1", name: "Discord Key", prefix: "cc_ab12cd", created_at: "2026-08-16T12:00:00Z", last_used_at: null },
        ],
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    return { data: null, isLoading: false, refetch: vi.fn() };
  },
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

describe("ClubManageRoute - Secure API Key Management (#3317)", () => {
  it("renders API Keys sidebar tab and developer panel options correctly", async () => {
    render(
      <BrowserRouter>
        <ClubManageRoute />
      </BrowserRouter>
    );

    // Verify side navigation item is present
    expect(await screen.findByRole("button", { name: "API Keys" })).toBeInTheDocument();
  });
});
