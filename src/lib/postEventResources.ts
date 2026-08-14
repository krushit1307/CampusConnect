export interface EventResourceItem {
  id: string;
  eventId: string;
  title: string;
  url: string;
  resourceType: "pdf" | "link" | "video";
  isPrivate: boolean;
  uploadedBy: string;
  createdAt: string;
}

export interface UserResourceAccessContext {
  userId: string;
  hasAttended: boolean;
}

/**
 * Validates resource payload inputs before creation or database persistence.
 */
export function validateResourceInput(input: {
  title: string;
  url: string;
  resourceType: string;
}): { isValid: boolean; error?: string } {
  if (!input.title || input.title.trim().length === 0) {
    return { isValid: false, error: "Resource title is required." };
  }

  if (!input.url || input.url.trim().length === 0) {
    return { isValid: false, error: "Resource URL is required." };
  }

  const validTypes = ["pdf", "link", "video"];
  if (!validTypes.includes(input.resourceType)) {
    return { isValid: false, error: "Invalid resource type. Must be 'pdf', 'link', or 'video'." };
  }

  return { isValid: true };
}

/**
 * Filters visible resources based on whether the user physically attended the event.
 */
export function filterResourcesForUser(
  resources: EventResourceItem[],
  userContext: UserResourceAccessContext,
): EventResourceItem[] {
  return resources.filter((res) => {
    if (!res.isPrivate) return true; // Public resources visible to everyone
    return userContext.hasAttended; // Private resources require verified attendance
  });
}

/**
 * Constructs automated post-event follow-up email content 24 hours after event completion.
 */
export function buildPostEventThankYouEmail(
  eventTitle: string,
  eventId: string,
  baseUrl = "https://campusconnect.edu",
): { subject: string; bodyHtml: string; resourceHubUrl: string } {
  const resourceHubUrl = `${baseUrl}/events/${eventId}?tab=resources`;
  const subject = `Thank you for attending ${eventTitle} - Presentation Slides & Resources`;

  const bodyHtml = `
    <h2>Thank you for joining us!</h2>
    <p>We hope you enjoyed <strong>${eventTitle}</strong>.</p>
    <p>The speaker slides, video recordings, and shared materials are now available in the Resource Hub.</p>
    <p><a href="${resourceHubUrl}">Access Event Resources</a></p>
  `.trim();

  return { subject, bodyHtml, resourceHubUrl };
}
