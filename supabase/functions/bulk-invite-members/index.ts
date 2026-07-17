import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// CORS headers – allow the Supabase dashboard and any campus frontend
// ---------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise and validate an email address. */
function normaliseEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/**
 * Parse a CSV body (text) and return the list of email strings found.
 * Supports files that have an optional header row containing the word "email".
 * Every other column in each row is ignored.
 *
 * Expected formats (any of these work):
 *   email
 *   alice@uni.edu
 *   bob@uni.edu
 *
 *   alice@uni.edu,Full Name,Other
 *   bob@uni.edu,Full Name,Other
 */
function parseEmailsFromCsv(csvText: string): string[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const emails: string[] = [];

  for (const line of lines) {
    const cols = line.split(",");
    const firstCol = cols[0].trim().toLowerCase();

    // Skip header row (contains literal "email")
    if (firstCol === "email") continue;

    // The first column is treated as the email
    emails.push(firstCol);
  }

  return emails;
}

// ---------------------------------------------------------------------------
// Edge Function entry point
// ---------------------------------------------------------------------------

/**
 * POST /functions/v1/bulk-invite-members
 *
 * Expects:
 *   - Authorization: Bearer <user_jwt>
 *   - Content-Type: multipart/form-data
 *   - Form field "club_id"  : UUID of the target club
 *   - Form field "csv_file" : CSV file with one email per row (first column)
 *
 * Returns JSON:
 * {
 *   "invited"  : number,   // rows successfully inserted
 *   "skipped"  : number,   // duplicates or already members
 *   "failed"   : string[], // emails that could not be resolved to a profile
 *   "invalid"  : string[], // rows that were not valid email addresses
 * }
 */
serve(async (req: Request) => {
  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // -------------------------------------------------------------------------
  // 1. Auth – verify the calling user
  // -------------------------------------------------------------------------
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing Authorization header" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Service-role client for privileged inserts
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // -------------------------------------------------------------------------
  // 2. Parse multipart form-data
  // -------------------------------------------------------------------------
  let clubId: string | null = null;
  let csvText: string | null = null;

  try {
    const formData = await req.formData();
    clubId = formData.get("club_id") as string | null;
    const csvFile = formData.get("csv_file");

    if (!clubId || !csvFile) {
      return new Response(
        JSON.stringify({
          error: "Both 'club_id' and 'csv_file' form fields are required.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    csvText =
      typeof csvFile === "string"
        ? csvFile
        : await (csvFile as File).text();
  } catch (_err) {
    return new Response(
      JSON.stringify({ error: "Failed to parse multipart form-data." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // -------------------------------------------------------------------------
  // 3. Verify caller is a club admin (or system admin / club creator)
  // -------------------------------------------------------------------------
  const { data: membership, error: memberError } = await supabase
    .from("club_members")
    .select("role, status")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();

  // Also allow the club creator (clubs.created_by)
  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("created_by")
    .eq("id", clubId)
    .maybeSingle();

  if (clubError || !club) {
    return new Response(JSON.stringify({ error: "Club not found." }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isClubAdmin =
    !memberError &&
    membership?.role === "admin" &&
    membership?.status === "approved";
  const isCreator = club.created_by === user.id;

  // Check system_admin role in profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isSystemAdmin = profile?.role === "system_admin";

  if (!isClubAdmin && !isCreator && !isSystemAdmin) {
    return new Response(
      JSON.stringify({
        error: "Forbidden: only club admins can bulk-invite members.",
      }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // -------------------------------------------------------------------------
  // 4. Parse CSV → list of raw emails
  // -------------------------------------------------------------------------
  const rawEmails = parseEmailsFromCsv(csvText!);

  if (rawEmails.length === 0) {
    return new Response(
      JSON.stringify({ error: "CSV file contained no email addresses." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Validate format
  const invalid: string[] = [];
  const validEmails: string[] = [];

  for (const raw of rawEmails) {
    const norm = normaliseEmail(raw);
    if (norm) {
      validEmails.push(norm);
    } else {
      invalid.push(raw);
    }
  }

  // -------------------------------------------------------------------------
  // 5. Resolve emails → profile UUIDs
  //    auth.users is not directly queryable via JS client, so we match on
  //    profiles joined with auth.users via Supabase RPC or by checking
  //    profiles directly (assumes email is stored via auth trigger).
  //    We query auth.users using the admin API available to service role.
  // -------------------------------------------------------------------------
  const failed: string[] = [];
  const resolvedUsers: { user_id: string; email: string }[] = [];

  // Batch lookup – Supabase admin API allows listing users filtered by email
  for (const email of validEmails) {
    const { data: adminData, error: adminErr } =
      await supabase.auth.admin.listUsers();

    if (adminErr) {
      // If admin API fails, fall back to profiles table (if email column exists)
      failed.push(email);
      continue;
    }

    const matched = adminData.users.find(
      (u) => u.email?.toLowerCase() === email,
    );

    if (matched) {
      resolvedUsers.push({ user_id: matched.id, email });
    } else {
      failed.push(email);
    }
  }

  // -------------------------------------------------------------------------
  // 6. Insert into club_members as pending
  //    ON CONFLICT DO NOTHING handles duplicates gracefully
  // -------------------------------------------------------------------------
  let invited = 0;
  let skipped = 0;

  for (const { user_id, email } of resolvedUsers) {
    const { error: insertErr, status } = await supabase
      .from("club_members")
      .insert({
        club_id: clubId,
        user_id,
        role: "member",
        status: "pending",
      })
      .select()
      .single();

    if (insertErr) {
      // 23505 = unique_violation (already a member or pending)
      if (insertErr.code === "23505" || status === 409) {
        skipped++;
      } else {
        console.error(`Failed to insert member ${email}:`, insertErr.message);
        failed.push(email);
      }
    } else {
      invited++;
    }
  }

  // -------------------------------------------------------------------------
  // 7. Return summary
  // -------------------------------------------------------------------------
  return new Response(
    JSON.stringify({
      invited,
      skipped,
      failed,
      invalid,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
