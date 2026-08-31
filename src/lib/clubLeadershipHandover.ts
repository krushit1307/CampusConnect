export interface LeadershipHandoverState {
  id?: string;
  clubId: string;
  userId: string;
  role: "president" | "treasurer" | "admin" | "officer";
  signedConstitution: boolean;
  signedFinancialLedger: boolean;
  signedComplianceProbation: boolean;
  completedAtIso?: string | null;
}

export interface HandoverSummaryDetails {
  clubName: string;
  currentBalance: number;
  constitutionVersion: string;
  activeProbationsCount: number;
  handoverState: LeadershipHandoverState;
}

export interface OnboardingAccessResult {
  isAccessGranted: boolean;
  pendingStep?: number;
  message: string;
}

/**
 * Determines dashboard access permissions based on 3-step digital signature completion.
 */
export function evaluateLeadershipOnboardingAccess(
  state: LeadershipHandoverState,
): OnboardingAccessResult {
  if (!state.signedConstitution) {
    return {
      isAccessGranted: false,
      pendingStep: 1,
      message: "Access Blocked: You must review and sign the Club Constitution (Step 1).",
    };
  }

  if (!state.signedFinancialLedger) {
    return {
      isAccessGranted: false,
      pendingStep: 2,
      message:
        "Access Blocked: You must review active Financial Ledger balances and sign acknowledgment (Step 2).",
    };
  }

  if (!state.signedComplianceProbation) {
    return {
      isAccessGranted: false,
      pendingStep: 3,
      message:
        "Access Blocked: You must review active probations/strikes and sign University Compliance agreement (Step 3).",
    };
  }

  return {
    isAccessGranted: true,
    message: "Handover complete! Dashboard access unlocked.",
  };
}

/**
 * Updates digital signature state when user signs a specific handover step.
 */
export function signHandoverStep(
  state: LeadershipHandoverState,
  step: 1 | 2 | 3,
): LeadershipHandoverState {
  const updated = { ...state };

  if (step === 1) updated.signedConstitution = true;
  if (step === 2) updated.signedFinancialLedger = true;
  if (step === 3) updated.signedComplianceProbation = true;

  if (
    updated.signedConstitution &&
    updated.signedFinancialLedger &&
    updated.signedComplianceProbation
  ) {
    updated.completedAtIso = new Date().toISOString();
  }

  return updated;
}
