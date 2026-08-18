import { describe, expect, it } from "vitest";
import {
  EVENT_SPAM_RATE_LIMIT,
  EVENT_SPAM_SIMILARITY_THRESHOLD,
  getEventSpamErrorMessage,
  isPendingSpamReview,
} from "./eventSpam";

describe("event spam moderation helpers", () => {
  it("matches the issue thresholds", () => {
    expect(EVENT_SPAM_RATE_LIMIT).toBe(5);
    expect(EVENT_SPAM_SIMILARITY_THRESHOLD).toBe(0.95);
  });

  it("recognizes quarantined events", () => {
    expect(isPendingSpamReview("pending_spam_review")).toBe(true);
    expect(isPendingSpamReview("published")).toBe(false);
  });

  it("turns the database rate-limit error into actionable feedback", () => {
    expect(getEventSpamErrorMessage(new Error("event_rate_limit_exceeded"))).toContain(
      `${EVENT_SPAM_RATE_LIMIT} events per hour`,
    );
    expect(getEventSpamErrorMessage(new Error("network failure"))).toBeNull();
  });
});
