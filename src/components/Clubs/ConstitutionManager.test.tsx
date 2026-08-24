import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConstitutionManager } from "./ConstitutionManager";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockAmendments = [
  {
    id: "amend-1",
    club_id: "club-123",
    title: "Change Treasurer Term",
    description: "Extend Treasurer term from 1 year to 2 years.",
    original_text: "Treasurer term shall be 1 year.",
    proposed_text: "Treasurer term shall be 2 years.",
    status: "PENDING",
    created_by: "user-123",
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000 * 7).toISOString(),
    amendment_votes: [{ id: "v-1", amendment_id: "amend-1", user_id: "user-999", vote: true }],
  },
];

const rpcMock = vi.fn().mockImplementation((fnName: string, args: any) => {
  if (fnName === "cast_amendment_vote") {
    return Promise.resolve({
      data: { success: true, message: "Vote cast successfully!", yes_votes: 2, no_votes: 0 },
      error: null,
    });
  }
  if (fnName === "close_amendment_voting") {
    return Promise.resolve({
      data: { success: true, status: "PASSED", message: "Amendment passed and merged!" },
      error: null,
    });
  }
  return Promise.resolve({ data: null, error: null });
});

const selectMock = vi.fn().mockImplementation((table: string) => {
  if (table === "constitution_amendments") {
    return {
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: mockAmendments, error: null }),
        }),
      }),
    };
  }
  return {
    select: vi.fn().mockReturnSelf(),
  };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: rpcMock,
    from: selectMock,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-123", email: "student@test.edu" } },
      }),
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("ConstitutionManager Amendment Voting Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Amendments Voting button when constitution version exists", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ConstitutionManager
          clubId="club-123"
          isOrganizer={true}
          currentVersion={1}
          currentFileUrl="club-123/file.pdf"
          clubName="Chess Club"
        />
      </QueryClientProvider>,
    );

    const amendmentsBtn = screen.getByTestId("amendments-voting-btn");
    expect(amendmentsBtn).toBeInTheDocument();
  });

  it("opens the amendments modal and displays proposed amendments", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ConstitutionManager
          clubId="club-123"
          isOrganizer={true}
          currentVersion={1}
          currentFileUrl="club-123/file.pdf"
          clubName="Chess Club"
        />
      </QueryClientProvider>,
    );

    const amendmentsBtn = screen.getByTestId("amendments-voting-btn");
    fireEvent.click(amendmentsBtn);

    // Verify modal title
    expect(await screen.findByText("Constitution Amendments")).toBeInTheDocument();

    // Verify proposed amendment title
    expect(await screen.findByText("Change Treasurer Term")).toBeInTheDocument();
  });

  it("allows organizers to propose new amendments", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ConstitutionManager
          clubId="club-123"
          isOrganizer={true}
          currentVersion={1}
          currentFileUrl="club-123/file.pdf"
          clubName="Chess Club"
        />
      </QueryClientProvider>,
    );

    const amendmentsBtn = screen.getByTestId("amendments-voting-btn");
    fireEvent.click(amendmentsBtn);

    const proposeBtn = await screen.findByRole("button", { name: /Propose Amendment/i });
    fireEvent.click(proposeBtn);

    expect(
      screen.getByPlaceholderText(/e.g. Extend Treasurer's Term to 2 Years/i),
    ).toBeInTheDocument();
  });

  it("supports voting YES/NO and calls cast_amendment_vote RPC", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ConstitutionManager
          clubId="club-123"
          isOrganizer={false}
          currentVersion={1}
          currentFileUrl="club-123/file.pdf"
          clubName="Chess Club"
        />
      </QueryClientProvider>,
    );

    const amendmentsBtn = screen.getByTestId("amendments-voting-btn");
    fireEvent.click(amendmentsBtn);

    const yesBtn = await screen.findByRole("button", { name: "Yes" });
    fireEvent.click(yesBtn);

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("cast_amendment_vote", {
        p_amendment_id: "amend-1",
        p_vote: true,
      });
    });
  });

  it("supports closing and resolving votes via close_amendment_voting RPC", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ConstitutionManager
          clubId="club-123"
          isOrganizer={true}
          currentVersion={1}
          currentFileUrl="club-123/file.pdf"
          clubName="Chess Club"
        />
      </QueryClientProvider>,
    );

    const amendmentsBtn = screen.getByTestId("amendments-voting-btn");
    fireEvent.click(amendmentsBtn);

    const resolveBtn = await screen.findByRole("button", { name: /Resolve & Tally Votes/i });
    fireEvent.click(resolveBtn);

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("close_amendment_voting", {
        p_amendment_id: "amend-1",
      });
    });
  });
});
