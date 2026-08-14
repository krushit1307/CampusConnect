import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { DeleteAccountModal } from "@/components/DeleteAccountModal";

// Mock Supabase client
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { email: "test@example.com" } } });
const mockGetSession = vi
  .fn()
  .mockResolvedValue({ data: { session: { access_token: "mock-token" } } });

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      getUser: mockGetUser,
      getSession: mockGetSession,
    },
  }),
}));

// Mock sonner toast
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (msg: string) => mockToastError(msg),
    success: (msg: string) => mockToastSuccess(msg),
  },
}));

describe("DeleteAccountModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock global fetch
    global.fetch = vi.fn();

    // Mock HTMLDialogElement prototype methods
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
  });

  it("renders correctly when open", () => {
    render(<DeleteAccountModal open={true} onClose={() => {}} />);
    expect(screen.getByText("Delete Account Permanently")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
    expect(screen.getByLabelText('Type "DELETE" to Confirm')).toBeInTheDocument();
  });

  it("validates that typed text must match DELETE", async () => {
    render(<DeleteAccountModal open={true} onClose={() => {}} />);

    const passwordInput = screen.getByLabelText("Confirm Password");
    const confirmInput = screen.getByLabelText('Type "DELETE" to Confirm');
    const submitBtn = screen.getByText("Permanently Delete My Account");

    fireEvent.change(passwordInput, { target: { value: "mypassword" } });
    fireEvent.change(confirmInput, { target: { value: "DELET" } });

    fireEvent.click(submitBtn);

    expect(mockToastError).toHaveBeenCalledWith("Please type DELETE to confirm account deletion.");
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("calls password check and triggers edge function on successful verification", async () => {
    // Mock fetch for successful Edge Function execution
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });

    render(<DeleteAccountModal open={true} onClose={() => {}} />);

    const passwordInput = screen.getByLabelText("Confirm Password");
    const confirmInput = screen.getByLabelText('Type "DELETE" to Confirm');
    const submitBtn = screen.getByText("Permanently Delete My Account");

    fireEvent.change(passwordInput, { target: { value: "mypassword" } });
    fireEvent.change(confirmInput, { target: { value: "DELETE" } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "mypassword",
      });
      expect(global.fetch).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Your account and data have been successfully deleted.",
      );
    });
  });

  it("throws error toast if password authentication fails", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {},
      error: new Error("Invalid password"),
    });

    render(<DeleteAccountModal open={true} onClose={() => {}} />);

    const passwordInput = screen.getByLabelText("Confirm Password");
    const confirmInput = screen.getByLabelText('Type "DELETE" to Confirm');
    const submitBtn = screen.getByText("Permanently Delete My Account");

    fireEvent.change(passwordInput, { target: { value: "wrongpassword" } });
    fireEvent.change(confirmInput, { target: { value: "DELETE" } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Invalid password. Please verify your credentials.",
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
