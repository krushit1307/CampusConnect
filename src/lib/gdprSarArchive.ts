import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const GDPR_SAR_QUEUE_NAME = "gdpr-sar-queue";
export const SAR_DEADLINE_DAYS = 30;
export const SAR_DOWNLOAD_TTL_SECONDS = SAR_DEADLINE_DAYS * 24 * 60 * 60;
export const SAR_ARCHIVE_MAGIC = "CCSAR1";

export const SAR_SOURCE_TABLES = [
  "users",
  "event_rsvps",
  "payments",
  "chat_logs",
  "support_tickets",
  "reviews",
] as const;

export type SarSourceTable = (typeof SAR_SOURCE_TABLES)[number];

export type GdprSarTablePayload = Record<SarSourceTable, unknown[]>;

export type GdprSarDocument = {
  type: "subject_access_request";
  regulation: "GDPR/CCPA";
  user_id: string;
  compiled_at: string;
  due_by: string;
  users: unknown[];
  event_rsvps: unknown[];
  payments: unknown[];
  chat_logs: unknown[];
  support_tickets: unknown[];
  reviews: unknown[];
};

export function sarDueBy(requestedAt: Date, now = requestedAt): Date {
  const due = new Date(now.getTime());
  due.setUTCDate(due.getUTCDate() + SAR_DEADLINE_DAYS);
  return due;
}

export function emptySarTables(): GdprSarTablePayload {
  return {
    users: [],
    event_rsvps: [],
    payments: [],
    chat_logs: [],
    support_tickets: [],
    reviews: [],
  };
}

export function buildGdprSarDocument(
  userId: string,
  tables: Partial<GdprSarTablePayload>,
  compiledAt = new Date(),
): GdprSarDocument {
  const payload = { ...emptySarTables(), ...tables };
  return {
    type: "subject_access_request",
    regulation: "GDPR/CCPA",
    user_id: userId,
    compiled_at: compiledAt.toISOString(),
    due_by: sarDueBy(compiledAt).toISOString(),
    users: payload.users,
    event_rsvps: payload.event_rsvps,
    payments: payload.payments,
    chat_logs: payload.chat_logs,
    support_tickets: payload.support_tickets,
    reviews: payload.reviews,
  };
}

export function serializeSarArchive(document: GdprSarDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function encryptSarArchive(
  plaintext: string,
  key = randomBytes(32),
): { key: Buffer; blob: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    key,
    blob: Buffer.concat([Buffer.from(SAR_ARCHIVE_MAGIC), iv, tag, ciphertext]),
  };
}

export function decryptSarArchive(blob: Buffer, key: Buffer): string {
  const magic = blob.subarray(0, SAR_ARCHIVE_MAGIC.length).toString("utf8");
  if (magic !== SAR_ARCHIVE_MAGIC) {
    throw new Error("invalid SAR archive");
  }
  const iv = blob.subarray(SAR_ARCHIVE_MAGIC.length, SAR_ARCHIVE_MAGIC.length + 12);
  const tag = blob.subarray(SAR_ARCHIVE_MAGIC.length + 12, SAR_ARCHIVE_MAGIC.length + 28);
  const ciphertext = blob.subarray(SAR_ARCHIVE_MAGIC.length + 28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function buildGdprSarReadyEmail(
  downloadUrl: string,
  expiresAt: Date,
  keyHex: string,
): {
  subject: string;
  html: string;
} {
  return {
    subject: "Your CampusConnect data archive is ready",
    html: `<p>Your GDPR/CCPA Subject Access Request archive is ready.</p>
<p><a href="${downloadUrl}">Download your encrypted archive</a></p>
<p>This link expires on ${expiresAt.toISOString()} (30 days).</p>
<p>AES-256-GCM key: <code>${keyHex}</code></p>`,
  };
}
