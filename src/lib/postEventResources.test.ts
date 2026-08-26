import { describe, it, expect } from "vitest";
import {
  validateResourceInput,
  filterResourcesForUser,
  buildPostEventThankYouEmail,
  EventResourceItem,
} from "./postEventResources";

describe("Post-Event Resource Hub Suite (#3002)", () => {
  const sampleResources: EventResourceItem[] = [
    {
      id: "res_1",
      eventId: "evt_100",
      title: "Public Slide Deck",
      url: "https://storage.campusconnect.edu/slides.pdf",
      resourceType: "pdf",
      isPrivate: false,
      uploadedBy: "usr_speaker",
      createdAt: "2026-08-01T10:00:00Z",
    },
    {
      id: "res_2",
      eventId: "evt_100",
      title: "Exclusive Attendee Code Repo",
      url: "https://github.com/example/private-demo",
      resourceType: "link",
      isPrivate: true,
      uploadedBy: "usr_speaker",
      createdAt: "2026-08-01T10:05:00Z",
    },
  ];

  it("validates resource creation inputs accurately", () => {
    expect(
      validateResourceInput({
        title: "Workshop Slides",
        url: "https://example.com/slides.pdf",
        resourceType: "pdf",
      }).isValid,
    ).toBe(true);

    expect(
      validateResourceInput({
        title: "",
        url: "https://example.com/slides.pdf",
        resourceType: "pdf",
      }).isValid,
    ).toBe(false);

    expect(
      validateResourceInput({
        title: "Workshop Slides",
        url: "https://example.com",
        resourceType: "invalid_type",
      }).isValid,
    ).toBe(false);
  });

  it("restricts private resources to verified attendees only", () => {
    // Non-attendee context
    const nonAttendeeResult = filterResourcesForUser(sampleResources, {
      userId: "usr_guest",
      hasAttended: false,
    });
    expect(nonAttendeeResult.length).toBe(1);
    expect(nonAttendeeResult[0].id).toBe("res_1");

    // Verified attendee context
    const attendeeResult = filterResourcesForUser(sampleResources, {
      userId: "usr_student",
      hasAttended: true,
    });
    expect(attendeeResult.length).toBe(2);
  });

  it("builds post-event thank you email with direct Resource Hub link", () => {
    const email = buildPostEventThankYouEmail("AI Seminar 2026", "evt_100");

    expect(email.subject).toContain("AI Seminar 2026");
    expect(email.resourceHubUrl).toBe("https://campusconnect.edu/events/evt_100?tab=resources");
    expect(email.bodyHtml).toContain("tab=resources");
  });
});
