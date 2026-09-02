export interface DonationTier {
  amount: number;
  impact: string;
  icon?: string;
}

export const DEFAULT_DONATION_TIERS: DonationTier[] = [
  { amount: 10, impact: "Buys 1 textbook for a student", icon: "Book" },
  { amount: 25, impact: "Provides refreshments for 5 attendees", icon: "Coffee" },
  { amount: 50, impact: "Funds a student laboratory desk & starter kit", icon: "Microscope" },
  { amount: 100, impact: "Sponsors a full workshop attendance grant", icon: "Award" },
  { amount: 250, impact: "Co-funds guest keynote speaker honorarium", icon: "Sparkles" },
  {
    amount: 500,
    impact: "Fully covers student travel stipends for the event",
    icon: "HeartHandshake",
  },
];

/**
 * Finds the highest unlocked donation tier matching the selected amount.
 */
export function getMatchedDonationTier(
  amount: number,
  tiers: DonationTier[] = DEFAULT_DONATION_TIERS,
): DonationTier | null {
  if (tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.amount - b.amount);

  let currentTier: DonationTier | null = null;
  for (const tier of sorted) {
    if (amount >= tier.amount) {
      currentTier = tier;
    } else {
      break;
    }
  }

  return currentTier;
}

/**
 * Validates selected amount against minimum ticket entry price.
 */
export function validateDonationAmount(
  amount: number,
  minAmount: number = 10,
  maxAmount: number = 1000,
): { isValid: boolean; error?: string; integerAmount: number } {
  const integerAmount = Math.round(amount);
  if (integerAmount < minAmount) {
    return {
      isValid: false,
      error: `Minimum ticket price is $${minAmount}.`,
      integerAmount,
    };
  }
  if (integerAmount > maxAmount) {
    return {
      isValid: false,
      error: `Maximum donation limit is $${maxAmount}.`,
      integerAmount,
    };
  }
  return { isValid: true, integerAmount };
}
