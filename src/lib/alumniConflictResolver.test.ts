import { describe, it, expect } from "vitest";
import {
  isSignificantGeographicChange,
  auditSpeakerEngagementLocation,
  SpeakerEngagement,
} from "./alumniConflictResolver";

describe("Develop Dynamic Alumni Speaker Conflict Resolver Suite (#4481)", () => {
  const baseEngagement: SpeakerEngagement = {
    id: "spk_req_99",
    alumniId: "alum_david",
    alumniName: "David Miller",
    alumniEmail: "david@techfirm.com",
    eventTitle: "Annual Tech Leadership Panel",
    eventDateIso: "2026-10-15T18:00:00Z",
    snapshotLocation: "New York, NY",
    currentOAuthLocation: "San Francisco, CA",
    attendanceFormat: "in_person",
    status: "accepted",
    isAtRisk: false,
  };

  it("detects significant state/country level location changes", () => {
    expect(isSignificantGeographicChange("New York, NY", "San Francisco, CA")).toBe(true);
    expect(isSignificantGeographicChange("London, UK", "New York, USA")).toBe(true);
    expect(isSignificantGeographicChange("New York, NY", "New York, NY")).toBe(false);
  });

  it("flags in-person engagement as at-risk and constructs automated verification email when location moves", () => {
    const result = auditSpeakerEngagementLocation(baseEngagement);

    expect(result.isConflictDetected).toBe(true);
    expect(result.engagement.isAtRisk).toBe(true);
    expect(result.engagement.riskReason).toContain("New York, NY");
    expect(result.engagement.riskReason).toContain("San Francisco, CA");

    expect(result.automatedEmailPayload).toBeDefined();
    expect(result.automatedEmailPayload?.recipientEmail).toBe("david@techfirm.com");
    expect(result.automatedEmailPayload?.bodyHtml).toContain(
      "We noticed you recently updated your location to",
    );
    expect(result.automatedEmailPayload?.bodyHtml).toContain(
      "switch you to a <strong>virtual attendee</strong>",
    );
  });

  it("ignores location checks for virtual engagements or unchanged locations", () => {
    const virtualEng: SpeakerEngagement = { ...baseEngagement, attendanceFormat: "virtual" };
    expect(auditSpeakerEngagementLocation(virtualEng).isConflictDetected).toBe(false);

    const sameLocEng: SpeakerEngagement = {
      ...baseEngagement,
      currentOAuthLocation: "New York, NY",
    };
    expect(auditSpeakerEngagementLocation(sameLocEng).isConflictDetected).toBe(false);
  });
});
