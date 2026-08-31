import React, { useMemo, useState } from "react";
import { Banknote, PiggyBank, ShieldAlert, Skull, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TIER_TEXT_CLASS,
  computePoolState,
  formatUsd,
  listRiskProfiles,
  quotePremium,
  settleDestruction,
} from "@/lib/hardwareInsurancePremium";
import { DestructionSettlement, InsurableAsset, PoolLedgerEntry } from "@/types/hardwareInsurance";

/**
 * Admin console for the hardware self-insurance pool (#5289).
 *
 * Shows the pool position derived from its ledger, the risk tiers that price every
 * checkout, and the "Asset Destroyed" action that routes a replacement payout to
 * purchasing. The settlement is previewed before it is committed, including the
 * shortfall when the pool cannot cover the replacement — an admin should learn that
 * before promising a club a new drone, not after.
 */

export interface HardwareInsurancePoolAdminProps {
  ledger: PoolLedgerEntry[];
  /** Assets currently on loan or flagged, eligible to be declared destroyed. */
  assets: InsurableAsset[];
  payeeDepartment?: string;
  /** Commits the claim; the Edge Function re-derives the payout server-side. */
  onDeclareDestroyed?: (
    settlement: DestructionSettlement,
    incidentDescription: string,
  ) => Promise<void> | void;
}

export const HardwareInsurancePoolAdmin: React.FC<HardwareInsurancePoolAdminProps> = ({
  ledger,
  assets,
  payeeDepartment = "Purchasing Department",
  onDeclareDestroyed,
}) => {
  const [selectedAssetId, setSelectedAssetId] = useState(assets[0]?.id ?? "");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [isSettling, setIsSettling] = useState(false);
  const [committed, setCommitted] = useState<DestructionSettlement | null>(null);
  const [error, setError] = useState("");

  const pool = useMemo(() => computePoolState(ledger), [ledger]);
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);

  const preview = useMemo(
    () =>
      selectedAsset ? settleDestruction({ asset: selectedAsset, ledger, payeeDepartment }) : null,
    [selectedAsset, ledger, payeeDepartment],
  );

  const handleDeclareDestroyed = async () => {
    if (!preview || !incidentDescription.trim() || isSettling) return;

    setIsSettling(true);
    setError("");
    try {
      await onDeclareDestroyed?.(preview, incidentDescription.trim());
      setCommitted(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not route the replacement payout.");
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <div
      className="max-w-6xl mx-auto p-6 font-sans space-y-8"
      data-testid="hardware-insurance-pool-admin"
    >
      <div className="border-b border-slate-800 pb-8">
        <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-4">
          <PiggyBank className="h-10 w-10 text-emerald-500" />
          Hardware Self-Insurance Pool
        </h1>
        <p className="text-slate-400 mt-3 font-mono text-base max-w-4xl leading-relaxed">
          Every hardware checkout contributes a mandatory micro-premium priced by the asset&apos;s
          risk tier. When an asset is destroyed, the replacement cost is routed from this pool to{" "}
          {payeeDepartment} instead of falling on the club that borrowed it.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Pool balance
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-400" data-testid="pool-balance">
              {formatUsd(pool.balanceUsd)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Premiums collected
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {formatUsd(pool.premiumsCollectedUsd)}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-500">{pool.premiumCount} checkouts</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Payouts issued
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {formatUsd(pool.payoutsIssuedUsd)}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-500">{pool.payoutCount} replacements</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Subsidies</p>
            <p className="mt-2 text-3xl font-black text-white">
              {formatUsd(pool.subsidiesReceivedUsd)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800 pb-5">
            <CardTitle className="text-white flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              Risk tiers
            </CardTitle>
            <CardDescription className="text-slate-400">
              Multipliers applied to every checkout premium.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-2">
              {listRiskProfiles().map((profile) => (
                <li
                  key={profile.category}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-sm text-slate-100">{profile.category}</p>
                    <span
                      className={`text-xs font-bold uppercase tracking-widest ${TIER_TEXT_CLASS[profile.tier]}`}
                    >
                      {profile.tier} · ×{profile.riskMultiplier}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{profile.rationale}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800 pb-5">
            <CardTitle className="text-white flex items-center gap-2 text-lg">
              <Skull className="h-5 w-5 text-red-400" />
              Declare an asset destroyed
            </CardTitle>
            <CardDescription className="text-slate-400">
              Routes the replacement cost from the pool to {payeeDepartment}.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">
              Asset
              <select
                value={selectedAssetId}
                onChange={(event) => setSelectedAssetId(event.target.value)}
                aria-label="Asset destroyed"
                className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
              >
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} — {formatUsd(asset.valuationUsd)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">
              Incident
              <textarea
                value={incidentDescription}
                onChange={(event) => setIncidentDescription(event.target.value)}
                aria-label="Incident description"
                rows={3}
                placeholder="Flown into the lake during the freshman workshop; unrecoverable."
                className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
              />
            </label>

            {selectedAsset && preview && (
              <div
                className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-1"
                data-testid="settlement-preview"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Settlement preview
                </p>
                <p className="font-mono text-sm text-slate-100">
                  claim {formatUsd(preview.claimedUsd)} · payout {formatUsd(preview.payoutUsd)} ·
                  shortfall {formatUsd(preview.shortfallUsd)}
                </p>
                <p
                  className={`text-xs font-bold uppercase tracking-widest ${
                    preview.decision === "FULLY_FUNDED" ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {preview.decision.replace(/_/g, " ")}
                </p>
                <p className="text-xs text-slate-500">{preview.reason}</p>
                <p className="font-mono text-[11px] text-slate-500">
                  premium on this asset today: {formatUsd(quotePremium(selectedAsset).premiumUsd)}
                </p>
              </div>
            )}

            {preview && preview.shortfallUsd > 0 && (
              <p role="alert" className="flex items-start gap-2 text-sm text-red-400">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                The pool cannot cover this replacement in full. {formatUsd(
                  preview.shortfallUsd,
                )}{" "}
                needs another funding source.
              </p>
            )}

            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            {committed ? (
              <p role="status" className="flex items-start gap-2 text-sm text-emerald-400">
                <Banknote className="h-4 w-4 mt-0.5 shrink-0" />
                {formatUsd(committed.payoutUsd)} routed to {committed.payeeDepartment} for{" "}
                {committed.assetName}. Pool balance is now{" "}
                {formatUsd(committed.poolBalanceAfterUsd)}.
              </p>
            ) : (
              <Button
                variant="destructive"
                onClick={handleDeclareDestroyed}
                disabled={!preview || !incidentDescription.trim() || isSettling}
              >
                <Skull className="h-4 w-4 mr-2" />
                {isSettling ? "Routing payout…" : "Asset destroyed"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HardwareInsurancePoolAdmin;
