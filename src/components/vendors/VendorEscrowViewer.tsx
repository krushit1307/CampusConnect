// =============================================================================
// Component: VendorEscrowViewer
// Issue: #4423 - Interactive "Vendor Bidding" Escrow Viewer
// =============================================================================

import { useEffect, useState } from "react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import Wallet from "lucide-react/dist/esm/icons/wallet";
import Lock from "lucide-react/dist/esm/icons/lock";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import {
  mapVendorEscrowTimeline,
  buildEscrowAssuranceMessage,
  type EscrowStageId,
  type EscrowTimelineStep,
  type VendorEscrowContract,
} from "@/lib/vendorEscrow";

const STAGE_ICONS: Record<EscrowStageId, typeof Wallet> = {
  ledger: Wallet,
  escrow: Lock,
  released: CheckCircle,
};

export function VendorEscrowViewer({ clubId }: { clubId: string }) {
  const supabase = createClient();
  const [timelines, setTimelines] = useState<Record<string, EscrowTimelineStep[]>>({});

  const { data: contracts = [], isLoading } = useQuery<VendorEscrowContract[]>({
    queryKey: ["vendor_contract_escrow", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_contracts")
        .select("id, vendor_name, amount, created_at, escrow_locked_at, released_at")
        .eq("club_id", clubId)
        .gt("amount", 0)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as VendorEscrowContract[];
    },
    enabled: !!clubId,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, EscrowTimelineStep[]> = {};
      for (const contract of contracts) {
        next[contract.id] = await mapVendorEscrowTimeline(contract);
      }
      if (!cancelled) setTimelines(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [contracts]);

  if (isLoading || contracts.length === 0) return null;

  return (
    <div className="space-y-4" data-testid="vendor-escrow-viewer">
      <h3 className="font-display font-black text-base uppercase tracking-wide">
        Vendor Escrow Tracker
      </h3>
      {contracts.map((contract) => {
        const steps = timelines[contract.id] || [];
        return (
          <div
            key={contract.id}
            className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000] dark:bg-zinc-900 dark:border-white space-y-4"
          >
            <p className="font-mono text-xs font-bold uppercase text-gray-600 dark:text-gray-300">
              {contract.vendor_name}
            </p>
            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {steps.map((step, index) => {
                const Icon = STAGE_ICONS[step.id];
                return (
                  <li
                    key={step.id}
                    className={`border-2 p-3 ${
                      step.current
                        ? "border-black bg-lime"
                        : step.reached
                          ? "border-black bg-emerald-50 dark:bg-emerald-950"
                          : "border-black/30 bg-gray-50 dark:bg-zinc-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-mono text-xs font-black uppercase">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>
                        {index + 1}. {step.label}
                      </span>
                    </div>
                    {step.timestamp && (
                      <p className="mt-2 font-mono text-[10px] break-all">
                        {new Date(step.timestamp).toISOString()}
                      </p>
                    )}
                    {step.cryptographicTimestamp && (
                      <p className="mt-1 font-mono text-[10px] break-all text-gray-600 dark:text-gray-400">
                        hash: {step.cryptographicTimestamp}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
            <p
              role="status"
              className="font-mono text-sm font-bold leading-relaxed border-2 border-black bg-cream p-3 dark:bg-zinc-800 dark:border-white"
            >
              {buildEscrowAssuranceMessage(contract)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
