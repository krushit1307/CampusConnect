import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { getCloudProvider } from "../_shared/cloudProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUserClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, requestId, eventId, clubId, provider, resourceType, quantity } =
      await req.json();
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const cloudProvider = getCloudProvider();

    if (action === "provision") {
      const { data: clubMember, error: cmError } = await supabaseAdmin
        .from("club_members")
        .select("role")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .single();

      if (
        cmError ||
        !clubMember ||
        (clubMember.role !== "admin" && clubMember.role !== "organizer")
      ) {
        return new Response(
          JSON.stringify({ error: "Forbidden: Only organizers can provision hardware." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const maxQuantity = parseInt(Deno.env.get("MAX_HARDWARE_QUANTITY") || "100", 10);
      if (quantity > maxQuantity || quantity <= 0) {
        return new Response(
          JSON.stringify({ error: `Invalid quantity. Max allowed is ${maxQuantity}.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: event } = await supabaseAdmin
        .from("events")
        .select("start_time, end_time")
        .eq("id", eventId)
        .single();
      if (!event) throw new Error("Event not found");

      const { data: request, error: reqError } = await supabaseAdmin
        .from("hardware_provisioning_requests")
        .insert({
          event_id: eventId,
          club_id: clubId,
          requested_by: user.id,
          provider,
          resource_type: resourceType,
          quantity,
          event_start_time: event.start_time,
          event_end_time: event.end_time,
          status: "provisioning",
        })
        .select()
        .single();

      if (reqError) throw reqError;

      try {
        const tags = {
          managed_by: "CampusConnect",
          club_id: clubId,
          event_id: eventId,
          provisioning_request_id: request.id,
        };
        const provisionResult = await cloudProvider.provisionInstances(
          quantity,
          resourceType,
          tags,
        );

        const resourceInserts = provisionResult.instanceIds.map((instanceId: string) => ({
          request_id: request.id,
          event_id: eventId,
          club_id: clubId,
          provider_resource_id: instanceId,
          status: "active",
        }));

        const { error: resError } = await supabaseAdmin
          .from("hardware_provisioned_resources")
          .insert(resourceInserts);
        if (resError) throw resError;

        await supabaseAdmin
          .from("hardware_provisioning_requests")
          .update({ status: "active" })
          .eq("id", request.id);
        return new Response(JSON.stringify({ success: true, request }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        await supabaseAdmin
          .from("hardware_provisioning_requests")
          .update({ status: "failed", error_information: e.message })
          .eq("id", request.id);
        throw e;
      }
    } else if (action === "terminate_manual") {
      const { data: request, error: fetchErr } = await supabaseAdmin
        .from("hardware_provisioning_requests")
        .select("*, hardware_provisioned_resources(*)")
        .eq("id", requestId)
        .single();
      if (fetchErr || !request) throw new Error("Request not found");

      const { data: clubMember, error: cmError } = await supabaseAdmin
        .from("club_members")
        .select("role")
        .eq("club_id", request.club_id)
        .eq("user_id", user.id)
        .single();

      if (
        cmError ||
        !clubMember ||
        (clubMember.role !== "admin" && clubMember.role !== "organizer")
      ) {
        return new Response(
          JSON.stringify({ error: "Forbidden: Only organizers can terminate hardware." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const instanceIds = request.hardware_provisioned_resources
        .map((r: any) => r.provider_resource_id)
        .filter(Boolean);
      await supabaseAdmin
        .from("hardware_provisioning_requests")
        .update({ status: "terminating" })
        .eq("id", request.id);

      try {
        if (instanceIds.length > 0) {
          await cloudProvider.terminateInstances(instanceIds);
        }
        await supabaseAdmin
          .from("hardware_provisioned_resources")
          .update({ status: "terminated" })
          .eq("request_id", request.id);
        await supabaseAdmin
          .from("hardware_provisioning_requests")
          .update({ status: "terminated" })
          .eq("id", request.id);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        await supabaseAdmin
          .from("hardware_provisioning_requests")
          .update({ status: "failed", error_information: e.message })
          .eq("id", request.id);
        throw e;
      }
    } else if (action === "assign_attendees") {
      const { data: resources } = await supabaseAdmin
        .from("hardware_provisioned_resources")
        .select("*")
        .eq("request_id", requestId)
        .is("attendee_id", null);
      if (!resources || resources.length === 0) {
        return new Response(JSON.stringify({ success: true, message: "No unassigned resources" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: attendees } = await supabaseAdmin
        .from("event_attendees")
        .select("id")
        .eq("event_id", eventId)
        .eq("status", "checked_in");
      if (!attendees || attendees.length === 0) {
        return new Response(JSON.stringify({ success: true, message: "No checked-in attendees" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let assignedCount = 0;
      for (let i = 0; i < Math.min(resources.length, attendees.length); i++) {
        await supabaseAdmin
          .from("hardware_provisioned_resources")
          .update({
            attendee_id: attendees[i].id,
            connection_metadata: {
              ssh_command: `ssh attendee@${resources[i].public_ip || "10.0.0." + i} -i ~/.ssh/id_rsa`,
              instructions: "Use this connection for the hackathon.",
            },
          })
          .eq("id", resources[i].id);
        assignedCount++;
      }
      return new Response(JSON.stringify({ success: true, assignedCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
