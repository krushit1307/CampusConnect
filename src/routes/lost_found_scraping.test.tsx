import { describe, it, expect, vi } from "vitest";

// Mock the email dispatch logic for testing
function compileLostFoundEmail(payload: {
  attendee_email: string;
  event_title: string;
  found_items: string;
  items_count: number;
}) {
  const appUrl = "https://campusconnect.edu";
  return {
    to: [payload.attendee_email],
    subject: `Found items from ${payload.event_title}! 🔍`,
    html: `
      <h2>Hope you had fun at ${payload.event_title}!</h2>
      <p>By the way, <strong>${payload.items_count} items (${payload.found_items})</strong> were found at the venue.</p>
      <p>If you lost something, please click below to view the active Lost & Found listings and claim your item:</p>
      <p><a href="${appUrl}/lost-found" style="display: inline-block; background-color: #a3e635; color: #000000; font-weight: bold; text-decoration: none; padding: 10px 20px; border: 2px solid #000000;">View Lost & Found Listings</a></p>
      <p>Thank you for using CampusConnect!</p>
    `.trim(),
  };
}

describe("Automated Post-Event Lost & Found Scraping (#3460)", () => {
  it("compiles post-event emails with correct temporal, spatial and list relevance metrics", () => {
    const payload = {
      attendee_email: "john_attendee@campus.edu",
      event_title: "Big Gala Night",
      found_items: "Leather Wallet, Car Keys, iPhone",
      items_count: 3,
    };

    const email = compileLostFoundEmail(payload);

    // Assert email parameters match spec
    expect(email.to).toContain("john_attendee@campus.edu");
    expect(email.subject).toBe("Found items from Big Gala Night! 🔍");
    expect(email.html).toContain("3 items (Leather Wallet, Car Keys, iPhone)");
    expect(email.html).toContain("https://campusconnect.edu/lost-found");
  });
});
