import { createHash } from "crypto";

export type ClubRiskLevel = "Low" | "Medium" | "High";

export interface OnboardingStep {
  stepNumber: number;
  title: string;
  isMandatory: boolean;
  isWaiverStep: boolean;
}

export interface WaiverExecutionPayload {
  clubId: string;
  incomingAdminId: string;
  adminFullName: string;
  signatureText: string;
  signedAtIso: string;
}

export interface ExecutedWaiverRecord {
  clubId: string;
  incomingAdminId: string;
  waiverTitle: string;
  signatureText: string;
  signatureHash: string;
  signedAtIso: string;
  isLegallyBinding: boolean;
}

export const BASE_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    stepNumber: 1,
    title: "Review Club Budget & Financial Ledger",
    isMandatory: true,
    isWaiverStep: false,
  },
  {
    stepNumber: 2,
    title: "Transfer Administrative Credentials",
    isMandatory: true,
    isWaiverStep: false,
  },
  {
    stepNumber: 3,
    title: "Acknowledge Campus Operations Policy",
    isMandatory: true,
    isWaiverStep: false,
  },
];

export const HIGH_RISK_WAIVER_STEP: OnboardingStep = {
  stepNumber: 4,
  title: "Execute High-Risk Leadership & Legal Indemnification Waiver",
  isMandatory: true,
  isWaiverStep: true,
};

/**
 * Generates dynamic transition handover steps based on the club's risk level.
 */
export function getTransitionHandoverSteps(riskLevel: ClubRiskLevel): OnboardingStep[] {
  if (riskLevel === "High") {
    return [...BASE_ONBOARDING_STEPS, HIGH_RISK_WAIVER_STEP];
  }
  return [...BASE_ONBOARDING_STEPS];
}

/**
 * Computes a secure SHA-256 cryptographic hash of the e-signature payload for legal discovery.
 */
export function generateWaiverSignatureHash(payload: WaiverExecutionPayload): string {
  const rawPayloadString = [
    payload.clubId,
    payload.incomingAdminId,
    payload.adminFullName.trim().toLowerCase(),
    payload.signatureText.trim(),
    payload.signedAtIso,
  ].join("|");

  return createHash("sha256").update(rawPayloadString).digest("hex");
}

/**
 * Validates and executes high-risk waiver e-signatures.
 */
export function executeLeadershipLiabilityWaiver(
  payload: WaiverExecutionPayload,
  riskLevel: ClubRiskLevel,
): ExecutedWaiverRecord {
  if (riskLevel !== "High") {
    throw new Error("Liability waiver execution is only required for High-risk clubs.");
  }

  if (payload.signatureText.trim().toLowerCase() !== payload.adminFullName.trim().toLowerCase()) {
    throw new Error("Signature mismatch: Printed name must match signature text exactly.");
  }

  const signatureHash = generateWaiverSignatureHash(payload);

  return {
    clubId: payload.clubId,
    incomingAdminId: payload.incomingAdminId,
    waiverTitle: "High-Risk Organization Leadership & Legal Indemnification Waiver",
    signatureText: payload.signatureText,
    signatureHash,
    signedAtIso: payload.signedAtIso,
    isLegallyBinding: true,
  };
}
