import { createClient } from "./supabase/client";
import confetti from "canvas-confetti";

export interface ClueItem {
  clue_id: string;
  sequence_order: number;
  hint_text: string;
  target_lat?: number | null;
  target_lng?: number | null;
  points: number;
  total_clues: number;
  current_score: number;
  is_completed: boolean;
}

export interface ScanSubmissionResult {
  success: boolean;
  message: string;
  new_clue_order: number;
  total_score: number;
  is_completed: boolean;
}

export interface QueuedScan {
  hunt_id: string;
  user_id: string;
  qr_payload: string;
  user_lat?: number | null;
  user_lng?: number | null;
  timestamp: number;
}

export const OFFLINE_QUEUE_KEY = "scavenger_hunt_offline_queue";

/**
 * Calculates distance in meters between two GPS coordinates using Haversine formula.
 */
export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Evaluates whether student's location is within allowed radius (e.g. 50 meters).
 */
export function isWithinGeoBoundary(
  userLat: number,
  userLng: number,
  targetLat: number,
  targetLng: number,
  maxMeters = 50,
): boolean {
  return calculateDistanceMeters(userLat, userLng, targetLat, targetLng) <= maxMeters;
}

/**
 * Formats a standardized unique QR payload for a clue.
 */
export function generateClueQrPayload(huntId: string, stepOrder: number, salt?: string): string {
  const secret = salt || `campus_hunt_${huntId.slice(0, 8)}_step_${stepOrder}`;
  return `CAMPUSHUNT:${huntId}:STEP_${stepOrder}:${secret}`;
}

/**
 * Triggers interactive canvas confetti animation.
 */
export function triggerCelebrationConfetti(isFinal = false): void {
  if (typeof window === "undefined" || !window.document?.createElement) return;

  try {
    if (isFinal) {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ["#6366F1", "#EC4899", "#F59E0B", "#10B981"],
      });
    } else {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.7 },
        colors: ["#3B82F6", "#10B981", "#F59E0B"],
      });
    }
  } catch {
    // Ignore canvas execution errors in jsdom or headless environments
  }
}

/**
 * Fetch current active clue for the user (anti-cheating RPC).
 */
export async function getUserCurrentClue(
  huntId: string,
  userId: string,
): Promise<{ success: boolean; data?: ClueItem; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_user_current_clue", {
      p_hunt_id: huntId,
      p_user_id: userId,
    });

    if (error) throw error;
    return { success: true, data: data?.[0] };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to fetch clue";
    return { success: false, error: errorMsg };
  }
}

/**
 * Submit scanned QR code with optional GPS check.
 */
export async function submitClueScan(
  huntId: string,
  userId: string,
  qrPayload: string,
  userLat?: number | null,
  userLng?: number | null,
): Promise<ScanSubmissionResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("submit_clue_scan", {
      p_hunt_id: huntId,
      p_user_id: userId,
      p_qr_payload: qrPayload.trim(),
      p_user_lat: userLat ?? null,
      p_user_lng: userLng ?? null,
    });

    if (error) throw error;

    const res = data?.[0] as ScanSubmissionResult | undefined;
    if (res?.success) {
      triggerCelebrationConfetti(res.is_completed);
    }
    return (
      res ?? {
        success: false,
        message: "No response from server",
        new_clue_order: 1,
        total_score: 0,
        is_completed: false,
      }
    );
  } catch (err: unknown) {
    // If offline / network failure, save to offline background sync queue
    queueOfflineScan({
      hunt_id: huntId,
      user_id: userId,
      qr_payload: qrPayload,
      user_lat: userLat,
      user_lng: userLng,
      timestamp: Date.now(),
    });

    const errorMsg = err instanceof Error ? err.message : "Network error";
    return {
      success: false,
      message: `Offline mode: Scan recorded locally. Will sync when back online. (${errorMsg})`,
      new_clue_order: 1,
      total_score: 0,
      is_completed: false,
    };
  }
}

/**
 * Queue scan locally for offline dead zones.
 */
export function queueOfflineScan(scan: QueuedScan): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    const list: QueuedScan[] = raw ? JSON.parse(raw) : [];
    list.push(scan);
    window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage quota errors
  }
}

export function getQueuedScans(): QueuedScan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Flush all offline scans once back online.
 */
export async function flushOfflineScans(): Promise<number> {
  const queue = getQueuedScans();
  if (queue.length === 0) return 0;

  let processedCount = 0;
  const remaining: QueuedScan[] = [];

  for (const scan of queue) {
    try {
      const res = await submitClueScan(
        scan.hunt_id,
        scan.user_id,
        scan.qr_payload,
        scan.user_lat,
        scan.user_lng,
      );
      if (res.success) {
        processedCount++;
      } else {
        remaining.push(scan);
      }
    } catch {
      remaining.push(scan);
    }
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  }

  return processedCount;
}
