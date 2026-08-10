import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserAvatarWidget } from "./UserAvatarWidget";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "user-123",
            email: "testuser@example.com",
            user_metadata: {
              avatar_url: "https://example.com/avatar.jpg",
            },
          },
        },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

vi.mock("@/hooks/usePresence", () => ({
  usePresence: () => ({ onlineUsers: 5 }),
  getPresenceBadgeClass: () => "bg-lime",
}));

describe("UserAvatarWidget Component (#1753)", () => {
  it("renders user avatar micro-component without parent Navbar coupling", async () => {
    render(
      <MemoryRouter>
        <UserAvatarWidget />
      </MemoryRouter>,
    );

    const userMenuButton = await screen.findByRole("button", { name: /user menu/i });
    expect(userMenuButton).toBeInTheDocument();
  });
});
