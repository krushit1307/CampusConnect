/**
 * Tag subscription alert copy (#4427).
 */
export function buildTagSubscriptionAlertMessage(clubName: string, tagName: string): string {
  const tag = (tagName || "").replace(/^#/, "").trim() || "Campus";
  const club = clubName?.trim() || "a campus club";
  return `New Event Alert: The ${club} just posted a #${tag} event! RSVP now.`;
}
