// =============================================================================
// Component: VendingMachineIntegration
// Purpose: Renders vending budget allocation config for organizers, dynamic
//   QR credits for attendees, and an interactive vending POS simulator.
// =============================================================================

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import {
  VendingMachineService,
  type VendingAllocation,
  type VendingUserCredit,
  type VendingDispenseLog,
} from "@/services/vendingMachineService";
import { Button } from "@/components/ui/button";
import QrCode from "lucide-react/dist/esm/icons/qr-code";
import ShoppingBag from "lucide-react/dist/esm/icons/shopping-bag";
import Settings from "lucide-react/dist/esm/icons/settings";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";

interface VendingMachineIntegrationProps {
  eventId: string;
  userId: string;
  isOrganizer: boolean;
}

export function VendingMachineIntegration({ eventId, userId, isOrganizer }: VendingMachineIntegrationProps) {
  const [allocation, setAllocation] = useState<VendingAllocation | null>(null);
  const [userCredit, setUserCredit] = useState<VendingUserCredit | null>(null);
  const [logs, setLogs] = useState<VendingDispenseLog[]>([]);

  // Allocation setup inputs
  const [budgetAmount, setBudgetAmount] = useState(500);
  const [userLimit, setUserLimit] = useState(10);

  // POS Simulator inputs
  const [selectedSnack, setSelectedSnack] = useState({ name: "Snickers Bar", price: 2.50 });
  const [machineId, setMachineId] = useState("VEND-CAMPUS-HUB-1");
  const [loading, setLoading] = useState(false);

  const snacks = [
    { name: "Snickers Bar", price: 2.50 },
    { name: "Energy Drink", price: 3.50 },
    { name: "Salted Pretzels", price: 2.00 },
    { name: "Protein Bar", price: 4.00 },
    { name: "Fizzy Soda", price: 1.75 },
  ];

  const loadData = useCallback(async () => {
    const alloc = await VendingMachineService.fetchAllocationForEvent(eventId);
    setAllocation(alloc);

    if (alloc && userId) {
      const credit = await VendingMachineService.fetchOrCreateUserCredit(eventId, userId);
      setUserCredit(credit);

      if (credit) {
        const dLogs = await VendingMachineService.fetchDispenseLogsForCredit(credit.id);
        setLogs(dLogs);
      }
    }
  }, [eventId, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Realtime updates for vending allocation, credits, and logs
  useEffect(() => {
    const channel = supabase
      .channel(`vending-realtime-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_vending_allocations",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          void loadData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vending_user_credits",
        },
        () => {
          void loadData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, loadData]);

  const handleConfigureAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (budgetAmount <= 0 || userLimit <= 0) {
      toast.error("Vending allocation budget and limits must be positive amounts.");
      return;
    }
    const created = await VendingMachineService.createVendingAllocation(eventId, budgetAmount, userLimit);
    if (created) {
      toast.success("Vending Machine smart integration allocation successfully created!");
      void loadData();
    } else {
      toast.error("Failed to allocate vending budget.");
    }
  };

  const handleSimulateScan = async () => {
    if (!userCredit) {
      toast.error("You do not have any active credits for this event.");
      return;
    }
    setLoading(true);
    toast.info(`Pinging university vending API (CBORD/Atrium) from ${machineId}...`);

    try {
      const res = await VendingMachineService.dispenseVendingItem(
        userCredit.qr_code_token,
        machineId,
        selectedSnack.name,
        selectedSnack.price
      );

      if (res.success) {
        toast.success(`Dispensed ${res.product_name}! Deducted $${res.amount_deducted?.toFixed(2)} from credits.`);
        void loadData();
      } else {
        toast.error(res.error || "Failed to dispense item.");
      }
    } catch (err: any) {
      toast.error(err.message || "Dispense transaction error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="border-4 border-black bg-yellow-50 p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)] rounded-none text-black font-mono mt-8"
      data-testid="vending-integration-card"
    >
      <div className="flex items-center gap-3 border-b-4 border-black pb-4 mb-6">
        <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-yellow-300">
          <ShoppingBag className="h-5 w-5 text-black" />
        </div>
        <div>
          <h3 className="text-xl font-black uppercase text-black">Smart Vending Credits</h3>
          <p className="text-xs text-zinc-700">Late-night off-hours food integration linked directly to Stripe Escrow</p>
        </div>
      </div>

      {/* Organizer Settings Panel */}
      {isOrganizer && (
        <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000] mb-6">
          <span className="font-black text-xs uppercase text-yellow-900 block border-b pb-1 mb-3 flex items-center gap-1.5">
            <Settings className="h-4 w-4" /> Organizer Finance & Vending Configuration
          </span>

          {!allocation ? (
            <form onSubmit={handleConfigureAllocation} className="space-y-4">
              <p className="text-xs text-zinc-600">
                Setup vending credit allocation for attendees. Funds are secured through the Club Stripe Ledger.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase">Total Budget Allocation ($)</label>
                  <input
                    type="number"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(Number(e.target.value))}
                    className="border-2 border-black bg-white px-2 py-1.5 text-xs font-mono outline-none w-full text-black"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase">Per-Student Credit Limit ($)</label>
                  <input
                    type="number"
                    value={userLimit}
                    onChange={(e) => setUserLimit(Number(e.target.value))}
                    className="border-2 border-black bg-white px-2 py-1.5 text-xs font-mono outline-none w-full text-black"
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="neu-border bg-yellow-300 text-black hover:bg-yellow-400 font-mono text-xs font-bold uppercase px-4 py-2 border-2 border-black shadow-[2px_2px_0_0_#000]"
                data-testid="configure-allocation-btn"
              >
                Provision Smart Vending Portal
              </Button>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
              <div className="border border-black/10 p-3 bg-zinc-50 rounded">
                <span className="text-[10px] uppercase font-bold text-zinc-500">Allocated Budget</span>
                <p className="text-lg font-black mt-1">${allocation.allocated_amount.toFixed(2)}</p>
              </div>
              <div className="border border-black/10 p-3 bg-zinc-50 rounded">
                <span className="text-[10px] uppercase font-bold text-zinc-500">Total Spent</span>
                <p className="text-lg font-black mt-1 text-red-600">${allocation.spent_amount.toFixed(2)}</p>
              </div>
              <div className="border border-black/10 p-3 bg-zinc-50 rounded">
                <span className="text-[10px] uppercase font-bold text-zinc-500">Remaining Balance</span>
                <p className="text-lg font-black mt-1 text-emerald-600">
                  ${(allocation.allocated_amount - allocation.spent_amount).toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Student Section */}
      {allocation ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: QR Code ticket & Credit limits */}
          <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000] flex flex-col justify-between items-center text-center">
            {userCredit ? (
              <>
                <div className="w-full border-b pb-3 mb-4">
                  <span className="font-black text-xs uppercase text-yellow-900 block">
                    Your Vending Pass Credits
                  </span>
                  <div className="font-display text-4xl font-black mt-2 text-emerald-600">
                    ${(allocation.per_user_limit - userCredit.spent_balance).toFixed(2)}
                  </div>
                  <span className="text-[10px] text-zinc-500 font-bold block mt-1 uppercase">
                    Remaining out of ${allocation.per_user_limit.toFixed(2)} Credit Limit
                  </span>
                </div>

                {/* Neo-brutalist QR pass representation */}
                <div
                  className="border-4 border-black p-4 bg-white shadow-[3px_3px_0_0_#000] my-4"
                  data-testid="vending-qr-container"
                >
                  <div className="w-40 h-40 bg-zinc-100 flex flex-col justify-center items-center relative overflow-hidden border-2 border-dashed border-black/30">
                    <QrCode className="h-28 w-28 text-black" />
                    <span className="text-[8px] font-black text-black absolute bottom-1 uppercase">
                      {userCredit.qr_code_token}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-zinc-500 leading-normal mt-3 w-full border-t pt-3">
                  Scan this QR code at any university Smart Vending machine (CBORD or Atrium partner) to dispense items.
                  <span className="block font-black text-black mt-1">
                    Expires: {new Date(userCredit.expires_at).toLocaleString()}
                  </span>
                </div>
              </>
            ) : (
              <div className="py-12 italic text-zinc-500 text-xs">
                Attendee credits are pending setup.
              </div>
            )}
          </div>

          {/* Right Column: Physical Vending Machine POS Simulator */}
          <div className="space-y-4">
            <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000] space-y-4">
              <span className="font-black text-xs uppercase text-yellow-900 block border-b pb-1">
                University Vending Machine POS Simulator
              </span>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase block text-zinc-500">
                  Select Item to Dispense:
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {snacks.map((s) => (
                    <button
                      key={s.name}
                      onClick={() => setSelectedSnack(s)}
                      className={`border-2 border-black p-2 text-left text-xs font-mono flex justify-between items-center transition-all ${
                        selectedSnack.name === s.name
                          ? "bg-yellow-200 translate-x-0.5 translate-y-0.5 shadow-[1px_1px_0_0_#000]"
                          : "bg-white hover:bg-zinc-50 shadow-[2px_2px_0_0_#000]"
                      }`}
                    >
                      <span className="font-bold">{s.name}</span>
                      <span className="font-black">${s.price.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase block text-zinc-500">
                  Physical Machine ID:
                </label>
                <input
                  type="text"
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                  className="border-2 border-black bg-white px-2 py-1.5 text-xs font-mono w-full text-black outline-none"
                  required
                />
              </div>

              <Button
                onClick={handleSimulateScan}
                disabled={loading}
                className="neu-border bg-yellow-300 hover:bg-yellow-400 text-black font-mono text-xs font-bold uppercase w-full py-2 shadow-[2px_2px_0_0_#000] border-2 border-black flex items-center justify-center gap-1.5"
                data-testid="simulate-dispense-btn"
              >
                <ArrowRight className="h-4 w-4" /> {loading ? "Communicating Vending API..." : "Scan QR & Trigger Dispense"}
              </Button>
            </div>

            {/* Historical transaction logs */}
            <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000] max-h-[160px] overflow-y-auto">
              <span className="font-black text-xs uppercase text-yellow-900 block mb-2">
                Dispense Logs / Receipts
              </span>
              {logs.length === 0 ? (
                <div className="text-center py-4 text-zinc-400 text-xs italic">
                  No vending dispense records found.
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="border border-black/10 bg-zinc-50 p-2 font-mono text-[10px] flex justify-between items-center"
                      data-testid={`vending-log-${log.id}`}
                    >
                      <div>
                        <p className="font-bold text-black">{log.product_name}</p>
                        <p className="text-[8px] text-zinc-500">
                          {log.vending_machine_id} • {new Date(log.dispensed_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <span className="font-black text-red-600">-${log.amount_deducted.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 border-2 border-dashed border-black/30 bg-white/40">
          <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto mb-2 animate-bounce" />
          <p className="text-xs font-bold uppercase text-zinc-600">No Vending Credits provisioned for this Event</p>
          <p className="text-[10px] text-zinc-500 mt-1">
            Organizers must allocate late-night snack budget to activate Smart Vending.
          </p>
        </div>
      )}
    </div>
  );
}
