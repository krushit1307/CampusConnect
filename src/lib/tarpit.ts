// src/lib/tarpit.ts
// Issue: #4995 - Dynamic "Early Bird" Rate-Limiting Tarpit
// Description: Client-side library for tarpit integration with bot detection

import { supabase } from "./supabase/client";

export interface TarpitConfig {
  bytesPerSecond?: number;
  maxDuration?: number;
  chunkSize?: number;
  initialDelay?: number;
}

export interface TarpitSession {
  id: string;
  ipAddress: string;
  userAgent?: string;
  fingerprint?: string;
  sessionStart: string;
  sessionEnd?: string;
  durationSeconds?: number;
  bytesSent: number;
  configBps: number;
  configMaxDuration: number;
  triggerReason: string;
  isActive: boolean;
}

export interface TarpitStats {
  totalSessions: number;
  activeSessions: number;
  totalDurationSeconds: number;
  totalBytesSent: number;
  avgDurationSeconds: number;
  uniqueIps: number;
  uniqueFingerprints: number;
  topTriggerReasons: Array<{ reason: string; count: number }>;
}

/**
 * Check if an IP or fingerprint is currently in the tarpit
 */
export async function isInTarpit(
  ipAddress?: string,
  fingerprint?: string,
): Promise<{ inTarpit: boolean; sessionId?: string; remainingSeconds?: number }> {
  try {
    const { data, error } = await supabase.rpc("is_in_tarpit", {
      p_ip_address: ipAddress,
      p_fingerprint: fingerprint,
    });

    if (error) throw error;

    if (data && data.length > 0) {
      const result = data[0];
      return {
        inTarpit: result.in_tarpit,
        sessionId: result.session_id || undefined,
        remainingSeconds: result.remaining_seconds || undefined,
      };
    }

    return { inTarpit: false };
  } catch (err) {
    console.error("Error checking tarpit status:", err);
    return { inTarpit: false };
  }
}

/**
 * Start a tarpit session for a detected bot
 * This should be called from the server-side (Edge Function), not client-side
 */
export async function startTarpitSession(
  ipAddress: string,
  userAgent?: string,
  fingerprint?: string,
  configName: string = "default",
  triggerReason: string = "honey_pot",
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("start_tarpit_session", {
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_fingerprint: fingerprint,
      p_config_name: configName,
      p_trigger_reason: triggerReason,
    });

    if (error) throw error;

    return data as string;
  } catch (err) {
    console.error("Error starting tarpit session:", err);
    return null;
  }
}

/**
 * End a tarpit session
 * This should be called from the server-side (Edge Function)
 */
export async function endTarpitSession(sessionId: string, bytesSent: number = 0): Promise<void> {
  try {
    const { error } = await supabase.rpc("end_tarpit_session", {
      p_session_id: sessionId,
      p_bytes_sent: bytesSent,
    });

    if (error) throw error;
  } catch (err) {
    console.error("Error ending tarpit session:", err);
  }
}

/**
 * Get tarpit configuration
 */
export async function getTarpitConfig(
  configName: string = "default",
): Promise<TarpitConfig | null> {
  try {
    const { data, error } = await supabase.rpc("get_tarpit_config", {
      p_config_name: configName,
    });

    if (error) throw error;

    if (data && data.length > 0) {
      const config = data[0];
      return {
        bytesPerSecond: Number(config.bytes_per_second),
        maxDuration: config.max_duration,
        chunkSize: config.chunk_size,
        initialDelay: config.initial_delay,
      };
    }

    return null;
  } catch (err) {
    console.error("Error getting tarpit config:", err);
    return null;
  }
}

/**
 * Get tarpit statistics for monitoring
 */
export async function getTarpitStats(days: number = 7): Promise<TarpitStats | null> {
  try {
    const { data, error } = await supabase.rpc("get_tarpit_stats", {
      p_days: days,
    });

    if (error) throw error;

    if (data && data.length > 0) {
      const stats = data[0];
      return {
        totalSessions: stats.total_sessions,
        activeSessions: stats.active_sessions,
        totalDurationSeconds: Number(stats.total_duration_seconds),
        totalBytesSent: Number(stats.total_bytes_sent),
        avgDurationSeconds: Number(stats.avg_duration_seconds),
        uniqueIps: stats.unique_ips,
        uniqueFingerprints: stats.unique_fingerprints,
        topTriggerReasons: stats.top_trigger_reasons || [],
      };
    }

    return null;
  } catch (err) {
    console.error("Error getting tarpit stats:", err);
    return null;
  }
}

/**
 * Redirect to tarpit Edge Function
 * This should be used when a bot is detected
 */
export function redirectToTarpit(config?: TarpitConfig): void {
  const baseUrl = "/functions/v1/tarpit";
  const params = new URLSearchParams();

  if (config) {
    if (config.bytesPerSecond) params.set("bps", config.bytesPerSecond.toString());
    if (config.maxDuration) params.set("maxDuration", config.maxDuration.toString());
    if (config.chunkSize) params.set("chunkSize", config.chunkSize.toString());
    if (config.initialDelay) params.set("initialDelay", config.initialDelay.toString());
  }

  const url = `${baseUrl}?${params.toString()}`;
  window.location.href = url;
}

/**
 * Check if request should be tarpitted based on bot detection
 * This is a helper function to integrate with existing bot detection logic
 */
export function shouldTarpit(
  isBotDetected: boolean,
  isInTarpitAlready: boolean,
  severity: "low" | "medium" | "high" = "medium",
): boolean {
  // Don't tarpit if already in tarpit (avoid resource waste)
  if (isInTarpitAlready) {
    return false;
  }

  // Only tarpit if bot is detected
  if (!isBotDetected) {
    return false;
  }

  // Based on severity, decide whether to tarpit
  // High severity: always tarpit
  // Medium severity: tarpit 80% of the time
  // Low severity: tarpit 30% of the time
  const random = Math.random();
  switch (severity) {
    case "high":
      return true;
    case "medium":
      return random < 0.8;
    case "low":
      return random < 0.3;
    default:
      return false;
  }
}
