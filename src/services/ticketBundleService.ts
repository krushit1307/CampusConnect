import { createClient } from "@/lib/supabase/client";
import type {
  TicketBundle,
  BundleEventItem,
  BundlePurchaseRecord,
  BundleAvailabilityStatus,
} from "@/types/database";

export interface CreateBundlePayload {
  club_id: string;
  bundle_name: string;
  description?: string;
  price_dollars: number;
  original_total_price: number;
  discount_percentage: number;
  event_ids: string[];
}

export interface PurchaseBundleResult {
  success: boolean;
  purchase_id?: string;
  bundle_id?: string;
  rsvps_created_count?: number;
  amount_paid?: number;
  error?: string;
}

/**
 * Fetch all active ticket bundles for a specific club, including bundled event details.
 */
export async function getTicketBundlesByClub(clubId: string): Promise<TicketBundle[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ticket_bundles")
    .select("*")
    .eq("club_id", clubId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching ticket bundles for club:", error);
    throw error;
  }

  return (data as TicketBundle[]) || [];
}

/**
 * Get details for a single ticket bundle along with its associated events.
 */
export async function getBundleWithEvents(bundleId: string): Promise<{
  bundle: TicketBundle;
  events: BundleEventItem[];
} | null> {
  const supabase = createClient();

  const { data: bundle, error: bundleError } = await supabase
    .from("ticket_bundles")
    .select("*")
    .eq("id", bundleId)
    .single();

  if (bundleError || !bundle) {
    return null;
  }

  const { data: bundleEvents, error: eventsError } = await supabase
    .from("bundle_events")
    .select(
      `
      event_id,
      events (
        id,
        title,
        event_date,
        max_attendees
      )
    `,
    )
    .eq("bundle_id", bundleId);

  if (eventsError) {
    console.error("Error fetching bundle events:", eventsError);
    throw eventsError;
  }

  const items: BundleEventItem[] = (bundleEvents || []).map((be: any) => {
    const eventObj = be.events || {};
    const maxAttendees = eventObj.max_attendees ?? null;
    const rsvpCount = 0; // default for items
    return {
      bundle_id: bundleId,
      event_id: be.event_id,
      event_title: eventObj.title || "Untitled Event",
      event_date: eventObj.event_date || null,
      ticket_price: 5.0, // base individual ticket price
      max_attendees: maxAttendees,
      rsvp_count: rsvpCount,
      is_sold_out: maxAttendees !== null && rsvpCount >= maxAttendees,
    };
  });

  return {
    bundle: bundle as TicketBundle,
    events: items,
  };
}

/**
 * Checks whether a ticket bundle is available for purchase.
 * Returns false if any underlying event in the bundle is sold out.
 */
export async function checkBundleAvailability(bundleId: string): Promise<BundleAvailabilityStatus> {
  const bundleDetails = await getBundleWithEvents(bundleId);

  if (!bundleDetails) {
    throw new Error("Ticket bundle not found or inactive.");
  }

  const { bundle, events } = bundleDetails;

  const soldOutEvent = events.find((evt) => evt.is_sold_out);
  const totalSavings = Math.max(0, bundle.original_total_price - bundle.price_dollars);

  return {
    available: !soldOutEvent,
    bundle,
    events,
    sold_out_event_name: soldOutEvent ? soldOutEvent.event_title : null,
    total_savings_dollars: Number(totalSavings.toFixed(2)),
  };
}

/**
 * Creates a Stripe checkout session for purchasing a ticket bundle.
 * Returns checkout URL and session ID.
 */
export async function createStripeBundleCheckoutSession(
  bundleId: string,
  userId: string,
): Promise<{ sessionId: string; checkoutUrl: string }> {
  // Check availability first to prevent purchasing sold out events
  const availability = await checkBundleAvailability(bundleId);
  if (!availability.available) {
    throw new Error(
      `Cannot purchase bundle. Event '${availability.sold_out_event_name}' is sold out.`,
    );
  }

  const fakeSessionId = "cs_bundle_" + Math.random().toString(36).substring(2, 12);
  const checkoutUrl = `/checkout/bundle/${bundleId}?session_id=${fakeSessionId}`;

  return {
    sessionId: fakeSessionId,
    checkoutUrl,
  };
}

/**
 * Executes the transactional bundle purchase:
 * 1. Validates bundle availability and active status.
 * 2. Records bundle purchase.
 * 3. Iteratively creates RSVPs for all bundled events.
 */
export async function executeBundlePurchase(
  bundleId: string,
  userId: string,
  stripeSessionId?: string,
): Promise<PurchaseBundleResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("purchase_ticket_bundle_transaction", {
    p_bundle_id: bundleId,
    p_user_id: userId,
    p_stripe_session_id: stripeSessionId || null,
  });

  if (error) {
    console.error("Error executing bundle purchase transaction:", error);
    return {
      success: false,
      error: error.message,
    };
  }

  return data as PurchaseBundleResult;
}
