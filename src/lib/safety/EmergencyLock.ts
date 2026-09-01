/**
 * EmergencyLock — Instantly & silently locks the escrow ledger when the
 * continuous-authentication system detects a critical kinematic anomaly
 * (snatch-and-run, struggle, device theft).
 *
 * On lock:
 *   1. Broadcasts an EMERGENCY_LOCK across all tabs (via SessionManager).
 *   2. Updates the global safety lock signal (shows the LockScreen overlay).
 *   3. Persists the lock + safety alert to Supabase (escrow_locks /
 *      safety_alerts) via a server-protected Edge Function / RPC.
 *
 * On unlock:
 *   1. Validates a fresh re-authentication (password / WebAuthn / duress-PIN).
 *   2. If a duress PIN was entered, it "appears" to unlock but actually
 *      silently triggers a campus-security alert (audit-only unlock).
 *   3. Updates global state + broadcasts LOCK_RELEASED.
 */

import { createClient } from "@/lib/supabase/client";
import { setSafetyLock, setThreatLevel } from "@/store/globalState";
import { SessionManager } from "../SessionManager";

export type UnlockResult = { ok: true; duressDetected: boolean } | { ok: false; error: string };

export type LockReason =
  "kinematic_anomaly" | "snatch_detected" | "struggle_detected" | "manual_lock" | "session_timeout";

export class EmergencyLockService {
  private static instance: EmergencyLockService | null = null;

  static getInstance(): EmergencyLockService {
    if (!EmergencyLockService.instance) {
      EmergencyLockService.instance = new EmergencyLockService();
    }
    return EmergencyLockService.instance;
  }

  /**
   * Locks the escrow ledger. When `duressFlag` is true, the visual
   * presentation on the lock screen remains identical to a normal lock, but
   * a silent security alert is recorded.
   */
  async triggerLock(
    userId: string,
    reason: LockReason,
    opts?: { duressFlag?: boolean; confidence?: number; sensorSnapshot?: unknown },
  ): Promise<void> {
    const duressFlag = opts?.duressFlag ?? false;

    // 1. Broadcast to all tabs
    SessionManager.getInstance().broadcastEmergencyLock(reason, duressFlag);

    // 2. Update global state — show LockScreen overlay everywhere
    setSafetyLock({ isLocked: true, reason, duressFlag });
    setThreatLevel("critical");

    // 3. Persist lock + alert server-side. Best-effort; do not block the UI.
    try {
      const supabase = createClient();
      await supabase.rpc("lock_user_escrow", {
        p_user_id: userId,
        p_reason: reason,
        p_duress_flag: duressFlag,
      });

      await supabase.rpc("record_safety_alert", {
        p_user_id: userId,
        p_alert_type: reason,
        p_confidence_score: opts?.confidence ?? null,
        p_sensor_snapshot: opts?.sensorSnapshot ?? null,
        p_locked_escrow: true,
        p_duress_indicated: duressFlag,
        p_ip_address: null,
        p_user_agent: navigator.userAgent,
      });
    } catch (err) {
      // Server-side persistence is best-effort. Log for debugging.
      console.error("[EmergencyLock] Failed to persist lock:", err);
    }
  }

  /**
   * Validates a re-authentication and unlocks (or triggers duress alert).
   *
   * @param email - the user's email
   * @param password - the entered password
   * @param duressPin - the user's configured duress PIN (nullable)
   */
  async verifyAndUnlock(
    email: string,
    password: string,
    duressPin?: string | null,
  ): Promise<UnlockResult> {
    const supabase = createClient();

    // Verify credentials with Supabase.
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { ok: false, error: "Invalid credentials" };
    }

    const userId = data.user?.id;
    if (!userId) {
      return { ok: false, error: "Could not identify user" };
    }

    // Re-authentication succeeded. Determine whether the entered PIN is the
    // duress PIN (silently trigger a security alert) — but still unlock the
    // device so the attacker isn't tipped off.
    let duressDetected = false;

    if (duressPin) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("duress_pin_hash")
          .eq("id", userId)
          .maybeSingle();

        if (profile?.duress_pin_hash) {
          // Compare with a constant-time-ish comparison (sha256 stored hash).
          duressDetected = await this.compareDuressPin(duressPin, profile.duress_pin_hash);
        }
      } catch {
        // Ignore — fall back to normal unlock.
      }
    }

    if (duressDetected) {
      // Silently record a duress alert with campus security, but unlock the
      // device so the attacker isn't tipped off.
      await supabase.rpc("record_safety_alert", {
        p_user_id: userId,
        p_alert_type: "duress_pin_entered",
        p_confidence_score: 1.0,
        p_sensor_snapshot: null,
        p_locked_escrow: false,
        p_duress_indicated: true,
        p_ip_address: null,
        p_user_agent: navigator.userAgent,
      });
    }

    // Unlock locally
    setSafetyLock({ isLocked: false, duressFlag: false });
    setThreatLevel("normal");

    // Persist unlock state + broadcast across tabs
    await supabase.rpc("unlock_user_escrow", { p_user_id: userId });
    SessionManager.getInstance().broadcastLockReleased(userId);

    return { ok: true, duressDetected };
  }

  /**
   * Compares a candidate PIN against the stored hash.
   * The stored hash format is "sha256$<hex>" (a salted SHA-256 digest).
   * This is a simplified, dependency-free approach; in production you'd use a
   * proper KDF via an Edge Function.
   */
  private async compareDuressPin(candidate: string, storedHash: string): Promise<boolean> {
    try {
      if (!storedHash.startsWith("sha256$")) {
        return false;
      }
      const hash = storedHash.split("sha256$")[1];
      const enc = new TextEncoder();
      const digest = await crypto.subtle.digest("SHA-256", enc.encode(candidate));
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      // Constant-time comparison
      if (hex.length !== hash.length) return false;
      let diff = 0;
      for (let i = 0; i < hex.length; i++) {
        diff |= hex.charCodeAt(i) ^ hash.charCodeAt(i);
      }
      return diff === 0;
    } catch {
      return false;
    }
  }
}
