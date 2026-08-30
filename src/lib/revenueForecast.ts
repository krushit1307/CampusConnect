export function formatRevenueCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function estimateProjectedTickets(
  currentSold: number,
  daysRemaining: number,
  averageCurvePercent: number,
  averageDailyVelocity: number,
  capacity = 0,
): number {
  if (currentSold <= 0) return 0;
  const projected =
    averageCurvePercent > 0
      ? Math.ceil(currentSold / averageCurvePercent)
      : Math.ceil(currentSold + averageDailyVelocity * Math.max(0, daysRemaining));
  return capacity > 0
    ? Math.min(capacity, Math.max(currentSold, projected))
    : Math.max(currentSold, projected);
}

export function getRevenueForecastWarning(
  projectedRevenueCents: number,
  breakEvenCents: number,
): string | null {
  const shortfall = breakEvenCents - projectedRevenueCents;
  return shortfall > 0
    ? `Projected ${formatRevenueCents(shortfall)} loss. Consider increasing marketing efforts.`
    : null;
}
