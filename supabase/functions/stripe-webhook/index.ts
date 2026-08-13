import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  try {
    const payload = await req.json();

    // MOCK: In a real app, this would be a Stripe Event verification.
    // We expect { type: 'checkout.session.completed', data: { metadata: { seatIds: '...', orderId: '...' } } }

    if (payload.type === "checkout.session.completed") {
      const seatIds = payload.data.metadata.seatIds.split(",");
      const orderId = payload.data.metadata.orderId;

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Call RPC to confirm
      const { error } = await supabase.rpc("confirm_seat_purchase", {
        p_seat_ids: seatIds,
        p_order_id: orderId,
      });

      if (error) {
        console.error("RPC Error:", error);
        throw error;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
