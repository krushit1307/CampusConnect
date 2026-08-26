import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

// Grace period (24 hours) to avoid deleting transient uploads while user drafts a form
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify Authorization Token or Webhook Secret
    const authHeader = req.headers.get("Authorization");
    const webhookSecretHeader = req.headers.get("x-webhook-secret");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET");

    const token = authHeader ? authHeader.replace("Bearer ", "") : "";
    const isAuthorized =
      (serviceRoleKey && token === serviceRoleKey) ||
      (webhookSecret && (token === webhookSecret || webhookSecretHeader === webhookSecret));

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 2. Query active image/file URLs from database tables
    const activeUrlStrings: Set<string> = new Set();

    // Profiles: avatar_url
    const { data: profileRows } = await supabase.from("profiles").select("avatar_url");
    if (profileRows) {
      profileRows.forEach((row: { avatar_url?: string | null }) => {
        if (row.avatar_url) activeUrlStrings.add(row.avatar_url);
      });
    }

    // Clubs: banner_url, logo_url
    const { data: clubRows } = await supabase.from("clubs").select("banner_url, logo_url");
    if (clubRows) {
      clubRows.forEach((row: { banner_url?: string | null; logo_url?: string | null }) => {
        if (row.banner_url) activeUrlStrings.add(row.banner_url);
        if (row.logo_url) activeUrlStrings.add(row.logo_url);
      });
    }

    // Events: banner_url, cover_image_url
    const { data: eventRows } = await supabase.from("events").select("banner_url, cover_image_url");
    if (eventRows) {
      eventRows.forEach((row: { banner_url?: string | null; cover_image_url?: string | null }) => {
        if (row.banner_url) activeUrlStrings.add(row.banner_url);
        if (row.cover_image_url) activeUrlStrings.add(row.cover_image_url);
      });
    }

    // Certificates: certificate_url
    const { data: certRows } = await supabase.from("certificates").select("certificate_url");
    if (certRows) {
      certRows.forEach((row: { certificate_url?: string | null }) => {
        if (row.certificate_url) activeUrlStrings.add(row.certificate_url);
      });
    }

    // Event Photos (if table exists)
    try {
      const { data: photoRows } = await supabase.from("event_photos").select("photo_url");
      if (photoRows) {
        photoRows.forEach((row: { photo_url?: string | null }) => {
          if (row.photo_url) activeUrlStrings.add(row.photo_url);
        });
      }
    } catch (_) {
      // Table may not exist in all environments
    }

    // Combined text string containing all active database file URLs for fast substring search
    const allActiveDbUrlsCombined = Array.from(activeUrlStrings).join(" \n ");

    // 3. Fetch storage buckets
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
      throw new Error(`Failed to list storage buckets: ${bucketError.message}`);
    }

    const now = Date.now();
    let totalFilesScanned = 0;
    let totalOrphanedCount = 0;
    const deletedFilesLog: Array<{ bucket: string; name: string }> = [];

    // 4. Iterate over buckets and identify orphaned files
    for (const bucket of buckets || []) {
      const { data: objects, error: listError } = await supabase.storage
        .from(bucket.name)
        .list("", { limit: 1000 });

      if (listError || !objects) {
        console.warn(`Could not list files in bucket ${bucket.name}:`, listError?.message);
        continue;
      }

      const orphanedNames: string[] = [];

      for (const file of objects) {
        // Skip placeholder or folder objects
        if (!file.name || file.name === ".emptyFolderPlaceholder") continue;

        totalFilesScanned++;

        // Enforce 24-hour grace period for recent files
        if (file.created_at) {
          const fileAge = now - new Date(file.created_at).getTime();
          if (fileAge < GRACE_PERIOD_MS) {
            continue;
          }
        }

        // Check if file name or path is referenced in active DB URLs
        const isReferenced = allActiveDbUrlsCombined.includes(file.name);

        if (!isReferenced) {
          orphanedNames.push(file.name);
          deletedFilesLog.push({ bucket: bucket.name, name: file.name });
        }
      }

      // 5. Delete orphaned objects for this bucket in batches of 100
      if (orphanedNames.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < orphanedNames.length; i += batchSize) {
          const batch = orphanedNames.slice(i, i + batchSize);
          const { error: removeError } = await supabase.storage.from(bucket.name).remove(batch);

          if (removeError) {
            console.error(`Failed to delete batch from ${bucket.name}:`, removeError.message);
          } else {
            totalOrphanedCount += batch.length;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Orphaned storage cleanup completed.",
        bucketsScanned: buckets?.length || 0,
        totalFilesScanned,
        deletedOrphanedCount: totalOrphanedCount,
        deletedFiles: deletedFilesLog,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: unknown) {
    console.error("cleanup-orphaned-storage error:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}

if (import.meta.main) {
  serve(handler);
}
