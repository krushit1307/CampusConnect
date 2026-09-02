import { describe, it, expect } from "vitest";
import {
  createSyntheticClubLedger,
  generateAccountingProof,
  verifyAccountingProof,
  PrivateLedgerInput,
} from "../clubBudgetZkp";

describe("Club Leadership Budget ZK Proof (#5353)", () => {
  it("1. Valid proof (Income - Payouts === Treasury Balance) generates verifiable proof", async () => {
    const ledger = createSyntheticClubLedger();

    // 75000 - 35000 = 40000
    expect(ledger.authorizedIncome - ledger.authorizedPayouts).toBe(ledger.treasuryBalance);

    const genRes = await generateAccountingProof(ledger);
    expect(genRes.success).toBe(true);
    expect(genRes.statement).toBeDefined();
    expect(genRes.proof).toBeDefined();

    const verRes = await verifyAccountingProof(genRes.statement!, genRes.proof!);
    expect(verRes.valid).toBe(true);
    expect(verRes.message).toBe("Accounting consistency proof verified.");
    expect(verRes.statement).toBe("ACCOUNTING_CONSISTENCY");
  });

  it("2. Invalid accounting relation (mismatched treasury balance) fails proof generation", async () => {
    const ledger = createSyntheticClubLedger();
    // Tamper treasury balance to 70000 instead of 40000
    const invalidLedger: PrivateLedgerInput = {
      ...ledger,
      treasuryBalance: 70000n,
    };

    const genRes = await generateAccountingProof(invalidLedger);
    expect(genRes.success).toBe(false);
    expect(genRes.error).toContain("Mathematical accounting relation failed");
  });

  it("3. Recipient privacy: proof & public statement do not contain private recipient IDs or PII", async () => {
    const ledger = createSyntheticClubLedger();
    const genRes = await generateAccountingProof(ledger);

    expect(genRes.success).toBe(true);
    const jsonStatement = JSON.stringify(genRes.statement);
    const jsonProof = JSON.stringify(genRes.proof);

    // Ensure raw synthetic recipient identifiers like 'recipient-demo-001' are NOT in public statement or proof
    ledger.transactions.forEach((tx) => {
      if (tx.recipientIdentifier) {
        expect(jsonStatement).not.toContain(tx.recipientIdentifier);
        expect(jsonProof).not.toContain(tx.recipientIdentifier);
      }
    });
  });

  it("4. Tampering with public signals causes verification failure", async () => {
    const ledger = createSyntheticClubLedger();
    const genRes = await generateAccountingProof(ledger);

    expect(genRes.success).toBe(true);
    const tamperedStatement = { ...genRes.statement! };
    const tamperedProof = { ...genRes.proof! };

    // Tamper with income in public signals
    tamperedProof.publicSignals = ["999999", ...tamperedProof.publicSignals.slice(1)];

    const verRes = await verifyAccountingProof(tamperedStatement, tamperedProof);
    expect(verRes.valid).toBe(false);
    expect(verRes.message).toContain("Verification failed");
  });

  it("5. No private data leakage in verification results", async () => {
    const ledger = createSyntheticClubLedger();
    const genRes = await generateAccountingProof(ledger);
    const verRes = await verifyAccountingProof(genRes.statement!, genRes.proof!);

    const resultStr = JSON.stringify(verRes);
    expect(resultStr).not.toContain("Catering Vendor Payout");
    expect(resultStr).not.toContain("AV & Stage Hardware");
    expect(resultStr).not.toContain("recipient-demo-001");
  });
});
