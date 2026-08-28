import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dispatchSafetyDrone, subscribeToDroneDispatch } from "@/services/droneDispatchService";
import type { DroneDispatchRecord } from "@/types/campusSafety";
import { toast } from "sonner";

export function DroneDispatchPanel({
  safetyCheckResponseId,
  studentName,
  dispatchedByUserId,
}: {
  safetyCheckResponseId: string;
  studentName: string;
  dispatchedByUserId: string;
}) {
  const [supabase] = useState(() => createClient());
  const [dispatch, setDispatch] = useState<DroneDispatchRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDispatch = async () => {
    setLoading(true);
    try {
      const result = await dispatchSafetyDrone(supabase, safetyCheckResponseId, dispatchedByUserId);
      if (!result.success || !result.dispatch) {
        toast.error(result.message || "Drone dispatch failed. No GPS fix available.");
        return;
      }
      setDispatch(result.dispatch);
      subscribeToDroneDispatch(supabase, result.dispatch.id, setDispatch);
      toast.success(`Drone dispatched to ${studentName}'s last known location.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch drone.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-2 border-black bg-black text-white p-4 space-y-3">
      {!dispatch ? (
        <button
          onClick={handleDispatch}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 uppercase disabled:opacity-50"
        >
          {loading ? "Dispatching..." : `Dispatch Drone to ${studentName}`}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase text-red-400">
            Drone Status: {dispatch.status.replace("_", " ")}
          </p>
          {dispatch.hls_playback_url ? (
            <video
              src={dispatch.hls_playback_url}
              controls
              autoPlay
              muted
              className="w-full rounded border border-red-500"
            />
          ) : (
            <p className="text-xs text-gray-400">Waiting for live video feed...</p>
          )}
        </div>
      )}
    </div>
  );
}