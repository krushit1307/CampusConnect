import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { downloadZip } from "https://esm.sh/client-zip@2.4.4";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Auth Header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { clubId } = await req.json();
    if (!clubId) {
      return new Response(JSON.stringify({ error: "Missing clubId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    // 1. Verify if user is an executive for this club
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { data: membership } = await supabase
      .from("club_members")
      .select("role")
      .eq("club_id", clubId)
      .eq("user_id", user.id)
      .single();

    if (
      !membership ||
      !["president", "vice_president", "treasurer", "secretary", "admin"].includes(membership.role)
    ) {
      return new Response(JSON.stringify({ error: "Forbidden: Not an active executive" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 2. Fetch all vault documents
    const { data: documents, error: docsError } = await supabase
      .from("vault_documents")
      .select("file_name, file_path, category")
      .eq("club_id", clubId);

    if (docsError || !documents || documents.length === 0) {
      return new Response(
        JSON.stringify({ error: "No documents found or error fetching documents" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // 3. Download files from storage and prepare for zip
    const filesToZip = [];
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    ); // use service role to avoid potential RLS loops if downloading in bulk, though user token would work too

    for (const doc of documents) {
      const { data: blob, error: downloadError } = await supabaseAdmin.storage
        .from("club_vaults")
        .download(doc.file_path);

      if (!downloadError && blob) {
        filesToZip.push({
          name: `${doc.category}/${doc.file_name}`,
          lastModified: new Date(),
          input: blob,
        });
      }
    }

    // Log audit trail
    await supabaseAdmin.from("vault_audit_log").insert({
      club_id: clubId,
      user_id: user.id,
      action: "EXPORT",
      file_name: "full_vault_export.zip",
    });

    if (filesToZip.length === 0) {
      return new Response(JSON.stringify({ error: "Failed to read files from storage" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 4. Generate Zip
    const zipResponse = downloadZip(filesToZip);

    return new Response(zipResponse.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="club_vault_export.zip"`,
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
