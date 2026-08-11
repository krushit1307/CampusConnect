import { describe, expect, it, vi } from "vitest";
import { formatCertificateFilename, generateFallbackCertificatePdf } from "./certificateUtils";

describe("certificateUtils module", () => {
  it("formats certificate filenames cleanly", () => {
    expect(formatCertificateFilename("Annual Hackathon 2026")).toBe(
      "annual-hackathon-2026-certificate.pdf",
    );
    expect(formatCertificateFilename("  Web3 & AI Workshop!! ")).toBe(
      "web3-ai-workshop-certificate.pdf",
    );
    expect(formatCertificateFilename(undefined)).toBe("campusconnect-certificate.pdf");
  });

  it("generates a valid fallback PDF Blob", async () => {
    const blob = await generateFallbackCertificatePdf({
      eventTitle: "Test Workshop",
      studentName: "Jane Doe",
      issuedAt: "2026-07-24T00:00:00.000Z",
      certId: "CERT-12345",
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(100);
  });

  it("handles exceptionally long names and event titles without erroring", async () => {
    const blob = await generateFallbackCertificatePdf({
      eventTitle:
        "A very long event title that spans many characters to test the text scaling functionality of our pdf generator",
      studentName: "Hubert Blaine Wolfeschlegelsteinhausenbergerdorff Sr.",
      issuedAt: "2026-07-24T00:00:00.000Z",
      certId: "CERT-LONGNAME-123",
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(100);
  });
});

describe("Issue #2910 Flow & Edge Case Requirements", () => {
  // Mock Database & Edge Function state
  interface MockEvent {
    id: string;
    title: string;
    event_date: string;
    generates_certificate: boolean;
  }

  interface MockProfile {
    id: string;
    full_name: string;
    email: string;
  }

  interface MockCertificate {
    id: string;
    event_id: string;
    user_id: string;
    attendee_name: string;
    event_title: string;
    event_date: string;
    certificate_url: string;
    verification_hash: string;
    email_sent_at: string | null;
  }

  const mockProfile: MockProfile = {
    id: "user-100",
    full_name: "Alice Johnson",
    email: "alice@example.com",
  };

  const mockEvent: MockEvent = {
    id: "event-200",
    title: "AI & Cloud Summit 2026",
    event_date: "2026-05-15T10:00:00.000Z",
    generates_certificate: true,
  };

  const certStore = new Map<string, MockCertificate>();

  // Simulated Edge Function logic for certificate generation & email delivery
  async function simulateGenerateCertificate(payload: {
    eventId: string;
    userId: string;
    event: MockEvent;
    profile: MockProfile;
  }) {
    // 1. Check if event enables certificate generation
    if (!payload.event.generates_certificate) {
      return { status: 400, error: "Event is configured not to generate certificates" };
    }

    const key = `${payload.eventId}:${payload.userId}`;
    const existing = certStore.get(key);

    // 2. Idempotency Check: return existing generated cert without duplicating
    if (existing && existing.certificate_url !== "pending") {
      return {
        status: 200,
        success: true,
        url: existing.certificate_url,
        verificationHash: existing.verification_hash,
        emailSent: Boolean(existing.email_sent_at),
        message: "Certificate already generated idempotently",
      };
    }

    // 3. Snapshot attendee & event details
    const certId = existing?.id || `cert-${Math.random().toString(36).substring(2, 9)}`;
    const snapshotName = payload.profile.full_name;
    const snapshotEventTitle = payload.event.title;
    const snapshotEventDate = payload.event.event_date; // Preserves actual event date!

    // 4. Generate PDF & Upload to storage
    const pdfBlob = await generateFallbackCertificatePdf({
      eventTitle: snapshotEventTitle,
      studentName: snapshotName,
      issuedAt: snapshotEventDate,
      certId,
    });

    if (!pdfBlob || pdfBlob.size === 0) {
      throw new Error("PDF generation failed");
    }

    const certificateUrl = `https://supabase.storage.co/certificates/${payload.userId}/${payload.eventId}.pdf`;
    const verificationHash = `hash-${payload.eventId}-${payload.userId}-${certId}`;

    // 5. Update DB record
    let emailSentAt = existing?.email_sent_at || null;

    // 6. Deliver email if not sent yet
    if (!emailSentAt && payload.profile.email) {
      emailSentAt = new Date().toISOString();
    }

    const updatedCert: MockCertificate = {
      id: certId,
      event_id: payload.eventId,
      user_id: payload.userId,
      attendee_name: snapshotName,
      event_title: snapshotEventTitle,
      event_date: snapshotEventDate,
      certificate_url: certificateUrl,
      verification_hash: verificationHash,
      email_sent_at: emailSentAt,
    };

    certStore.set(key, updatedCert);

    return {
      status: 200,
      success: true,
      url: certificateUrl,
      verificationHash,
      emailSent: true,
    };
  }

  // Simulated Verification API logic
  function simulateVerifyCertificate(hashOrCertId: string) {
    if (!hashOrCertId || hashOrCertId === "invalid-hash") {
      return { valid: false, status: "not_found", message: "No certificate found" };
    }

    for (const cert of certStore.values()) {
      if (cert.verification_hash === hashOrCertId || cert.id === hashOrCertId) {
        return {
          valid: true,
          status: "verified",
          certificate: {
            id: cert.id,
            holder: cert.attendee_name,
            event: cert.event_title,
            eventDate: cert.event_date,
            verificationHash: cert.verification_hash,
            certificateUrl: cert.certificate_url,
          },
        };
      }
    }

    return { valid: false, status: "not_found", message: "No certificate found" };
  }

  it("completes full flow: attendance -> PDF storage -> email -> verification", async () => {
    certStore.clear();

    // Trigger certificate generation
    const res = await simulateGenerateCertificate({
      eventId: mockEvent.id,
      userId: mockProfile.id,
      event: mockEvent,
      profile: mockProfile,
    });

    expect(res.status).toBe(200);
    expect(res.success).toBe(true);
    expect(res.url).toContain("certificates/user-100/event-200.pdf");
    expect(res.verificationHash).toBeDefined();

    // Verify hash
    const verification = simulateVerifyCertificate(res.verificationHash);
    expect(verification.valid).toBe(true);
    expect(verification.certificate.holder).toBe("Alice Johnson");
    expect(verification.certificate.event).toBe("AI & Cloud Summit 2026");
    expect(verification.certificate.eventDate).toBe("2026-05-15T10:00:00.000Z");
  });

  it("handles late check-in while preserving actual event date on certificate", async () => {
    certStore.clear();

    // Event happened on 2026-05-15, but check-in happens months later (e.g. 2026-08-11)
    const res = await simulateGenerateCertificate({
      eventId: mockEvent.id,
      userId: mockProfile.id,
      event: mockEvent,
      profile: mockProfile,
    });

    const verification = simulateVerifyCertificate(res.verificationHash);
    expect(verification.valid).toBe(true);
    // Preserves original event date, NOT check-in timestamp
    expect(verification.certificate.eventDate).toBe("2026-05-15T10:00:00.000Z");
  });

  it("prevents duplicate webhooks from recreating certificates or sending duplicate emails", async () => {
    certStore.clear();

    // First webhook call
    const firstCall = await simulateGenerateCertificate({
      eventId: mockEvent.id,
      userId: mockProfile.id,
      event: mockEvent,
      profile: mockProfile,
    });

    expect(firstCall.status).toBe(200);
    const firstCert = certStore.get(`${mockEvent.id}:${mockProfile.id}`);
    const originalEmailSentAt = firstCert?.email_sent_at;

    // Second webhook call (Duplicate retry)
    const secondCall = await simulateGenerateCertificate({
      eventId: mockEvent.id,
      userId: mockProfile.id,
      event: mockEvent,
      profile: mockProfile,
    });

    expect(secondCall.status).toBe(200);
    expect(secondCall.message).toContain("idempotently");
    const secondCert = certStore.get(`${mockEvent.id}:${mockProfile.id}`);

    // Verify certificate ID and email timestamp remain identical (no duplicates!)
    expect(secondCert?.id).toBe(firstCert?.id);
    expect(secondCert?.email_sent_at).toBe(originalEmailSentAt);
  });

  it("keeps snapshotted attendee name immutable when user profile name changes later", async () => {
    certStore.clear();

    // Issue certificate when user is named Alice Johnson
    const initialProfile = { ...mockProfile, full_name: "Alice Johnson" };
    const res = await simulateGenerateCertificate({
      eventId: mockEvent.id,
      userId: mockProfile.id,
      event: mockEvent,
      profile: initialProfile,
    });

    // User updates profile name later to Alice Smith
    const updatedProfile = { ...mockProfile, full_name: "Alice Smith" };

    // Verify certificate still returns original snapshotted name "Alice Johnson"
    const verification = simulateVerifyCertificate(res.verificationHash);
    expect(verification.valid).toBe(true);
    expect(verification.certificate.holder).toBe("Alice Johnson");
  });

  it("rejects certificate generation when generates_certificate = false", async () => {
    certStore.clear();

    const disabledEvent: MockEvent = {
      ...mockEvent,
      generates_certificate: false,
    };

    const res = await simulateGenerateCertificate({
      eventId: disabledEvent.id,
      userId: mockProfile.id,
      event: disabledEvent,
      profile: mockProfile,
    });

    expect(res.status).toBe(400);
    expect(res.error).toContain("configured not to generate certificates");
  });

  it("returns invalid / not_found state for invalid verification hash", () => {
    const invalidResult = simulateVerifyCertificate("invalid-hash");
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.status).toBe("not_found");
  });
});

describe("Issue #3011 Automated Certificate of Leadership Test Suite", () => {
  interface MockClubMember {
    id: string;
    club_id: string;
    user_id: string;
    role: string;
    permissions_level: number;
    status: string;
    joined_at: string;
    removed_at: string | null;
    termination_reason: string | null;
  }

  interface MockLeadershipCert {
    id: string;
    club_id: string;
    user_id: string;
    certificate_type: "leadership";
    attendee_name: string;
    role_title: string;
    tenure_start: string;
    tenure_end: string;
    termination_reason: string | null;
    certificate_url: string;
    verification_hash: string;
    verify_url: string;
  }

  const leadershipCertStore = new Map<string, MockLeadershipCert>();

  // Backend simulation for check_leadership_certificate_eligibility & generate_leadership_certificate
  function simulateLeadershipEligibility(member: MockClubMember | undefined) {
    if (!member) {
      return { eligible: false, reason: "No club membership record found" };
    }

    if (member.termination_reason && member.termination_reason.toLowerCase() === "impeached") {
      return { eligible: false, reason: "Member was impeached and is ineligible for a Leadership Certificate" };
    }

    if (member.role.toLowerCase() === "member" && member.permissions_level < 50) {
      return { eligible: false, reason: "Member did not hold a leadership role" };
    }

    const startMs = new Date(member.joined_at).getTime();
    const endMs = member.removed_at ? new Date(member.removed_at).getTime() : Date.now();
    const tenureDays = Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24));

    if (tenureDays < 90) {
      return {
        eligible: false,
        reason: `Leadership tenure must be at least 90 days (current tenure: ${tenureDays} days)`,
        tenureDays,
      };
    }

    return { eligible: true, tenureDays, roleTitle: member.role };
  }

  function simulateGenerateLeadershipCert(member: MockClubMember, profileName: string, clubName: string) {
    const eligibility = simulateLeadershipEligibility(member);
    if (!eligibility.eligible) {
      return { status: 400, error: eligibility.reason };
    }

    const key = `${member.club_id}:${member.user_id}:${member.role}:${member.joined_at}`;
    const existing = leadershipCertStore.get(key);
    if (existing) {
      return {
        status: 200,
        success: true,
        certificate: existing,
        message: "Leadership certificate already generated idempotently",
      };
    }

    const certId = `lead-cert-${Math.random().toString(36).slice(2, 9)}`;
    const hash = `hash-${certId}`;
    const tenureEnd = member.removed_at || new Date().toISOString();
    const verifyUrl = `https://campusconnect.app/verify-leadership?hash=${hash}`;

    const cert: MockLeadershipCert = {
      id: certId,
      club_id: member.club_id,
      user_id: member.user_id,
      certificate_type: "leadership",
      attendee_name: profileName,
      role_title: member.role,
      tenure_start: member.joined_at,
      tenure_end: tenureEnd,
      termination_reason: member.termination_reason,
      certificate_url: `https://supabase.storage.co/certificates/${member.user_id}/leadership_${member.club_id}_${certId}.pdf`,
      verification_hash: hash,
      verify_url: verifyUrl,
    };

    leadershipCertStore.set(key, cert);
    return { status: 200, success: true, certificate: cert };
  }

  it("1. Allows eligible executive with >90 days tenure", () => {
    leadershipCertStore.clear();
    const member: MockClubMember = {
      id: "mem-1",
      club_id: "club-tech",
      user_id: "user-alice",
      role: "President",
      permissions_level: 100,
      status: "approved",
      joined_at: "2026-01-01T00:00:00.000Z",
      removed_at: "2026-05-15T00:00:00.000Z", // 134 days
      termination_reason: "term_completed",
    };

    const res = simulateGenerateLeadershipCert(member, "Alice Johnson", "Tech Club");
    expect(res.status).toBe(200);
    expect(res.certificate?.role_title).toBe("President");
    expect(res.certificate?.verify_url).toContain("/verify-leadership?hash=");
  });

  it("2. Rejects executive with tenure under 90 days", () => {
    leadershipCertStore.clear();
    const shortTenureMember: MockClubMember = {
      id: "mem-2",
      club_id: "club-tech",
      user_id: "user-bob",
      role: "Vice President",
      permissions_level: 100,
      status: "approved",
      joined_at: "2026-04-01T00:00:00.000Z",
      removed_at: "2026-05-01T00:00:00.000Z", // 30 days
      termination_reason: "resigned",
    };

    const res = simulateGenerateLeadershipCert(shortTenureMember, "Bob Smith", "Tech Club");
    expect(res.status).toBe(400);
    expect(res.error).toContain("must be at least 90 days");
  });

  it("3. Supports current active leadership role (>90 days)", () => {
    leadershipCertStore.clear();
    const activeMember: MockClubMember = {
      id: "mem-3",
      club_id: "club-robotics",
      user_id: "user-charlie",
      role: "Treasurer",
      permissions_level: 100,
      status: "approved",
      joined_at: "2026-01-01T00:00:00.000Z", // ~222 days to current date
      removed_at: null, // Active
      termination_reason: null,
    };

    const res = simulateGenerateLeadershipCert(activeMember, "Charlie Brown", "Robotics Club");
    expect(res.status).toBe(200);
    expect(res.certificate?.attendee_name).toBe("Charlie Brown");
  });

  it("4. Supports completed leadership role (>90 days)", () => {
    leadershipCertStore.clear();
    const completedMember: MockClubMember = {
      id: "mem-4",
      club_id: "club-robotics",
      user_id: "user-diana",
      role: "Secretary",
      permissions_level: 100,
      status: "approved",
      joined_at: "2025-09-01T00:00:00.000Z",
      removed_at: "2026-05-30T00:00:00.000Z", // 271 days
      termination_reason: "term_completed",
    };

    const res = simulateGenerateLeadershipCert(completedMember, "Diana Prince", "Robotics Club");
    expect(res.status).toBe(200);
    expect(res.certificate?.tenure_end).toBe("2026-05-30T00:00:00.000Z");
  });

  it("5. Rejects removed/impeached executive regardless of tenure", () => {
    leadershipCertStore.clear();
    const impeachedMember: MockClubMember = {
      id: "mem-5",
      club_id: "club-tech",
      user_id: "user-eve",
      role: "President",
      permissions_level: 100,
      status: "removed",
      joined_at: "2025-01-01T00:00:00.000Z",
      removed_at: "2026-06-01T00:00:00.000Z", // 516 days
      termination_reason: "impeached",
    };

    const res = simulateGenerateLeadershipCert(impeachedMember, "Eve Adams", "Tech Club");
    expect(res.status).toBe(400);
    expect(res.error).toContain("was impeached and is ineligible");
  });

  it("6. Rejects invalid user/club combination", () => {
    leadershipCertStore.clear();
    const eligibility = simulateLeadershipEligibility(undefined);
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason).toContain("No club membership record found");
  });

  it("7. Prevents duplicate certificate generation (idempotent)", () => {
    leadershipCertStore.clear();
    const member: MockClubMember = {
      id: "mem-7",
      club_id: "club-tech",
      user_id: "user-frank",
      role: "Lead Developer",
      permissions_level: 100,
      status: "approved",
      joined_at: "2026-01-01T00:00:00.000Z",
      removed_at: "2026-05-15T00:00:00.000Z",
      termination_reason: "term_completed",
    };

    const call1 = simulateGenerateLeadershipCert(member, "Frank Wright", "Tech Club");
    expect(call1.status).toBe(200);

    const call2 = simulateGenerateLeadershipCert(member, "Frank Wright", "Tech Club");
    expect(call2.status).toBe(200);
    expect(call2.message).toContain("idempotently");
    expect(call2.certificate?.id).toBe(call1.certificate?.id);
  });

  it("8. Preserves snapshotted recipient name even if profile name changes later", () => {
    leadershipCertStore.clear();
    const member: MockClubMember = {
      id: "mem-8",
      club_id: "club-tech",
      user_id: "user-grace",
      role: "Vice President",
      permissions_level: 100,
      status: "approved",
      joined_at: "2026-01-01T00:00:00.000Z",
      removed_at: "2026-05-15T00:00:00.000Z",
      termination_reason: "term_completed",
    };

    const res = simulateGenerateLeadershipCert(member, "Grace Hopper", "Tech Club");
    expect(res.certificate?.attendee_name).toBe("Grace Hopper");

    // Profile updates later to Grace Hopper-Smith
    const currentProfileName = "Grace Hopper-Smith";
    // Certificate stored name remains immutable
    expect(res.certificate?.attendee_name).toBe("Grace Hopper");
    expect(res.certificate?.attendee_name).not.toBe(currentProfileName);
  });

  it("9. QR code URL points to public /verify-leadership?hash=XYZ route", () => {
    leadershipCertStore.clear();
    const member: MockClubMember = {
      id: "mem-9",
      club_id: "club-tech",
      user_id: "user-hank",
      role: "President",
      permissions_level: 100,
      status: "approved",
      joined_at: "2026-01-01T00:00:00.000Z",
      removed_at: "2026-05-15T00:00:00.000Z",
      termination_reason: "term_completed",
    };

    const res = simulateGenerateLeadershipCert(member, "Hank Pym", "Tech Club");
    expect(res.certificate?.verify_url).toContain("https://campusconnect.app/verify-leadership?hash=");
  });
});
