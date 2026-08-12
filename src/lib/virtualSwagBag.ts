import { createClient } from "./supabase/client";

export interface SwagItem {
  id: string;
  event_id: string;
  title: string;
  description?: string;
  sponsor_name: string;
  generic_code?: string;
  link_url?: string;
  image_url?: string;
  expires_at?: string;
  claimed_code?: string;
}

export interface ClaimSwagResult {
  success: boolean;
  code?: string;
  message: string;
}

/**
 * Gating check: Verifies if user RSVP status is 'attended' (physically checked in).
 * Merely RSVPing ('going') is not sufficient to unlock the swag bag.
 */
export function isAttendanceVerified(rsvpStatus: string): boolean {
  if (!rsvpStatus || typeof rsvpStatus !== "string") return false;
  return rsvpStatus.toLowerCase().trim() === "attended";
}

/**
 * Claims a unique single-use promo code for a Virtual Swag item via Supabase RPC.
 */
export async function claimSwagCode(swagItemId: string, userId: string): Promise<ClaimSwagResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("claim_unique_swag_code", {
    p_swag_item_id: swagItemId,
    p_user_id: userId,
  });

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  const res = data?.[0];
  return {
    success: res?.success ?? false,
    code: res?.code ?? undefined,
    message: res?.message ?? "Failed to claim promo code.",
  };
}

/**
 * Formats expiration date string and returns expired boolean flag.
 */
export function formatSwagExpiration(
  expiresAt?: string | null,
  now: Date = new Date(),
): { expired: boolean; label: string } {
  if (!expiresAt) {
    return { expired: false, label: "No expiration date" };
  }

  const expDate = new Date(expiresAt);
  const isExpired = expDate.getTime() <= now.getTime();

  if (isExpired) {
    return { expired: true, label: "Expired" };
  }

  const formattedDate = expDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return { expired: false, label: `Expires on ${formattedDate}` };
}
