import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { withAuth, WithAuthProps } from "./withAuth";

// Mock Supabase Client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: "user-123", email: "test@campus.edu" },
          },
        },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}));

const ProtectedComponent: React.FC<WithAuthProps> = ({ user }) => (
  <div>Protected Content for {user.email}</div>
);

const Wrapped = withAuth(ProtectedComponent);

describe("withAuth HOC", () => {
  it("renders protected component when session is present", async () => {
    render(
      <MemoryRouter>
        <Wrapped />
      </MemoryRouter>,
    );

    const content = await screen.findByText("Protected Content for test@campus.edu");
    expect(content).toBeInPrimary();
  });
});
