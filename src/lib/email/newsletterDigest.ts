export interface DigestEventItem {
  id: string;
  title: string;
  event_date: string;
  location?: string | null;
  clubs?: { name: string } | { name: string }[] | null;
}

export interface NewsletterDigestParams {
  events: DigestEventItem[];
  appUrl?: string;
}

/**
 * Safely escapes HTML special characters to prevent XSS.
 */
export function escapeHtml(unsafe: string): string {
  return (unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Formats ISO date string nicely for email digests.
 */
export function formatDigestDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

/**
 * Compiles dynamic HTML template for the weekly events digest.
 */
export function compileNewsletterDigestHtml({
  events,
  appUrl = "https://campusconnect.app",
}: NewsletterDigestParams): string {
  const safeAppUrl = escapeHtml(appUrl);

  const eventItemsHtml = events
    .map((event) => {
      const clubName = event.clubs
        ? Array.isArray(event.clubs)
          ? event.clubs[0]?.name
          : event.clubs.name
        : "Campus Club";
      const formattedDate = formatDigestDate(event.event_date);
      const safeTitle = escapeHtml(event.title);
      const safeClub = escapeHtml(clubName || "Campus Club");
      const safeLocation = escapeHtml(event.location || "TBA");
      const eventUrl = `${safeAppUrl}/events/${escapeHtml(event.id)}`;

      return `
        <div style="margin-bottom: 20px; padding: 16px; border: 2px solid #000000; background-color: #f7f7f5;">
          <div style="font-size: 11px; font-weight: 800; font-family: monospace; text-transform: uppercase; color: #4b5563; margin-bottom: 4px;">
            ${safeClub} &bull; ${formattedDate}
          </div>
          <div style="font-size: 18px; font-weight: 900; margin-bottom: 8px;">
            ${safeTitle}
          </div>
          <div style="font-size: 13px; font-family: monospace; color: #374151; margin-bottom: 12px;">
            📍 Location: ${safeLocation}
          </div>
          <a href="${eventUrl}" target="_blank" style="display: inline-block; background-color: #a3e635; color: #000000; font-weight: 800; font-family: monospace; text-transform: uppercase; text-decoration: none; padding: 8px 16px; border: 2px solid #000000; font-size: 12px;">
            View Event Details &rarr;
          </a>
        </div>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CampusConnect Weekly Digest - Upcoming Events</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f5; color: #000000; margin: 0; padding: 0;">
  <div style="max-width: 580px; margin: 32px auto; background-color: #ffffff; border: 3px solid #000000; box-shadow: 6px 6px 0px #000000; padding: 28px;">
    <div style="font-size: 24px; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 3px solid #000000;">
      CAMPUS<span style="background-color: #000000; color: #ffffff; padding: 2px 8px;">CONNECT</span>
      <div style="font-size: 12px; font-family: monospace; font-weight: 700; color: #4b5563; margin-top: 4px; text-transform: uppercase;">
        📅 Upcoming Events Digest (Next 7 Days)
      </div>
    </div>
    <div style="font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
      <p>Hey there! Here are the exciting events happening across campus over the next 7 days:</p>
      ${eventItemsHtml}
    </div>
    <div style="text-align: center; margin: 28px 0 16px 0;">
      <a href="${safeAppUrl}/events" target="_blank" style="display: inline-block; background-color: #000000; color: #ffffff; font-weight: 800; font-family: monospace; text-transform: uppercase; text-decoration: none; padding: 12px 24px; border: 2px solid #000000; font-size: 13px;">
        Explore All Events on CampusConnect &rarr;
      </a>
    </div>
    <div style="margin-top: 32px; font-size: 11px; font-family: monospace; color: #6b7280; border-top: 2px solid #e5e7eb; padding-top: 16px;">
      <p>You received this email because you opted into the weekly CampusConnect newsletter digest.</p>
      <p>To update your email notification preferences, visit <a href="${safeAppUrl}/settings" style="color: #2563eb;">your account settings</a>.</p>
    </div>
  </div>
</body>
</html>
`.trim();
}

/**
 * Compiles dynamic Plain Text template for the weekly events digest.
 */
export function compileNewsletterDigestText({
  events,
  appUrl = "https://campusconnect.app",
}: NewsletterDigestParams): string {
  const eventList = events
    .map((event, index) => {
      const clubName = event.clubs
        ? Array.isArray(event.clubs)
          ? event.clubs[0]?.name
          : event.clubs.name
        : "Campus Club";
      const formattedDate = formatDigestDate(event.event_date);
      return `${index + 1}. ${event.title}
   Club: ${clubName}
   Date: ${formattedDate}
   Location: ${event.location || "TBA"}
   Link: ${appUrl}/events/${event.id}`;
    })
    .join("\n\n");

  return `
CAMPUSCONNECT - Upcoming Events Digest (Next 7 Days)

Here are the events happening across campus over the next 7 days:

${eventList}

Visit all events: ${appUrl}/events

You received this email because you opted into the weekly CampusConnect newsletter digest.
Update preferences at ${appUrl}/settings
`.trim();
}
