import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import AdminLeadershipApprovals from "./admin.leadership-approvals";

// Mock Supabase
const mockApprove = vi.fn().mockResolvedValue({ error: null });
const mockReject = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "advisor-1" } } }),
    },
    rpc: (name: string) => {
      if (name === "is_system_admin") return Promise.resolve({ data: true, error: null });
      if (name === "approve_leadership_transfer") return mockApprove();
      if (name === "reject_leadership_transfer") return mockReject();
      return Promise.resolve({ data: null, error: null });
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => Promise.resolve({
              data: [
                {
                  id: "transition-1",
                  role_title: "President",
                  effective_date: "2026-08-20T12:00:00Z",
                  status: "accepted",
                  su_advisor_approval_status: "pending",
                  clubs: { name: "Art Club" },
                  outgoing: { first_name: "Alex", last_name: "Smith", email: "alex@campus.edu" },
                  incoming: { first_name: "John", last_name: "Doe", email: "john@campus.edu" },
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    }),
  }),
}));

// Mock React Query
vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: () => ({
    data: [
      {
        id: "transition-1",
        role_title: "President",
        effective_date: "2026-08-20T12:00:00Z",
        status: "accepted",
        su_advisor_approval_status: "pending",
        clubs: { name: "Art Club" },
        outgoing: { first_name: "Alex", last_name: "Smith", email: "alex@campus.edu" },
        incoming: { first_name: "John", last_name: "Doe", email: "john@campus.edu" },
      },
    ],
    isLoading: false,
  }),
  useMutation: (opts: any) => ({
    mutate: (id: string) => opts.mutationFn(id).then(opts.onSuccess),
    isPending: false,
  }),
}));

describe("Multi-Factor Role Transfer Verification UI (#3459)", () => {
  it("renders pending leadership transfers list and processes approve/reject clicks", async () => {
    render(
      <BrowserRouter>
        <AdminLeadershipApprovals />
      </BrowserRouter>
    );

    // Verify title and club details render
    expect(await screen.findByText("Pending Leadership Changes")).toBeInTheDocument();
    expect(screen.getByText("Art Club")).toBeInTheDocument();
    expect(screen.getByText("Alex Smith (alex@campus.edu)")).toBeInTheDocument();
    expect(screen.getByText("John Doe (john@campus.edu)")).toBeInTheDocument();

    // Click Approve button
    const approveBtn = screen.getByRole("button", { name: "Approve" });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(mockApprove).toHaveBeenCalled();
    });

    // Click Reject button
    const rejectBtn = screen.getByRole("button", { name: "Reject" });
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(mockReject).toHaveBeenCalled();
    });
  });
});
