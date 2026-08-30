import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImpeachmentVoteModal } from "./ImpeachmentVoteModal";
import { supabase } from "@/lib/supabaseClient";
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { toast } from "sonner";

// Mock dependencies
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@simplewebauthn/browser", () => ({
  startAuthentication: vi.fn(),
  browserSupportsWebAuthn: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ImpeachmentVoteModal", () => {
  const defaultProps = {
    clubId: "test-club-123",
    targetUserId: "target-user-456",
    targetUserName: "John Doe",
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (browserSupportsWebAuthn as any).mockReturnValue(true);
  });

  it("does not render when isOpen is false", () => {
    render(<ImpeachmentVoteModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(/Cast Impeachment Vote/i)).not.toBeInTheDocument();
  });

  it("renders correctly when open", () => {
    render(<ImpeachmentVoteModal {...defaultProps} />);
    expect(screen.getByText(/Cast Impeachment Vote/i)).toBeInTheDocument();
    expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Authenticate & Vote/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
  });

  it("shows error if WebAuthn is not supported", async () => {
    (browserSupportsWebAuthn as any).mockReturnValue(false);
    render(<ImpeachmentVoteModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/State the constitutional violations/i);
    fireEvent.change(textarea, { target: { value: "Violated rules" } });

    fireEvent.click(screen.getByRole("button", { name: /Authenticate & Vote/i }));

    expect(toast.error).toHaveBeenCalledWith(
      "WebAuthn is not supported on this device/browser. Cannot cast biometric vote.",
    );
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("requires a reason to be entered", async () => {
    render(<ImpeachmentVoteModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Authenticate & Vote/i }));

    expect(toast.error).toHaveBeenCalledWith("You must provide a reason for the impeachment vote.");
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("successfully processes the vote with WebAuthn step-up", async () => {
    // Mock the sequence of calls
    (supabase.functions.invoke as any).mockImplementation((fnName: string, options: any) => {
      if (options.body.action === "generate-challenge") {
        return Promise.resolve({ data: { challenge: "base64-challenge-string" }, error: null });
      }
      if (options.body.action === "execute") {
        return Promise.resolve({ data: { success: true, message: "Vote recorded" }, error: null });
      }
      return Promise.resolve({ data: null, error: new Error("Unknown action") });
    });

    (startAuthentication as any).mockResolvedValue({
      id: "cred-id",
      rawId: "raw-id",
      response: { clientDataJSON: "xyz", authenticatorData: "abc", signature: "sig" },
      type: "public-key",
    });

    render(<ImpeachmentVoteModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/State the constitutional violations/i);
    fireEvent.change(textarea, { target: { value: "Absence from meetings" } });

    fireEvent.click(screen.getByRole("button", { name: /Authenticate & Vote/i }));

    // Assertions
    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith("governance-action", {
        body: {
          action: "generate-challenge",
          actionType: "impeachment",
          payload: {
            clubId: "test-club-123",
            targetUserId: "target-user-456",
            reason: "Absence from meetings",
          },
        },
      });
    });

    await waitFor(() => {
      expect(startAuthentication).toHaveBeenCalledWith({ challenge: "base64-challenge-string" });
    });

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith("governance-action", {
        body: {
          action: "execute",
          authenticationResponse: {
            id: "cred-id",
            rawId: "raw-id",
            response: { clientDataJSON: "xyz", authenticatorData: "abc", signature: "sig" },
            type: "public-key",
          },
        },
      });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Vote recorded");
      expect(defaultProps.onSuccess).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it("handles challenge generation failure", async () => {
    (supabase.functions.invoke as any).mockResolvedValue({
      data: null,
      error: new Error("Failed to generate challenge"),
    });

    render(<ImpeachmentVoteModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/State the constitutional violations/i);
    fireEvent.change(textarea, { target: { value: "Absence" } });

    fireEvent.click(screen.getByRole("button", { name: /Authenticate & Vote/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to generate challenge");
      expect(startAuthentication).not.toHaveBeenCalled();
    });
  });

  it("handles WebAuthn cancellation/failure", async () => {
    (supabase.functions.invoke as any).mockResolvedValueOnce({
      data: { challenge: "challenge" },
      error: null,
    });

    (startAuthentication as any).mockRejectedValue(new Error("User cancelled"));

    render(<ImpeachmentVoteModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/State the constitutional violations/i);
    fireEvent.change(textarea, { target: { value: "Absence" } });

    fireEvent.click(screen.getByRole("button", { name: /Authenticate & Vote/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("User cancelled");
      expect(supabase.functions.invoke).toHaveBeenCalledTimes(1); // Only challenge, no execute
    });
  });

  it("handles signature execution failure (e.g., replay attack or invalid signature)", async () => {
    (supabase.functions.invoke as any).mockImplementation((fnName: string, options: any) => {
      if (options.body.action === "generate-challenge") {
        return Promise.resolve({ data: { challenge: "c" }, error: null });
      }
      if (options.body.action === "execute") {
        return Promise.resolve({
          data: null,
          error: new Error("Invalid signature or expired challenge"),
        });
      }
    });

    (startAuthentication as any).mockResolvedValue({});

    render(<ImpeachmentVoteModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/State the constitutional violations/i);
    fireEvent.change(textarea, { target: { value: "Absence" } });

    fireEvent.click(screen.getByRole("button", { name: /Authenticate & Vote/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid signature or expired challenge");
    });
  });
});
