export interface DonationGoalTier {
  id: string;
  eventId: string;
  tierOrder: number;
  targetAmount: number;
  title: string;
  description?: string;
  isUnlocked: boolean;
}

export interface ThermometerScaleResult {
  currentTotalDonations: number;
  activeTargetGoal: number;
  activeGoalTierOrder: number;
  activeGoalTitle: string;
  nextStretchGoal: number | null;
  fillPercentage: number;
  yAxisMaxScale: number;
  triggerCelebrationAnimation: boolean;
  statusMessage: string;
}

/**
 * Calculates dynamic SVG Thermometer Y-axis scaling, fill percentages, and celebration triggers.
 */
export function calculateDonationThermometerState(
  currentTotalDonations: number,
  goals: DonationGoalTier[],
): ThermometerScaleResult {
  const sortedGoals = [...goals].sort((a, b) => a.tierOrder - b.tierOrder);

  if (sortedGoals.length === 0) {
    return {
      currentTotalDonations,
      activeTargetGoal: 0,
      activeGoalTierOrder: 1,
      activeGoalTitle: "General Fundraising",
      nextStretchGoal: null,
      fillPercentage: 100,
      yAxisMaxScale: Math.max(100, currentTotalDonations),
      triggerCelebrationAnimation: false,
      statusMessage: "Support our campaign!",
    };
  }

  // Identify highest met goal index and active target goal index
  let highestMetIndex = -1;
  for (let i = 0; i < sortedGoals.length; i++) {
    if (currentTotalDonations >= sortedGoals[i].targetAmount) {
      highestMetIndex = i;
    }
  }

  const activeIndex =
    highestMetIndex >= 0 && highestMetIndex < sortedGoals.length - 1
      ? highestMetIndex + 1
      : Math.max(0, highestMetIndex);

  const activeGoal = sortedGoals[activeIndex];
  const isPrimaryGoalMet = highestMetIndex >= 0;
  const isAllGoalsMet =
    highestMetIndex === sortedGoals.length - 1 &&
    currentTotalDonations >= sortedGoals[sortedGoals.length - 1].targetAmount;

  // Calculate thermometer SVG percentage height (capped at 100%)
  const rawPercentage = (currentTotalDonations / activeGoal.targetAmount) * 100;
  const fillPercentage = Number(Math.min(100, Math.max(0, rawPercentage)).toFixed(1));

  let statusMessage = `Goal: $${activeGoal.targetAmount.toLocaleString()} - ${activeGoal.title}`;
  if (isAllGoalsMet) {
    statusMessage = `ALL STRETCH GOALS UNLOCKED! Total raised: $${currentTotalDonations.toLocaleString()}!`;
  } else if (isPrimaryGoalMet) {
    statusMessage = `GOAL MET! Help us hit our Stretch Goal ($${activeGoal.targetAmount.toLocaleString()}) to ${activeGoal.title}!`;
  }

  const nextStretchGoal =
    activeIndex < sortedGoals.length - 1 ? sortedGoals[activeIndex + 1].targetAmount : null;

  return {
    currentTotalDonations,
    activeTargetGoal: activeGoal.targetAmount,
    activeGoalTierOrder: activeGoal.tierOrder,
    activeGoalTitle: activeGoal.title,
    nextStretchGoal: isPrimaryGoalMet ? activeGoal.targetAmount : nextStretchGoal,
    fillPercentage,
    yAxisMaxScale: activeGoal.targetAmount,
    triggerCelebrationAnimation: isPrimaryGoalMet,
    statusMessage,
  };
}
