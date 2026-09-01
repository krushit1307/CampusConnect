import React, { useState } from "react";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import Lock from "lucide-react/dist/esm/icons/lock";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Cpu from "lucide-react/dist/esm/icons/cpu";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Radio from "lucide-react/dist/esm/icons/radio";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Wallet from "lucide-react/dist/esm/icons/wallet";

import {
  defaultEstateSmartContractEngine,
  EstateDonationTrust,
  SmartContractResult,
} from "@/lib/crypto/alumniEstateSmartContractEngine";

export const AlumniEstateTrustSimulatorCard: React.FC = () => {
  const [demoId] = useState("trust-demo-robotics-5m");
  const [trust, setTrust] = useState<EstateDonationTrust | undefined>(() =>
    defaultEstateSmartContractEngine.getTrust(demoId),
  );

  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Unauthorized Recipient Test Toggle
  const [simulateUnauthorizedWallet, setSimulateUnauthorizedWallet] = useState(false);

  const refreshTrustState = () => {
    setTrust(defaultEstateSmartContractEngine.getTrust(demoId));
  };

  const handleFundTrust = async () => {
    if (!trust) return;
    setIsLoading(true);
    setActionMessage(null);
    setErrorMessage(null);

    const res = defaultEstateSmartContractEngine.fundTrust(demoId, 5000000n);
    if (res.success && res.data) {
      setActionMessage(
        "Trust successfully funded with $5,000,000 USDC. Status updated to WAITING_FOR_ORACLE.",
      );
      refreshTrustState();
    } else {
      setErrorMessage(res.message || "Funding failed.");
    }
    setIsLoading(false);
  };

  const handleOracleVerify = async () => {
    if (!trust) return;
    setIsLoading(true);
    setActionMessage(null);
    setErrorMessage(null);

    const attestation = {
      donationId: demoId,
      eventHash: "0xabc123789fed456hash",
      verified: true,
      certificateRef: "synthetic-attestation-ref-009",
      timestamp: new Date().toISOString(),
    };

    const res = await defaultEstateSmartContractEngine.verifyOracleAttestation(demoId, attestation);
    if (res.success && res.data) {
      setActionMessage(
        "Chainlink Oracle verified synthetic death-event attestation. Status updated to ORACLE_VERIFIED.",
      );
      refreshTrustState();
    } else {
      setErrorMessage(res.message || "Oracle verification failed.");
    }
    setIsLoading(false);
  };

  const handleReleaseTrust = async () => {
    if (!trust) return;
    setIsLoading(true);
    setActionMessage(null);
    setErrorMessage(null);

    const releaseWallet = simulateUnauthorizedWallet
      ? "0xDEADBEEF00000000000000000000000000009999" // Unauthorized attacker wallet
      : trust.beneficiaryWallet; // Locked beneficiary wallet

    const res = defaultEstateSmartContractEngine.releaseTrust(demoId, releaseWallet);
    if (res.success && res.data) {
      setActionMessage(
        `DONATION RELEASED! ${res.data.targetAmount.toLocaleString()} ${res.data.asset} successfully transferred to locked beneficiary wallet (${res.data.beneficiaryWallet}).`,
      );
      refreshTrustState();
    } else {
      setErrorMessage(res.message || "Release failed.");
    }
    setIsLoading(false);
  };

  if (!trust) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 text-slate-100 font-sans">
      {/* Sandbox Disclaimer Header */}
      <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-xs text-amber-200">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold uppercase tracking-wider block text-amber-300">
            PROTOTYPE / SANDBOX SIMULATION
          </span>
          No real funds are transferred. This is not a legally valid estate-planning instrument.
          Demonstrates programmable smart-contract donation release upon oracle verification.
        </div>
      </div>

      {/* Title & Status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <h3 className="text-xl font-bold tracking-tight text-white">
              Alumni Estate Donation Trust (Smart Contract)
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            DeFi Programmable Trust Contract with Chainlink Death-Event Oracle Verification
          </p>
        </div>

        <span
          data-testid="trust-status-badge"
          className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase border ${
            trust.status === "RELEASED"
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
              : trust.status === "ORACLE_VERIFIED"
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                : trust.status === "WAITING_FOR_ORACLE"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700"
          }`}
        >
          {trust.status}
        </span>
      </div>

      {/* Contract & Beneficiary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Alumni Donor</span>
          <span className="text-white font-bold block">{trust.donorName}</span>
          <div className="pt-2 border-t border-slate-900 flex justify-between">
            <span className="text-slate-500">Target Goal:</span>
            <span className="text-emerald-400 font-bold">
              ${trust.targetAmount.toLocaleString()} {trust.asset}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Funded Balance:</span>
            <span className="text-blue-400 font-bold">
              ${trust.fundedAmount.toLocaleString()} {trust.asset}
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
          <span className="text-slate-400 block text-[10px] uppercase font-bold flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-amber-400" /> Beneficiary & Locked Wallet
          </span>
          <span className="text-white font-bold block">{trust.beneficiaryName}</span>
          <div className="pt-2 border-t border-slate-900 space-y-1">
            <span className="text-slate-500 text-[10px] block">Locked Wallet Address:</span>
            <span
              data-testid="locked-beneficiary-wallet"
              className="text-cyan-300 text-[11px] font-mono break-all block bg-slate-900 p-1.5 rounded border border-slate-800"
            >
              {trust.beneficiaryWallet}
            </span>
          </div>
        </div>
      </div>

      {/* Oracle Attestation Status Box */}
      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-bold flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" /> Chainlink Oracle Attestation Status
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              trust.oracleVerified
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-slate-800 text-slate-500"
            }`}
          >
            {trust.oracleVerified ? "VERIFIED" : "PENDING"}
          </span>
        </div>

        {trust.attestationHash && (
          <div className="text-[10px] text-slate-400 pt-1">
            Attestation Hash:{" "}
            <span className="text-cyan-300 break-all">{trust.attestationHash}</span>
          </div>
        )}
      </div>

      {/* Test Unauthorized Wallet Toggle */}
      <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
        <span className="text-slate-400 font-mono">
          Simulate Unauthorized Beneficiary Wallet Release (Rejection Security Test)
        </span>
        <input
          type="checkbox"
          checked={simulateUnauthorizedWallet}
          onChange={(e) => setSimulateUnauthorizedWallet(e.target.checked)}
          data-testid="toggle-unauthorized-wallet"
          className="w-4 h-4 accent-rose-500"
        />
      </div>

      {/* Action Simulation Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <button
          onClick={handleFundTrust}
          disabled={isLoading || trust.status !== "CREATED"}
          data-testid="btn-fund-trust"
          className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs transition shadow-lg disabled:opacity-40"
        >
          1. Fund Trust ($5M)
        </button>

        <button
          onClick={handleOracleVerify}
          disabled={
            isLoading || (trust.status !== "FUNDED" && trust.status !== "WAITING_FOR_ORACLE")
          }
          data-testid="btn-oracle-verify"
          className="py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs transition shadow-lg disabled:opacity-40"
        >
          2. Oracle Verify Event
        </button>

        <button
          onClick={handleReleaseTrust}
          disabled={isLoading || trust.status !== "ORACLE_VERIFIED"}
          data-testid="btn-release-trust"
          className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs transition shadow-lg disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          <ShieldCheck className="w-4 h-4" /> 3. Release Donation
        </button>
      </div>

      {/* Messages Output */}
      {actionMessage && (
        <div
          role="status"
          data-testid="action-success-message"
          className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl font-mono text-xs flex items-center gap-2"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          data-testid="action-error-message"
          className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl font-mono text-xs flex items-center gap-2"
        >
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
