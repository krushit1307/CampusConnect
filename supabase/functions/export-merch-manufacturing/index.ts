// =============================================================================
// Edge Function: Export Merch Manufacturing CSV
// Issue: Merch Pre-Order Module
// Description: Exports manufacturing-ready CSV data from paid merch orders.
// Aggregates orders by variant/SKU, counts only paid/captured orders.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimiter } from "../shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const limited = await rateLimiter(req, "export-merch-manufacturing", 10, 60);
  if (limited) return limited;

  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    // Check authorization: must be system admin or club treasurer/admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is system admin
    const { data: isAdmin } = await supabase.rpc("is_system_admin");
    if (!isAdmin) {
      // Check if user is club treasurer/admin for any club
      const { data: member } = await supabase
        .from("club_members")
        .select("role, club_id")
        .eq("user_id", user.id)
        .single();

      if (
        !member ||
        !["treasurer", "admin", "president", "vice_president", "secretary"].includes(member.role)
      ) {
        return new Response(JSON.stringify({ error: "Forbidden - insufficient permissions" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch paid orders with their items
    const { data: orders, error: ordersError } = await supabase
      .from("merch_orders")
      .select(
        `
            *,
            merch_order_items (
                variant:merch_variants!merch_order_items_variant_id_fk (
                    id,
                    name
                )
            )
        `,
      )
      .eq("payment_status", "captured")
      .order("created_at", { ascending: false });

    if (ordersError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch orders: " + ordersError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Aggregate by variant
    const variantAggregates: Map<
      string,
      { quantity: number; variantName: string; itemName: string }
    > = new Map();

    for (const order of orders || []) {
      for (const item of order.merch_order_items || []) {
        const variantName = item.variant?.name || "Unknown Variant";
        const existing = variantAggregates.get(variantName);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          const sizeColor = variantName.split(" ");
          const size = sizeColor[0] || "One Size";
          const color = sizeColor.slice(1).join(" ") || "Unknown";
          const sku = `MD-${color.toUpperCase()}-${size.toUpperCase()}`;
          variantAggregates.set(variantName, {
            quantity: item.quantity,
            variantName,
            itemName: order.userId ? "Merch" : "Unknown",
            sku,
          });
        }
      }
    }

    // Build CSV
    const lines: string[] = [];
    lines.push("Item,Size,Color,SKU,Total Quantity");

    variantAggregates.forEach((data) => {
      const [size, color] = data.variantName.split(" ").slice(0, 2);
      lines.push(`${data.itemName},${size || ""},${color || ""},${data.sku},${data.quantity}`);
    });

    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    return new Response(blob, {
      headers: {
        ...corsHeaders,
        "Content-Disposition": `attachment; filename=merch-manufacturing-${new Date().toISOString().split("T")[0]}.csv`,
        "Content-Type": "text/csv;charset=utf-8",
      },
    });
  } catch (err: any) {
    console.error("[export-merch-manufacturing] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
