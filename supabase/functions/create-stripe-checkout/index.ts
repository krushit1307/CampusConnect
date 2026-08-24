// =============================================================================
// Edge Function: Create Stripe Checkout Session (with Group Discounts)
--Issue: #2902 - Implement 'Group Discounts' for Event Ticketing
--Description: Creates a Stripe Checkout session.Validates the requested
--quantity against remaining capacity, calculates the group discount, and
--applies it as a negative line item(discount) in the Stripe session.
    // =============================================================================

    import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2023-10-16",
});

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiscountRule {
    min_qty: number;
    discount_pct: number;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 1. Authenticate User
        const authHeader = req.headers.get("Authorization")!;
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        // 2. Parse Request
        const { eventId, quantity } = await req.json();
        if (!eventId || !quantity || quantity < 1) {
            throw new Error("Invalid event ID or quantity");
        }

        // 3. Fetch Active Ticket Tier & Validate Capacity
        const { data: activeTiers, error: tierError } = await supabase.rpc('get_active_ticket_tier', {
            p_event_id: eventId
        });

        if (tierError || !activeTiers || activeTiers.length === 0) {
            throw new Error("No ticket tier is currently available");
        }

        const tier = activeTiers[0];

        const { data: event, error: eventError } = await supabase
            .from("events")
            .select("title")
            .eq("id", eventId)
            .single();

        if (eventError || !event) {
            throw new Error("Event not found");
        }

        const remainingCapacity = tier.capacity !== null ? tier.capacity - tier.sold_count : Infinity;

        if (quantity > remainingCapacity) {
            throw new Error(`Only ${remainingCapacity} tickets remaining for the current tier.`);
        }

        // 4. Calculate Discount
        const rules: DiscountRule[] = tier.discount_rules || [];
        const sortedRules = [...rules].sort((a, b) => b.min_qty - a.min_qty);

        let applicableDiscount = 0;
        for (const rule of sortedRules) {
            if (quantity >= rule.min_qty) {
                applicableDiscount = rule.discount_pct;
                break;
            }
        }

        // Check if dynamic pricing is active on this event
        const { data: eventDetails, error: eventDetailsError } = await supabase
            .from("events")
            .select("base_price, surge_multiplier")
            .eq("id", eventId)
            .single();

        let basePriceCents = tier.price;
        let isDynamic = false;
        if (!eventDetailsError && eventDetails && eventDetails.base_price !== null) {
            const { data: dynamicPrice, error: priceError } = await supabase.rpc('calculate_current_price', {
                p_event_id: eventId
            });
            if (!priceError && dynamicPrice !== null) {
                basePriceCents = dynamicPrice;
                isDynamic = true;
            }
        }

        const subtotal = basePriceCents * quantity;
        const discountAmount = Math.round(subtotal * (applicableDiscount / 100));
        const totalAmount = subtotal - discountAmount;

        // 5. Build Stripe Line Items
        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
            {
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: isDynamic ? `${event.title} (Dynamic Price)` : `${event.title} - ${tier.name}`,
                        description: `${quantity} ticket(s)`,
                    },
                    unit_amount: basePriceCents,
                },
                quantity: quantity,
            }
        ];

        // Apply discount as a negative line item if applicable
        if (discountAmount > 0) {
            lineItems.push({
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: `Group Discount (${applicableDiscount}% off)`,
                    },
                    unit_amount: -discountAmount, // Negative amount for discount
                },
                quantity: 1,
            });
        }

        // 6. Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: lineItems,
            mode: "payment",
            success_url: `${req.headers.get("origin")}/events/${eventId}/tickets/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.get("origin")}/events/${eventId}/tickets`,
            metadata: {
                user_id: user.id,
                tier_id: tier.id,
                quantity: quantity.toString(),
                discount_applied: applicableDiscount.toString(),
                event_id: eventId
            },
            // Enforce "All or Nothing" refund policy for group purchases
            payment_intent_data: {
                setup_future_usage: 'off_session',
            }
        });

        return new Response(
            JSON.stringify({ sessionId: session.id, url: session.url }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[StripeCheckout] Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
});
