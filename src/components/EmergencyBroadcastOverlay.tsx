// =============================================================================
// Component: EmergencyBroadcastOverlay
// Issue: #3165 - Emergency Campus Broadcast Override Module
// Description: Global "God Mode" overlay. Mounted once near the root of the
// app (see App.tsx) so it renders above every route. The instant an active
// row exists in `campus_emergencies`, it forces a full-screen, un-dismissible
// red alert that blocks all underlying app functionality. There is
// intentionally no close/dismiss button — the alert only disappears once an
// admin flips `active` to false in the database.
// =============================================================================

import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import { useEmergencyBroadcast } from "@/hooks/useEmergencyBroadcast";

export function EmergencyBroadcastOverlay() {
  const { emergency } = useEmergencyBroadcast();

  if (!emergency) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-red-700 p-6 text-center text-white"
    >
      <AlertTriangle className="mb-6 h-16 w-16 animate-pulse" aria-hidden="true" />
      <p className="mb-2 font-mono text-sm uppercase tracking-widest text-red-100">
        {emergency.severity === "critical" ? "Critical Emergency Alert" : "Emergency Alert"}
      </p>
      <h1 className="mb-4 text-3xl font-bold md:text-5xl">{emergency.title}</h1>
      <p className="max-w-2xl text-lg md:text-xl">{emergency.message}</p>
      <p className="mt-8 text-xs text-red-100">
        This alert will clear automatically once Campus Security issues the all-clear.
      </p>
    </div>
  );
}