export function getNotificationLink(
  type: string,
  metadata: Record<string, unknown> | null | undefined,
  fallbackLink?: string | null,
): string | undefined {
  if (!metadata || typeof metadata !== "object") {
    return fallbackLink || undefined;
  }

  switch (type) {
    case "event":
    case "event_rsvp":
    case "event_invite":
    case "event_update":
      if (metadata.event_id) return `/events/${metadata.event_id}`;
      break;
    case "club":
    case "club_application_approved":
    case "club_invite":
      if (metadata.club_id) return `/clubs/${metadata.club_id}`;
      break;
    case "mention":
    case "reply":
    case "post_like":
      if (metadata.post_id) {
        if (metadata.comment_id) {
          return `/posts/${metadata.post_id}#comment-${metadata.comment_id}`;
        }
        return `/posts/${metadata.post_id}`;
      }
      break;
    case "message":
    case "new_message":
      return "/messages";
  }
  return fallbackLink || undefined;
}
