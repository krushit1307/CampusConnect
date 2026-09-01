import React, { useState } from "react";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import KeyRound from "lucide-react/dist/esm/icons/key-round";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Lock from "lucide-react/dist/esm/icons/lock";
import EyeOff from "lucide-react/dist/esm/icons/eye-off";
import FileSpreadsheet from "lucide-react/dist/esm/icons/file-spreadsheet";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Cpu from "lucide-react/dist/esm/icons/cpu";

import {
  createSyntheticClubLedger,
  generateAccountingProof,
  verifyAccountingProof,
  PrivateLedgerInput,
  PublicAccountingStatement,
  AccountingProof,
  ProofVerificationResult,
} from "@/lib/crypto/clubBudgetZkp";

export const ClubBudgetZkProofPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"treasurer" | "auditor">("treasurer");
  const [ledger, setLedger] = useState<PrivateLedgerInput>(() => createSyntheticClubLedger());

  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const [generatedStatement, setGeneratedStatement] = useState<PublicAccountingStatement | null>(
    null,
  );
  const [generatedProof, setGeneratedProof] = useState<AccountingProof | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [verificationResult, setVerificationResult] = useState<ProofVerificationResult | null>(
    null,
  );

  // Mismatched Balance Test Toggle
  const [tamperBalance, setTamperBalance] = useState(false);

  const handleGenerateProof = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    setVerificationResult(null);

    const activeLedger: PrivateLedgerInput = tamperBalance
      ? { ...ledger, treasuryBalance: ledger.treasuryBalance + 5000n } // Invalid relation
      : ledger;

    try {
      const res = await generateAccountingProof(activeLedger);
      if (res.success && res.statement && res.proof) {
        setGeneratedStatement(res.statement);
        setGeneratedProof(res.proof);
      } else {
        setGenerationError(res.error || "Proof generation failed.");
      }
    } catch (err: any) {
      setGenerationError(err?.message || "Error occurred during proof generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVerifyProof = async () => {
    if (!generatedStatement || !generatedProof) return;

    setIsVerifying(true);
    try {
      const res = await verifyAccountingProof(generatedStatement, generatedProof);
      setVerificationResult(res);
    } catch (err: any) {
      setVerificationResult({
        valid: false,
        statement: "ACCOUNTING_CONSISTENCY",
        message: err?.message || "Verification execution error.",
        verifiedAt: new Date().toISOString(),
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="bg-card border rounded-2xl p-6 space-y-6 shadow-xl text-card-foreground">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-purple-500/10 rounded-2xl border border-purple-500/20 text-purple-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight">
                Club Budget Privacy & Accounting Integrity (ZKP)
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800">
                PROTOTYPE
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Demonstrate mathematical consistency of income, payouts, and balance without exposing
              private transaction details.
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center p-1 bg-muted rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab("treasurer")}
            data-testid="tab-treasurer"
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === "treasurer"
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Treasurer View
          </button>
          <button
            onClick={() => setActiveTab("auditor")}
            data-testid="tab-auditor"
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === "auditor"
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Auditor Verification
          </button>
        </div>
      </div>

      {/* Safety & Disclaimer Notice */}
      <div className="p-3 bg-muted/60 border rounded-xl flex items-start space-x-2.5 text-xs text-muted-foreground">
        <Lock className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-foreground">Zero-Knowledge Privacy Boundary:</span>{" "}
          Cryptographic proof demonstrates that authorized income minus authorized payouts equals
          treasury balance ($75,000 - $35,000 = $40,000) and payout recipients are verified, while
          keeping private transactions, vendor PII, and Tax IDs hidden.
        </div>
      </div>

      {activeTab === "treasurer" ? (
        <div className="space-y-6">
          {/* Synthetic Private Ledger Section */}
          <div className="bg-muted/30 border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                <span>Synthetic Private Ledger (Hidden from Public)</span>
              </h4>
              <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                <EyeOff className="w-3.5 h-3.5" /> Private
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-3 bg-background border rounded-lg">
                <span className="text-muted-foreground block text-[10px]">Authorized Income</span>
                <span className="text-base font-bold text-green-500">
                  ${ledger.authorizedIncome.toLocaleString()}
                </span>
              </div>
              <div className="p-3 bg-background border rounded-lg">
                <span className="text-muted-foreground block text-[10px]">Authorized Payouts</span>
                <span className="text-base font-bold text-rose-500">
                  ${ledger.authorizedPayouts.toLocaleString()}
                </span>
              </div>
              <div className="p-3 bg-background border rounded-lg">
                <span className="text-muted-foreground block text-[10px]">Treasury Balance</span>
                <span className="text-base font-bold text-blue-500">
                  ${ledger.treasuryBalance.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Private Transactions List */}
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {ledger.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-2.5 bg-background border rounded-lg flex items-center justify-between text-xs font-mono"
                >
                  <div>
                    <span className="font-semibold text-foreground">{tx.description}</span>
                    {tx.recipientIdentifier && (
                      <span className="text-[10px] text-muted-foreground block">
                        Recipient Commitment: {tx.recipientIdentifier}
                      </span>
                    )}
                  </div>
                  <span
                    className={`font-bold ${
                      tx.type === "income" ? "text-green-500" : "text-rose-500"
                    }`}
                  >
                    {tx.type === "income" ? "+" : "-"}${tx.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Test Manipulation Control */}
          <div className="flex items-center justify-between p-3 bg-background border rounded-xl text-xs">
            <span className="font-medium text-muted-foreground">
              Simulate Mismatched Treasury Balance (Invalid Accounting Relation Test)
            </span>
            <input
              type="checkbox"
              checked={tamperBalance}
              onChange={(e) => setTamperBalance(e.target.checked)}
              data-testid="toggle-tamper-balance"
              className="w-4 h-4 accent-purple-600"
            />
          </div>

          {/* Action: Generate ZK Proof */}
          <div className="flex justify-end">
            <button
              onClick={handleGenerateProof}
              disabled={isGenerating}
              data-testid="btn-generate-zk-proof"
              className="px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-600/25 transition disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Generating ZK SNARK Proof...
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" /> Generate ZK Accounting Proof
                </>
              )}
            </button>
          </div>

          {/* Generation Error Alert */}
          {generationError && (
            <div
              role="alert"
              data-testid="proof-generation-error"
              className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs flex items-center gap-2 font-mono"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{generationError}</span>
            </div>
          )}

          {/* Generated Proof Card */}
          {generatedProof && generatedStatement && (
            <div
              data-testid="generated-proof-card"
              className="bg-muted/40 border border-purple-500/30 rounded-xl p-5 space-y-3 font-mono text-xs animate-in fade-in"
            >
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-bold text-purple-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Proof Generated Successfully
                </span>
                <span className="text-[10px] text-muted-foreground">{generatedProof.proofId}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Statement Type</span>
                  <span className="font-bold">{generatedProof.statementType}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">
                    Recipient Merkle Root
                  </span>
                  <span className="font-mono text-purple-300 text-[10px] truncate block">
                    {generatedStatement.authorizedRecipientRoot}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-background border rounded-lg space-y-1 text-[10px]">
                <span className="text-muted-foreground block font-bold">
                  Public Signals (No PII Exposed):
                </span>
                <div>• Income Sum: ${generatedStatement.incomeSum}</div>
                <div>• Payout Sum: ${generatedStatement.payoutSum}</div>
                <div>• Treasury Balance: ${generatedStatement.calculatedBalance}</div>
                <div>
                  • Balance Commitment:{" "}
                  {generatedStatement.treasuryBalanceCommitment.substring(0, 24)}...
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Auditor Verification View */
        <div className="space-y-6">
          <div className="bg-muted/30 border rounded-xl p-5 space-y-4">
            <h4 className="font-bold text-sm flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Auditor Proof Verification Terminal</span>
            </h4>

            {generatedProof && generatedStatement ? (
              <div className="space-y-4 font-mono text-xs">
                <div className="p-4 bg-background border rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                    <span>Proof Payload:</span>
                    <span className="text-emerald-400 font-bold">READY TO VERIFY</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                    <span>Private Transactions:</span>
                    <span className="text-purple-400 font-bold">HIDDEN</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                    <span>Beneficiary Identities / PII:</span>
                    <span className="text-purple-400 font-bold">HIDDEN</span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleVerifyProof}
                    disabled={isVerifying}
                    data-testid="btn-verify-zk-proof"
                    className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Running Verification...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" /> Verify ZK Accounting Proof
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-background border rounded-xl text-center text-xs text-muted-foreground space-y-2">
                <AlertCircle className="w-6 h-6 text-amber-500 mx-auto" />
                <p>
                  No proof generated yet. Switch to Treasurer View to generate a ZK accounting proof
                  first.
                </p>
              </div>
            )}
          </div>

          {/* Verification Result Output Card */}
          {verificationResult && (
            <div
              data-testid="verification-result-card"
              className={`p-5 rounded-xl border font-mono text-xs space-y-3 ${
                verificationResult.valid
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/40 text-rose-300"
              }`}
            >
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                <span className="font-bold flex items-center gap-2 text-sm">
                  {verificationResult.valid ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>ACCOUNTING CONSISTENCY VERIFIED</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-rose-400" />
                      <span>VERIFICATION FAILED</span>
                    </>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(verificationResult.verifiedAt).toLocaleTimeString()}
                </span>
              </div>

              <p className="font-bold text-xs">{verificationResult.message}</p>

              {verificationResult.details && (
                <div className="p-3 bg-background/50 border rounded-lg space-y-1 text-[11px] text-muted-foreground">
                  <div>
                    • Accounting Relation (Income - Payouts = Balance):{" "}
                    {verificationResult.details.balanceConsistent ? "PASS" : "FAIL"}
                  </div>
                  <div>
                    • Authorized Recipient Commitments:{" "}
                    {verificationResult.details.recipientsVerified ? "PASS" : "FAIL"}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
