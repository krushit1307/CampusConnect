// =============================================================================
// Component: VendorEscrowViewer
// Issue: #5377 - SLA Multi-Oracle Escrow Slashing (GPS + IoT Temperature)
// =============================================================================

import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Wallet from "lucide-react/dist/esm/icons/wallet";
import Lock from "lucide-react/dist/esm/icons/lock";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Flame from "lucide-react/dist/esm/icons/flame";
import Thermometer from "lucide-react/dist/esm/icons/thermometer";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Play from "lucide-react/dist/esm/icons/play";
import { Button } from "@/components/ui/button";
import {
  mapVendorEscrowTimeline,
  buildEscrowAssuranceMessage,
  type EscrowStageId,
  type EscrowTimelineStep,
  type VendorEscrowContract,
} from "@/lib/vendorEscrow";
import { VendorSlaService, type SlaContract } from "@/services/vendorSlaService";

const STAGE_ICONS: Record<EscrowStageId, typeof Wallet> = {
  ledger: Wallet,
  escrow: Lock,
  released: CheckCircle,
};

export function VendorEscrowViewer({ clubId }: { clubId: string }) {
  const supabase = createClient();
  const [timelines, setTimelines] = useState<Record<string, EscrowTimelineStep[]>>({});

  // SLA config states
  const [slaDeadline, setSlaDeadline] = useState<string>("");
  const [slaMinTemp, setSlaMinTemp] = useState<number>(140);
  
  // Oracle Simulator states
  const [simTemp, setSimTemp] = useState<number>(145);
  const [simGpsTime, setSimGpsTime] = useState<string>("");
  const [simOracleSig, setSimOracleSig] = useState<string>("consensus-sla-oracle-signature-v1");
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const { data: contracts = [], isLoading, refetch } = useQuery<SlaContract[]>({
    queryKey: ["vendor_contract_escrow_sla", clubId],
    queryFn: async () => {
      return await VendorSlaService.fetchContractsForClub(clubId);
    },
    enabled: !!clubId,
  });

  // Realtime updates
  useEffect(() => {
    if (!clubId) return;
    const channel = supabase
      .channel(`vendor-sla-realtime-${clubId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vendor_contracts",
          filter: `club_id=eq.${clubId}`,
        },
        () => {
          void refetch();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clubId, refetch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, EscrowTimelineStep[]> = {};
      for (const contract of contracts) {
        // Adapt SlaContract to VendorEscrowContract
        const adapted: VendorEscrowContract = {
          id: contract.id,
          vendor_name: contract.vendor_name,
          amount: contract.amount,
          created_at: contract.created_at,
          escrow_locked_at: contract.status !== "PENDING" ? contract.created_at : null,
          released_at: contract.status === "RELEASED" || contract.status === "SLASHED" ? contract.created_at : null,
        };
        next[contract.id] = await mapVendorEscrowTimeline(adapted);
      }
      if (!cancelled) setTimelines(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [contracts]);

  const handleConfigureSla = async (contractId: string) => {
    if (!slaDeadline) {
      toast.error("Please select a delivery deadline.");
      return;
    }
    const success = await VendorSlaService.configureSlaContract(
      contractId,
      new Date(slaDeadline).toISOString(),
      slaMinTemp
    );
    if (success) {
      toast.success("SLA parameters successfully locked into Smart Contract!");
      setSlaDeadline("");
      void refetch();
    } else {
      toast.error("Failed to configure SLA constraints.");
    }
  };

  const handleExecutePayout = async (contractId: string) => {
    setLoading((prev) => ({ ...prev, [contractId]: true }));
    const actualGpsTime = simGpsTime || new Date().toISOString();
    toast.info("Ingesting GPS + IoT cargo bay temperature oracle streams...");

    try {
      const res = await VendorSlaService.executeSlaPayout(
        contractId,
        actualGpsTime,
        simTemp,
        simOracleSig
      );

      if (res.success) {
        if (res.payout_status === "SLASHED") {
          toast.error(`SLA VIOLATION: Food was cold ($${res.amount_slashed?.toFixed(2)} slashed & refunded).`);
        } else {
          toast.success("SLA MET: 100% of escrow paid out to vendor.");
        }
        void refetch();
      } else {
        toast.error(res.error || "Execution failed.");
      }
    } catch (err: any) {
      toast.error(err.message || "Payout error.");
    } finally {
      setLoading((prev) => ({ ...prev, [contractId]: false }));
    }
  };

  if (isLoading || contracts.length === 0) return null;

  return (
    <div className="space-y-6" data-testid="vendor-escrow-viewer">
      <h3 className="font-display font-black text-lg uppercase tracking-wide">
        Multi-Oracle SLA Escrow Tracker
      </h3>
      {contracts.map((contract) => {
        const steps = timelines[contract.id] || [];
        const isSlashed = contract.status === "SLASHED";
        const isReleased = contract.status === "RELEASED";
        const adaptedContract: VendorEscrowContract = {
          id: contract.id,
          vendor_name: contract.vendor_name,
          amount: contract.amount,
          created_at: contract.created_at,
          escrow_locked_at: contract.status !== "PENDING" ? contract.created_at : null,
          released_at: isReleased || isSlashed ? contract.created_at : null,
        };

        return (
          <div
            key={contract.id}
            className="border-4 border-black bg-white p-5 shadow-[8px_8px_0_0_#000] dark:bg-zinc-900 dark:border-white space-y-4 font-mono text-black dark:text-white"
            data-testid={`contract-card-${contract.id}`}
          >
            <div className="flex justify-between items-start border-b-2 border-black pb-2">
              <div>
                <p className="text-sm font-black uppercase">{contract.vendor_name}</p>
                <p className="text-[10px] text-zinc-500 font-bold">Escrow ID: {contract.id}</p>
              </div>
              <span className={`text-[10px] font-black border-2 border-black px-2 py-0.5 uppercase ${
                isReleased
                  ? "bg-emerald-100 text-emerald-800"
                  : isSlashed
                    ? "bg-red-100 text-red-800 animate-pulse"
                    : "bg-yellow-100 text-yellow-800"
              }`}>
                {contract.status}
              </span>
            </div>

            {/* Stages timeline */}
            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {steps.map((step, index) => {
                const Icon = STAGE_ICONS[step.id];
                return (
                  <li
                    key={step.id}
                    className={`border-2 p-3 ${
                      step.current
                        ? "border-black bg-yellow-100 text-black font-bold"
                        : step.reached
                          ? "border-black bg-emerald-50 dark:bg-emerald-950"
                          : "border-black/30 bg-gray-50 dark:bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-mono text-xs font-black uppercase">
                      <Icon className="h-4 w-4 shrink-0 text-black dark:text-white" />
                      <span>
                        {index + 1}. {step.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* SLA Configuration Form (If deadline is missing) */}
            {!contract.delivery_deadline && (
              <div className="border-2 border-dashed border-black p-4 bg-zinc-50 dark:bg-zinc-800 space-y-3">
                <span className="text-xs font-black uppercase text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                  <Flame className="h-4 w-4" /> Configure Smart Contract SLA constraints
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase">Expected Delivery Deadline</label>
                    <input
                      type="datetime-local"
                      value={slaDeadline}
                      onChange={(e) => setSlaDeadline(e.target.value)}
                      className="border-2 border-black bg-white px-2 py-1 text-xs outline-none w-full text-black"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase">Qualitative Temp SLA Limit (°F)</label>
                    <input
                      type="number"
                      value={slaMinTemp}
                      onChange={(e) => setSlaMinTemp(Number(e.target.value))}
                      className="border-2 border-black bg-white px-2 py-1 text-xs outline-none w-full text-black"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => handleConfigureSla(contract.id)}
                  className="neu-border bg-indigo-500 hover:bg-indigo-600 text-white font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-black"
                >
                  Lock SLA to Polygon
                </Button>
              </div>
            )}

            {/* SLA Configuration Details (If configured) */}
            {contract.delivery_deadline && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-2 border-black bg-cream/30 p-3 text-xs">
                <div>
                  <span className="font-bold text-zinc-500 block uppercase text-[9px]">SLA Time Deadline</span>
                  <p className="font-bold">{new Date(contract.delivery_deadline).toLocaleString()}</p>
                </div>
                <div>
                  <span className="font-bold text-zinc-500 block uppercase text-[9px]">SLA Temperature Rule</span>
                  <p className="font-bold">Min Temp &ge; {contract.min_temp_limit}°F (50% slash if below)</p>
                </div>
              </div>
            )}

            {/* SLA Multi-Oracle Payout Simulator (Only if contract is PENDING and SLA is configured) */}
            {contract.status === "PENDING" && contract.delivery_deadline && (
              <div className="border-2 border-black p-4 bg-yellow-50 dark:bg-zinc-800 space-y-3">
                <span className="text-xs font-black uppercase text-yellow-900 dark:text-yellow-300 flex items-center gap-1">
                  <Thermometer className="h-4 w-4" /> Multi-Oracle Payout & Slashing Simulator
                </span>
                <p className="text-[10px] text-zinc-600 dark:text-zinc-300">
                  Simulate Chainlink Oracle pings with actual drone GPS arrival timestamp and cryptographically signed cargo probe temp log.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase">Recorded Min Temperature (°F)</label>
                    <input
                      type="number"
                      value={simTemp}
                      onChange={(e) => setSimTemp(Number(e.target.value))}
                      className="border-2 border-black bg-white px-2 py-1 text-xs outline-none w-full text-black"
                      data-testid={`sim-temp-input-${contract.id}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase">GPS Arrival Time (Default: Now)</label>
                    <input
                      type="datetime-local"
                      value={simGpsTime}
                      onChange={(e) => setSimGpsTime(e.target.value)}
                      className="border-2 border-black bg-white px-2 py-1 text-xs outline-none w-full text-black"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase">Cryptographic Oracle Stream Sig</label>
                    <input
                      type="text"
                      value={simOracleSig}
                      onChange={(e) => setSimOracleSig(e.target.value)}
                      className="border-2 border-black bg-white px-2 py-1 text-xs outline-none w-full text-black"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => handleExecutePayout(contract.id)}
                  disabled={loading[contract.id]}
                  className="neu-border bg-yellow-300 hover:bg-yellow-400 text-black font-mono text-xs font-bold uppercase w-full py-2 shadow-[2px_2px_0_0_#000] border-2 border-black flex items-center justify-center gap-1.5"
                  data-testid={`execute-payout-btn-${contract.id}`}
                >
                  <Play className="h-4 w-4" /> {loading[contract.id] ? "Running Polygon Oracle Consensus..." : "Scan Vending QR & Execute SLA payout"}
                </Button>
              </div>
            )}

            {/* SLA Settlement Details (If already executed) */}
            {(isReleased || isSlashed) && (
              <div className="border-2 border-black bg-zinc-50 dark:bg-zinc-800 p-4 space-y-2 text-xs">
                <span className="font-black text-xs uppercase text-zinc-700 dark:text-zinc-300 block border-b pb-1">
                  SLA Settlement Record (Polygon Audit Log)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-500 block">Actual GPS Arrival Time</span>
                    <p className="font-bold">{contract.gps_arrival_time ? new Date(contract.gps_arrival_time).toLocaleString() : "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-500 block">Minimum Bay Temperature</span>
                    <p className="font-black text-red-600">{contract.min_recorded_temp}°F</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-500 block">Payout Amount</span>
                    <p className="font-black text-emerald-600">${(contract.amount - contract.slashed_amount).toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-500 block">Slashed Penalty Refunded</span>
                    <p className="font-black text-red-600">${contract.slashed_amount.toFixed(2)}</p>
                  </div>
                </div>
                <div className="pt-2 border-t mt-2">
                  <span className="text-[9px] font-bold uppercase text-zinc-500 block">Oracle Cryptographic Proof</span>
                  <p className="font-mono text-[9px] break-all text-blue-900 dark:text-blue-300 font-bold">{contract.oracle_sig}</p>
                </div>
              </div>
            )}

            <p
              role="status"
              className="font-mono text-xs font-bold leading-relaxed border-2 border-black bg-cream p-3 dark:bg-zinc-800 dark:border-white"
            >
              {buildEscrowAssuranceMessage(adaptedContract)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
