import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import ClubManageRoute from "./clubs.$slug.manage";

// Mock Supabase Client
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

const mockSupabase = {
  auth: {
    getUser: () =>
      Promise.resolve({
        data: {
          user: {
            id: "user-123",
            email: "admin@club.edu",
          },
        },
      }),
  },
  from: vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: "club-123",
        name: "Developer Society",
        slug: "dev-soc",
        description: "Code and chill.",
        status: "approved",
      },
      error: null,
    }),
  })),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

describe("Club Co-Hosting Management Panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
    mockUpdate.mockReturnThis();
    mockDelete.mockReturnThis();
  });

  it("renders pending invitations and active co-hosted events list", async () => {
    // Mock invitations and active co-hosted lists
    mockSelect.mockImplementation((queryStr) => {
      if (queryStr.includes("events (")) {
        // This is event_hosts selection query
        return {
          eq: vi.fn().mockImplementation((col, val) => {
            if (col === "status" && val === "pending") {
              return Promise.resolve({
                data: [
                  {
                    event_id: "event-1",
                    club_id: "club-123",
                    status: "pending",
                    events: {
                      id: "event-1",
                      title: "Hackathon Joint Prep",
                      start_date: "2026-09-01T12:00:00Z",
                      end_date: "2026-09-01T13:00:00Z",
                    },
                  },
                ],
                error: null,
              });
            } else if (col === "is_primary_host" && val === false) {
              return {
                eq: vi.fn().mockResolvedValue({
                  data: [
                    {
                      event_id: "event-2",
                      club_id: "club-123",
                      status: "accepted",
                      events: {
                        id: "event-2",
                        title: "Multi-Club Tech Mixer",
                        start_date: "2026-09-05T18:00:00Z",
                        end_date: "2026-09-05T21:00:00Z",
                      },
                    },
                  ],
                  error: null,
                }),
              };
            }
            return Promise.resolve({ data: [], error: null });
          }),
        };
      }
      return { eq: vi.fn().mockReturnThis() };
    });

    render(
      <BrowserRouter>
        <ClubManageRoute />
      </BrowserRouter>
    );

    // Switch to Co-Hosting Tab
    const tabButton = await screen.findByRole("button", { name: /co-hosting/i });
    fireEvent.click(tabButton);

    // Verify Tab Header
    expect(screen.getByRole("heading", { name: /co-hosting management/i })).toBeInTheDocument();

    // Verify invitation title
    const inviteTitle = await screen.findByText("Hackathon Joint Prep");
    expect(inviteTitle).toBeInTheDocument();

    // Verify active co-hosted title
    const activeTitle = screen.getByText("Multi-Club Tech Mixer");
    expect(activeTitle).toBeInTheDocument();
  });

  it("handles Accept invitation mutation", async () => {
    mockSelect.mockImplementation((queryStr) => {
      if (queryStr.includes("events (")) {
        return {
          eq: vi.fn().mockImplementation((col, val) => {
            if (col === "status" && val === "pending") {
              return Promise.resolve({
                data: [
                  {
                    event_id: "event-1",
                    club_id: "club-123",
                    status: "pending",
                    events: {
                      id: "event-1",
                      title: "Hackathon Joint Prep",
                    },
                  },
                ],
                error: null,
              });
            }
            return Promise.resolve({ data: [], error: null });
          }),
        };
      }
      return { eq: vi.fn().mockReturnThis() };
    });

    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    render(
      <BrowserRouter>
        <ClubManageRoute />
      </BrowserRouter>
    );

    const tabButton = await screen.findByRole("button", { name: /co-hosting/i });
    fireEvent.click(tabButton);

    const acceptBtn = await screen.findByRole("button", { name: /accept/i });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ status: "accepted" });
    });
  });
});
