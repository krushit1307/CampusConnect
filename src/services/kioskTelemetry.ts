// =============================================================================
// Service & Hook: Kiosk Hardware Telemetry
// Issue: #3455 - Develop a 'Real-Time Hardware Metrics Dashboard' for Kiosks
// Description: Extracts hardware telemetry (battery, charging state, ping latency)
// via Web APIs (navigator.getBattery) and broadcasts real-time metrics every 60 seconds
// to Supabase for centralized fleet management.
// =============================================================================

import { useEffect, useRef } from "react";
import { createClient } from "../lib/supabase/client";

export interface KioskTelemetryPayload {
  device_id: string;
  event_id?: string | null;
  battery_level: number; // 0 to 100
  is_charging: boolean;
  ping_ms: number;
  network_type?: string;
  last_seen: string; // ISO string
}

/** Offline threshold: 3 minutes in milliseconds */
export const OFFLINE_THRESHOLD_MS = 3 * 60 * 1000;

/** Dying battery threshold: < 15% battery level when NOT charging */
export const DYING_BATTERY_THRESHOLD = 15;

/**
 * Checks if a kiosk device's battery is dying (< 15% and not charging).
 */
export function isDyingBattery(batteryLevel: number, isCharging: boolean): boolean {
  return batteryLevel < DYING_BATTERY_THRESHOLD && !isCharging;
}

/**
 * Checks if a kiosk device has stopped broadcasting (> 3 minutes).
 */
export function isDeviceOffline(
  lastSeen: string | Date,
  now: Date = new Date(),
  thresholdMs: number = OFFLINE_THRESHOLD_MS,
): boolean {
  const lastSeenTime =
    typeof lastSeen === "string" ? new Date(lastSeen).getTime() : lastSeen.getTime();
  if (isNaN(lastSeenTime)) return true;
  return now.getTime() - lastSeenTime > thresholdMs;
}

/**
 * Safely extracts battery metrics via Web Battery Status API (navigator.getBattery).
 */
export async function getHardwareBatteryInfo(): Promise<{ level: number; isCharging: boolean }> {
  try {
    if (typeof navigator !== "undefined" && "getBattery" in navigator) {
      const battery = await (navigator as any).getBattery();
      return {
        level: Math.round((battery.level || 1) * 100),
        isCharging: Boolean(battery.charging),
      };
    }
  } catch (err) {
    console.warn(
      "[kioskTelemetry] navigator.getBattery API unavailable, using fallback metrics:",
      err,
    );
  }
  // Safe default fallback
  return { level: 100, isCharging: true };
}

/**
 * Measures network ping latency to the server in milliseconds.
 */
export async function getPingLatencyMs(): Promise<number> {
  const start = performance.now();
  try {
    // Ping lightweight endpoint or current domain
    await fetch("/favicon.png", { method: "HEAD", cache: "no-cache" }).catch(() => {});
  } catch {
    // Ignore network error
  }
  return Math.round(performance.now() - start);
}

/**
 * Sends a telemetry heartbeat payload to Supabase kiosk_devices table.
 */
export async function sendKioskTelemetry(
  deviceId: string,
  eventId?: string | null,
  overrideMetrics?: Partial<KioskTelemetryPayload>,
): Promise<KioskTelemetryPayload | null> {
  if (!deviceId) return null;

  const battery = await getHardwareBatteryInfo();
  const ping = await getPingLatencyMs();

  const payload: KioskTelemetryPayload = {
    device_id: deviceId,
    event_id: eventId || null,
    battery_level: overrideMetrics?.battery_level ?? battery.level,
    is_charging: overrideMetrics?.is_charging ?? battery.isCharging,
    ping_ms: overrideMetrics?.ping_ms ?? ping,
    network_type:
      overrideMetrics?.network_type || (navigator as any)?.connection?.effectiveType || "wifi",
    last_seen: new Date().toISOString(),
  };

  try {
    const supabase = createClient();
    const { error } = await supabase.from("kiosk_devices").upsert(
      {
        device_id: payload.device_id,
        event_id: payload.event_id,
        battery_level: payload.battery_level,
        is_charging: payload.is_charging,
        ping_ms: payload.ping_ms,
        network_type: payload.network_type,
        last_seen: payload.last_seen,
        updated_at: payload.last_seen,
      },
      { onConflict: "device_id" },
    );

    if (error) {
      console.error("[kioskTelemetry] Failed to broadcast hardware telemetry:", error);
    }
  } catch (err) {
    console.error("[kioskTelemetry] Telemetry broadcast error:", err);
  }

  return payload;
}

/**
 * React Hook to automatically broadcast kiosk hardware telemetry every interval (default 60s).
 */
export function useKioskTelemetry(
  deviceId: string = "Door 1",
  eventId?: string | null,
  intervalMs: number = 60000,
) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!deviceId) return;

    // Send immediate heartbeat on mount
    void sendKioskTelemetry(deviceId, eventId);

    // Schedule regular heartbeat broadcast every 60s
    intervalRef.current = setInterval(() => {
      void sendKioskTelemetry(deviceId, eventId);
    }, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [deviceId, eventId, intervalMs]);
}
