// =============================================================================
// Types: Dynamic "Hardware Resource" Drone Maintenance Augmented Reality Guide
// Issue: #5132 - Dynamic "Hardware Resource" Drone Maintenance Augmented Reality Guide
// Description: Data structures for drone model specifications, AR setup steps,
// setup sessions, pose verification results, and flight controller unlock payloads.
// =============================================================================

export type DroneSetupStatus =
  | "NOT_STARTED"
  | "MODEL_IDENTIFYING"
  | "MODEL_VERIFIED"
  | "STEP_IN_PROGRESS"
  | "STEP_VERIFIED"
  | "ALL_STEPS_VERIFIED"
  | "FLIGHT_CONTROLLER_UNLOCKED";

export type ArGuideType =
  | "unfold_arms_propellers"
  | "insert_battery"
  | "compass_calibration"
  | "gimbal_cover_removal"
  | "propeller_locks_verify";

export interface DroneSetupStep {
  stepId: string;
  stepNumber: number;
  title: string;
  instructionText: string;
  arGuideType: ArGuideType;
  arOverlayModelUrl?: string;
  verificationThreshold: number; // e.g. 0.85 confidence score
}

export interface DroneModelDefinition {
  modelId: string;
  modelName: string;
  manufacturer: string;
  arOverlayModelUrl: string;
  requiredSteps: DroneSetupStep[];
}

export interface StepVerificationResult {
  stepId: string;
  isVerified: boolean;
  confidenceScore: number;
  poseMessage: string;
  verifiedAt?: string;
}

export interface DroneSetupSession {
  sessionId: string;
  assetId: string;
  studentId: string;
  modelId: string;
  modelName: string;
  currentStepIndex: number;
  completedStepIds: string[];
  status: DroneSetupStatus;
  flightControllerUnlockToken?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface FlightControllerUnlockPayload {
  assetId: string;
  studentId: string;
  modelId: string;
  sessionId: string;
  unlockToken: string;
  unlockedAt: string;
  firmwareAccessGranted: boolean;
}
