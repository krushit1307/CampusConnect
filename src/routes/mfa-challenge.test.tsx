import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MfaChallengePage from "./mfa-challenge";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useSearchParams: () => [new URLSearchParams("redirectTo=/dashboard"), vi.fn()],
  };
});

const mfaMock = {
  getSession: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
  challenge: vi.fn(),
  verify: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: mfaMock.getSession,
      mfa: {
        getAuthenticatorAssuranceLevel: mfaMock.getAuthenticatorAssuranceLevel,
        listFactors: mfaMock.listFactors,
        challenge: mfaMock.challenge,
        verify: mfaMock.verify,
      },
    },
    rpc: mfaMock.rpc,
  }),
}));

const session = { user: { id: "user-123", email: "treasurer@univ.edu" } };

beforeEach(() => {
  vi.clearAllMocks();
  navigateMock.mockReset();
  mfaMock.getSession.mockResolvedValue({ data: { session }, error: null });
  mfaMock.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: ["password"] },
    error: null,
  });
  mfaMock.listFactors.mockResolvedValue({
    data: {
      all: [{ id: "factor_123", type: "totp", status: "verified" }],
      totp: [{ id: "factor_123", type: "totp", status: "verified" }],
      phone: [],
    },
    error: null,
  });
  mfaMock.rpc.mockResolvedValue({ data: true, error: null });
  mfaMock.challenge.mockResolvedValue({ data: { id: "challenge_123" }, error: null });
  mfaMock.verify.mockResolvedValue({ data: {}, error: null });
});

describe("MfaChallengePage", () => {
  it("redirects to /auth when there is no active session", async () => {
    mfaMock.getSession.mockResolvedValue({ data: { session: null }, error: null });

    render(
      <MemoryRouter>
        <MfaChallengePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/auth", { replace: true });
    });
  });

  it("skips the challenge and continues when the session is already aal2", async () => {
    mfaMock.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: {
        currentLevel: "aal2",
        nextLevel: "aal2",
        currentAuthenticationMethods: ["password", "totp"],
      },
      error: null,
    });

    render(
      <MemoryRouter>
        <MfaChallengePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
    expect(mfaMock.challenge).not.toHaveBeenCalled();
  });

  it("redirects to redirectTo when MFA is not enforced for the user", async () => {
    mfaMock.rpc.mockResolvedValue({ data: false, error: null });

    render(
      <MemoryRouter>
        <MfaChallengePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
    expect(mfaMock.challenge).not.toHaveBeenCalled();
  });

  it("starts a challenge and verifies a 6-digit code", async () => {
    render(
      <MemoryRouter>
        <MfaChallengePage />
      </MemoryRouter>,
    );

    const input = await screen.findByLabelText(/6-digit authenticator code/i);
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));

    await waitFor(() => {
      expect(mfaMock.verify).toHaveBeenCalledWith({
        factorId: "factor_123",
        challengeId: "challenge_123",
        code: "123456",
      });
      expect(navigateMock).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  it("rejects an invalid code without navigating", async () => {
    mfaMock.verify.mockResolvedValue({ data: null, error: new Error("Invalid code") });

    render(
      <MemoryRouter>
        <MfaChallengePage />
      </MemoryRouter>,
    );

    const input = await screen.findByLabelText(/6-digit authenticator code/i);
    fireEvent.change(input, { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(navigateMock).not.toHaveBeenCalledWith("/dashboard", { replace: true });
  });
});
