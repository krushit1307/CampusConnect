export interface ContractMilestoneDefinition {
  title: string;
  order: number;
  percentage: number; // e.g. 30 for 30%
}

export interface EscrowMilestoneRecord {
  id: string;
  contractId: string;
  title: string;
  order: number;
  payoutPercentage: number;
  payoutAmount: number;
  isEvidenceVerified: boolean;
  isReleased: boolean;
  stripeTransferId?: string | null;
}

export interface FinancialProgressBarState {
  contractTotalAmount: number;
  totalReleasedAmount: number;
  remainingLockedAmount: number;
  progressPercentage: number;
  completedMilestonesCount: number;
  totalMilestonesCount: number;
}

export interface MilestoneReleaseResult {
  milestoneId: string;
  releasedAmount: number;
  stripeTransferPayload: {
    vendorStripeAccountId: string;
    amountCents: number;
    description: string;
  };
  updatedFinancialState: FinancialProgressBarState;
}

/**
 * Validates that defined milestones sum up to exactly 100%.
 */
export function validateMilestonesDefinition(milestones: ContractMilestoneDefinition[]): boolean {
  if (!milestones || milestones.length === 0) return false;
  const total = milestones.reduce((sum, m) => sum + m.percentage, 0);
  return Math.round(total) === 100;
}

/**
 * Generates milestone records with calculated dollar amounts from total contract value.
 */
export function generateContractMilestones(
  contractId: string,
  totalContractAmount: number,
  definitions: ContractMilestoneDefinition[],
): EscrowMilestoneRecord[] {
  if (!validateMilestonesDefinition(definitions)) {
    throw new Error("Invalid milestones: percentage sum must equal exactly 100%.");
  }

  return definitions.map((def, idx) => {
    const payoutAmount = Number(((totalContractAmount * def.percentage) / 100).toFixed(2));
    return {
      id: `ms_${contractId}_${idx + 1}`,
      contractId,
      title: def.title,
      order: def.order,
      payoutPercentage: def.percentage,
      payoutAmount,
      isEvidenceVerified: false,
      isReleased: false,
      stripeTransferId: null,
    };
  });
}

/**
 * Calculates current financial progress bar metrics across all milestones.
 */
export function calculateFinancialProgressBar(
  contractTotalAmount: number,
  milestones: EscrowMilestoneRecord[],
): FinancialProgressBarState {
  const released = milestones
    .filter((m) => m.isReleased)
    .reduce((sum, m) => sum + m.payoutAmount, 0);

  const totalReleasedAmount = Number(released.toFixed(2));
  const remainingLockedAmount = Number(
    Math.max(0, contractTotalAmount - totalReleasedAmount).toFixed(2),
  );
  const progressPercentage = Number(((totalReleasedAmount / contractTotalAmount) * 100).toFixed(2));
  const completedMilestonesCount = milestones.filter((m) => m.isReleased).length;

  return {
    contractTotalAmount,
    totalReleasedAmount,
    remainingLockedAmount,
    progressPercentage,
    completedMilestonesCount,
    totalMilestonesCount: milestones.length,
  };
}

/**
 * Executes milestone release and formats Stripe Connect transfer payload.
 */
export function executeMilestoneRelease(
  milestone: EscrowMilestoneRecord,
  allMilestones: EscrowMilestoneRecord[],
  totalContractAmount: number,
  vendorStripeAccountId: string,
): MilestoneReleaseResult {
  if (!milestone.isEvidenceVerified) {
    throw new Error("Cannot release milestone escrow: deliverable photo evidence is not verified.");
  }
  if (milestone.isReleased) {
    throw new Error("Milestone has already been released.");
  }

  const updatedMilestones = allMilestones.map((m) =>
    m.id === milestone.id ? { ...m, isReleased: true } : m,
  );

  const updatedState = calculateFinancialProgressBar(totalContractAmount, updatedMilestones);

  return {
    milestoneId: milestone.id,
    releasedAmount: milestone.payoutAmount,
    stripeTransferPayload: {
      vendorStripeAccountId,
      amountCents: Math.round(milestone.payoutAmount * 100),
      description: `Fractional Escrow Release: ${milestone.title} (${milestone.payoutPercentage}%)`,
    },
    updatedFinancialState: updatedState,
  };
}
