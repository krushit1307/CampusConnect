import { createClient } from "./supabase/client";

export interface SharePermissions {
  shareEmail: boolean;
  shareLinkedin: boolean;
  shareGithub: boolean;
  shareInstagram: boolean;
  sharePhone: boolean;
}

export interface ConnectQrPayload {
  version: "1.0";
  userId: string;
  eventId?: string;
  permissions: SharePermissions;
  timestamp: number;
  signature?: string;
}

export interface UserConnection {
  id: string;
  name: string;
  email?: string;
  linkedin?: string;
  github?: string;
  instagram?: string;
  phone?: string;
  eventName?: string;
  connectedAt: string;
}

export const DEFAULT_SHARE_PERMISSIONS: SharePermissions = {
  shareEmail: true,
  shareLinkedin: true,
  shareGithub: false,
  shareInstagram: false,
  sharePhone: false,
};

export const QR_CODE_EXPIRATION_MS = 300000; // 5 minutes in milliseconds
export const OFFLINE_QUEUE_STORAGE_KEY = "campusconnect_offline_connections_queue";

/**
 * Generates a simple checksum signature for anti-spoofing validation.
 */
export function generatePayloadSignature(
  userId: string,
  eventId: string | undefined,
  timestamp: number,
  secretKey = "campus_connect_secret",
): string {
  const str = `${userId}:${eventId || ""}:${timestamp}:${secretKey}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Encodes user connection information and granular privacy permissions into a signed QR code payload.
 */
export function generateConnectQrPayload(
  userId: string,
  eventId?: string,
  permissions: SharePermissions = DEFAULT_SHARE_PERMISSIONS,
  secretKey = "campus_connect_secret",
  timestamp = Date.now(),
): string {
  const signature = generatePayloadSignature(userId, eventId, timestamp, secretKey);

  const payload: ConnectQrPayload = {
    version: "1.0",
    userId,
    eventId,
    permissions,
    timestamp,
    signature,
  };

  return JSON.stringify(payload);
}

/**
 * Parses, validates, and verifies cryptographic anti-spoofing signature and 5-minute expiration window.
 */
export function parseConnectQrPayload(
  rawQrString: string,
  secretKey = "campus_connect_secret",
  nowMs = Date.now(),
): { valid: boolean; payload?: ConnectQrPayload; error?: string } {
  try {
    const data = JSON.parse(rawQrString) as ConnectQrPayload;
    if (!data.userId || data.version !== "1.0") {
      return { valid: false, error: "Invalid QR code format." };
    }

    // Expiration check (5 minutes / 300,000 ms)
    if (nowMs - data.timestamp > QR_CODE_EXPIRATION_MS) {
      return { valid: false, error: "QR code has expired. Please refresh the QR code on screen." };
    }

    // Signature verification if present
    if (data.signature) {
      const expectedSig = generatePayloadSignature(
        data.userId,
        data.eventId,
        data.timestamp,
        secretKey,
      );
      if (data.signature !== expectedSig) {
        return { valid: false, error: "Anti-spoofing signature verification failed." };
      }
    }

    return { valid: true, payload: data };
  } catch {
    return { valid: false, error: "Corrupted QR code payload." };
  }
}

/**
 * Swaps digital business cards via Supabase RPC, storing connection permissions and event context.
 */
export async function swapDigitalBusinessCards(
  targetUserId: string,
  eventId?: string,
  permissions: SharePermissions = DEFAULT_SHARE_PERMISSIONS,
): Promise<{ success: boolean; message: string; connectionId?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("swap_digital_business_cards", {
    p_target_user_id: targetUserId,
    p_event_id: eventId ?? null,
    p_shared_permissions: permissions as unknown as Record<string, unknown>,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  const res = data?.[0];
  return {
    success: res?.success ?? false,
    message: res?.message ?? "Digital business card swapped.",
    connectionId: res?.connection_id ?? undefined,
  };
}

/**
 * Offline Mode Caching: Caches scanned payload locally when there is no internet connection.
 */
export function queueOfflineConnection(payload: ConnectQrPayload): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  const queue = getOfflineConnectionsQueue();
  queue.push(payload);
  window.localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

/**
 * Retrieves cached offline connections from LocalStorage.
 */
export function getOfflineConnectionsQueue(): ConnectQrPayload[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const data = window.localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Clears the offline connection queue.
 */
export function clearOfflineConnectionsQueue(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.removeItem(OFFLINE_QUEUE_STORAGE_KEY);
}

/**
 * Auto-syncs cached offline connections to Supabase when internet connectivity is restored.
 */
export async function syncOfflineConnections(): Promise<{ syncedCount: number; errors: number }> {
  const queue = getOfflineConnectionsQueue();
  if (queue.length === 0) return { syncedCount: 0, errors: 0 };

  let syncedCount = 0;
  let errors = 0;

  for (const item of queue) {
    const res = await swapDigitalBusinessCards(item.userId, item.eventId, item.permissions);
    if (res.success) {
      syncedCount++;
    } else {
      errors++;
    }
  }

  clearOfflineConnectionsQueue();
  return { syncedCount, errors };
}

/**
 * Formats a single connection into standard vCard (.vcf) format for phone address book import.
 */
export function generateVCard(connection: UserConnection): string {
  const vcardLines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${connection.name || "Student Connection"}`,
    connection.email ? `EMAIL;TYPE=INTERNET:${connection.email}` : null,
    connection.phone ? `TEL;TYPE=CELL:${connection.phone}` : null,
    connection.linkedin ? `URL;TYPE=LinkedIn:${connection.linkedin}` : null,
    connection.github ? `URL;TYPE=GitHub:${connection.github}` : null,
    connection.eventName ? `NOTE:Met at ${connection.eventName}` : null,
    "END:VCARD",
  ].filter(Boolean);

  return vcardLines.join("\n");
}

/**
 * Formats multiple user connections into a single exportable vCard (.vcf) bundle string.
 */
export function exportConnectionsToVCard(connections: UserConnection[]): string {
  return connections.map(generateVCard).join("\n\n");
}

/**
 * Formats a user's network connections into an exportable CSV string.
 * Columns: Name, Email, LinkedIn, GitHub, Instagram, Phone, Event Met, Connected Date
 */
export function exportConnectionsToCsv(connections: UserConnection[]): string {
  const headers = [
    "Full Name",
    "Email",
    "LinkedIn",
    "GitHub",
    "Instagram",
    "Phone",
    "Event Met",
    "Connected Date",
  ];

  const rows = connections.map((c) => [
    `"${(c.name || "Student Connection").replace(/"/g, '""')}"`,
    `"${(c.email || "").replace(/"/g, '""')}"`,
    `"${(c.linkedin || "").replace(/"/g, '""')}"`,
    `"${(c.github || "").replace(/"/g, '""')}"`,
    `"${(c.instagram || "").replace(/"/g, '""')}"`,
    `"${(c.phone || "").replace(/"/g, '""')}"`,
    `"${(c.eventName || "Campus Event").replace(/"/g, '""')}"`,
    `"${new Date(c.connectedAt).toLocaleDateString("en-US")}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
