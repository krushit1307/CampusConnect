import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parse } from "https://deno.land/std@0.168.0/encoding/csv.ts";

// ---------------------------------------------------------------------------
// CORS headers – allow the Supabase dashboard and any campus frontend
// ---------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
 * Enforces a maximum limit of 1000 rows.
 */
function parseEmailsFromCsv(csvText: string): string[] {
  let rows: string[][];
  try {
    rows = parse(csvText) as string[][];
  } catch (_err) {
    // Fallback to basic regex-split if CSV parsing fails on malformed input
    const lines = csvText.split(/\r?\n/).filter(Boolean);
    rows = lines.map((line) => line.split(","));
  }

  if (rows.length === 0) return [];

  // Enforce a row-count limit to avoid excessive memory usage
  if (rows.length > 1000) {
    throw new Error("CSV file exceeds maximum limit of 1000 rows.");
  }

  const emails: string[] = [];

  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const firstCol = row[0].trim().toLowerCase();

    // Skip header row (contains literal "email")
    if (firstCol === "email" || !firstCol) continue;

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
 *   "invalidCount": number, // count of invalid emails
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

  // Enforce upload size limit using Content-Length header to prevent large payloads
  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = parseInt(contentLengthHeader, 10);
    if (contentLength > 2 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "Payload too large. Maximum CSV size is 2MB." }),
        {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }

  // -------------------------------------------------------------------------
  // 1. Auth – verify the calling user
  // -------------------------------------------------------------------------
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

    csvText = typeof csvFile === "string" ? csvFile : await (csvFile as File).text();
  } catch (_err) {
    return new Response(JSON.stringify({ error: "Failed to parse multipart form-data." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
    !memberError && membership?.role === "admin" && membership?.status === "approved";
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
  let rawEmails: string[];
  try {
    rawEmails = parseEmailsFromCsv(csvText!);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to parse CSV.";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (rawEmails.length === 0) {
    return new Response(JSON.stringify({ error: "CSV file contained no email addresses." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
  //    Fetch auth users in one paginated pass rather than calling listUsers()
  //    in a loop per email.
  // -------------------------------------------------------------------------
  const failed: string[] = [];
  const resolvedUsers: { user_id: string; email: string }[] = [];

  const allUsers: { id: string; email?: string }[] = [];
  let page = 1;
  const perPage = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: adminData, error: adminErr } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (adminErr) {
      console.error(`Admin listUsers API error: ${adminErr.message}`);
      return new Response(
        JSON.stringify({ error: "Internal server error: failed to retrieve user directory." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const pageUsers = adminData?.users || [];
    allUsers.push(...pageUsers);

    if (pageUsers.length < perPage) {
      hasMore = false;
    } else {
      page++;
    }
  }

  const emailToUserMap = new Map<string, string>();
  for (const u of allUsers) {
    if (u.email) {
      emailToUserMap.set(u.email.toLowerCase(), u.id);
    }
  }

  const pendingResolved: { user_id: string; email: string }[] = [];
  for (const email of validEmails) {
    const userId = emailToUserMap.get(email);
    if (userId) {
      pendingResolved.push({ user_id: userId, email });
    } else {
      failed.push(email);
    }
  }

  // Verify that profile records exist for the resolved user IDs to avoid foreign key errors on insert
  if (pendingResolved.length > 0) {
    const userIds = pendingResolved.map((u) => u.user_id);
    const { data: existingProfiles, error: profileErr } = await supabase
      .from("profiles")
      .select("id")
      .in("id", userIds);

    if (profileErr) {
      console.error(`Failed to verify profiles: ${profileErr.message}`);
      return new Response(
        JSON.stringify({ error: "Internal server error: failed to verify student profiles." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const existingProfileIds = new Set((existingProfiles || []).map((p: { id: string }) => p.id));
    for (const u of pendingResolved) {
      if (existingProfileIds.has(u.user_id)) {
        resolvedUsers.push(u);
      } else {
        failed.push(u.email);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 6. Bulk Insert/Upsert into club_members as pending
  //    onConflict + ignoreDuplicates: true handles existing memberships gracefully
  // -------------------------------------------------------------------------
  let invited = 0;
  let skipped = 0;

  if (resolvedUsers.length > 0) {
    const inserts = resolvedUsers.map(({ user_id }) => ({
      club_id: clubId,
      user_id,
      role: "member" as const,
      status: "pending" as const,
    }));

    const { data: insertedData, error: bulkInsertErr } = await supabase
      .from("club_members")
      .upsert(inserts, { onConflict: "club_id,user_id", ignoreDuplicates: true })
      .select("user_id");

    if (bulkInsertErr) {
      console.error(`Failed to bulk insert members. Error code: ${bulkInsertErr.code}`);
      return new Response(
        JSON.stringify({ error: "Failed to invite members due to a database error." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    invited = insertedData?.length ?? 0;
    skipped = resolvedUsers.length - invited;
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
