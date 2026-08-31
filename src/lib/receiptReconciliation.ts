export type VerificationStatus =
  "Pending_Verification" | "Auto-Verified" | "Mismatch_Detected" | "Manual_Audit_Passed";

export interface LedgerTransaction {
  id: string;
  clubId: string;
  vendorName: string;
  amount: number;
  ocrTotalAmount?: number | null;
  verificationStatus: VerificationStatus;
}

export interface ReconciliationResult {
  transactionId: string;
  ledgerAmount: number;
  ocrTotalAmount: number;
  delta: number;
  verificationStatus: VerificationStatus;
  requiresManualAudit: boolean;
  auditQueueReason?: string;
}

/**
 * Reconciles AWS Textract OCR total amount against recorded ledger transaction amount.
 */
export function reconcileReceiptTransaction(
  transaction: LedgerTransaction,
  textractOcrTotal: number,
): ReconciliationResult {
  const ledgerAmount = Number(transaction.amount.toFixed(2));
  const ocrAmount = Number(textractOcrTotal.toFixed(2));
  const delta = Number(Math.abs(ledgerAmount - ocrAmount).toFixed(2));

  if (delta === 0.0) {
    return {
      transactionId: transaction.id,
      ledgerAmount,
      ocrTotalAmount: ocrAmount,
      delta: 0.0,
      verificationStatus: "Auto-Verified",
      requiresManualAudit: false,
    };
  }

  return {
    transactionId: transaction.id,
    ledgerAmount,
    ocrTotalAmount: ocrAmount,
    delta,
    verificationStatus: "Mismatch_Detected",
    requiresManualAudit: true,
    auditQueueReason: `Financial mismatch detected: Ledger logged $${ledgerAmount.toFixed(
      2,
    )}, but OCR receipt extracted $${ocrAmount.toFixed(2)} (Delta: $${delta.toFixed(2)}).`,
  };
}

/**
 * Filters mismatch transactions that must be routed to the Student Union Admin audit queue.
 */
export function filterTransactionsForAdminAuditQueue(
  reconciliations: ReconciliationResult[],
): ReconciliationResult[] {
  return reconciliations.filter((r) => r.requiresManualAudit);
}
