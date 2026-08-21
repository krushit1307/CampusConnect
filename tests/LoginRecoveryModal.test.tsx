import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { LoginRecoveryModal } from "@/components/auth/LoginRecoveryModal";
import { useSessionRecoveryStore } from "@/store/useSessionRecoveryStore";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn().mockImplementation(({ password }) => {
        if (password === "wrong_password") {
          return Promise.resolve({
            data: { session: null },
            error: { message: "Invalid login credentials" },
          });
        }
        return Promise.resolve({
          data: { session: { access_token: "test_recovered_token" } },
          error: null,
        });
      }),
    },
  }),
}));

describe("<LoginRecoveryModal />", () => {
  beforeEach(() => {
    useSessionRecoveryStore.getState().reset();
  });

  it("should not render when isOpen is false", () => {
    render(<LoginRecoveryModal />);
    expect(screen.queryByText(/Session Expired/i)).toBeNull();
  });

  it("should render when isOpen is true with security warning and pre-filled email", () => {
    useSessionRecoveryStore.getState().openModal("testuser@campusconnect.edu");
    render(<LoginRecoveryModal />);

    expect(screen.getByText(/Session Expired/i)).toBeDefined();
    expect(screen.getByText(/Your session timed out while you were working/i)).toBeDefined();
    const emailInput = screen.getByPlaceholderText(/user@example.com/i) as HTMLInputElement;
    expect(emailInput.value).toBe("testuser@campusconnect.edu");
  });

  it("should display error message when re-authentication fails", async () => {
    useSessionRecoveryStore.getState().openModal("testuser@campusconnect.edu");
    render(<LoginRecoveryModal />);

    const passwordInput = screen.getByPlaceholderText(/••••••••/i);
    fireEvent.change(passwordInput, { target: { value: "wrong_password" } });

    const submitBtn = screen.getByRole("button", { name: /Save & Resume Work/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Invalid login credentials/i)).toBeDefined();
  });
});
