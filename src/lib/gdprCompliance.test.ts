import { describe, it, expect } from "vitest";
import {
  validateAccountDeletionSafety,
  formatGdprExportJson,
  ClubAdminRole,
} from "./gdprCompliance";

describe("GDPR Compliance & Data Export Suite (#2683)", () => {
  it("formats aggregated user profile and activity data into GDPR export payload", () => {
    const profile = {
      id: "usr_100",
      email: "student@university.edu",
      fullName: "Alex Rivera",
      createdAt: "2026-01-15T00:00:00Z",
    };

    const rsvps = [
      {
        id: "r1",
        eventId: "e1",
        status: "CONFIRMED",
        createdAt: "2026-02-01T12:00:00Z",
      },
    ];

    const exportPayload = formatGdprExportJson(profile, rsvps);

    expect(exportPayload.profile.id).toBe("usr_100");
    expect(exportPayload.rsvps.length).toBe(1);
    expect(exportPayload.exportedAt).toBeDefined();
  });

  it("blocks account deletion when user is the sole admin of a club", () => {
    const roles: ClubAdminRole[] = [
      { clubId: "c1", clubName: "Coding Club", soleAdmin: true },
      { clubId: "c2", clubName: "Chess Club", soleAdmin: false },
    ];

    const result = validateAccountDeletionSafety(roles);

    expect(result.canDelete).toBe(false);
    expect(result.blockingClubs).toContain("Coding Club");
    expect(result.reason).toContain("sole administrator");
  });

  it("allows account deletion when user is not a sole admin of any club", () => {
    const roles: ClubAdminRole[] = [{ clubId: "c2", clubName: "Chess Club", soleAdmin: false }];

    const result = validateAccountDeletionSafety(roles);

    expect(result.canDelete).toBe(true);
    expect(result.blockingClubs.length).toBe(0);
  });
});
