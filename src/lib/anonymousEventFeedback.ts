import { createHash } from "crypto";

export interface EventFeedbackSubmissionInput {
  eventId: string;
  userId: string;
  rating: number;
  reviewComment: string;
  isAnonymous: boolean;
}

export interface ProcessedFeedbackPayload {
  eventId: string;
  userId: string | null;
  rating: number;
  reviewComment: string;
  isAnonymous: boolean;
  anonymousUserHash: string | null;
  displayAuthorName: string;
}

export const SERVER_SALT_ANONYMITY = "CAMPUS_CONNECT_ROTATING_SALT_2026_Q3";

/**
 * Computes a SHA-256 cryptographic hash of user_id + event_id + server salt.
 * Mathematically irreversible to protect student identity while verifying unique submission.
 */
export function generateCryptographicAnonymityHash(
  userId: string,
  eventId: string,
  serverSalt: string = SERVER_SALT_ANONYMITY,
): string {
  const rawPayload = `${userId.trim()}:${eventId.trim()}:${serverSalt}`;
  return createHash("sha256").update(rawPayload).digest("hex");
}

/**
 * Processes feedback submission input, stripping raw user ID and attaching SHA-256 hash when anonymous.
 */
export function processEventFeedbackSubmission(
  input: EventFeedbackSubmissionInput,
  userName: string,
): ProcessedFeedbackPayload {
  if (!input.isAnonymous) {
    return {
      eventId: input.eventId,
      userId: input.userId,
      rating: input.rating,
      reviewComment: input.reviewComment,
      isAnonymous: false,
      anonymousUserHash: null,
      displayAuthorName: userName,
    };
  }

  const anonymousUserHash = generateCryptographicAnonymityHash(input.userId, input.eventId);

  return {
    eventId: input.eventId,
    userId: null, // Nullified for database privacy
    rating: input.rating,
    reviewComment: input.reviewComment,
    isAnonymous: true,
    anonymousUserHash,
    displayAuthorName: "Anonymous Student",
  };
}
