export type BarterConsiderationType = "points" | "ledger";

export interface ParsedBarterAmount {
  amountPoints: number | null;
  amountCents: number | null;
}

export function parseBarterAmount(
  rawValue: string,
  considerationType: BarterConsiderationType,
): ParsedBarterAmount | null {
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;

  if (considerationType === "points") {
    const points = Math.floor(numericValue);
    return points > 0 ? { amountPoints: points, amountCents: null } : null;
  }

  const cents = Math.round(numericValue * 100);
  return cents > 0 ? { amountPoints: null, amountCents: cents } : null;
}

export function formatBarterAmount(
  considerationType: BarterConsiderationType,
  amountPoints: number | null,
  amountCents: number | null,
): string {
  return considerationType === "points"
    ? `${amountPoints ?? 0} points`
    : `$${((amountCents ?? 0) / 100).toFixed(2)}`;
}
