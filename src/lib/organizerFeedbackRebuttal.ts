export interface EventReview {
  id: string;
  eventId: string;
  eventTitle: string;
  reviewerUserId: string;
  reviewerEmail: string;
  reviewerName: string;
  rating: number; // 1-5 stars
  reviewComment: string;
  isPublic: boolean;
  organizerResponseText?: string | null;
  organizerRespondedAtIso?: string | null;
}

export interface RebuttalSubmissionPayload {
  reviewId: string;
  organizerUserId: string;
  responseText: string;
}

export interface OrganizerResponseCardProps {
  responseBody: string;
  respondedAtIso: string;
  containerCss: string;
}

export interface RebuttalNotificationPayload {
  recipientEmail: string;
  subject: string;
  bodyText: string;
  actionUrl: string;
}

/**
 * Validates organizer rebuttal text before database storage.
 */
export function validateOrganizerRebuttalText(text: string): { isValid: boolean; error?: string } {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: "Response text cannot be empty." };
  }
  if (trimmed.length > 1000) {
    return { isValid: false, error: "Response text exceeds maximum length of 1000 characters." };
  }
  return { isValid: true };
}

/**
 * Returns Tailwind CSS styling and properties for rendering the Yelp/Google Reviews style rebuttal container.
 */
export function getOrganizerRebuttalContainerProps(
  responseBody: string,
  respondedAtIso: string,
): OrganizerResponseCardProps {
  return {
    responseBody,
    respondedAtIso,
    containerCss:
      "mt-3 ml-4 p-3 bg-gray-50 border-l-4 border-indigo-500 rounded-r shadow-sm text-sm text-gray-700",
  };
}

/**
 * Constructs automated notification payload dispatched to the original reviewer.
 */

export function buildOrganizerResponseNotification(
  review: EventReview,
  responseText: string,
): RebuttalNotificationPayload {
  return {
    recipientEmail: review.reviewerEmail,
    subject: `Response to your review for ${review.eventTitle}`,
    bodyText: `The Organizer has responded to your feedback for "${review.eventTitle}":\n\n"${responseText}"`,
    actionUrl: `/events/${review.eventId}/reviews#review-${review.id}`,
  };
}
