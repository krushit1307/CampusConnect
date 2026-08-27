import { describe, it, expect } from "vitest";
import {
  formatWhatsAppRecipientNumber,
  routeEventReminder,
  handleDeliveryFailureFallback,
  UserNotificationPreferences,
  EventReminderDetails,
  TWILIO_WHATSAPP_NUMBER,
} from "./whatsappReminders";

describe("Automated WhatsApp Event Reminders Suite (#2996)", () => {
  const sampleEvent: EventReminderDetails = {
    eventId: "evt_gala_99",
    eventTitle: "International Food Festival",
    startTimeText: "Today at 6:00 PM",
    locationName: "Student Center Plaza",
  };

  it("formats international phone numbers into Twilio WhatsApp format", () => {
    expect(formatWhatsAppRecipientNumber("+1 (555) 234-5678")).toBe("whatsapp:+15552345678");
    expect(formatWhatsAppRecipientNumber("447911123456")).toBe("whatsapp:+447911123456");
  });

  it("routes notification via WhatsApp when user prefers WhatsApp and has opted in", () => {
    const user: UserNotificationPreferences = {
      userId: "usr_intl_student",
      email: "student@university.edu",
      phoneNumber: "+15551234567",
      preferredMethod: "whatsapp",
      whatsappOptIn: true,
    };

    const dispatch = routeEventReminder(user, sampleEvent);

    expect(dispatch.channelUsed).toBe("whatsapp");
    expect(dispatch.isFallback).toBe(false);
    expect(dispatch.whatsappPayload?.to).toBe("whatsapp:+15551234567");
    expect(dispatch.whatsappPayload?.from).toBe(TWILIO_WHATSAPP_NUMBER);
    expect(dispatch.whatsappPayload?.contentVariables["1"]).toBe("International Food Festival");
  });

  it("falls back to email if user selects WhatsApp but has not opted in or lacks phone number", () => {
    const noOptInUser: UserNotificationPreferences = {
      userId: "usr_no_optin",
      email: "student@university.edu",
      phoneNumber: "+15551234567",
      preferredMethod: "whatsapp",
      whatsappOptIn: false, // Opt-in false
    };

    const dispatch = routeEventReminder(noOptInUser, sampleEvent);

    expect(dispatch.channelUsed).toBe("email");
    expect(dispatch.isFallback).toBe(true);
    expect(dispatch.reason).toContain("opt-in consent flag is set to false");
  });

  it("handles webhook delivery failures and dispatches email fallback", () => {
    const fallback = handleDeliveryFailureFallback(
      "whatsapp",
      "student@university.edu",
      "Invalid WhatsApp Number",
    );

    expect(fallback.channelUsed).toBe("email");
    expect(fallback.isFallback).toBe(true);
    expect(fallback.reason).toContain("Failed to deliver via WHATSAPP");
  });
});
