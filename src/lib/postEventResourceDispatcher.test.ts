import { describe, it, expect } from "vitest";
import {
  filterVerifiedAttendees,
  buildResourceDistributionEmail,
  isEventEligibleForDispatch,
  DisplayableResource,
} from "./postEventResourceDispatcher";

describe("Automated Post-Event Resource Distribution Suite (#3702)", () => {
  const sampleResources: DisplayableResource[] = [
    {
      id: "res_1",
      title: "Slide Deck - Machine Learning 101",
      url: "https://storage.campusconnect.edu/slides/ml101.pdf",
      resourceType: "pdf",
    },
    {
      id: "res_2",
      title: "GitHub Demo Repository",
      url: "https://github.com/example/ml-demo",
      resourceType: "link",
    },
  ];

  it("filters rsvps strictly to verified 'attended' users", () => {
    const rawRsvps = [
      { userId: "usr_1", email: "alice@uni.edu", fullName: "Alice", status: "attended" },
      { userId: "usr_2", email: "bob@uni.edu", fullName: "Bob", status: "attending" }, // No-show/unverified
      { userId: "usr_3", email: "charlie@uni.edu", fullName: "Charlie", status: "declined" },
    ];

    const verified = filterVerifiedAttendees(rawRsvps);

    expect(verified.length).toBe(1);
    expect(verified[0].userId).toBe("usr_1");
  });

  it("builds clean HTML email payloads containing attached resource links", () => {
    const attendee = { userId: "usr_1", email: "alice@uni.edu", fullName: "Alice Smith" };
    const email = buildResourceDistributionEmail(attendee, "AI Workshop", sampleResources);

    expect(email.toEmail).toBe("alice@uni.edu");
    expect(email.subject).toContain("AI Workshop");
    expect(email.htmlBody).toContain("Slide Deck - Machine Learning 101");
    expect(email.htmlBody).toContain("https://storage.campusconnect.edu/slides/ml101.pdf");
  });

  it("identifies events that ended at least 1 hour ago for automated cron processing", () => {
    const now = 1000000000000; // Mock current time
    const endedTwoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
    const ended10MinsAgo = new Date(now - 10 * 60 * 1000).toISOString();

    expect(isEventEligibleForDispatch(endedTwoHoursAgo, now)).toBe(true);
    expect(isEventEligibleForDispatch(ended10MinsAgo, now)).toBe(false);
  });
});
