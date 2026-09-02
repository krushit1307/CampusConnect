// =============================================================================
// Component: CatererDietaryAlertWidget
// Issue: #3676 - Implement 'Automated "Dietary Restriction" Caterer Alert'
// Description: Organizer dashboard widget visualizing post-RFP severe dietary alerts
// sent to caterers, pending vs acknowledged status badges, and accountability tracking.
// =============================================================================

import React, { useState, useEffect, useCallback } from "react";
import {
  getCatererDietaryAlerts,
  acknowledgeCatererDietaryAlert,
  type CatererDietaryAlert,
} from "@/services/catererDietaryAlert";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Clock from "lucide-react/dist/esm/icons/clock";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import Mail from "lucide-react/dist/esm/icons/mail";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";

interface CatererDietaryAlertWidgetProps {
  eventId: string;
}

export function CatererDietaryAlertWidget({ eventId }: CatererDietaryAlertWidgetProps) {
  const [alerts, setAlerts] = useState<CatererDietaryAlert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAlerts = useCallback(async () => {
    if (!eventId) return;
    setIsLoading(true);
    const data = await getCatererDietaryAlerts(eventId);
    setAlerts(data);
    setIsLoading(false);
  }, [eventId]);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  const handleSimulateAcknowledge = async (token: string) => {
    const res = await acknowledgeCatererDietaryAlert(token);
    if (res.success) {
      void fetchAlerts();
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 font-mono flex items-center gap-2">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
        Checking caterer health & safety alerts...
      </div>
    );
  }

  if (alerts.length === 0) return null;

  const pendingAlerts = alerts.filter((a) => a.acknowledgment_status === "PENDING");
  const acknowledgedAlerts = alerts.filter((a) => a.acknowledgment_status === "ACKNOWLEDGED");

  return (
    <div data-testid="caterer-dietary-alert-widget" className="space-y-4 my-6">
      {/* PENDING EMERGENCY ALERTS */}
      {pendingAlerts.length > 0 && (
        <div
          data-testid="pending-caterer-alert-banner"
          className="bg-red-950/80 border-2 border-red-500 rounded-2xl p-5 shadow-xl text-white animate-pulse"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-600 rounded-xl shrink-0">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-black uppercase tracking-wider text-red-200">
                    ⚠️ URGENT CATERER HEALTH ALERT
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-600 text-white">
                    PENDING ACKNOWLEDGMENT
                  </span>
                </div>
                {pendingAlerts.map((alert) => (
                  <p key={alert.id} className="text-sm font-bold text-red-100 mt-1">
                    URGENT: A new attendee ({alert.attendee_name}) with a severe{" "}
                    <span className="underline font-black text-yellow-300">
                      {alert.dietary_tag}
                    </span>{" "}
                    has registered after RFP finalization. Sent to caterer ({alert.caterer_email}).
                  </p>
                ))}
              </div>
            </div>

            {/* Vendor Acknowledgment Action */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className="text-xs font-mono text-red-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Awaiting Caterer Response
              </span>
              <div className="flex gap-2">
                {pendingAlerts[0] && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSimulateAcknowledge(pendingAlerts[0].token)}
                      data-testid="simulate-acknowledge-btn"
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold rounded-lg text-slate-200 transition-colors"
                    >
                      Acknowledge
                    </button>
                    <a
                      href={`/caterer/alert/${pendingAlerts[0].token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 border border-indigo-400 text-xs font-bold rounded-lg text-white transition-colors flex items-center gap-1"
                    >
                      Open Portal
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACKNOWLEDGED ALERTS */}
      {acknowledgedAlerts.length > 0 && (
        <div
          data-testid="acknowledged-caterer-alert-banner"
          className="bg-emerald-950/80 border border-emerald-600 rounded-2xl p-5 text-emerald-100 shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 rounded-xl shrink-0 text-white">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-300">
                ✅ Caterer Health Alert Acknowledged
              </h4>
              {acknowledgedAlerts.map((alert) => (
                <div key={alert.id} className="mt-1 flex items-center justify-between gap-4">
                  <p className="text-xs md:text-sm font-semibold text-emerald-100">
                    Caterer ({alert.caterer_email}) acknowledged severe {alert.dietary_tag} alert
                    for {alert.attendee_name} at{" "}
                    {alert.acknowledged_at
                      ? new Date(alert.acknowledged_at).toLocaleTimeString()
                      : "10:45 AM"}
                    .
                  </p>
                  <a
                    href={`/caterer/alert/${alert.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 border border-emerald-500 text-xs font-bold rounded text-white transition-colors flex items-center shrink-0"
                  >
                    Open Portal
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
