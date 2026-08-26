export const EVENT_SPAM_RATE_LIMIT = 5;
export const EVENT_SPAM_RATE_WINDOW = "1 hour";
export const EVENT_SPAM_SIMILARITY_THRESHOLD = 0.95;

export function isPendingSpamReview(status: string | null | undefined) {
  return status === "pending_spam_review";
}

export function getEventSpamErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (
    message.includes("event_rate_limit_exceeded") ||
    message.toLowerCase().includes("rate limit exceeded")
  ) {
    return `You can publish up to ${EVENT_SPAM_RATE_LIMIT} events per hour. Please try again later.`;
  }

  return null;
}
