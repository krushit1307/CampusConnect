import type { SupabaseClient } from "@supabase/supabase-js";
import type { DroneDispatchRecord } from "@/types/campusSafety";

/** Invokes the dispatch-safety-drone edge function for an overdue/missing student. */
export async function dispatchSafetyDrone(
  supabase: SupabaseClient,
  safetyCheckResponseId: string,
  dispatchedByUserId: string,
): Promise<{ success: boolean; message?: string; dispatch?: DroneDispatchRecord }> {
  const { data, error } = await supabase.functions.invoke("dispatch-safety-drone", {
    body: { safetyCheckResponseId, dispatchedByUserId },
  });

  if (error) throw new Error(error.message);
  return data;
}

/** Subscribes to live status/video-feed updates for an active drone dispatch. */
export function subscribeToDroneDispatch(
  supabase: SupabaseClient,
  dispatchId: string,
  onUpdate: (dispatch: DroneDispatchRecord) => void,
): () => void {
  const channel = supabase
    .channel(`drone_dispatch:${dispatchId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "drone_dispatches", filter: `id=eq.${dispatchId}` },
      (payload) => onUpdate(payload.new as DroneDispatchRecord),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}