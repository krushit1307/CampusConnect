import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminDlqPage from "./admin.dlq";

// Mock Supabase client
const mockInvoke = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
const mockDelete = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});
const mockSelect = vi.fn().mockReturnValue({
  order: vi.fn().mockResolvedValue({
    data: [
      {
        id: "dlq-1",
        payload: {
          to: "failed@test.com",
          subject: "Failed Welcome Email",
          body: "<h1>Welcome</h1>",
        },
        error_message: "Invalid API Key",
        attempt_count: 3,
        created_at: new Date().toISOString(),
      },
    ],
    error: null,
  }),
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }),
    },
    from: vi.fn().mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: "admin" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "dead_letter_queue") {
        return {
          select: mockSelect,
          delete: mockDelete,
        };
      }
      return {};
    }),
    functions: {
      invoke: mockInvoke,
    },
  }),
}));

describe("AdminDlqPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders DLQ page layout and items", async () => {
    const mockUser = { id: "user-123", email: "admin@test.com" };
    render(
      <MemoryRouter>
        <AdminDlqPage user={mockUser as any} />
      </MemoryRouter>,
    );

    // Wait for role verification and loading items
    await waitFor(() => {
      expect(screen.getByText("Dead Letter Queue (DLQ)")).toBeInTheDocument();
    });

    expect(screen.getByText("failed@test.com")).toBeInTheDocument();
    expect(screen.getByText("Subject: Failed Welcome Email")).toBeInTheDocument();
    expect(screen.getByText(/Attempts: 3/)).toBeInTheDocument();
  });

  it("sends resend request when clicking Resend", async () => {
    const mockUser = { id: "user-123", email: "admin@test.com" };
    render(
      <MemoryRouter>
        <AdminDlqPage user={mockUser as any} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Resend")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Resend"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("send-welcome-email", {
        body: {
          to: "failed@test.com",
          fullName: "CampusConnect Member",
          subject: "Failed Welcome Email",
          body: "<h1>Welcome</h1>",
          dlq_id: "dlq-1",
        },
      });
    });
  });
});
