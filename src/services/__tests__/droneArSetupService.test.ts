// =============================================================================
// Unit Tests: DroneArSetupService
// Issue: #5132 - Dynamic "Hardware Resource" Drone Maintenance Augmented Reality Guide
// Description: Exhaustive tests for checkout authorization, camera model detection,
// step-by-step pose verification, step-skipping prevention, and flight controller unlocking.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DroneArSetupService } from "../droneArSetupService";

describe("DroneArSetupService (#5132)", () => {
  let service: DroneArSetupService;

  const mockAssetId = "drone-asset-99";
  const mockStudentId = "student-pilot-123";

  beforeEach(() => {
    service = new DroneArSetupService();
  });

  afterEach(() => {
    service.clearAll();
  });

  it("initiates a setup session for an authorized user with active checkout booking", () => {
    const res = service.startSetupSession(mockAssetId, mockStudentId, true, "skydio_x2");

    expect(res.success).toBe(true);
    expect(res.session).toBeDefined();
    expect(res.session?.status).toBe("NOT_STARTED");
    expect(res.session?.modelId).toBe("skydio_x2");
  });

  it("rejects unauthorized users who do not have an active checkout booking for the drone asset", () => {
    const res = service.startSetupSession(mockAssetId, "unauthorized-user-999", false, "skydio_x2");

    expect(res.success).toBe(false);
    expect(res.error).toContain("Unauthorized");
  });

  it("identifies drone model via camera object recognition and updates session status", () => {
    const startRes = service.startSetupSession(mockAssetId, mockStudentId, true, "skydio_x2");
    const sessionId = startRes.session!.sessionId;

    const identifyRes = service.identifyDroneModelFromCamera(sessionId, "skydio_x2", 0.94);

    expect(identifyRes.success).toBe(true);
    expect(identifyRes.session?.status).toBe("MODEL_VERIFIED");
  });

  it("rejects low-confidence or mismatched model camera recognition", () => {
    const startRes = service.startSetupSession(mockAssetId, mockStudentId, true, "skydio_x2");
    const sessionId = startRes.session!.sessionId;

    // Low confidence
    const lowConf = service.identifyDroneModelFromCamera(sessionId, "skydio_x2", 0.5);
    expect(lowConf.success).toBe(false);
    expect(lowConf.error).toContain("confidence too low");

    // Model mismatch
    const mismatch = service.identifyDroneModelFromCamera(sessionId, "dji_mavic_3", 0.95);
    expect(mismatch.success).toBe(false);
    expect(mismatch.error).toContain("Model mismatch");
  });

  it("verifies setup steps in strict sequence and rejects step-skipping out-of-order attempts", () => {
    const startRes = service.startSetupSession(mockAssetId, mockStudentId, true, "skydio_x2");
    const sessionId = startRes.session!.sessionId;
    service.identifyDroneModelFromCamera(sessionId, "skydio_x2", 0.94);

    // Attempting Step 2 (insert_battery) BEFORE Step 1 (unfold_arms) -> REJECTED
    const skipAttempt = service.verifyStepPose(sessionId, "step_insert_battery", 0.95);
    expect(skipAttempt.isVerified).toBe(false);
    expect(skipAttempt.poseMessage).toContain("Out-of-order step verification rejected");

    // Step 1: Unfold arms -> PASSED
    const step1Res = service.verifyStepPose(sessionId, "step_unfold_arms", 0.9);
    expect(step1Res.isVerified).toBe(true);

    // Step 2: Insert battery -> PASSED
    const step2Res = service.verifyStepPose(sessionId, "step_insert_battery", 0.92);
    expect(step2Res.isVerified).toBe(true);

    // Step 3: Compass calibration -> PASSED
    const step3Res = service.verifyStepPose(sessionId, "step_compass_calibration", 0.96);
    expect(step3Res.isVerified).toBe(true);

    const updatedSession = service.getSession(sessionId);
    expect(updatedSession?.status).toBe("ALL_STEPS_VERIFIED");
    expect(updatedSession?.completedStepIds).toHaveLength(3);
  });

  it("unlocks flight-controller software and issues signed unlock token ONLY AFTER all steps are verified", () => {
    const startRes = service.startSetupSession(mockAssetId, mockStudentId, true, "skydio_x2");
    const sessionId = startRes.session!.sessionId;
    service.identifyDroneModelFromCamera(sessionId, "skydio_x2", 0.94);

    // Attempting unlock BEFORE completing steps -> DENIED
    const prematureUnlock = service.completeAndUnlockFlightController(sessionId);
    expect(prematureUnlock.success).toBe(false);
    expect(prematureUnlock.error).toContain("Cannot unlock flight controller");

    // Complete all 3 steps
    service.verifyStepPose(sessionId, "step_unfold_arms", 0.9);
    service.verifyStepPose(sessionId, "step_insert_battery", 0.92);
    service.verifyStepPose(sessionId, "step_compass_calibration", 0.96);

    // Unlock flight controller -> SUCCESS
    const unlockRes = service.completeAndUnlockFlightController(sessionId);

    expect(unlockRes.success).toBe(true);
    expect(unlockRes.unlockPayload).toBeDefined();

    const payload = unlockRes.unlockPayload!;
    expect(payload.firmwareAccessGranted).toBe(true);
    expect(payload.unlockToken).toContain("fc_unlock_");

    expect(service.isTokenValid(payload.unlockToken)).toBe(true);
  });
});
