import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface LockdownResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Triggers a physical hard lockdown of a specific zone using the secure tunnel Edge Function.
 */
export async function triggerLockdown(
  zoneId: string = "Science_Building_Exterior",
): Promise<LockdownResponse> {
  try {
    const { data, error } = await supabase.functions.invoke("trigger-campus-lockdown", {
      body: { action: "LOCKDOWN", zone_id: zoneId },
    });

    if (error) throw new Error(error.message);

    return { success: true, message: data.message };
  } catch (err: any) {
    console.error("Lockdown failed:", err);
    return { success: false, error: err.message || "Failed to trigger lockdown" };
  }
}

/**
 * Reverts the lockdown state, unlocking the physical doors of a specific zone.
 */
export async function clearLockdown(
  zoneId: string = "Science_Building_Exterior",
): Promise<LockdownResponse> {
  try {
    const { data, error } = await supabase.functions.invoke("trigger-campus-lockdown", {
      body: { action: "UNLOCK", zone_id: zoneId },
    });

    if (error) throw new Error(error.message);

    return { success: true, message: data.message };
  } catch (err: any) {
    console.error("Unlock failed:", err);
    return { success: false, error: err.message || "Failed to clear lockdown" };
  }
}
