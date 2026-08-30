import React, { useState } from "react";
import {
  EventVendorBooking,
  VendorCancellationNotification,
} from "@/types/vendorCancellation";
import { vendorCancellationNotificationService } from "@/services/vendorCancellationNotificationService";

interface VendorCancellationNotificationWidgetProps {
  eventId: string;
  eventTitle: string;
  isCancelled?: boolean;
}

export const VendorCancellationNotificationWidget: React.FC<
  VendorCancellationNotificationWidgetProps
> = ({ eventId, eventTitle, isCancelled = false }) => {
  const [bookings] = useState<EventVendorBooking[]>(
    vendorCancellationNotificationService.getEventBookedVendors(eventId),
  );
  const [history, setHistory] = useState<VendorCancellationNotification[]>(
    vendorCancellationNotificationService.getVendorCancellationHistory(eventId),
  );

  const handleAcknowledge = (notificationId: string) => {
    vendorCancellationNotificationService.acknowledgeVendorCancellation(
      notificationId,
      "Cancellation acknowledged by vendor operations lead.",
    );
    setHistory(
      vendorCancellationNotificationService.getVendorCancellationHistory(eventId),
    );
  };

  if (bookings.length === 0) {
    return (
      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-400">
        No third-party vendors contracted for this event.
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-white space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-xs font-bold uppercase tracking-wider border border-purple-500/30">
              Vendor Contracts
            </span>
            <h4 className="text-base font-bold text-white">
              Automated Cancellation Dispatch
            </h4>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Auto-Notifies contracted vendors via Email, SMS & Webhooks with contract penalty logic
          </p>
        </div>
      </div>

      {/* Contracted Vendors List */}
      <div className="space-y-3">
        {bookings.map((bkg) => {
          const feeCalc =
            vendorCancellationNotificationService.calculateVendorCancellationFees(bkg);
          const notification = history.find((h) => h.bookingId === bkg.id);

          return (
            <div
              key={bkg.id}
              className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{bkg.vendorName}</span>
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] uppercase font-mono">
                    {bkg.category.replace("_", " ")}
                  </span>
                </div>
                <div className="text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>Contract: ${(bkg.contractAmountCents / 100).toLocaleString()}</span>
                  <span>Deposit Paid: ${(bkg.depositPaidCents / 100).toLocaleString()}</span>
                  <span className="text-purple-400 font-semibold">{feeCalc.policyDescription}</span>
                </div>
              </div>

              {/* Status / Dispatch Tags */}
              <div className="flex items-center gap-2 shrink-0">
                {notification ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/30 text-[11px] font-semibold">
                      <span>Notified</span>
                      <span className="text-[10px] text-emerald-400 font-mono">
                        ({notification.channelsSent.join(", ")})
                      </span>
                    </div>

                    {notification.status === "acknowledged" ? (
                      <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-lg border border-blue-500/30 text-[11px] font-bold">
                        ACK Received
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAcknowledge(notification.id)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] transition font-medium"
                      >
                        Simulate ACK
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-500 text-[11px] font-mono italic">
                    {isCancelled ? "Notification Pending" : "Active Booking"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
