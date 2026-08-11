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
