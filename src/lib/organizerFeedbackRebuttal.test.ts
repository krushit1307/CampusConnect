import { describe, it, expect } from "vitest";
import {
  validateOrganizerRebuttalText,
  getOrganizerRebuttalContainerProps,
  buildOrganizerResponseNotification,
  EventReview,
} from "./organizerFeedbackRebuttal";

describe("Implement Automated Event Feedback Organizer Rebuttal Suite (#4519)", () => {
  const sampleReview: EventReview = {
    id: "rev_101",
    eventId: "evt_pizza_party",
    eventTitle: "Annual Pizza Night",
    reviewerUserId: "usr_student_alice",
    reviewerEmail: "alice@university.edu",
    reviewerName: "Alice Smith",
    rating: 1,
    reviewComment: "The pizza was terrible.",
    isPublic: true,
  };

  it("validates rebuttal text length and empty constraints", () => {
    expect(validateOrganizerRebuttalText("").isValid).toBe(false);
    expect(validateOrganizerRebuttalText("   ").isValid).toBe(false);
    expect(validateOrganizerRebuttalText("We ordered from the place YOU voted for.").isValid).toBe(
      true,
    );
  });

  it("returns distinct container CSS properties for Yelp/Google Reviews style rendering", () => {
    const props = getOrganizerRebuttalContainerProps(
      "We ordered from the place YOU voted for.",
      "2026-08-25T12:00:00Z",
    );

    expect(props.responseBody).toBe("We ordered from the place YOU voted for.");
    expect(props.containerCss).toContain("border-l-4 border-indigo-500");
    expect(props.containerCss).toContain("bg-gray-50");
  });

  it("constructs automated notification payload for original reviewer", () => {
    const rebuttal = "We ordered from the place YOU voted for.";
    const notif = buildOrganizerResponseNotification(sampleReview, rebuttal);

    expect(notif.recipientEmail).toBe("alice@university.edu");
    expect(notif.subject).toBe("Response to your review for Annual Pizza Night");
    expect(notif.bodyText).toContain(
      'The Organizer has responded to your feedback for "Annual Pizza Night"',
    );
    expect(notif.bodyText).toContain('"We ordered from the place YOU voted for."');
    expect(notif.actionUrl).toBe("/events/evt_pizza_party/reviews#review-rev_101");
  });
});
