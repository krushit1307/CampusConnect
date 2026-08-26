import { describe, it, expect } from "vitest";
import {
  generatePrivateDocumentSignedUrl,
  DEFAULT_SIGNED_URL_EXPIRES_IN,
  PrivateDocumentRequest,
} from "./privateDocuments";

describe("Private Club Documents Signed URL Suite (#2724)", () => {
  const memberRequest: PrivateDocumentRequest = {
    clubId: "club_acm_01",
    filePath: "meeting_minutes_2026.pdf",
    userId: "usr_alice",
    userClubIds: ["club_acm_01", "club_robotics"],
  };

  const nonMemberRequest: PrivateDocumentRequest = {
    clubId: "club_acm_01",
    filePath: "financial_report.pdf",
    userId: "usr_eve",
    userClubIds: ["club_chess"], // Eve is not a member of ACM
  };

  it("generates time-limited signed URL for verified active club members", () => {
    const result = generatePrivateDocumentSignedUrl(memberRequest);

    expect(result.allowed).toBe(true);
    expect(result.expiresInSeconds).toBe(DEFAULT_SIGNED_URL_EXPIRES_IN);
    expect(result.signedUrl).toContain("sign/club_documents/club_acm_01/meeting_minutes_2026.pdf");
    expect(result.signedUrl).toContain("token=");
  });

  it("blocks signed URL generation and returns 403 Forbidden reason for non-members", () => {
    const result = generatePrivateDocumentSignedUrl(nonMemberRequest);

    expect(result.allowed).toBe(false);
    expect(result.signedUrl).toBeUndefined();
    expect(result.reason).toContain("Access Denied: You must be an active club member");
  });
});
