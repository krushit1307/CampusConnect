import { describe, it, expect } from "vitest";
import {
  registerUserFcmToken,
  generateWaitlistPushPayload,
  dispatchWaitlistPromotionPushNotification,
  WaitlistPromotionPushPayload,
} from "./waitlistPromotionPush";

describe("Waitlist Promotion Push Notifications Utility (#4404)", () => {
  const samplePayload: WaitlistPromotionPushPayload = {
    userId: "u-101",
    eventId: "evt-gala-2026",
    eventTitle: "Annual Spring Gala",
    fcmDeviceToken: "fcm_tok_sample_991823",
    claimDeadlineHours: 24,
    claimToken: "claim_token_77",
  };

  it("registers valid FCM device token", () => {
    const token = registerUserFcmToken("u-101", "fcm_tok_sample_991823");
    expect(token).toBe("fcm_tok_sample_991823");
  });

  it("constructs urgent notification text and mobile deep-link URL", () => {
    const push = generateWaitlistPushPayload(samplePayload);

    expect(push.title).toContain("URGENT: Ticket Opened Up for Annual Spring Gala");
    expect(push.body).toContain("You have 24 hours to claim it");
    expect(push.deepLinkUrl).toBe("campusconnect://checkout?event_id=evt-gala-2026&claim_token=claim_token_77");
  });

  it("dispatches high-priority push notification and returns delivery payload", () => {
    const result = dispatchWaitlistPromotionPushNotification(samplePayload);

    expect(result.success).toBe(true);
    expect(result.deepLinkUrl).toContain("campusconnect://checkout?");
    expect(result.title).toContain("Annual Spring Gala");
  });
});
