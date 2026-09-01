/**
 * Turnstile Emergency Control — Campus Safety (Issue #5279)
 * Client helper that fires the high-priority EMERGENCY_EVACUATION payload and drops magnetic locks.
 */

import { createClient } from "@/lib/supabase/client";
import type { EvacuationPayload } from "@/lib/audio/fireAlarmFingerprint";

export type EvacuationResult =
  | { success: true; alreadyEvacuated: boolean; turnstilesUnlocked: number; eventId: string }
  | { success: false; error: string };

export async function triggerEmergencyEvacuation(
  payload: EvacuationPayload,
): Promise<EvacuationResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("trigger_emergency_evacuation", {
    p_event_id: payload.eventId,
    p_bouncer_id: payload.bouncerId,
    p_detection_duration_seconds: payload.detectionDurationSeconds,
    p_payload: payload as unknown as Record<string, unknown>,
  });

  if (error) return { success: false, error: error.message };

  const res = data as {
    success: boolean;
    already_evacuated?: boolean;
    turnstiles_unlocked?: number;
    event_id?: string;
    message?: string;
  };
  if (!res?.success)
    return {
      success: false,
      error: (res as unknown as { message?: string })?.message ?? "Evacuation failed",
    };

  return {
    success: true,
    alreadyEvacuated: Boolean(res.already_evacuated),
    turnstilesUnlocked: res.turnstiles_unlocked ?? 0,
    eventId: res.event_id ?? payload.eventId,
  };
}

/**
 * Fallback HTTP path for bouncer iPad when Supabase RPC is unreachable (uses Next.js API route).
 * The API route itself calls the same RPC service-role side.
 */
export async function triggerEmergencyEvacuationViaApi(
  payload: EvacuationPayload,
): Promise<EvacuationResult> {
  try {
    const res = await fetch("/api/bouncer/emergency-evacuation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: json.error ?? `HTTP ${res.status}` };
    return {
      success: true,
      alreadyEvacuated: Boolean(json.already_evacuated),
      turnstilesUnlocked: json.turnstiles_unlocked ?? 0,
      eventId: json.event_id ?? payload.eventId,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/**
 * High-priority fire-and-forget with retry: first try RPC, fallback to API, retry once on network failure.
 */
export async function fireEvacuationWithRetry(
  payload: EvacuationPayload,
): Promise<EvacuationResult> {
  const primary = await triggerEmergencyEvacuation(payload);
  if (primary.success) return primary;
  // Network / RLS transient? try API path
  const fallback = await triggerEmergencyEvacuationViaApi(payload);
  return fallback;
}
