export interface DisplayableResource {
  id: string;
  title: string;
  url: string;
  resourceType: "pdf" | "link" | "video";
}

export interface AttendedAttendee {
  userId: string;
  email: string;
  fullName: string;
}

export interface ResourceEmailPayload {
  toEmail: string;
  subject: string;
  htmlBody: string;
}

/**
 * Filters attendees strictly to those who physically attended the event (status === 'attended').
 */
export function filterVerifiedAttendees(
  rsvps: Array<{ userId: string; email: string; fullName: string; status: string }>,
): AttendedAttendee[] {
  return rsvps
    .filter((r) => r.status === "attended")
    .map((r) => ({
      userId: r.userId,
      email: r.email,
      fullName: r.fullName,
    }));
}

/**
 * Builds SendGrid HTML email template containing slide decks and resources for verified attendees.
 */
export function buildResourceDistributionEmail(
  attendee: AttendedAttendee,
  eventTitle: string,
  resources: DisplayableResource[],
): ResourceEmailPayload {
  const subject = `Your Post-Event Resources for ${eventTitle}`;

  const resourceListHtml = resources
    .map(
      (res) =>
        `<li style="margin-bottom: 8px;"><strong>${res.title}</strong> (${res.resourceType.toUpperCase()}): <a href="${res.url}">View Resource</a></li>`,
    )
    .join("");

  const htmlBody = `
    <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
      <h2>Hi ${attendee.fullName},</h2>
      <p>Thank you for attending <strong>${eventTitle}</strong>!</p>
      <p>As promised, here are the speaker slides, references, and educational materials from the session:</p>
      <ul>
        ${resourceListHtml}
      </ul>
      <p>Best regards,<br/>CampusConnect Team</p>
    </div>
  `.trim();

  return {
    toEmail: attendee.email,
    subject,
    htmlBody,
  };
}

/**
 * Evaluates whether an event ended 1 or more hours ago and is eligible for automated cron dispatch.
 */
export function isEventEligibleForDispatch(
  eventEndTimeIso: string,
  nowMs: number = Date.now(),
): boolean {
  const endTimeMs = new Date(eventEndTimeIso).getTime();
  const oneHourInMs = 60 * 60 * 1000;
  return nowMs - endTimeMs >= oneHourInMs;
}
