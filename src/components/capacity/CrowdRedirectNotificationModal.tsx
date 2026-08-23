// =============================================================================
// File: src/components/capacity/CrowdRedirectNotificationModal.tsx
// Issue: #4283 - Build a 'Real-Time "Event Capacity" Thermal Map'
// Description: Modal dialog for dispatching automated or customized attendee push
//              notifications to load-balance crowded physical venues with incentives.
// =============================================================================

import React, { useState } from "react";
import {
  Bell,
  Sparkles,
  Coffee,
  Gift,
  Ticket,
  Send,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type {
  CrowdSurgeAlert,
  CrowdRedirectBroadcast,
} from "@/types/capacityThermalMap";
import { dispatchCrowdRedirectNotification } from "@/services/capacityThermalMapService";

interface CrowdRedirectNotificationModalProps {
  alert: CrowdSurgeAlert | null;
  isOpen: boolean;
  onClose: () => void;
  onBroadcastDispatched?: (broadcast: CrowdRedirectBroadcast) => void;
}

export const CrowdRedirectNotificationModal: React.FC<CrowdRedirectNotificationModalProps> = ({
  alert,
  isOpen,
  onClose,
  onBroadcastDispatched,
}) => {
  const [selectedIncentive, setSelectedIncentive] =
    useState<CrowdRedirectBroadcast["incentiveOffer"]>("FREE_SWAG");
  const [customMessage, setCustomMessage] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [successResult, setSuccessResult] = useState<CrowdRedirectBroadcast | null>(null);

  if (!alert) return null;

  const defaultMessage =
    alert.recommendedIncentiveText ||
    `⚠️ ${alert.zoneName} is crowded! Head over to ${alert.suggestedRedirectZoneName} to grab free recruiter swag and avoid wait times!`;

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);

    const messageToSend = customMessage.trim() || defaultMessage;
    const res = await dispatchCrowdRedirectNotification(alert, messageToSend, selectedIncentive);

    if (res.success && res.broadcast) {
      setSuccessResult(res.broadcast);
      onBroadcastDispatched?.(res.broadcast);
    }

    setIsSending(false);
  };

  const handleClose = () => {
    setSuccessResult(null);
    setCustomMessage("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="neu-border max-w-lg bg-white p-6 dark:bg-zinc-900">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center border-2 border-black bg-rose-500 text-white">
              <Bell className="h-4 w-4" />
            </div>
            <DialogTitle className="text-xl font-black uppercase text-zinc-900 dark:text-white">
              Crowd Load-Balancing Broadcast
            </DialogTitle>
          </div>
          <DialogDescription className="font-mono text-xs text-zinc-500">
            Dispatch high-priority push notifications to attendees currently in {alert.zoneName} to
            divert foot traffic.
          </DialogDescription>
        </DialogHeader>

        {successResult ? (
          <div className="mt-4 space-y-4 font-mono text-xs">
            <div className="neu-border border-emerald-500 bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              <div className="flex items-center gap-2 font-black text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span>Broadcast Successfully Dispatched!</span>
              </div>
              <p className="mt-2 text-xs">
                Sent to <strong>{successResult.targetAudienceCount} attendees</strong> currently in{" "}
                {alert.zoneName}.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-emerald-200 pt-2 dark:border-emerald-800 text-[11px]">
                <div>
                  <span className="text-zinc-500">Target Zone:</span>
                  <p className="font-bold">{alert.suggestedRedirectZoneName}</p>
                </div>
                <div>
                  <span className="text-zinc-500">Projected Shift:</span>
                  <p className="font-bold text-emerald-600">
                    ~{successResult.convertedRedirectionCount} attendees converting
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleClose}
              className="neu-border w-full bg-lime font-mono text-xs font-bold uppercase text-black hover:bg-lime/80"
            >
              Done & Return to Thermal Map
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSendBroadcast} className="mt-4 space-y-4 font-mono text-xs">
            {/* Surge Info Banner */}
            <div className="neu-border border-rose-600 bg-rose-50 p-3 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200">
              <div className="flex items-center justify-between font-bold">
                <span>Over-Capacity Zone:</span>
                <span className="text-rose-600 font-black">
                  {alert.currentOccupancy} / {alert.maxCapacity} ({alert.occupancyRatioPercent}%)
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                <span>Redirect destination:</span>
                <strong className="text-emerald-600">{alert.suggestedRedirectZoneName}</strong>
              </div>
            </div>

            {/* Incentive Picker */}
            <div>
              <label className="block font-bold uppercase text-zinc-700 dark:text-zinc-300 mb-1.5">
                Select Redirection Incentive Perk
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIncentive("FREE_SWAG")}
                  className={`neu-border flex items-center gap-2 p-2.5 text-left transition-all ${
                    selectedIncentive === "FREE_SWAG"
                      ? "bg-black text-white dark:bg-lime dark:text-black font-black"
                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  <Gift className="h-4 w-4" />
                  <span>Free Swag & Stickers</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedIncentive("COFFEE_VOUCHER")}
                  className={`neu-border flex items-center gap-2 p-2.5 text-left transition-all ${
                    selectedIncentive === "COFFEE_VOUCHER"
                      ? "bg-black text-white dark:bg-lime dark:text-black font-black"
                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  <Coffee className="h-4 w-4" />
                  <span>Free Espresso / Cold Brew</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedIncentive("VIP_RAFFLE_TICKET")}
                  className={`neu-border flex items-center gap-2 p-2.5 text-left transition-all ${
                    selectedIncentive === "VIP_RAFFLE_TICKET"
                      ? "bg-black text-white dark:bg-lime dark:text-black font-black"
                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  <Ticket className="h-4 w-4" />
                  <span>Double Raffle Entry</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedIncentive("PRIORITY_ENTRY")}
                  className={`neu-border flex items-center gap-2 p-2.5 text-left transition-all ${
                    selectedIncentive === "PRIORITY_ENTRY"
                      ? "bg-black text-white dark:bg-lime dark:text-black font-black"
                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Fast-Track Recruiter Line</span>
                </button>
              </div>
            </div>

            {/* Custom Push Notification Text */}
            <div>
              <label className="block font-bold uppercase text-zinc-700 dark:text-zinc-300 mb-1">
                Push Notification Text (Customizable)
              </label>
              <textarea
                rows={3}
                value={customMessage || defaultMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="neu-border w-full bg-zinc-50 p-2 text-zinc-900 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} className="neu-border">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSending}
                className="neu-border flex items-center gap-1.5 bg-lime font-mono text-xs font-black uppercase text-black hover:bg-lime/80 shadow-[3px_3px_0_0_#000]"
              >
                <Send className="h-3.5 w-3.5" />
                {isSending ? "Broadcasting..." : `Send to ${alert.currentOccupancy} Attendees`}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CrowdRedirectNotificationModal;
