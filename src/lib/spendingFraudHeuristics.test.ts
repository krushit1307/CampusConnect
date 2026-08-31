import { describe, it, expect } from "vitest";
import {
  evaluateStructuringFraudHeuristic,
  calculateRollingVendorTotal,
  LedgerTransactionRecord,
} from "./spendingFraudHeuristics";

describe("Implement Automated Club Spending Fraud Detection Heuristics Suite (#4778)", () => {
  const clubId = "club_robotics";

  const subThresholdTx1: LedgerTransactionRecord = {
    id: "tx_1",
    clubId,
    vendorName: "SparkFun Electronics",
    amount: 260.0,
    createdAtIso: "2026-08-20T10:00:00Z",
    verificationStatus: "Auto-Verified",
  };

  const subThresholdTx2: LedgerTransactionRecord = {
    id: "tx_2",
    clubId,
    vendorName: "SparkFun Electronics",
    amount: 250.0, // 260 + 250 = 510 >= $500 threshold
    createdAtIso: "2026-08-22T14:00:00Z",
    verificationStatus: "Auto-Verified",
  };

  const unrelatedTx: LedgerTransactionRecord = {
    id: "tx_3",
    clubId,
    vendorName: "Domino's Pizza",
    amount: 120.0,
    createdAtIso: "2026-08-21T12:00:00Z",
    verificationStatus: "Auto-Verified",
  };

  const history = [subThresholdTx1, subThresholdTx2, unrelatedTx];

  it("calculates accurate rolling 7-day vendor totals", () => {
    const { rollingTotal } = calculateRollingVendorTotal(subThresholdTx2, history);
    expect(rollingTotal).toBe(510.0);
  });

  it("overrules auto-verification and flags structuring fraud when sub-threshold total >= $500", () => {
    const result = evaluateStructuringFraudHeuristic(subThresholdTx2, history);

    expect(result.isStructuringDetected).toBe(true);
    expect(result.overruledStatus).toBe("Structuring_Fraud_Suspected");
    expect(result.rolling7DayTotal).toBe(510.0);
    expect(result.affectedTransactionIds).toContain("tx_1");
    expect(result.affectedTransactionIds).toContain("tx_2");
    expect(result.fraudFlagReason).toContain("Structuring Fraud Detected");
    expect(result.fraudFlagReason).toContain("SparkFun Electronics");
  });

  it("permits sub-threshold transactions when rolling total remains under $500", () => {
    const singleTxHistory = [subThresholdTx1];
    const result = evaluateStructuringFraudHeuristic(subThresholdTx1, singleTxHistory);

    expect(result.isStructuringDetected).toBe(false);
    expect(result.overruledStatus).toBe("Auto-Verified");
    expect(result.rolling7DayTotal).toBe(260.0);
  });
});
