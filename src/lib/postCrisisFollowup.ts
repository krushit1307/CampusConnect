export interface CrisisInterventionRecord {
  id: string;
  userId: string;
  userEmail: string;
  fullName: string;
  triggeredAtIso: string;
  followupDueAtIso: string;
  followupStatus: "pending" | "sent" | "failed" | "opted_out";
}

export interface CrisisFollowupEmailPayload {
  recipientEmail: string;
  replyToEmail: string;
  subject: string;
  bodyText: string;
}

export const MONITORED_HEALTH_STAFF_EMAIL = "health-support@campusconnect.edu";
export const FOLLOWUP_DELAY_HOURS = 48;

/**
 * Calculates the exact 48-hour follow-up timestamp for a crisis intervention event.
 */
export function calculateFollowupDueDate(triggeredAt: Date): Date {
  const dueDate = new Date(triggeredAt.getTime());
  dueDate.setHours(dueDate.getHours() + FOLLOWUP_DELAY_HOURS);
  return dueDate;
}

/**
 * Determines whether a pending crisis intervention is due for automated 48-hour check-in dispatch.
 */
export function isFollowupDue(followupDueAtIso: string, currentDate: Date = new Date()): boolean {
  return currentDate.getTime() >= new Date(followupDueAtIso).getTime();
}

/**
 * Constructs a gentle, personalized check-in email payload routed to University Health staff.
 */
export function buildCrisisFollowupEmail(
  record: CrisisInterventionRecord,
): CrisisFollowupEmailPayload {
  const firstName = record.fullName.trim().split(" ")[0] || "there";

  const bodyText = [
    `Hi ${firstName},`,
    ``,
    `Checking in. Were you able to connect with someone at the Counseling Center?`,
    `If not, you can reply directly to this email for help.`,
    ``,
    `Warm regards,`,
    `University Student Health & Wellness Team`,
  ].join("\n");

  return {
    recipientEmail: record.userEmail,
    replyToEmail: MONITORED_HEALTH_STAFF_EMAIL,
    subject: "Checking in - Campus Student Wellness",
    bodyText,
  };
}
