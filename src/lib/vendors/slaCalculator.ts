import { VendorMilestone, SLACalculationResult } from '@/types/vendors';

/**
 * Calculates the SLA penalty based on the time delta between deadline and actual arrival.
 * Rule: -5% of total payout for every 15 minutes late, capped at 50%.
 */
export function calculateSLAPenalty(milestone: VendorMilestone, arrivalTime: Date): SLACalculationResult {
    const deadline = new Date(milestone.deadline_timestamp);
    const delayMs = arrivalTime.getTime() - deadline.getTime();

    if (delayMs <= 0) {
        return {
            delayMinutes: 0,
            penaltyPercentage: 0,
            penaltyAmount: 0,
            finalPayout: milestone.total_amount,
            message: 'On time or early. No penalty applied.',
        };
    }

    const delayMinutes = Math.ceil(delayMs / (1000 * 60));
    const penaltyPercentage = Math.min(50, Math.floor(delayMinutes / 15) * 5);
    const penaltyAmount = milestone.total_amount * (penaltyPercentage / 100);
    const finalPayout = milestone.total_amount - penaltyAmount;

    return {
        delayMinutes,
        penaltyPercentage,
        penaltyAmount,
        finalPayout,
        message: `Late by ${delayMinutes} minutes. ${penaltyPercentage}% penalty applied ($${penaltyAmount.toFixed(2)} slashed).`,
    };
}
