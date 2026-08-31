// =============================================================================
// Component: DroneMaintenanceLedger
// Purpose: Allows technicians to submit repair logs to an immutable blockchain
//   ledger and audit log transactions for insurance/compliance verification.
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  DroneMaintenanceService,
  type MaintenanceLog,
  type InventoryItem,
} from "@/services/droneMaintenanceService";
import { Button } from "@/components/ui/button";
import Cpu from "lucide-react/dist/esm/icons/cpu";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import PenTool from "lucide-react/dist/esm/icons/pen-tool";
import History from "lucide-react/dist/esm/icons/history";
import Activity from "lucide-react/dist/esm/icons/activity";

interface DroneMaintenanceLedgerProps {
  myClubId: string;
}

export function DroneMaintenanceLedger({ myClubId }: DroneMaintenanceLedgerProps) {
  const supabase = createClient();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [partsUsed, setPartsUsed] = useState("");
  const [serialNumbers, setSerialNumbers] = useState("");
  const [digitalSignature, setDigitalSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, [supabase]);

  // Load club inventory items
  const loadClubInventory = useCallback(async () => {
    if (!myClubId) return;
    const clubItems = await DroneMaintenanceService.fetchInventoryItemsForClub(myClubId);
    setItems(clubItems);
    if (clubItems.length > 0 && !selectedItemId) {
      setSelectedItemId(clubItems[0].id);
    }
  }, [myClubId, selectedItemId]);

  // Load blockchain ledger records for the selected item
  const loadLedgerLogs = useCallback(async () => {
    if (!selectedItemId) return;
    setLoadingLogs(true);
    const ledgerLogs = await DroneMaintenanceService.fetchMaintenanceLogs(selectedItemId);
    setLogs(ledgerLogs);
    setLoadingLogs(false);
  }, [selectedItemId]);

  useEffect(() => {
    void loadClubInventory();
  }, [myClubId, loadClubInventory]);

  useEffect(() => {
    if (selectedItemId) {
      void loadLedgerLogs();
    }
  }, [selectedItemId, loadLedgerLogs]);

  // Realtime update listener for maintenance logs
  useEffect(() => {
    if (!selectedItemId) return;
    const channel = supabase
      .channel(`drone-maintenance-realtime-${selectedItemId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "equipment_maintenance_blockchain_logs",
          filter: `item_id=eq.${selectedItemId}`,
        },
        () => {
          void loadLedgerLogs();
          void loadClubInventory();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedItemId, loadLedgerLogs, loadClubInventory, supabase]);

  const handleSubmitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) {
      toast.error("Please select an asset to record maintenance for.");
      return;
    }
    if (!partsUsed.trim() || !serialNumbers.trim() || !digitalSignature.trim()) {
      toast.error("All repair fields are required to construct the immutable blockchain payload.");
      return;
    }
    if (!currentUserId) {
      toast.error("Authentication required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await DroneMaintenanceService.logEquipmentRepair(
        selectedItemId,
        currentUserId,
        partsUsed,
        serialNumbers,
        digitalSignature
      );

      if (res.success) {
        toast.success("Tamper-proof repair payload successfully logged on the blockchain!");
        setPartsUsed("");
        setSerialNumbers("");
        setDigitalSignature("");
        void loadLedgerLogs();
        void loadClubInventory();
      } else {
        toast.error(res.error || "Failed to log repair details to blockchain.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedItem = items.find((i) => i.id === selectedItemId);

  return (
    <div
      className="border-4 border-black bg-orange-50 p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)] rounded-none text-black font-mono mt-8"
      data-testid="drone-maintenance-ledger"
    >
      <div className="flex items-center gap-2 border-b-4 border-black pb-3 mb-6">
        <Cpu className="h-6 w-6 text-black animate-pulse" />
        <h3 className="font-display text-xl font-black uppercase text-black">
          Drone & Hardware Blockchain Maintenance Ledger
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Form to log new repairs */}
        <div className="space-y-4">
          <div className="border-2 border-black bg-white p-4 shadow-[3px_3px_0px_rgba(0,0,0,1)]">
            <span className="font-black text-xs uppercase text-indigo-900 block mb-2">
              Step 1: Select Club Hardware Asset
            </span>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="neu-border bg-white w-full p-2 font-mono text-sm"
              data-testid="asset-select"
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.category}) - {item.condition_status || "EXCELLENT"}
                </option>
              ))}
            </select>

            {selectedItem && (
              <div className="mt-3 text-[10px] text-zinc-600 flex justify-between items-center bg-zinc-50 p-2 border border-black border-dashed">
                <span>Asset ID: <strong className="text-black font-bold">{selectedItem.id.slice(0, 8)}</strong></span>
                <span>Barcode: <strong className="text-black font-bold">{selectedItem.barcode}</strong></span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmitLog} className="border-2 border-black bg-white p-4 shadow-[3px_3px_0px_rgba(0,0,0,1)] space-y-3">
            <span className="font-black text-xs uppercase text-indigo-900 block">
              Step 2: Immutable Maintenance Payload
            </span>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-600">Exact Parts Used</label>
              <input
                type="text"
                placeholder="e.g. OEM Carbon Fiber Propellers, 4000mAh Battery"
                value={partsUsed}
                onChange={(e) => setPartsUsed(e.target.value)}
                className="border-2 border-black bg-white px-2 py-1.5 text-xs font-mono outline-none w-full text-black"
                data-testid="parts-input"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-600">Serial Numbers</label>
              <input
                type="text"
                placeholder="e.g. SN-BATT-9922, SN-PROP-88"
                value={serialNumbers}
                onChange={(e) => setSerialNumbers(e.target.value)}
                className="border-2 border-black bg-white px-2 py-1.5 text-xs font-mono outline-none w-full text-black"
                data-testid="serials-input"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-600">Technician Digital Signature</label>
              <input
                type="text"
                placeholder="e.g. Technician John Smith, FAA Lic #12345"
                value={digitalSignature}
                onChange={(e) => setDigitalSignature(e.target.value)}
                className="border-2 border-black bg-white px-2 py-1.5 text-xs font-mono outline-none w-full text-black"
                data-testid="signature-input"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="neu-border bg-[#a3e635] text-black hover:bg-lime-400 font-mono text-xs font-bold uppercase w-full py-2 shadow-[2px_2px_0_0_#000] flex items-center justify-center gap-1.5"
              data-testid="log-repair-btn"
            >
              <PenTool className="h-4 w-4" /> {submitting ? "Signing & Minting Block..." : "Sign & Log Tamper-Proof Repair"}
            </Button>
          </form>
        </div>

        {/* Right Column: Immutable blockchain verification history */}
        <div className="flex flex-col">
          <div className="border-2 border-black bg-white p-4 shadow-[3px_3px_0px_rgba(0,0,0,1)] flex-1 flex flex-col">
            <span className="font-black text-xs uppercase text-indigo-900 block mb-3 flex items-center gap-1.5">
              <History className="h-4 w-4" /> Blockchain Verification History
            </span>

            {loadingLogs ? (
              <div className="flex-1 flex items-center justify-center py-10">
                <span className="text-xs text-zinc-500 animate-pulse">Querying blockchain node...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-zinc-200 bg-zinc-50 rounded">
                <Activity className="h-8 w-8 text-zinc-400 mb-2" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase">
                  No repair blocks logged yet for this asset
                </span>
                <span className="text-[9px] text-zinc-400 mt-1 max-w-[200px]">
                  Logging repairs registers cryptographically verifiable proofs to Gnosis Chain / Polygon.
                </span>
              </div>
            ) : (
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="border-2 border-black bg-zinc-50 p-3 shadow-[2px_2px_0px_rgba(0,0,0,1)] flex flex-col gap-2 relative overflow-hidden"
                    data-testid={`blockchain-log-card-${log.id}`}
                  >
                    <div className="flex items-center justify-between border-b border-black/5 pb-1">
                      <div className="flex items-center gap-1">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="font-black text-[9px] uppercase text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          VERIFIED BLOCK
                        </span>
                      </div>
                      <span className="text-[9px] text-zinc-500 font-bold">
                        {new Date(log.recorded_at).toLocaleDateString()} at{" "}
                        {new Date(log.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="space-y-1 text-[10px]">
                      <div>
                        <span className="font-bold text-zinc-500">Parts Used:</span>{" "}
                        <strong className="text-black font-black">{log.parts_used}</strong>
                      </div>
                      <div>
                        <span className="font-bold text-zinc-500">Serial Numbers:</span>{" "}
                        <strong className="text-black font-black">{log.serial_numbers}</strong>
                      </div>
                      <div>
                        <span className="font-bold text-zinc-500">Technician Signature:</span>{" "}
                        <strong className="text-black font-black">{log.digital_signature}</strong>
                      </div>
                      <div className="pt-1.5 border-t border-black/5 flex flex-col gap-0.5">
                        <span className="font-bold text-zinc-500 text-[8px] uppercase">Verifiable Maintenance Hash (SHA-256):</span>
                        <code className="bg-white p-1 border border-black/10 rounded font-mono text-[8px] truncate font-bold text-zinc-800">
                          {log.maintenance_hash}
                        </code>
                      </div>
                      {log.blockchain_tx_hash && (
                        <div className="flex flex-col gap-0.5 mt-1">
                          <span className="font-bold text-zinc-500 text-[8px] uppercase">Polygon Explorer Link:</span>
                          <a
                            href={`https://polygonscan.com/tx/${log.blockchain_tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[8px] text-blue-800 underline truncate hover:text-blue-900 font-bold"
                          >
                            {log.blockchain_tx_hash}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
