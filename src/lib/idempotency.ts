/**
 * Idempotency Utility Functions
 *
 * This module provides utilities for generating, hashing, and managing
 * idempotency keys to prevent duplicate payment processing.
 */

/**
 * Generates a cryptographically strong UUID v4 for use as an idempotency key.
 * @returns A string representing the UUID.
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Hashes a payload object using SHA-256 to ensure payload integrity.
 * This prevents a scenario where a user reuses an idempotency key but
 * changes the request body (e.g., changing ticket quantity from 1 to 2).
 *
 * @param payload - The request body to hash.
 * @returns A promise resolving to the hex-encoded SHA-256 hash string.
 */
export async function hashPayload(payload: unknown): Promise<string> {
  const jsonString = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonString);

  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Validates that a stored hash matches the current payload hash.
 *
 * @param storedHash - The hash retrieved from the database.
 * @param currentPayload - The current request payload to validate.
 * @returns A promise resolving to true if they match, false otherwise.
 */
export async function validatePayloadHash(
  storedHash: string,
  currentPayload: unknown,
): Promise<boolean> {
  const currentHash = await hashPayload(currentPayload);
  return storedHash === currentHash;
}
