// =============================================================================
// Service: Notification Dispatcher
// Issue: #3450 - Build a 'Customizable Push Notification Schedule'
// Description: Evaluates user Do Not Disturb (DND) quiet hours & notification priority.
// Emergency alerts (Issue #3165) bypass DND; non-urgent notifications in DND window are
// pushed to a Redis delayed queue set to execute at dnd_end_time.
// =============================================================================

export type NotificationPriority = "urgent" | "emergency" | "high" | "normal" | "low";

export interface PushNotificationPayload {
  id?: string;
  title: string;
  body: string;
  user_id: string;
  priority?: NotificationPriority;
  type?: string;
  url?: string;
  payload?: Record<string, any>;
}

export interface UserNotificationPreferences {
  user_id?: string;
  push_notifications?: boolean;
  dnd_start_time?: string | null;
  dnd_end_time?: string | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  timezone?: string | null;
}

export interface DelayedPushJob {
  id: string;
  user_id: string;
  payload: PushNotificationPayload;
  execute_at: string; // ISO string
  execute_at_timestamp: number; // ms timestamp for Redis score
  created_at: string;
}

export interface RedisLikeClient {
  zadd(key: string, score: number, member: string): Promise<number | string | void>;
}

/**
 * In-memory fallback Redis delayed queue for environments/tests without live Redis.
 */
class InMemoryRedisQueue implements RedisLikeClient {
  private queue: Array<{ key: string; score: number; member: string }> = [];

  async zadd(key: string, score: number, member: string): Promise<number> {
    this.queue.push({ key, score, member });
    this.queue.sort((a, b) => a.score - b.score);
    return 1;
  }

  getJobs(key: string): Array<{ score: number; member: string }> {
    return this.queue.filter((q) => q.key === key);
  }

  clear() {
    this.queue = [];
  }
}

export const defaultInMemoryQueue = new InMemoryRedisQueue();

/**
 * Checks if a notification is emergency or urgent priority (bypasses DND).
 */
export function isEmergencyOrUrgent(priority?: NotificationPriority, type?: string): boolean {
  if (priority === "emergency" || priority === "urgent") return true;
  if (type === "emergency_broadcast" || type === "emergency_roll_call") return true;
  return false;
}

/**
 * Parses HH:mm or HH:mm:ss string into minutes past midnight (0 to 1439).
 */
export function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(":");
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Extracts local time (hours & minutes) from a Date in the given IANA timezone.
 */
export function getLocalMinutesForTimezone(date: Date, timeZone?: string | null): number {
  const tz = timeZone || "UTC";
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    let hours = 0;
    let minutes = 0;
    for (const part of parts) {
      if (part.type === "hour") hours = parseInt(part.value, 10) % 24;
      if (part.type === "minute") minutes = parseInt(part.value, 10);
    }
    return hours * 60 + minutes;
  } catch (err) {
    // Fallback to UTC if timezone is invalid
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
}

/**
 * Checks if a given Date falls within a user's DND quiet hours window.
 */
export function isWithinDNDWindow(
  dndStart?: string | null,
  dndEnd?: string | null,
  timezone?: string | null,
  referenceDate: Date = new Date(),
): boolean {
  const startStr = dndStart || null;
  const endStr = dndEnd || null;

  const startMinutes = parseTimeToMinutes(startStr);
  const endMinutes = parseTimeToMinutes(endStr);

  if (startMinutes === null || endMinutes === null) {
    return false;
  }

  const currentMinutes = getLocalMinutesForTimezone(referenceDate, timezone);

  if (startMinutes <= endMinutes) {
    // Intra-day quiet hours e.g. 01:00 to 07:00
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight quiet hours e.g. 22:00 to 08:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

/**
 * Calculates the exact Date when the DND window next ends at dnd_end_time.
 */
export function calculateNextDNDEndTime(
  dndEnd: string,
  timezone?: string | null,
  referenceDate: Date = new Date(),
): Date {
  const endMinutes = parseTimeToMinutes(dndEnd) ?? 8 * 60; // default 08:00 AM
  const currentMinutes = getLocalMinutesForTimezone(referenceDate, timezone);

  const endHours = Math.floor(endMinutes / 60);
  const endMins = endMinutes % 60;

  // We format local YYYY-MM-DD in user's timezone
  const tz = timezone || "UTC";
  try {
    const dFormat = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const dateParts = dFormat.format(referenceDate); // e.g. "2026-08-20"

    // Create base target date in local time
    const targetLocal = new Date(
      `${dateParts}T${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}:00Z`,
    );

    // If local time has already passed dnd_end today, schedule for tomorrow
    if (currentMinutes >= endMinutes) {
      targetLocal.setUTCDate(targetLocal.getUTCDate() + 1);
    }
    return targetLocal;
  } catch {
    // Fallback: Add remaining hours to current date
    let minsToAdd = endMinutes - currentMinutes;
    if (minsToAdd <= 0) minsToAdd += 24 * 60;
    return new Date(referenceDate.getTime() + minsToAdd * 60 * 1000);
  }
}

export interface DispatchResult {
  status: "sent" | "queued" | "skipped";
  reason: string;
  delayedJob?: DelayedPushJob;
}

/**
 * Main Notification Dispatcher Engine entry point.
 */
export async function dispatchNotification(
  payload: PushNotificationPayload,
  userPrefs: UserNotificationPreferences,
  redisClient?: RedisLikeClient,
  pushSender?: (p: PushNotificationPayload) => Promise<any>,
  referenceDate: Date = new Date(),
): Promise<DispatchResult> {
  // Check if push notifications are explicitly disabled for user
  if (userPrefs.push_notifications === false) {
    return {
      status: "skipped",
      reason: "User has disabled push notifications in settings",
    };
  }

  const dndStart = userPrefs.dnd_start_time || userPrefs.quiet_hours_start;
  const dndEnd = userPrefs.dnd_end_time || userPrefs.quiet_hours_end;
  const userTz = userPrefs.timezone || "UTC";

  // Check emergency override
  const isEmergency = isEmergencyOrUrgent(payload.priority, payload.type);
  if (isEmergency) {
    if (pushSender) {
      await pushSender(payload);
    }
    return {
      status: "sent",
      reason: "Urgent/Emergency alert successfully bypassed DND constraints",
    };
  }

  // Check DND quiet hours window
  const inDND = isWithinDNDWindow(dndStart, dndEnd, userTz, referenceDate);

  if (inDND && dndEnd) {
    const targetExecuteDate = calculateNextDNDEndTime(dndEnd, userTz, referenceDate);
    const executeAtTimestamp = targetExecuteDate.getTime();
    const jobId = `job_${payload.id || Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const delayedJob: DelayedPushJob = {
      id: jobId,
      user_id: payload.user_id,
      payload,
      execute_at: targetExecuteDate.toISOString(),
      execute_at_timestamp: executeAtTimestamp,
      created_at: referenceDate.toISOString(),
    };

    const client = redisClient || defaultInMemoryQueue;
    await client.zadd("delayed_push_notifications", executeAtTimestamp, JSON.stringify(delayedJob));

    return {
      status: "queued",
      reason: `Inside DND window (${dndStart} - ${dndEnd}). Notification delayed to execute at ${targetExecuteDate.toISOString()}`,
      delayedJob,
    };
  }

  // Outside DND window: dispatch immediately
  if (pushSender) {
    await pushSender(payload);
  }

  return {
    status: "sent",
    reason: "Dispatched push notification immediately (outside DND window)",
  };
}
