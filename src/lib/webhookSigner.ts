import crypto from "crypto";

export interface WebhookEndpoint {
  id: string;
  club_id: string;
  endpoint_url: string;
  secret_key: string;
  description?: string;
  active: boolean;
  subscriptions: string[];
  created_at?: string;
}

export interface WebhookDeliveryLog {
  id: string;
  endpoint_id: string;
  event_type: string;
  payload: Record<string, any>;
  status_code: number;
  response_body?: string;
  success: boolean;
  attempt: number;
  delivered_at: string;
}

export const AVAILABLE_WEBHOOK_EVENTS = [
  { type: "rsvp.created", label: "RSVP Created", description: "Triggered when a student RSVPs to a club event" },
  { type: "rsvp.cancelled", label: "RSVP Cancelled", description: "Triggered when a student cancels their RSVP" },
  { type: "event.published", label: "Event Published", description: "Triggered when a new club event goes live" },
  { type: "member.joined", label: "Member Joined", description: "Triggered when a new student joins the club" },
  { type: "announcement.posted", label: "Announcement Posted", description: "Triggered when club leaders post news" },
];

/**
 * Generates a cryptographically secure random secret key for webhook HMAC verification (#3543).
 * Format: whsec_<32-hex-characters>
 */
export function generateWebhookSecretKey(): string {
  if (crypto.randomBytes) {
    return `whsec_${crypto.randomBytes(16).toString("hex")}`;
  }
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const hex = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `whsec_${hex}`;
}

/**
 * Generates cryptographic HMAC SHA-256 signature for a webhook payload (#3543).
 * Header format: t={timestamp},v1={hex_digest}
 */
export function generateHmacSha256Signature(
  secretKey: string,
  payload: string | object,
  timestamp: number = Math.floor(Date.now() / 1000)
): string {
  const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);
  const signaturePayload = `${timestamp}.${payloadString}`;
  const digest = crypto.createHmac("sha256", secretKey).update(signaturePayload).digest("hex");

  return `t=${timestamp},v1=${digest}`;
}

/**
 * Verifies incoming webhook signature and protects against replay attacks (#3543).
 */
export function verifyWebhookSignature(
  secretKey: string,
  payload: string | object,
  signatureHeader: string,
  toleranceSeconds: number = 300
): { valid: boolean; error?: string } {
  if (!signatureHeader || !secretKey) {
    return { valid: false, error: "Missing signature header or secret key" };
  }

  const parts = signatureHeader.split(",");
  let timestampStr: string | null = null;
  let receivedSignature: string | null = null;

  for (const part of parts) {
    const [key, val] = part.split("=");
    if (key === "t") timestampStr = val;
    if (key === "v1") receivedSignature = val;
  }

  if (!timestampStr || !receivedSignature) {
    return { valid: false, error: "Malformed signature header format" };
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return { valid: false, error: "Invalid timestamp in signature header" };
  }

  // Replay attack protection
  const currentTimestamp = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTimestamp - timestamp) > toleranceSeconds) {
    return { valid: false, error: "Webhook timestamp expired (replay attack protection)" };
  }

  const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);
  const expectedPayload = `${timestamp}.${payloadString}`;
  const computedSignature = crypto.createHmac("sha256", secretKey).update(expectedPayload).digest("hex");

  if (computedSignature !== receivedSignature) {
    return { valid: false, error: "HMAC SHA-256 signature mismatch" };
  }

  return { valid: true };
}

/**
 * Formats a standardized webhook event payload envelope (#3543).
 */
export function formatWebhookPayload(
  eventType: string,
  clubId: string,
  data: Record<string, any>
): Record<string, any> {
  return {
    id: `evt_wh_${Date.now()}`,
    event: eventType,
    club_id: clubId,
    created_at: Math.floor(Date.now() / 1000),
    data,
  };
}
