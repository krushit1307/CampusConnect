export interface DonationRecord {
  id: string;
  campaignId: string;
  donorName: string;
  amount: number;
  createdAt: string;
}

export interface DonationCampaignSummary {
  campaignId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  progressPercentage: number;
  isGoalReached: boolean;
  recentDonors: DonationRecord[];
}

/**
 * Formats a numeric amount into USD currency string (#4402).
 */
export function formatDonationCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, amount));
}

/**
 * Calculates campaign progress percentage and goal status (#4402).
 */
export function calculateCampaignProgress(
  targetAmount: number,
  currentAmount: number
): { progressPercentage: number; isGoalReached: boolean } {
  const target = Math.max(1, targetAmount);
  const current = Math.max(0, currentAmount);
  const pct = Math.round((current / target) * 1000) / 10;
  const isGoalReached = current >= target;

  return {
    progressPercentage: pct,
    isGoalReached,
  };
}

/**
 * Adds a new donation to the campaign summary and updates ticker list (#4402).
 */
export function addDonationToCampaign(
  summary: DonationCampaignSummary,
  donorName: string,
  amount: number
): DonationCampaignSummary {
  const newDonation: DonationRecord = {
    id: `don-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    campaignId: summary.campaignId,
    donorName: donorName.trim() || "Anonymous Supporter",
    amount: Math.max(1, amount),
    createdAt: new Date().toISOString(),
  };

  const updatedCurrent = summary.currentAmount + newDonation.amount;
  const progress = calculateCampaignProgress(summary.targetAmount, updatedCurrent);
  const updatedDonors = [newDonation, ...summary.recentDonors].slice(0, 10); // Keep top 10 recent

  return {
    ...summary,
    currentAmount: updatedCurrent,
    progressPercentage: progress.progressPercentage,
    isGoalReached: progress.isGoalReached,
    recentDonors: updatedDonors,
  };
}
