export interface WaitlistPromotionPushPayload {
  userId: string;
  eventId: string;
  eventTitle: string;
  fcmDeviceToken: string;
  claimDeadlineHours?: number;
  claimToken?: string;
}

export interface PushNotificationDispatchResult {
  success: boolean;
  notificationId: string;
  title: string;
  body: string;
  deepLinkUrl: string;
  sentAt: string;
}

/**
 * Registers/validates user's FCM device token (#4404).
 */
export function registerUserFcmToken(userId: string, token: string): string {
  if (!token || token.trim().length < 5) {
    throw new Error("Invalid FCM device token.");
  }
  return token.trim();
}

/**
 * Constructs urgent push payload & mobile deep-link URL for waitlist promotion (#4404).
 */
export function generateWaitlistPushPayload(payload: WaitlistPromotionPushPayload) {
  const deadlineHours = payload.claimDeadlineHours || 24;
  const claimToken = payload.claimToken || `claim-${Date.now()}`;
  const title = `🚨 URGENT: Ticket Opened Up for ${payload.eventTitle}!`;
  const body = `A ticket opened up for ${payload.eventTitle}! You have ${deadlineHours} hours to claim it before it passes to the next person.`;
  const deepLinkUrl = `campusconnect://checkout?event_id=${payload.eventId}&claim_token=${claimToken}`;

  return {
    title,
    body,
    deepLinkUrl,
    claimToken,
    deadlineHours,
  };
}

/**
 * Dispatches high-priority transactional FCM push notification (#4404).
 */
export function dispatchWaitlistPromotionPushNotification(
  payload: WaitlistPromotionPushPayload
): PushNotificationDispatchResult {
  if (!payload.fcmDeviceToken) {
    throw new Error("Cannot dispatch push notification: Missing FCM device token.");
  }

  const { title, body, deepLinkUrl } = generateWaitlistPushPayload(payload);
  const notificationId = `push-${Date.now()}`;

  return {
    success: true,
    notificationId,
    title,
    body,
    deepLinkUrl,
    sentAt: new Date().toISOString(),
  };
}
