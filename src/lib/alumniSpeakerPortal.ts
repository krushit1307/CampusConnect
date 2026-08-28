export interface AlumniProfile {
  alumniId: string;
  fullName: string;
  email: string;
  currentRoleCompany: string;
  headshotUrl: string;
  bio: string;
}

export interface SpeakerRequestRfp {
  id?: string;
  clubId: string;
  clubName: string;
  alumniId: string;
  eventId?: string;
  topic: string;
  eventDateIso: string;
  honorariumBudget: number;
  status: "pending" | "accepted" | "declined";
}

export interface SpeakerDecisionResult {
  requestId: string;
  status: "accepted" | "declined";
  speakerMeta?: {
    name: string;
    headshotUrl: string;
    bio: string;
  };
}

/**
 * Validates RFP parameters before submitting an invitation to an Alumni speaker.
 */
export function validateSpeakerRequestRfp(rfp: Partial<SpeakerRequestRfp>): {
  isValid: boolean;
  error?: string;
} {
  if (!rfp.clubId || !rfp.alumniId) {
    return { isValid: false, error: "Missing required club or alumni identifiers." };
  }

  if (!rfp.topic || rfp.topic.trim().length < 5) {
    return {
      isValid: false,
      error: "Please provide a detailed presentation topic (at least 5 characters).",
    };
  }

  if (!rfp.eventDateIso || new Date(rfp.eventDateIso).getTime() <= Date.now()) {
    return { isValid: false, error: "Event date must be scheduled in the future." };
  }

  return { isValid: true };
}

/**
 * Generates email invitation payload sent to alumni featuring action links.
 */
export function buildAlumniInvitationEmail(rfp: SpeakerRequestRfp, alumni: AlumniProfile) {
  const formattedBudget = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(rfp.honorariumBudget);

  const formattedDate = new Date(rfp.eventDateIso).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return {
    recipientEmail: alumni.email,
    subject: `Guest Speaker Invitation: ${rfp.topic} (${rfp.clubName})`,
    bodyHtml: `
      <h2>Hello ${alumni.fullName},</h2>
      <p><strong>${rfp.clubName}</strong> would love to invite you as a Guest Speaker for their upcoming event on <strong>${rfp.topic}</strong>.</p>
      <ul>
        <li><strong>Event Date:</strong> ${formattedDate}</li>
        <li><strong>Honorarium Offered:</strong> ${formattedBudget}</li>
      </ul>
      <div style="margin-top: 20px;">
        <a href="https://campusconnect.edu/alumni/requests/${rfp.id}?action=accept" style="background-color: #16a34a; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 10px;">Accept Request</a>
        <a href="https://campusconnect.edu/alumni/requests/${rfp.id}?action=decline" style="background-color: #dc2626; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Decline Request</a>
      </div>
    `.trim(),
  };
}

/**
 * Processes alumni decision and maps profile details to event draft upon acceptance.
 */
export function processAlumniDecision(
  rfp: SpeakerRequestRfp,
  decision: "accept" | "decline",
  alumni: AlumniProfile,
): SpeakerDecisionResult {
  if (decision === "accept") {
    return {
      requestId: rfp.id || "req_temp",
      status: "accepted",
      speakerMeta: {
        name: alumni.fullName,
        headshotUrl: alumni.headshotUrl,
        bio: alumni.bio,
      },
    };
  }

  return {
    requestId: rfp.id || "req_temp",
    status: "declined",
  };
}
