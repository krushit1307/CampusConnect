import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MultiCampusIdentityMigrationWidget } from "./MultiCampusIdentityMigrationWidget";
import { generateIdentityMigrationToken } from "@/lib/multiCampusIdentity";

describe("MultiCampusIdentityMigrationWidget Component (#4293)", () => {
  it("renders Multi-Campus Identity Resolution Portal header and issuer tab", () => {
    render(
      <MultiCampusIdentityMigrationWidget
        currentCampusId="uni-a-stanford"
        initialPoints={50000}
      />
    );

    expect(screen.getByText(/Multi-Campus Identity Resolution & Transfer Portal/i)).toBeInTheDocument();
    expect(screen.getByText("50,000 PTS")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate Signed Cryptographic JWT Migration Token/i })).toBeInTheDocument();
  });

  it("generates signed cryptographic JWT migration token", () => {
    render(
      <MultiCampusIdentityMigrationWidget
        currentCampusId="uni-a-stanford"
        initialPoints={50000}
      />
    );

    const generateBtn = screen.getByRole("button", { name: /Generate Signed Cryptographic JWT Migration Token/i });
    fireEvent.click(generateBtn);

    expect(screen.getByText(/Signed Migration Token/i)).toBeInTheDocument();
  });

  it("verifies migration token and executes cross-campus migration", () => {
    const handleSuccess = vi.fn();
    const token = generateIdentityMigrationToken({
      sourceCampusId: "uni-a-stanford",
      sourceUserId: "u-101",
      userHandle: "alice_v",
      gamificationPoints: 50000,
      eventRsvpsCount: 42,
      certificates: [],
    });

    render(
      <MultiCampusIdentityMigrationWidget
        onMigrationSuccess={handleSuccess}
      />
    );

    const importTab = screen.getByRole("button", { name: /2. Import & Merge/i });
    fireEvent.click(importTab);

    const tokenInput = screen.getByPlaceholderText(/Paste JWT migration token/i);
    fireEvent.change(tokenInput, { target: { value: token } });

    const verifyBtn = screen.getByRole("button", { name: /Verify Token Cryptographic Signature/i });
    fireEvent.click(verifyBtn);

    expect(screen.getByText("VALID SIGNATURE")).toBeInTheDocument();

    const mergeBtn = screen.getByRole("button", { name: /Merge Identity & Disable Old Account/i });
    fireEvent.click(mergeBtn);

    expect(handleSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        oldAccountStatus: "disabled",
      })
    );
  });
});
