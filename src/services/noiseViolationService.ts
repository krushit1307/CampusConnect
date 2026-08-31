// =============================================================================
// Service: Noise Violation Alert Service
// Issue: #3684 - Build a 'Real-Time "Decibel/Noise" Violation Alert'
// Description: Processes IoT decibel monitor hardware payloads (dB > 90 for 5 mins),
// logs warnings in noise_violation_logs for liability protection, and triggers real-time
// red alert warnings on the organizer's dashboard.
// =============================================================================

import { createClient } from "../lib/supabase/client";
import type { NoiseViolationLog } from "../types/database";

/** Threshold: Decibels > 90 */
export const DECIBEL_THRESHOLD = 90;

/** Threshold: Duration >= 5 minutes */
export const DURATION_THRESHOLD_MINS = 5;

/**
 * Checks if noise metrics exceed legal thresholds (> 90dB for sustained 5 mins).
 */
export function isDecibelViolation(decibels: number, durationMinutes: number): boolean {
  return decibels > DECIBEL_THRESHOLD && durationMinutes >= DURATION_THRESHOLD_MINS;
}

/**
 * Processes incoming IoT noise telemetry, logs liability record, and returns warning alert payload.
 */
export async function processIoTNoiseAlert(
  venueId: string,
  venueName: string,
  decibels: number,
  durationMinutes: number,
  eventId?: string | null,
): Promise<{
  violation: boolean;
  logData?: NoiseViolationLog;
  alertMessage?: string;
  error?: string;
}> {
  if (!venueId || typeof decibels !== "number" || typeof durationMinutes !== "number") {
    return { violation: false, error: "Missing venueId, decibels, or durationMinutes." };
  }

  // 1. Evaluate violation threshold
  if (!isDecibelViolation(decibels, durationMinutes)) {
    return { violation: false };
  }

  const supabase = createClient();

  try {
    let activeEventId = eventId || null;
    let resolvedVenueName = venueName || venueId;

    // If eventId not provided, query active event matching venue
    if (!activeEventId) {
      const cleanVenueId = (venueId || "").replace(/[,()]/g, " ").trim();
      const cleanVenueName = (venueName || "").replace(/[,()]/g, " ").trim();
      const filterClause = cleanVenueName
        ? `location.ilike.%${cleanVenueId}%,location.ilike.%${cleanVenueName}%`
        : `location.ilike.%${cleanVenueId}%`;

      const { data: activeEvents } = await supabase
        .from("events")
        .select("id, title, location")
        .or(filterClause)
        .order("created_at", { ascending: false })
        .limit(1);

      if (activeEvents && activeEvents[0]) {
        activeEventId = activeEvents[0].id;
        resolvedVenueName = activeEvents[0].location || resolvedVenueName;
      }
    }

    // 2. Query past warning count for this event to escalate warning count (#1, #2, #3)
    let warningCount = 1;
    if (activeEventId) {
      const { data: existingLogs } = await supabase
        .from("noise_violation_logs")
        .select("id")
        .eq("event_id", activeEventId);

      warningCount = (existingLogs?.length || 0) + 1;
    }

    // 3. Format warning alert message
    const alertMessage = `WARNING: Noise levels have exceeded ${decibels}dB for ${durationMinutes} minutes (Warning #${warningCount}). Lower the volume immediately to avoid security intervention.`;

    // 4. Insert log into noise_violation_logs table (Liability Audit Trail)
    const { data: logRecord, error: insertErr } = await supabase
      .from("noise_violation_logs")
      .insert({
        event_id: activeEventId,
        venue_id: venueId,
        venue_name: resolvedVenueName,
        decibels,
        duration_minutes: durationMinutes,
        warning_level: decibels >= 95 ? "CRITICAL" : "WARNING",
        warning_count: warningCount,
        alert_message: alertMessage,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    console.log(
      `[noiseViolationService] Decibel violation alert logged for ${resolvedVenueName}: ${alertMessage}`,
    );

    return {
      violation: true,
      logData: logRecord as NoiseViolationLog,
      alertMessage,
    };
  } catch (err: any) {
    console.error("[noiseViolationService] Error logging noise violation:", err);
    return { violation: false, error: err.message || "Failed to process noise alert." };
  }
}

/**
 * Fetches all historical noise violation logs for an event (Liability Audit Trail).
 */
export async function getEventNoiseViolations(eventId: string): Promise<NoiseViolationLog[]> {
  if (!eventId) return [];

  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from("noise_violation_logs")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as NoiseViolationLog[];
  } catch (err) {
    console.error("[noiseViolationService] Fetch noise logs error:", err);
    return [];
  }
}
