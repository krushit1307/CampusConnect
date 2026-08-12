import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MfaSetupModal } from "./MfaSetupModal";
import { MfaVerificationModal } from "./MfaVerificationModal";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      mfa: {
        enroll: vi.fn().mockResolvedValue({
          data: {
            id: "factor_123",
            type: "totp",
            totp: {
              secret: "JBSWY3DPEHPK3PXP",
              uri: "otpauth://totp/CampusConnect:user@campus.edu?secret=JBSWY3DPEHPK3PXP&issuer=CampusConnect",
            },
          },
          error: null,
        }),
        challenge: vi.fn().mockResolvedValue({
          data: { id: "challenge_123" },
          error: null,
        }),
        verify: vi.fn().mockResolvedValue({
          data: { user: { id: "user_123" } },
          error: null,
        }),
      },
    },
  }),
}));

describe("MfaSetupModal Component", () => {
  it("renders selection step when opened", () => {
    render(<MfaSetupModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText("Two-Factor Authentication Setup")).toBeInTheDocument();
    expect(screen.getByText("Authenticator App (Recommended)")).toBeInTheDocument();
    expect(screen.getByText("SMS Mobile Verification")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(<MfaSetupModal isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByText("Two-Factor Authentication Setup")).not.toBeInTheDocument();
  });
});

describe("MfaVerificationModal Component", () => {
  it("renders TOTP prompt correctly", () => {
    render(
      <MfaVerificationModal
        isOpen={true}
        factorId="factor_123"
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Two-Factor Authentication Required")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("000000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /verify sign-in/i })).toBeInTheDocument();
  });

  it("calls onCancel when Cancel button is clicked", () => {
    const handleCancel = vi.fn();
    render(
      <MfaVerificationModal
        isOpen={true}
        factorId="factor_123"
        onSuccess={vi.fn()}
        onCancel={handleCancel}
      />,
    );

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });
});
