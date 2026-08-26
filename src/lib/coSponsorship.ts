export type EscrowEntry = {
  amount: number | string;
  entry_type: "deposit" | "refund";
};

export function normalizeContributionAmount(value: string | number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100) / 100;
}

export function calculateEscrowBalance(entries: EscrowEntry[]) {
  return Math.round(entries.reduce((total, entry) => total + Number(entry.amount), 0) * 100) / 100;
}
