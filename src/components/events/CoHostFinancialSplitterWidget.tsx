import React, { useState } from "react";
import { executeDynamicCoHostRevenueSplit } from "@/services/cohostFinancialSplitterService";
import { RevenueSplitConfig } from "@/lib/cohostRevenueSplitter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, ShieldCheck, ArrowRightLeft, Building2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export interface CoHostClubInfo {
  clubId: string;
  clubName: string;
  stripeAccountId: string;
  pct: number;
  isPrimary: boolean;
}

interface CoHostFinancialSplitterWidgetProps {
  eventId: string;
  eventTitle: string;
  ticketPriceDollars: number;
  coHosts: CoHostClubInfo[];
}

export const CoHostFinancialSplitterWidget: React.FC<CoHostFinancialSplitterWidgetProps> = ({
  eventId,
  eventTitle,
  ticketPriceDollars,
  coHosts,
}) => {
  const [loading, setLoading] = useState(false);
  const [lastSplitResult, setLastSplitResult] = useState<any | null>(null);

  const totalCents = Math.round(ticketPriceDollars * 100);

  const handleSimulateTicketSplit = async () => {
    setLoading(true);
    try {
      const mockChargeId = "ch_mock_" + Math.random().toString(36).substring(2, 10);
      const splitConfigs: RevenueSplitConfig[] = coHosts.map((h) => ({
        clubId: h.clubId,
        stripeAccountId: h.stripeAccountId,
        pct: h.pct,
        isPrimary: h.isPrimary,
      }));

      const res = await executeDynamicCoHostRevenueSplit(
        eventId,
        mockChargeId,
        totalCents,
        splitConfigs,
      );

      if (res.success) {
        toast.success("Revenue split and club ledger balances updated!");
        setLastSplitResult(res);
      } else {
        toast.error(res.message || "Failed to process revenue split.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="neu-border bg-white p-6 space-y-6">
      <div className="flex justify-between items-start border-b pb-4">
        <div>
          <Badge className="bg-indigo-600 text-white font-mono text-xs font-bold uppercase mb-2">
            Stripe Connect Splitter
          </Badge>
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
            Co-Host Revenue Sharing: {eventTitle}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Automated Stripe Connect Destination Transfers & Dual-Ledger Synchronization.
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-emerald-600 font-mono">
            ${ticketPriceDollars.toFixed(2)}
          </span>
          <span className="block text-[10px] uppercase font-bold text-slate-400">
            Per Ticket Sale
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Configured Co-Host Revenue Distribution:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {coHosts.map((host) => {
            const hostShareCents = Math.floor((totalCents * host.pct) / 100);
            const hostShareDollars = (hostShareCents / 100).toFixed(2);

            return (
              <div
                key={host.clubId}
                className="neu-border p-4 bg-slate-50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-indigo-500" />
                      {host.clubName}
                    </span>
                    {host.isPrimary ? (
                      <Badge variant="default" className="text-[10px] font-bold bg-indigo-600">
                        Primary Host
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] font-bold">
                        Co-Host
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    Stripe ACCT: {host.stripeAccountId}
                  </span>
                </div>

                <div className="mt-3 pt-2 border-t flex justify-between items-baseline">
                  <span className="text-xs font-semibold text-slate-600">Share ({host.pct}%):</span>
                  <span className="text-lg font-black font-mono text-emerald-600">
                    ${hostShareDollars}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-2">
        <Button
          onClick={handleSimulateTicketSplit}
          disabled={loading}
          className="neu-border neu-press w-full py-6 text-base font-black bg-emerald-500 hover:bg-emerald-600 text-white uppercase tracking-wider"
        >
          {loading
            ? "Processing Transfer..."
            : `Process Ticket Revenue Split ($${ticketPriceDollars.toFixed(2)})`}
        </Button>
      </div>

      {lastSplitResult && (
        <div className="neu-border bg-emerald-50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Postgres Transaction & Stripe Connect Payouts Completed!</span>
          </div>

          <div className="space-y-1.5 text-xs text-slate-700">
            {lastSplitResult.transfers?.map((tr: any, i: number) => (
              <div
                key={i}
                className="flex justify-between items-center font-mono bg-white p-2 neu-border"
              >
                <span>
                  Club {tr.club_id} ({tr.pct}%):
                </span>
                <span className="font-bold text-emerald-600">
                  +${(tr.amount_cents / 100).toFixed(2)} (Transfer: {tr.transfer_id})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
