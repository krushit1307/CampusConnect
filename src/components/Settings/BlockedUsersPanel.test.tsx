import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BlockedUsersPanel } from "./BlockedUsersPanel";
import * as userBlockUtils from "@/lib/userBlockUtils";

vi.mock("@/lib/userBlockUtils", () => ({
  getBlockedUsersList: vi.fn(),
  unblockUser: vi.fn(),
  blockUser: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        neq: vi.fn(() => ({
          or: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      })),
    })),
  }),
}));

describe("BlockedUsersPanel Component", () => {
  const currentUserId = "user_123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when user has no blocked accounts", async () => {
    vi.mocked(userBlockUtils.getBlockedUsersList).mockResolvedValue([]);

    render(<BlockedUsersPanel currentUserId={currentUserId} />);

    await waitFor(() => {
      expect(screen.getByText("You currently have no blocked users.")).toBeInTheDocument();
    });
  });

  it("renders list of blocked users and allows unblocking", async () => {
    const mockBlockedUsers = [
      {
        blocked_id: "user_456",
        first_name: "Jane",
        last_name: "Doe",
        handle: "janedoe",
        avatar_url: null,
        college: "Engineering",
        created_at: "2026-07-31T00:00:00Z",
      },
    ];

    vi.mocked(userBlockUtils.getBlockedUsersList).mockResolvedValue(mockBlockedUsers);
    vi.mocked(userBlockUtils.unblockUser).mockResolvedValue({ success: true });

    render(<BlockedUsersPanel currentUserId={currentUserId} />);

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
      expect(screen.getByText("@janedoe • Blocked 7/31/2026")).toBeInTheDocument();
    });

    const unblockBtn = screen.getByRole("button", { name: /unblock/i });
    fireEvent.click(unblockBtn);

    await waitFor(() => {
      expect(userBlockUtils.unblockUser).toHaveBeenCalledWith(currentUserId, "user_456");
    });
  });
});
