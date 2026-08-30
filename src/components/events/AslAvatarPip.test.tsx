import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AslAvatarPip } from "./AslAvatarPip";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => {
  return {
    createClient: () => ({
      channel: () => ({
        on: () => ({
          subscribe: vi.fn(),
        }),
      }),
      removeChannel: vi.fn(),
    }),
  };
});

describe("AslAvatarPip", () => {
  it("renders the toggle button and opens PIP window on click", async () => {
    render(<AslAvatarPip eventId="evt-123" />);

    const toggleBtn = screen.getByTestId("asl-pip-toggle-btn");
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveTextContent(/Enable ASL Avatar/i);

    // PIP window is initially not present
    expect(screen.queryByTestId("asl-avatar-pip-container")).not.toBeInTheDocument();

    // Toggle click
    fireEvent.click(toggleBtn);

    expect(await screen.findByTestId("asl-avatar-pip-container")).toBeInTheDocument();
    expect(screen.getByText(/Signapse AI Avatar/i)).toBeInTheDocument();
    expect(screen.getByTestId("asl-avatar-pip-video")).toBeInTheDocument();
  });
});
