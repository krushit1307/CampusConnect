import { createClient } from "@/lib/supabase/client";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const userId = url.searchParams.get("state"); // State passes the user_id

  if (!code || !userId) {
    return new Response("Missing authorization code or state", { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const redirectUri = `${url.origin}/api/calendar/callback`;

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
      return new Response("Failed to retrieve refresh token. Re-consent may be required.", {
        status: 400,
      });
    }

    // Fetch user profile from google to get email (optional, but good)
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    let email = null;
    if (profileRes.ok) {
      const profile = await profileRes.json();
      email = profile.email;
    }

    const supabase = createClient();

    // Store securely in Supabase using upsert
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
    const { error: upsertErr } = await supabase.from("user_calendar_integrations").upsert(
      {
        user_id: userId,
        provider: "google",
        access_token,
        refresh_token,
        expires_at: expiresAt,
        email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (upsertErr) {
      return new Response(`Database insert failed: ${upsertErr.message}`, { status: 500 });
    }

    // Redirect to messages/mentorship dashboard with success
    return Response.redirect(`${url.origin}/messages?calendar_connected=true`);
  } catch (err: any) {
    console.error("Calendar OAuth callback error:", err);
    return new Response(err.message || "An unexpected error occurred during OAuth callback", {
      status: 500,
    });
  }
}
