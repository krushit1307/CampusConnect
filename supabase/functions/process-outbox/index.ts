import { z } from "https://esm.sh/zod@3.24.2";
import { parseJsonBody } from "../_shared/validation.ts";

const processOutboxPayloadSchema = z
  .object({
    table: z.string().min(1),
    action: z.string().min(1),
    record: z
      .object({
        id: z.string().optional(),
        title: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const processOutboxSchema = z
  .object({
    outbox_id: z.string().uuid("outbox_id must be a valid UUID"),
    payload: processOutboxPayloadSchema,
  })
  .strict();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = await parseJsonBody(processOutboxSchema, req);
    if (!parsed.ok) return parsed.response;
    const { outbox_id, payload } = parsed.data;

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
