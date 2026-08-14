import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, renderHook } from "@testing-library/react";
import { PresenceProvider, usePresence } from "./usePresence";
import { Avatar } from "@/components/ui/avatar";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-123" } } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    channel: () => ({
      on: () => ({
        on: () => ({
          on: () => ({
            on: () => ({
              subscribe: vi.fn(),
            }),
          }),
        }),
      }),
      presenceState: () => ({
        "user-123": [{ userId: "user-123", status: "online", lastSeen: new Date().toISOString() }],
        "user-456": [{ userId: "user-456", status: "offline", lastSeen: new Date().toISOString() }],
      }),
      track: vi.fn(),
      unsubscribe: vi.fn(),
    }),
  }),
}));

describe("Presence System", () => {
  it("renders children inside PresenceProvider without issues", () => {
    render(
      <PresenceProvider>
        <div data-testid="test-child">Child Content</div>
      </PresenceProvider>,
    );
    expect(screen.getByTestId("test-child")).toBeInTheDocument();
  });

  it("Avatar component renders green indicator dot when isOnline is true", () => {
    render(<Avatar isOnline={true} data-testid="avatar-root" />);
    expect(screen.getByTestId("presence-indicator")).toBeInTheDocument();
  });

  it("Avatar component does not render indicator when isOnline is false", () => {
    render(<Avatar isOnline={false} data-testid="avatar-root" />);
    expect(screen.queryByTestId("presence-indicator")).not.toBeInTheDocument();
  });
});
