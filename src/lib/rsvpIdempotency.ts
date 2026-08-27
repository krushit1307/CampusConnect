import { generateIdempotencyKey } from "@/lib/idempotency";

const pendingKeys = new Map<string, string>();

/**
 * Returns a stable idempotency key for a given event so rapid double-clicks
 * on the RSVP button all send the same UUID (issue #2323). The key is reused
 * until the action fully succeeds, at which point `clearRsvpIdempotencyKey`
 * frees it for the next genuine toggle.
 */
export function getRsvpIdempotencyKey(eventId: string): string {
  let key = pendingKeys.get(eventId);
  if (!key) {
    key = generateIdempotencyKey();
    pendingKeys.set(eventId, key);
  }
  return key;
}

export function clearRsvpIdempotencyKey(eventId: string): void {
  pendingKeys.delete(eventId);
}
