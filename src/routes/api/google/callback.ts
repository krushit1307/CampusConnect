import { createClient } from "@/lib/supabase/client";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const clubId = url.searchParams.get("state"); // State passes the club_id

  if (!code || !clubId) {
    return new Response("Missing authorization code or state", { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const redirectUri = `${url.origin}/api/google/callback`;

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      return new Response(`Token exchange failed: ${await tokenRes.text()}`, { status: 400 });
    }

    const { access_token, refresh_token, expires_in } = await tokenRes.json();

    if (!refresh_token) {
      return new Response("Failed to retrieve refresh token. Re-consent may be required.", { status: 400 });
    }

    const supabase = createClient();

    // Store securely in Supabase using upsert
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
    const { error: upsertErr } = await supabase.from("google_sheets_integrations").upsert({
      club_id: clubId,
      access_token,
      refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: "club_id" });

    if (upsertErr) {
      return new Response(`Database insert failed: ${upsertErr.message}`, { status: 500 });
    }

    // Get club slug for redirection
    const { data: club, error: clubErr } = await supabase
      .from("clubs")
      .select("slug")
      .eq("id", clubId)
      .single();

    if (clubErr || !club) {
      return new Response("Linked club not found", { status: 404 });
    }

    // Redirect to club settings page
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/clubs/${club.slug}/manage?tab=developer`,
      },
    });
  } catch (err: any) {
    return new Response(err.message || "An unexpected error occurred during OAuth callback", { status: 500 });
  }
}
