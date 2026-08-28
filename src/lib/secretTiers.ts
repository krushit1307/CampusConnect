// src/lib/secretTiers.ts
// Issue: #4672 - Dynamic "Early Bird" Secret Unlock Links
// Description: TypeScript library functions for secret tier management

import { supabase } from "./supabase/client";

/**
 * Result of a secret tier creation operation
 */
export type CreateSecretTierResult =
  | { success: true; tier_id: string; unlock_hash: string; unlock_url: string; message: string }
  | { success: false; error: string };

/**
 * Result of a secret link validation operation
 */
export type ValidateSecretLinkResult =
  { success: true; tier: SecretTierInfo } | { success: false; error: string };

/**
 * Secret tier information
 */
export interface SecretTierInfo {
  id: string;
  name: string;
  price: number;
  capacity: number | null;
  uses_remaining: number;
}

/**
 * Create a secret ticket tier for an event
 *
 * @param eventId - The event ID
 * @param name - Tier name (e.g., "VIP Early Bird")
 * @param price - Price in cents
 * @param capacity - Capacity (null for unlimited)
 * @param maxUses - Maximum number of uses for the secret link
 * @param expiresAt - Optional expiration timestamp
 * @param description - Optional description
 * @param startDate - Optional start date
 * @param endDate - Optional end date
 * @returns Result of the secret tier creation operation
 */
export async function createSecretTier(
  eventId: string,
  name: string,
  price: number,
  capacity: number | null,
  maxUses: number,
  expiresAt?: string,
  description?: string,
  startDate?: string,
  endDate?: string,
): Promise<CreateSecretTierResult> {
  try {
    const { data, error } = await supabase.rpc("create_secret_tier", {
      p_event_id: eventId,
      p_name: name,
      p_price: price,
      p_capacity: capacity,
      p_max_uses: maxUses,
      p_expires_at: expiresAt || null,
      p_description: description || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "No response from server." };
    }

    if (data.success === false) {
      return { success: false, error: data.error ?? "Unknown error" };
    }

    return {
      success: true,
      tier_id: data.tier_id,
      unlock_hash: data.unlock_hash,
      unlock_url: data.unlock_url,
      message: data.message ?? "Secret tier created successfully",
    };
  } catch (error: any) {
    return { success: false, error: error.message ?? "Unknown error occurred" };
  }
}

/**
 * Validate a secret unlock hash and return the secret tier details
 *
 * @param eventId - The event ID
 * @param unlockHash - The secret unlock hash from URL
 * @returns Result of the validation operation
 */
export async function validateSecretLink(
  eventId: string,
  unlockHash: string,
): Promise<ValidateSecretLinkResult> {
  try {
    const { data, error } = await supabase.functions.invoke("validate-secret-link", {
      body: { eventId, unlockHash },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "No response from server." };
    }

    if (data.error) {
      return { success: false, error: data.error };
    }

    if (!data.valid) {
      return { success: false, error: data.message || "Invalid or expired secret link" };
    }

    return {
      success: true,
      tier: {
        id: data.tier.id,
        name: data.tier.name,
        price: data.tier.price,
        capacity: data.tier.capacity,
        uses_remaining: data.tier.uses_remaining,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message ?? "Unknown error occurred" };
  }
}

/**
 * Get all ticket tiers for an event (including secret tiers)
 * This should only be called by event organizers/admins
 *
 * @param eventId - The event ID
 * @returns All ticket tiers for the event
 */
export async function getAllTicketTiers(eventId: string) {
  try {
    const { data, error } = await supabase.rpc("get_all_ticket_tiers", {
      p_event_id: eventId,
    });

    if (error) {
      console.error("Error fetching all ticket tiers:", error);
      return null;
    }

    return data;
  } catch (error: any) {
    console.error("Error fetching all ticket tiers:", error);
    return null;
  }
}

/**
 * Get public ticket tiers for an event (excludes secret tiers)
 *
 * @param eventId - The event ID
 * @returns Public ticket tiers for the event
 */
export async function getPublicTicketTiers(eventId: string) {
  try {
    const { data, error } = await supabase.rpc("get_public_ticket_tiers", {
      p_event_id: eventId,
    });

    if (error) {
      console.error("Error fetching public ticket tiers:", error);
      return null;
    }

    return data;
  } catch (error: any) {
    console.error("Error fetching public ticket tiers:", error);
    return null;
  }
}

/**
 * Record a secret tier purchase (decrements uses_remaining)
 *
 * @param tierId - The secret tier ID
 * @returns Result of the purchase recording operation
 */
export async function recordSecretTierPurchase(tierId: string) {
  try {
    const { data, error } = await supabase.rpc("record_secret_tier_purchase", {
      p_tier_id: tierId,
    });

    if (error) {
      console.error("Error recording secret tier purchase:", error);
      return null;
    }

    return data;
  } catch (error: any) {
    console.error("Error recording secret tier purchase:", error);
    return null;
  }
}

/**
 * Check if the current URL has a valid unlock hash
 *
 * @param eventId - The event ID
 * @returns Secret tier info if valid, null otherwise
 */
export async function checkSecretUnlock(eventId: string): Promise<SecretTierInfo | null> {
  if (typeof window === "undefined") return null;

  const urlParams = new URLSearchParams(window.location.search);
  const unlockHash = urlParams.get("unlock_hash");

  if (!unlockHash) return null;

  const result = await validateSecretLink(eventId, unlockHash);
  return result.success ? result.tier : null;
}
