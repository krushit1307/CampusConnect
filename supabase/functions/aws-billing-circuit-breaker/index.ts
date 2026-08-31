import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from "https://esm.sh/@aws-sdk/client-cost-explorer@3.501.0";
import {
  EC2Client,
  DescribeInstancesCommand,
  TerminateInstancesCommand,
} from "https://esm.sh/@aws-sdk/client-ec2@3.501.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Fetch all events that have an active AWS budget limit
    const { data: events, error } = await supabaseClient
      .from("events")
      .select("id, title, max_aws_budget, organizer_id")
      .not("max_aws_budget", "is", null);

    if (error) {
      throw error;
    }

    const credentials = {
      accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID") ?? "",
      secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY") ?? "",
    };
    const region = Deno.env.get("AWS_REGION") ?? "us-east-1";

    const costExplorer = new CostExplorerClient({ region, credentials });
    const ec2 = new EC2Client({ region, credentials });

    const results = [];

    for (const event of events) {
      // 1. Query AWS Cost Explorer API filtering by event_id tag
      // For real-time cost, we approximate or use fine-grained billing.
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const startDate = firstDayOfMonth.toISOString().split("T")[0];
      const endDate = now.toISOString().split("T")[0]; // Note: CE might need strictly tomorrow if using current month.

      const command = new GetCostAndUsageCommand({
        TimePeriod: {
          Start: startDate,
          End: new Date(now.getTime() + 86400000).toISOString().split("T")[0],
        },
        Granularity: "DAILY",
        Metrics: ["UnblendedCost"],
        Filter: {
          Tags: {
            Key: "event_id",
            Values: [event.id],
          },
        },
      });

      let currentCost = 0;
      try {
        const costRes = await costExplorer.send(command);
        currentCost =
          costRes.ResultsByTime?.reduce(
            (acc, res) => acc + parseFloat(res.Total?.UnblendedCost?.Amount || "0"),
            0,
          ) ?? 0;
      } catch (e) {
        console.error(`Failed to get cost for event ${event.id}:`, e);
        continue;
      }

      // Log the current cost
      await supabaseClient.from("event_aws_billing_logs").insert({
        event_id: event.id,
        current_cost: currentCost,
        max_budget: event.max_aws_budget,
      });

      // 2. Trigger Circuit Breaker if budget exceeded
      if (currentCost >= event.max_aws_budget) {
        // Query instances
        const describeCmd = new DescribeInstancesCommand({
          Filters: [
            {
              Name: "tag:event_id",
              Values: [event.id],
            },
            {
              Name: "instance-state-name",
              Values: ["running", "pending"],
            },
          ],
        });

        const instancesRes = await ec2.send(describeCmd);
        const instanceIds: string[] = [];

        instancesRes.Reservations?.forEach((res) => {
          res.Instances?.forEach((inst) => {
            if (inst.InstanceId) instanceIds.push(inst.InstanceId);
          });
        });

        if (instanceIds.length > 0) {
          // Terminate
          const terminateCmd = new TerminateInstancesCommand({
            InstanceIds: instanceIds,
          });
          await ec2.send(terminateCmd);

          // Get Organizer Phone (Mocked fetching logic)
          const { data: orgData } = await supabaseClient
            .from("profiles")
            .select("phone")
            .eq("id", event.organizer_id)
            .single();

          const phone = orgData?.phone ?? "UNKNOWN";

          // Trigger Twilio SMS (Mocked via RPC or fetch)
          // In real life, we would fetch to Twilio API here.
          const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
          const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
          if (twilioAccountSid && twilioAuthToken && phone !== "UNKNOWN") {
            const formData = new URLSearchParams();
            formData.append("To", phone);
            formData.append("From", Deno.env.get("TWILIO_PHONE_NUMBER") ?? "");
            formData.append(
              "Body",
              `🚨 BUDGET EXCEEDED for ${event.title}. All Hackathon servers have been terminated to prevent further charges.`,
            );

            await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
                },
                body: formData,
              },
            );
          }

          // Log the circuit breaker action
          await supabaseClient.from("aws_circuit_breaker_audits").insert({
            event_id: event.id,
            cost_at_termination: currentCost,
            max_budget: event.max_aws_budget,
            terminated_instance_count: instanceIds.length,
            instance_ids: instanceIds,
            sms_sent_to: phone,
          });

          results.push({ event_id: event.id, action: "terminated", count: instanceIds.length });
        } else {
          results.push({ event_id: event.id, action: "no_instances_to_terminate" });
        }
      } else {
        results.push({ event_id: event.id, action: "safe", cost: currentCost });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
