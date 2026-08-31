import React, { useMemo } from "react";
import { BadgeCheck, ShieldAlert, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EscrowPayout,
  MWBE_MANDATE_PERCENT,
  MwbeCategory,
  buildDiversitySpendReport,
  describeCategory,
} from "@/lib/supplierDiversity";

/**
 * Super Admin supplier diversity dashboard (#5291).
 *
 * Aggregates released escrow payouts into the minority/women-owned spend ratio the
 * federal grant is conditioned on, and states the shortfall in dollars when the
 * mandate is missed — a percentage alone does not tell the Dean how much of the
 * next contract has to go to a certified supplier.
 */

export interface SupplierDiversityComplianceDashboardProps {
  payouts: EscrowPayout[];
  mandatePercent?: number;
}

const VERDICT_STYLE = {
  ACHIEVED: "border-emerald-600 bg-emerald-50 text-emerald-800",
  AT_RISK: "border-amber-600 bg-amber-50 text-amber-800",
  NON_COMPLIANT: "border-red-600 bg-red-50 text-red-800",
} as const;

const usd = (amount: number): string => `$${amount.toLocaleString("en-US")}`;

export const SupplierDiversityComplianceDashboard: React.FC<
  SupplierDiversityComplianceDashboardProps
> = ({ payouts, mandatePercent = MWBE_MANDATE_PERCENT }) => {
  const report = useMemo(
    () => buildDiversitySpendReport(payouts, mandatePercent),
    [payouts, mandatePercent],
  );

  const topMwbeVendors = useMemo(() => {
    const byVendor = new Map<string, { name: string; amountUsd: number }>();
    for (const payout of payouts) {
      if (!payout.mwbeCertified || Number(payout.amountUsd) <= 0) continue;
      const existing = byVendor.get(payout.vendorId);
      byVendor.set(payout.vendorId, {
        name: payout.vendorName,
        amountUsd: (existing?.amountUsd ?? 0) + Number(payout.amountUsd),
      });
    }
    return [...byVendor.values()].sort((a, b) => b.amountUsd - a.amountUsd).slice(0, 5);
  }, [payouts]);

  const categories = Object.entries(report.spendByCategoryUsd).filter(
    ([, amount]) => amount > 0,
  ) as [MwbeCategory, number][];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6" data-testid="supplier-diversity-dashboard">
      <div>
        <h1 className="font-display text-3xl font-black">Supplier Diversity Compliance</h1>
        <p className="mt-2 font-mono text-sm text-slate-600">
          Released escrow payouts across campus, measured against the {report.mandatePercent}% MWBE
          spend condition attached to the federal grant.
        </p>
      </div>

      <div
        role="status"
        data-testid="compliance-headline"
        className={`neu-border flex items-start gap-3 p-4 font-mono text-sm shadow-[2px_2px_0_0_#000] ${
          VERDICT_STYLE[report.verdict]
        }`}
      >
        {report.verdict === "ACHIEVED" ? (
          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        ) : (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        )}
        <span>
          {report.headline}
          {report.shortfallUsd > 0 && (
            <span className="mt-1 block" data-testid="compliance-shortfall">
              {usd(report.shortfallUsd)} of additional MWBE spend is required to reach{" "}
              {report.mandatePercent}%.
            </span>
          )}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="font-mono text-xs uppercase tracking-widest text-slate-500">
              Total spend
            </p>
            <p className="mt-2 font-display text-2xl font-black" data-testid="total-spend">
              {usd(report.totalSpendUsd)}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-500">
              {report.payoutCount} released payouts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="font-mono text-xs uppercase tracking-widest text-slate-500">MWBE spend</p>
            <p className="mt-2 font-display text-2xl font-black" data-testid="mwbe-spend">
              {usd(report.mwbeSpendUsd)}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-500">
              {report.mwbePayoutCount} payouts to certified vendors
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="font-mono text-xs uppercase tracking-widest text-slate-500">MWBE share</p>
            <p className="mt-2 font-display text-2xl font-black" data-testid="mwbe-percent">
              {report.mwbePercent}%
            </p>
            <p className="mt-1 font-mono text-xs text-slate-500">
              mandate {report.mandatePercent}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
              Spend by ownership class
            </CardTitle>
            <CardDescription>Where the certified spend actually went.</CardDescription>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <p className="font-mono text-xs text-slate-500">
                No spend with certified suppliers yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {categories.map(([category, amount]) => (
                  <li
                    key={category}
                    className="flex items-center justify-between gap-3 font-mono text-sm"
                  >
                    <span>{describeCategory(category)}</span>
                    <span className="font-bold">{usd(amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top certified suppliers</CardTitle>
            <CardDescription>Largest MWBE payouts by vendor.</CardDescription>
          </CardHeader>
          <CardContent>
            {topMwbeVendors.length === 0 ? (
              <p className="font-mono text-xs text-slate-500">No certified suppliers paid yet.</p>
            ) : (
              <ol className="space-y-2">
                {topMwbeVendors.map((vendor) => (
                  <li
                    key={vendor.name}
                    className="flex items-center justify-between gap-3 font-mono text-sm"
                  >
                    <span className="truncate">{vendor.name}</span>
                    <span className="font-bold">{usd(vendor.amountUsd)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SupplierDiversityComplianceDashboard;
