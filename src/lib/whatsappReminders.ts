export type PreferredContactMethod = "sms" | "whatsapp" | "email";

export interface UserNotificationPreferences {
  userId: string;
  email: string;
  phoneNumber?: string;
  preferredMethod: PreferredContactMethod;
  whatsappOptIn: boolean;
}

export interface EventReminderDetails {
  eventId: string;
  eventTitle: string;
  startTimeText: string;
  locationName: string;
}

export interface TwilioWhatsAppPayload {
  to: string; // e.g. "whatsapp:+1234567890"
  from: string; // e.g. "whatsapp:+14155238886"
  contentSid: string; // Pre-approved WhatsApp Business Template ID
  contentVariables: Record<string, string>;
}

export interface NotificationDispatchResult {
  channelUsed: PreferredContactMethod;
  recipientAddress: string;
  whatsappPayload?: TwilioWhatsAppPayload;
  isFallback: boolean;
  reason?: string;
}

export const TWILIO_WHATSAPP_NUMBER = "whatsapp:+14155238886";
export const REMINDER_TEMPLATE_SID = "HX1234567890abcdef1234567890abcd";

/**
 * Formats E.164 phone numbers into Twilio WhatsApp format.
 */
export function formatWhatsAppRecipientNumber(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/[^\d+]/g, "");
  const e164 = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
  return `whatsapp:${e164}`;
}

/**
 * Routes event reminders based on user preference, opt-in status, and number validity.
 */
export function routeEventReminder(
  user: UserNotificationPreferences,
  event: EventReminderDetails,
): NotificationDispatchResult {
  // If user explicitly prefers WhatsApp AND has opted in AND provided a phone number
  if (user.preferredMethod === "whatsapp") {
    if (!user.whatsappOptIn) {
      return {
        channelUsed: "email",
        recipientAddress: user.email,
        isFallback: true,
        reason: "WhatsApp opt-in consent flag is set to false. Falling back to email.",
      };
    }

    if (!user.phoneNumber) {
      return {
        channelUsed: "email",
        recipientAddress: user.email,
        isFallback: true,
        reason: "No phone number registered for WhatsApp delivery. Falling back to email.",
      };
    }

    const whatsappTo = formatWhatsAppRecipientNumber(user.phoneNumber);

    return {
      channelUsed: "whatsapp",
      recipientAddress: whatsappTo,
      isFallback: false,
      whatsappPayload: {
        to: whatsappTo,
        from: TWILIO_WHATSAPP_NUMBER,
        contentSid: REMINDER_TEMPLATE_SID,
        contentVariables: {
          "1": event.eventTitle,
          "2": event.startTimeText,
          "3": event.locationName,
        },
      },
    };
  }

  if (user.preferredMethod === "sms" && user.phoneNumber) {
    return {
      channelUsed: "sms",
      recipientAddress: user.phoneNumber,
      isFallback: false,
    };
  }

  // Default to email
  return {
    channelUsed: "email",
    recipientAddress: user.email,
    isFallback: false,
  };
}

/**
 * Handles webhook delivery failure triggers, falling back to email notification.
 */
export function handleDeliveryFailureFallback(
  failedChannel: PreferredContactMethod,
  userEmail: string,
  failureReason: string,
): NotificationDispatchResult {
  return {
    channelUsed: "email",
    recipientAddress: userEmail,
    isFallback: true,
    reason: `Failed to deliver via ${failedChannel.toUpperCase()} (${failureReason}). Fallback email dispatched.`,
  };
}
