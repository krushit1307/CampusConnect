import { describe, it, expect } from "vitest";
import {
  reconcileReceiptTransaction,
  filterTransactionsForAdminAuditQueue,
  LedgerTransaction,
} from "./receiptReconciliation";

describe("Implement Automated Club Spending Receipt Reconciliation Suite (#4516)", () => {
  const matchingTx: LedgerTransaction = {
    id: "tx_dominos_400",
    clubId: "club_hackathon",
    vendorName: "Domino's Pizza",
    amount: 400.0,
    verificationStatus: "Pending_Verification",
  };

  const mismatchTx: LedgerTransaction = {
    id: "tx_catering_50",
    clubId: "club_chess",
    vendorName: "Campus Catering",
    amount: 50.0,
    verificationStatus: "Pending_Verification",
  };

  it("automatically verifies transactions when OCR total matches ledger amount exactly (delta = 0.00)", () => {
    const result = reconcileReceiptTransaction(matchingTx, 400.0);

    expect(result.verificationStatus).toBe("Auto-Verified");
    expect(result.delta).toBe(0.0);
    expect(result.requiresManualAudit).toBe(false);
    expect(result.auditQueueReason).toBeUndefined();
  });

  it("flags mismatch_detected and routes to admin audit queue when financial discrepancies exist", () => {
    // Ledger says $50.00, OCR extracts $45.00
    const result = reconcileReceiptTransaction(mismatchTx, 45.0);

    expect(result.verificationStatus).toBe("Mismatch_Detected");
    expect(result.delta).toBe(5.0);
    expect(result.requiresManualAudit).toBe(true);
    expect(result.auditQueueReason).toContain(
      "Ledger logged $50.00, but OCR receipt extracted $45.00",
    );
  });

  it("correctly filters transactions queued for Student Union Admin manual review", () => {
    const rec1 = reconcileReceiptTransaction(matchingTx, 400.0);
    const rec2 = reconcileReceiptTransaction(mismatchTx, 45.0);

    const auditQueue = filterTransactionsForAdminAuditQueue([rec1, rec2]);

    expect(auditQueue.length).toBe(1);
    expect(auditQueue[0].transactionId).toBe("tx_catering_50");
  });
});
