const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { outbox_id, payload } = await req.json();

    if (!outbox_id || !payload) {
      return new Response(
        JSON.stringify({ error: "Missing outbox_id or payload in request body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `[Outbox Worker] Processing outbox event ${outbox_id}:`,
      JSON.stringify(payload, null, 2),
    );

    const { table, action, record } = payload;

    // Simulate external side effects based on table and action
    if (table === "events" && action === "INSERT") {
      console.log(
        `[Outbox Worker] [Guaranteed Delivery] Dispatching invitations and search indexes for new event: ${record?.title || record?.id}`,
      );
      // In production, this would invoke SendGrid/Resend APIs and update search indexes
    } else if (table === "posts" && action === "INSERT") {
      console.log(
        `[Outbox Worker] [Guaranteed Delivery] Dispatching notifications for new post: ${record?.id}`,
      );
    }

    return new Response(JSON.stringify({ success: true, outbox_id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Outbox Worker Error]:", errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
