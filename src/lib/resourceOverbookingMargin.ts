export interface AssetNoShowYieldConfig {
  assetCategory: string;
  historicalNoShowRate: number;
  overbookingCapacityPercent: number;
  gracePeriodMinutes: number;
}

export interface StandbyPromotionResult {
  queueId: string;
  assetId: string;
  primaryClubName: string;
  standbyClubName: string;
  noShowConfirmed: boolean;
  promotedToActive: boolean;
  pickupWindowMinutes: number;
  notificationMessage: string;
  promotedAt: string;
}

export const DEFAULT_GRACE_PERIOD_MINUTES = 15;

/**
 * Calculates overbooking capacity limit based on historical no-show rates (#4984).
 */
export function calculateOverbookingCapacity(
  totalUnits: number,
  noShowRatePercent: number = 15.0
): { maxAllowedBookings: number; overbookingMarginPercent: number } {
  const units = Math.max(1, totalUnits);
  const marginMultiplier = 1 + Math.min(0.25, Math.max(0.05, noShowRatePercent / 100));
  const maxAllowedBookings = Math.floor(units * marginMultiplier);
  const overbookingMarginPercent = Math.round((maxAllowedBookings / units) * 100);

  return {
    maxAllowedBookings,
    overbookingMarginPercent,
  };
}

/**
 * Evaluates 15-minute RFID pickup grace period. Cancels no-show primary reservation and promotes standby club (#4984).
 */
export function evaluateNoShowStandbyPromotion(
  queueId: string,
  primaryClubName: string,
  standbyClubName: string,
  primaryScannedRfid: boolean,
  minutesElapsed: number,
  assetName: string = "4K Projector"
): StandbyPromotionResult {
  const isNoShow = !primaryScannedRfid && minutesElapsed >= DEFAULT_GRACE_PERIOD_MINUTES;

  if (isNoShow) {
    return {
      queueId,
      assetId: `asset-${Date.now()}`,
      primaryClubName,
      standbyClubName,
      noShowConfirmed: true,
      promotedToActive: true,
      pickupWindowMinutes: 15,
      notificationMessage: `The ${assetName} is yours! ${primaryClubName} missed their 15-minute pickup window. You have 15 minutes to pick it up.`,
      promotedAt: new Date().toISOString(),
    };
  }

  return {
    queueId,
    assetId: `asset-${Date.now()}`,
    primaryClubName,
    standbyClubName,
    noShowConfirmed: false,
    promotedToActive: false,
    pickupWindowMinutes: Math.max(0, DEFAULT_GRACE_PERIOD_MINUTES - minutesElapsed),
    notificationMessage: `Waiting for ${primaryClubName} RFID pickup scan (${Math.max(
      0,
      DEFAULT_GRACE_PERIOD_MINUTES - minutesElapsed
    )}m remaining).`,
    promotedAt: new Date().toISOString(),
  };
}
