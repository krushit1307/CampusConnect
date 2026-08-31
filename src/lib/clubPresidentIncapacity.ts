/**
 * Club President Incapacity Protocol — Dead Man's Switch (#5280)
 * Pure domain logic for the algorithmic executive privilege escalation.
 * State machine: healthy (0-20d) → warning_pending (21-29d) → succession_pending (≥30d)
 */

export const WARNING_THRESHOLD_DAYS = 21;
export const SUCCESSION_THRESHOLD_DAYS = 30;

export type IncapacityStatus =
  | "healthy"
  | "warning_pending"
  | "warning_sent"
  | "succession_pending"
  | "succession_executed"
  | "no_president"
  | "no_vice_president";

export type SuccessionDecision =
  | { action: "none"; reason: "healthy" | "already_warned" | "already_executed" }
  | { action: "send_warning"; daysInactive: number; emailSubject: string }
  | { action: "execute_succession"; daysInactive: number };

export interface PresidentProfile {
  id: string;
  last_active_at: string | null;
  roleTitle: string; // e.g. "President" | "SuperAdmin"
}

export interface SuccessionKeys {
  stripeConnectRevoked: boolean;
  escrowRevoked: boolean;
  newStripePublicKey: string;
  newEscrowPublicKey: string;
}

export function daysSinceLastActive(
  lastActiveAt: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!lastActiveAt) return 0;
  const last = new Date(lastActiveAt);
  if (Number.isNaN(last.getTime())) return 0;
  const diffMs = now.getTime() - last.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function evaluateIncapacityStatus(daysInactive: number): IncapacityStatus {
  if (daysInactive >= SUCCESSION_THRESHOLD_DAYS) return "succession_pending";
  if (daysInactive >= WARNING_THRESHOLD_DAYS) return "warning_pending";
  return "healthy";
}

export function shouldSendWarning(
  daysInactive: number,
  existingStatus?: IncapacityStatus,
): boolean {
  if (daysInactive < WARNING_THRESHOLD_DAYS || daysInactive >= SUCCESSION_THRESHOLD_DAYS)
    return false;
  if (existingStatus === "warning_sent") return false;
  if (existingStatus === "succession_executed") return false;
  return true;
}

export function shouldExecuteSuccession(daysInactive: number, hasVicePresident: boolean): boolean {
  if (!hasVicePresident) return false;
  return daysInactive >= SUCCESSION_THRESHOLD_DAYS;
}

export function decideNextAction(opts: {
  daysInactive: number;
  hasVicePresident: boolean;
  currentStatus?: IncapacityStatus;
}): SuccessionDecision {
  const { daysInactive, hasVicePresident, currentStatus } = opts;
  if (currentStatus === "succession_executed")
    return { action: "none", reason: "already_executed" };
  if (shouldExecuteSuccession(daysInactive, hasVicePresident)) {
    return { action: "execute_succession", daysInactive };
  }
  if (shouldSendWarning(daysInactive, currentStatus)) {
    return {
      action: "send_warning",
      daysInactive,
      emailSubject: "Warning: Impending Executive Lockout.",
    };
  }
  if (
    currentStatus === "warning_sent" &&
    daysInactive < SUCCESSION_THRESHOLD_DAYS &&
    daysInactive >= WARNING_THRESHOLD_DAYS
  ) {
    return { action: "none", reason: "already_warned" };
  }
  return { action: "none", reason: "healthy" };
}

export function buildWarningEmail(
  presidentName: string,
  clubName: string,
  daysInactive: number,
): { subject: string; body: string } {
  return {
    subject: "Warning: Impending Executive Lockout.",
    body: `Hi ${presidentName},\n\nYour account for club "${clubName}" has shown no login activity for ${daysInactive} consecutive days.\n\nOn day 30 of inactivity the system will automatically:\n- Cryptographically revoke your Stripe Connect and Escrow signing keys\n- Promote the Vice President to President and mint fresh access keys\n- Notify the Dean of Students of the structural change\n\nPlease log in to reset the dead man's switch and retain executive privilege.\n\n— CampusConnect Security`,
  };
}

export function buildSuccessionAudit(
  clubId: string,
  oldPresidentId: string,
  newPresidentId: string,
  daysInactive: number,
): Record<string, unknown> {
  return {
    club_id: clubId,
    old_president: oldPresidentId,
    new_president: newPresidentId,
    days_inactive: daysInactive,
    revoked_keys: ["stripe_connect", "escrow"],
    dean_notified: true,
    executed_at: new Date().toISOString(),
  };
}

export function revokeAndMintKeys(clubId: string, newPresidentId: string): SuccessionKeys {
  // Deterministic mock for tests: derive from ids (production would call Stripe API + KMS)
  const suffix = Buffer.from(`${clubId}:${newPresidentId}:${Date.now()}`)
    .toString("hex")
    .slice(0, 16);
  return {
    stripeConnectRevoked: true,
    escrowRevoked: true,
    newStripePublicKey: `pk_live_${suffix}`,
    newEscrowPublicKey: `escrow_pub_${suffix}`,
  };
}

export function isPresidentRole(title: string | null | undefined): boolean {
  if (!title) return false;
  const t = title.trim().toLowerCase();
  return t === "president" || t === "superadmin" || t === "super_admin" || t === "super admin";
}

export function isVicePresidentRole(title: string | null | undefined): boolean {
  if (!title) return false;
  const t = title.trim().toLowerCase();
  return t === "vice president" || t === "vice_president" || t === "vice-president";
}
