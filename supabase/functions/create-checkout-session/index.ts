import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { seatIds, eventId } = await req.json();

    if (!seatIds || !seatIds.length) {
      throw new Error("Seat IDs are required");
    }

    // Since this is a MOCK, we just return a mock URL.
    // In a real app, we'd initialize Stripe, create a checkout session
    // with metadata: { seatIds: seatIds.join(',') }

    const mockOrderId = `mock_order_${crypto.randomUUID()}`;
    const mockCheckoutUrl = `/events/${eventId}/checkout-mock?orderId=${mockOrderId}&seats=${seatIds.join(",")}`;

    return new Response(JSON.stringify({ url: mockCheckoutUrl, orderId: mockOrderId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
