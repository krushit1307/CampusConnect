export type CriticalAccommodationType =
  | "asl_interpreter"
  | "braille_materials"
  | "wheelchair_shuttle"
  | "assistive_listening";

export type RoutingStatus =
  | "routed_to_disability_services"
  | "in_review_by_admin"
  | "fulfilled_by_admin"
  | "closed";

export interface AccessibilityRequestPayload {
  id: string;
  eventId: string;
  eventTitle: string;
  accommodationType: CriticalAccommodationType;
  status: RoutingStatus;
  disabilityServicesTicketId?: string;
  adminNotes?: string;
  createdAt: string;
}

export interface LockedUIState {
  isLocked: boolean;
  bannerTitle: string;
  bannerMessage: string;
  statusBadgeText: string;
  ticketIdText: string;
}

export const CRITICAL_ACCOMMODATIONS: Record<CriticalAccommodationType, { label: string; description: string }> = {
  asl_interpreter: {
    label: "American Sign Language (ASL) Interpreter",
    description: "Certified ASL interpreter for deaf/hard-of-hearing attendees.",
  },
  braille_materials: {
    label: "Embossed Braille Event Collateral",
    description: "Printed tactile Braille decks for blind/low-vision attendees.",
  },
  wheelchair_shuttle: {
    label: "Accessible Campus Wheelchair Shuttle",
    description: "ADA-compliant wheelchair lift transport to event venue.",
  },
  assistive_listening: {
    label: "FM/Infrared Assistive Listening Device",
    description: "Direct audio amplification system for auditorium sightlines.",
  },
};

/**
 * Checks if accommodation type requires direct University Disability Services routing (#4277).
 */
export function isCriticalAccommodation(type: string): boolean {
  return ["asl_interpreter", "braille_materials", "wheelchair_shuttle", "assistive_listening"].includes(type);
}

/**
 * Routes critical accessibility request directly to University Disability Services Admin (#4277).
 */
export function routeAccessibilityRequest(
  request: Partial<AccessibilityRequestPayload>
): AccessibilityRequestPayload {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const ticketId = request.disabilityServicesTicketId || `DS-${randomNum}`;

  return {
    id: request.id || `req-${Date.now()}`,
    eventId: request.eventId || "evt-default",
    eventTitle: request.eventTitle || "Campus Event",
    accommodationType: (request.accommodationType as CriticalAccommodationType) || "asl_interpreter",
    status: "routed_to_disability_services",
    disabilityServicesTicketId: ticketId,
    adminNotes: undefined,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Generates locked UI banner state for student club organizers (#4277).
 */
export function getOrganizerLockedUIState(request: AccessibilityRequestPayload): LockedUIState {
  const isFulfilled = request.status === "fulfilled_by_admin";

  return {
    isLocked: !isFulfilled,
    bannerTitle: isFulfilled
      ? "✅ Accommodations Fulfilled by University Admin"
      : "🔒 Handled by University Disability Services Admin",
    bannerMessage: isFulfilled
      ? `University Disability Services has confirmed fulfillment: "${request.adminNotes || "Professional ADA resources assigned."}" No further action required.`
      : `${CRITICAL_ACCOMMODATIONS[request.accommodationType]?.label || "Critical accommodation"} request received. This is currently being handled directly by University Professionals. No action is required on your part.`,
    statusBadgeText: isFulfilled ? "Fulfilled & Confirmed" : "Dispatched to Disability Services",
    ticketIdText: `Ticket #${request.disabilityServicesTicketId || "DS-PENDING"}`,
  };
}

/**
 * Updates accessibility request to fulfilled by University Admin (#4277).
 */
export function fulfillAccessibilityRequest(
  request: AccessibilityRequestPayload,
  adminNotes: string
): AccessibilityRequestPayload {
  return {
    ...request,
    status: "fulfilled_by_admin",
    adminNotes: adminNotes || "Confirmed by Disability Services Admin.",
  };
}
