import { createClient } from "@/lib/supabase/client";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") || "google";

  if (provider !== "google") {
    return new Response("Only google calendar is currently supported", { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const redirectUri = `${url.origin}/api/calendar/callback`;

  // Need to verify user is authenticated before redirecting
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const scopes = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
  ].join(" ");

  const state = user.id; // pass user id in state

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${state}`;

  return Response.redirect(googleAuthUrl);
}
