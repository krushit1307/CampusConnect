import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    // Note: this function could be triggered from pg_cron which doesn't have an auth header
    // But since it's a cron, we authenticate it internally via some mechanism, or just check the service role
    // Since pg_net sends a request, we can just allow it if we include a secret in the header
    // Or we simply verify the authorization header matches our service role key

    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${supabaseServiceKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Find expired jobs
    const { data: expiredJobs, error: fetchError } = await supabase
      .from("data_export_jobs")
      .select("*")
      .lt("expires_at", new Date().toISOString());

    if (fetchError) {
      throw fetchError;
    }

    if (!expiredJobs || expiredJobs.length === 0) {
      return new Response(JSON.stringify({ message: "No expired jobs to clean up." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let deletedCount = 0;

    for (const job of expiredJobs) {
      // 2. Delete from storage if storage_path exists
      if (job.storage_path) {
        // storage_path is like 'user_id/job_id/export.zip'
        const { error: deleteStorageError } = await supabase.storage
          .from("data-exports")
          .remove([job.storage_path]);

        if (deleteStorageError) {
          console.error(`Failed to delete storage for job ${job.id}:`, deleteStorageError);
          continue; // Skip DB delete if storage delete fails
        }
      }

      // 3. Delete from DB
      const { error: deleteDbError } = await supabase
        .from("data_export_jobs")
        .delete()
        .eq("id", job.id);

      if (deleteDbError) {
        console.error(`Failed to delete job ${job.id} from DB:`, deleteDbError);
      } else {
        deletedCount++;
      }
    }

    return new Response(
      JSON.stringify({ message: `Successfully cleaned up ${deletedCount} jobs.` }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Cleanup error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
