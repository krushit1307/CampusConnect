import { describe, it, expect } from "vitest";
import {
  validateSpeakerRequestRfp,
  buildAlumniInvitationEmail,
  processAlumniDecision,
  AlumniProfile,
  SpeakerRequestRfp,
} from "./alumniSpeakerPortal";

describe("Develop Dynamic Alumni Speaker Request Portal Suite (#4403)", () => {
  const mockAlumni: AlumniProfile = {
    alumniId: "alum_sarah",
    fullName: "Sarah Chen",
    email: "sarah@techcorp.com",
    currentRoleCompany: "VP of Engineering at TechCorp",
    headshotUrl: "https://storage.campusconnect.edu/headshots/sarah.jpg",
    bio: "Class of 2018 CS graduate leading distributed systems teams.",
  };

  const mockRfp: SpeakerRequestRfp = {
    id: "rfp_404",
    clubId: "club_fintech",
    clubName: "FinTech & Tech Society",
    alumniId: "alum_sarah",
    eventId: "evt_panel_2026",
    topic: "Tech in Finance Keynote",
    eventDateIso: "2026-11-15T18:00:00Z",
    honorariumBudget: 500.0,
    status: "pending",
  };

  it("validates structured RFP input and flags past dates or empty topics", () => {
    expect(validateSpeakerRequestRfp(mockRfp).isValid).toBe(true);

    const emptyTopic = validateSpeakerRequestRfp({ ...mockRfp, topic: "" });
    expect(emptyTopic.isValid).toBe(false);
    expect(emptyTopic.error).toContain("detailed presentation topic");

    const pastDate = validateSpeakerRequestRfp({
      ...mockRfp,
      eventDateIso: "2020-01-01T00:00:00Z",
    });
    expect(pastDate.isValid).toBe(false);
    expect(pastDate.error).toContain("must be scheduled in the future");
  });

  it("generates structured HTML invitation email with action buttons", () => {
    const email = buildAlumniInvitationEmail(mockRfp, mockAlumni);

    expect(email.recipientEmail).toBe("sarah@techcorp.com");
    expect(email.subject).toContain("FinTech & Tech Society");
    expect(email.bodyHtml).toContain("Tech in Finance Keynote");
    expect(email.bodyHtml).toContain("$500.00");
    expect(email.bodyHtml).toContain("action=accept");
    expect(email.bodyHtml).toContain("action=decline");
  });

  it("attaches alumni headshot and bio to event metadata upon acceptance", () => {
    const result = processAlumniDecision(mockRfp, "accept", mockAlumni);

    expect(result.status).toBe("accepted");
    expect(result.speakerMeta?.name).toBe("Sarah Chen");
    expect(result.speakerMeta?.headshotUrl).toBe(
      "https://storage.campusconnect.edu/headshots/sarah.jpg",
    );
  });
});
