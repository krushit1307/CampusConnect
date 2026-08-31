import { describe, it, expect, vi } from "vitest";
import {
  WARNING_THRESHOLD_DAYS,
  SUCCESSION_THRESHOLD_DAYS,
  daysSinceLastActive,
  evaluateIncapacityStatus,
  shouldSendWarning,
  shouldExecuteSuccession,
  decideNextAction,
  buildWarningEmail,
  buildSuccessionAudit,
  revokeAndMintKeys,
  isPresidentRole,
  isVicePresidentRole,
} from "./clubPresidentIncapacity";

describe("clubPresidentIncapacity — Dead Man's Switch #5280", () => {
  it("computes days since last active", () => {
    const now = new Date("2026-05-27T12:00:00Z");
    expect(daysSinceLastActive("2026-05-06T12:00:00Z", now)).toBe(21);
    expect(daysSinceLastActive("2026-04-27T12:00:00Z", now)).toBe(30);
    expect(daysSinceLastActive(null, now)).toBe(0);
    expect(daysSinceLastActive("invalid", now)).toBe(0);
    expect(daysSinceLastActive(new Date().toISOString(), now)).toBe(0);
  });

  it("evaluates status thresholds 21/30", () => {
    expect(evaluateIncapacityStatus(0)).toBe("healthy");
    expect(evaluateIncapacityStatus(20)).toBe("healthy");
    expect(evaluateIncapacityStatus(21)).toBe("warning_pending");
    expect(evaluateIncapacityStatus(29)).toBe("warning_pending");
    expect(evaluateIncapacityStatus(30)).toBe("succession_pending");
    expect(evaluateIncapacityStatus(90)).toBe("succession_pending");
  });

  it("decides warning vs succession with idempotency", () => {
    expect(shouldSendWarning(20)).toBe(false);
    expect(shouldSendWarning(21)).toBe(true);
    expect(shouldSendWarning(25)).toBe(true);
    expect(shouldSendWarning(30)).toBe(false);
    expect(shouldSendWarning(21, "warning_sent")).toBe(false);
    expect(shouldExecuteSuccession(30, true)).toBe(true);
    expect(shouldExecuteSuccession(30, false)).toBe(false);
    expect(shouldExecuteSuccession(29, true)).toBe(false);
  });

  it("decideNextAction state machine", () => {
    expect(decideNextAction({ daysInactive: 10, hasVicePresident: true })).toEqual({
      action: "none",
      reason: "healthy",
    });
    expect(decideNextAction({ daysInactive: 21, hasVicePresident: true }).action).toBe(
      "send_warning",
    );
    expect(
      decideNextAction({ daysInactive: 21, hasVicePresident: true, currentStatus: "warning_sent" }),
    ).toEqual({
      action: "none",
      reason: "already_warned",
    });
    expect(decideNextAction({ daysInactive: 30, hasVicePresident: true }).action).toBe(
      "execute_succession",
    );
    expect(decideNextAction({ daysInactive: 30, hasVicePresident: false }).action).toBe("none");
    expect(
      decideNextAction({
        daysInactive: 30,
        hasVicePresident: true,
        currentStatus: "succession_executed",
      }),
    ).toEqual({
      action: "none",
      reason: "already_executed",
    });
  });

  it("builds warning email with 21-day subject", () => {
    const email = buildWarningEmail("Alex", "Robotics Club", 21);
    expect(email.subject).toBe("Warning: Impending Executive Lockout.");
    expect(email.body).toContain("21 consecutive days");
    expect(email.body).toContain("Stripe Connect");
    expect(email.body).toContain("Vice President");
  });

  it("builds succession audit with revoked keys and dean notified", () => {
    const audit = buildSuccessionAudit("club-1", "pres-1", "vp-1", 30);
    expect(audit.club_id).toBe("club-1");
    expect(audit.revoked_keys).toEqual(["stripe_connect", "escrow"]);
    expect(audit.dean_notified).toBe(true);
  });

  it("revokes and mints deterministic keys", () => {
    const keys = revokeAndMintKeys("club-1", "vp-1");
    expect(keys.stripeConnectRevoked).toBe(true);
    expect(keys.escrowRevoked).toBe(true);
    expect(keys.newStripePublicKey).toMatch(/^pk_live_/);
    expect(keys.newEscrowPublicKey).toMatch(/^escrow_pub_/);
  });

  it("detects president and vice president roles", () => {
    expect(isPresidentRole("President")).toBe(true);
    expect(isPresidentRole("SuperAdmin")).toBe(true);
    expect(isPresidentRole("president ")).toBe(true);
    expect(isPresidentRole("Vice President")).toBe(false);
    expect(isVicePresidentRole("Vice President")).toBe(true);
    expect(isVicePresidentRole("vice_president")).toBe(true);
    expect(isVicePresidentRole("President")).toBe(false);
  });

  it("constants are 21 and 30", () => {
    expect(WARNING_THRESHOLD_DAYS).toBe(21);
    expect(SUCCESSION_THRESHOLD_DAYS).toBe(30);
  });
});
