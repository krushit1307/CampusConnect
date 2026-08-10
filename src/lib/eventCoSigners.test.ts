import { describe, it, expect } from "vitest";

// Mock event and signature records to test approval business logic
export interface MockEvent {
  id: string;
  title: string;
  alcohol_present: boolean;
  max_attendees: number | null;
  off_campus_speaker: boolean;
  is_high_risk: boolean;
  status: "draft" | "pending_signatures" | "published";
}

export interface MockSignature {
  id: string;
  event_id: string;
  signer_role: string;
  signer_name: string;
  signer_email: string;
  signature_token: string;
  signed_at: string | null;
  ip_address: string | null;
}

// business logic helper
export function evaluateEventRiskAndStatus(
  event: MockEvent,
  signatures: MockSignature[],
): MockEvent {
  const isHighRisk =
    event.alcohol_present ||
    (event.max_attendees !== null && event.max_attendees > 200) ||
    event.off_campus_speaker;
  const updatedEvent = { ...event, is_high_risk: isHighRisk };

  if (isHighRisk) {
    const allSigned = signatures
      .filter((s) => s.event_id === event.id)
      .every((s) => s.signed_at !== null);
    if (allSigned) {
      updatedEvent.status = "published";
    } else {
      updatedEvent.status = "pending_signatures";
    }
  } else {
    // If not high risk, defaults to published or scheduled
    if (updatedEvent.status === "pending_signatures") {
      updatedEvent.status = "published";
    }
  }

  return updatedEvent;
}

// Invalidate signatures logic
export function handleEventUpdate(
  oldEvent: MockEvent,
  newEvent: MockEvent,
  signatures: MockSignature[],
): { event: MockEvent; signatures: MockSignature[] } {
  const finalEvent = { ...newEvent };
  let finalSignatures = [...signatures];

  const detailsChanged =
    oldEvent.title !== newEvent.title ||
    oldEvent.alcohol_present !== newEvent.alcohol_present ||
    oldEvent.max_attendees !== newEvent.max_attendees ||
    oldEvent.off_campus_speaker !== newEvent.off_campus_speaker;

  if (detailsChanged && (oldEvent.is_high_risk || newEvent.is_high_risk)) {
    // Invalidate signatures
    finalSignatures = signatures.map((s) => {
      if (s.event_id === oldEvent.id) {
        return { ...s, signed_at: null, ip_address: null };
      }
      return s;
    });
    finalEvent.status = "pending_signatures";
  }

  return { event: finalEvent, signatures: finalSignatures };
}

describe("Event Co-Signers Workflow", () => {
  it("correctly identifies high-risk events", () => {
    const normalEvent: MockEvent = {
      id: "ev-1",
      title: "Clean Campus Drive",
      alcohol_present: false,
      max_attendees: 50,
      off_campus_speaker: false,
      is_high_risk: false,
      status: "draft",
    };

    const alcoholEvent = { ...normalEvent, alcohol_present: true };
    const largeEvent = { ...normalEvent, max_attendees: 250 };
    const speakerEvent = { ...normalEvent, off_campus_speaker: true };

    expect(evaluateEventRiskAndStatus(normalEvent, []).is_high_risk).toBe(false);
    expect(evaluateEventRiskAndStatus(alcoholEvent, []).is_high_risk).toBe(true);
    expect(evaluateEventRiskAndStatus(largeEvent, []).is_high_risk).toBe(true);
    expect(evaluateEventRiskAndStatus(speakerEvent, []).is_high_risk).toBe(true);
  });

  it("blocks publication status without required signatures for high-risk events", () => {
    const highRiskEvent: MockEvent = {
      id: "ev-2",
      title: "Campus Concert",
      alcohol_present: false,
      max_attendees: 500,
      off_campus_speaker: false,
      is_high_risk: true,
      status: "published", // Client attempts to publish directly
    };

    const signatures: MockSignature[] = [
      {
        id: "s1",
        event_id: "ev-2",
        signer_role: "Advisor",
        signer_name: "Adv",
        signer_email: "a@c.t",
        signature_token: "t1",
        signed_at: null,
        ip_address: null,
      },
      {
        id: "s2",
        event_id: "ev-2",
        signer_role: "Dean",
        signer_name: "Dn",
        signer_email: "d@c.t",
        signature_token: "t2",
        signed_at: null,
        ip_address: null,
      },
    ];

    const result = evaluateEventRiskAndStatus(highRiskEvent, signatures);
    expect(result.status).toBe("pending_signatures"); // Forced to pending
  });

  it("permits publication only when all required signatures are present", () => {
    const highRiskEvent: MockEvent = {
      id: "ev-3",
      title: "TEDx Campus",
      alcohol_present: false,
      max_attendees: 100,
      off_campus_speaker: true,
      is_high_risk: true,
      status: "published",
    };

    const signatures: MockSignature[] = [
      {
        id: "s1",
        event_id: "ev-3",
        signer_role: "Advisor",
        signer_name: "Adv",
        signer_email: "a@c.t",
        signature_token: "t1",
        signed_at: "2026-08-10T12:00:00Z",
        ip_address: "1.1.1.1",
      },
      {
        id: "s2",
        event_id: "ev-3",
        signer_role: "Dean",
        signer_name: "Dn",
        signer_email: "d@c.t",
        signature_token: "t2",
        signed_at: "2026-08-10T12:05:00Z",
        ip_address: "1.1.1.2",
      },
    ];

    const result = evaluateEventRiskAndStatus(highRiskEvent, signatures);
    expect(result.status).toBe("published");
  });

  it("invalidates signatures and resets status if approved event details change", () => {
    const approvedEvent: MockEvent = {
      id: "ev-4",
      title: "Wine & Cheese Gathering",
      alcohol_present: true,
      max_attendees: 150,
      off_campus_speaker: false,
      is_high_risk: true,
      status: "published",
    };

    const signatures: MockSignature[] = [
      {
        id: "s1",
        event_id: "ev-4",
        signer_role: "Advisor",
        signer_name: "Adv",
        signer_email: "a@c.t",
        signature_token: "t1",
        signed_at: "2026-08-10T12:00:00Z",
        ip_address: "1.1.1.1",
      },
    ];

    // Modify details
    const editedEvent = { ...approvedEvent, title: "Beer & Cheese Gathering" };

    const { event, signatures: updatedSigs } = handleEventUpdate(
      approvedEvent,
      editedEvent,
      signatures,
    );

    expect(event.status).toBe("pending_signatures");
    expect(updatedSigs[0].signed_at).toBeNull();
    expect(updatedSigs[0].ip_address).toBeNull();
  });
});
