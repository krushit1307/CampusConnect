// src/components/notifications/NotificationCenterDropdown.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotificationCenterDropdown } from "./NotificationCenterDropdown";

// Mock the supabase client.
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

// Mock react-router-dom Link.
vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to} data-testid="mock-link">
      {children}
    </a>
  ),
}));

import { supabase } from "@/lib/supabase/client";

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockRpc.mockReset();
  // Default: empty inbox.
  mockRpc.mockImplementation((name: string) => {
    if (name === "get_categorized_notifications") {
      return Promise.resolve({
        data: {
          items: [],
          unread_by_type: {},
          total_unread: 0,
          total_count: 0,
          limit: 30,
          offset: 0,
        },
        error: null,
      });
    }
    if (name === "get_unread_notification_count") {
      return Promise.resolve({ data: 0, error: null });
    }
    if (name === "mark_notification_read") {
      return Promise.resolve({
        data: { success: true, marked_read: true },
        error: null,
      });
    }
    if (name === "mark_all_notifications_read") {
      return Promise.resolve({
        data: { success: true, marked_read_count: 5 },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  });
});

describe("NotificationCenterDropdown", () => {
  it("renders nothing when userId is undefined", () => {
    const { container } = render(<NotificationCenterDropdown userId={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the bell button with no badge when unread count is 0", async () => {
    render(<NotificationCenterDropdown userId="user-1" />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
    });
    // No badge should be present.
    expect(screen.queryByText(/\d+/)).not.toBeInTheDocument();
  });

  it("renders the bell button with a badge when unread count > 0", async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === "get_unread_notification_count") {
        return Promise.resolve({ data: 5, error: null });
      }
      if (name === "get_categorized_notifications") {
        return Promise.resolve({
          data: {
            items: [
              {
                id: "n1",
                type: "event_liked",
                title: "Someone liked your event",
                message: "Alice liked your event.",
                link: "/events/e1",
                is_read: false,
                created_at: new Date().toISOString(),
                group_count: 1,
              },
            ],
            unread_by_type: { event_liked: 1 },
            total_unread: 5,
            total_count: 10,
            limit: 30,
            offset: 0,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(<NotificationCenterDropdown userId="user-1" />);
    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument();
    });
  });

  it("opens the dropdown when the bell is clicked", async () => {
    render(<NotificationCenterDropdown userId="user-1" />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    await waitFor(() => {
      expect(screen.getByRole("menu", { name: /notifications/i })).toBeInTheDocument();
    });
  });

  it("renders category tabs", async () => {
    render(<NotificationCenterDropdown userId="user-1" />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    await waitFor(() => {
      expect(screen.getByText("All")).toBeInTheDocument();
      expect(screen.getByText("Mentions")).toBeInTheDocument();
      expect(screen.getByText("Events")).toBeInTheDocument();
      expect(screen.getByText("Messages")).toBeInTheDocument();
      expect(screen.getByText("System")).toBeInTheDocument();
    });
  });

  it("renders the 'Mark all as read' button when unread count > 0", async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === "get_unread_notification_count") {
        return Promise.resolve({ data: 3, error: null });
      }
      if (name === "get_categorized_notifications") {
        return Promise.resolve({
          data: {
            items: [
              {
                id: "n1",
                type: "event_liked",
                title: "Someone liked your event",
                message: "Alice liked your event.",
                link: "/events/e1",
                is_read: false,
                created_at: new Date().toISOString(),
                group_count: 1,
              },
            ],
            unread_by_type: { event_liked: 3 },
            total_unread: 3,
            total_count: 10,
            limit: 30,
            offset: 0,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(<NotificationCenterDropdown userId="user-1" />);
    await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    await waitFor(() => {
      expect(screen.getByText("Mark all as read")).toBeInTheDocument();
    });
  });

  it("renders the empty state when there are no notifications", async () => {
    render(<NotificationCenterDropdown userId="user-1" />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    await waitFor(() => {
      expect(screen.getByText(/you're all caught up/i)).toBeInTheDocument();
    });
  });
});
