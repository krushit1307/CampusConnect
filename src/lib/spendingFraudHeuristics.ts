export type VerificationStatus =
  | "Pending_Verification"
  | "Auto-Verified"
  | "Mismatch_Detected"
  | "Structuring_Fraud_Suspected"
  | "Manual_Audit_Passed";

export interface LedgerTransactionRecord {
  id: string;
  clubId: string;
  vendorName: string;
  amount: number;
  createdAtIso: string;
  verificationStatus: VerificationStatus;
  fraudFlagReason?: string | null;
}

export interface StructuringEvaluationResult {
  transactionId: string;
  vendorName: string;
  rolling7DayTotal: number;
  isStructuringDetected: boolean;
  overruledStatus: VerificationStatus;
  fraudFlagReason?: string;
  affectedTransactionIds: string[];
}

export const MANUAL_AUDIT_SINGLE_THRESHOLD = 500.0;
export const ROLLING_WINDOW_DAYS = 7;

/**
 * Normalizes vendor strings for accurate heuristic grouping.
 */
export function normalizeVendorName(vendorName: string): string {
  return vendorName.trim().toLowerCase();
}

/**
 * Calculates rolling total spending for a vendor within the 7-day lookback window.
 */
export function calculateRollingVendorTotal(
  targetTransaction: LedgerTransactionRecord,
  allTransactions: LedgerTransactionRecord[],
  lookbackDays = ROLLING_WINDOW_DAYS,
): { rollingTotal: number; windowTransactions: LedgerTransactionRecord[] } {
  const normVendor = normalizeVendorName(targetTransaction.vendorName);
  const targetDate = new Date(targetTransaction.createdAtIso).getTime();
  const windowStartMs = targetDate - lookbackDays * 24 * 60 * 60 * 1000;

  const windowTransactions = allTransactions.filter((tx) => {
    if (tx.clubId !== targetTransaction.clubId) return false;
    if (normalizeVendorName(tx.vendorName) !== normVendor) return false;

    const txDate = new Date(tx.createdAtIso).getTime();
    return txDate >= windowStartMs && txDate <= targetDate;
  });

  const rollingTotal = windowTransactions.reduce((sum, tx) => sum + tx.amount, 0);

  return {
    rollingTotal: Number(rollingTotal.toFixed(2)),
    windowTransactions,
  };
}

/**
 * Evaluates structuring fraud heuristics and overrules OCR Auto-Verification if rolling sum >= $500.
 */
export function evaluateStructuringFraudHeuristic(
  targetTransaction: LedgerTransactionRecord,
  history: LedgerTransactionRecord[],
  threshold = MANUAL_AUDIT_SINGLE_THRESHOLD,
): StructuringEvaluationResult {
  const { rollingTotal, windowTransactions } = calculateRollingVendorTotal(
    targetTransaction,
    history,
  );

  const isStructuringDetected = rollingTotal >= threshold;

  if (!isStructuringDetected) {
    return {
      transactionId: targetTransaction.id,
      vendorName: targetTransaction.vendorName,
      rolling7DayTotal: rollingTotal,
      isStructuringDetected: false,
      overruledStatus: targetTransaction.verificationStatus,
      affectedTransactionIds: [],
    };
  }

  const fraudFlagReason = `Structuring Fraud Detected: 7-day cumulative spend for vendor "${
    targetTransaction.vendorName
  }" reached $${rollingTotal.toFixed(2)} (exceeds $${threshold.toFixed(
    2,
  )} audit threshold). Overruling auto-verification.`;

  return {
    transactionId: targetTransaction.id,
    vendorName: targetTransaction.vendorName,
    rolling7DayTotal: rollingTotal,
    isStructuringDetected: true,
    overruledStatus: "Structuring_Fraud_Suspected",
    fraudFlagReason,
    affectedTransactionIds: windowTransactions.map((tx) => tx.id),
  };
}
