import { createClient } from "@/lib/supabase/client";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const eventId = params.id;
  const supabase = createClient();

  const { data: sheet, error } = await supabase
    .from("event_google_sheets")
    .select("spreadsheet_id")
    .eq("event_id", eventId)
    .single();

  if (error || !sheet) {
    return Response.json({ linked: false });
  }

  return Response.json({ linked: true, spreadsheetId: sheet.spreadsheet_id });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const eventId = params.id;
  const supabase = createClient();

  // 1. Get event details
  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select("id, title, club_id")
    .eq("id", eventId)
    .single();

  if (eventErr || !event) {
    return new Response("Event not found", { status: 404 });
  }

  // 2. Fetch Google integration refresh token
  const { data: integration, error: integrationErr } = await supabase
    .from("google_sheets_integrations")
    .select("refresh_token")
    .eq("club_id", event.club_id)
    .single();

  if (integrationErr || !integration) {
    return new Response(JSON.stringify({ error: "Google account not linked for this club" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

  try {
    // 3. Refresh access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: integration.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenRes.ok) {
      return new Response(`Token refresh failed: ${await tokenRes.text()}`, { status: 400 });
    }

    const { access_token } = await tokenRes.json();

    // 4. Create new spreadsheet
    const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          title: `RSVPs: ${event.title}`,
        },
      }),
    });

    if (!createRes.ok) {
      return new Response(`Spreadsheet creation failed: ${await createRes.text()}`, { status: 400 });
    }

    const { spreadsheetId } = await createRes.json();

    // 5. Initialize headers
    const headers = ["Name", "Email", "RSVP Status", "RSVP Time"];
    const initRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:D1?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: [headers],
        }),
      }
    );

    if (!initRes.ok) {
      return new Response(`Headers initialization failed: ${await initRes.text()}`, { status: 400 });
    }

    // 6. Fetch existing RSVPs to back-populate
    const { data: rsvps } = await supabase
      .from("event_rsvps")
      .select("status, created_at, profiles(full_name, email)")
      .eq("event_id", eventId);

    if (rsvps && rsvps.length > 0) {
      const rows = rsvps.map((r: any) => [
        r.profiles?.full_name || "Anonymous",
        r.profiles?.email || "No Email",
        r.status,
        r.created_at,
      ]);

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A2:append?valueInputOption=USER_ENTERED`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: rows,
          }),
        }
      );
    }

    // 7. Save spreadsheet link in database
    const { error: linkErr } = await supabase.from("event_google_sheets").upsert({
      event_id: eventId,
      spreadsheet_id: spreadsheetId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "event_id" });

    if (linkErr) {
      return new Response(`Save spreadsheet ID failed: ${linkErr.message}`, { status: 500 });
    }

    return Response.json({ success: true, spreadsheetId });
  } catch (err: any) {
    return new Response(err.message || "An unexpected error occurred", { status: 500 });
  }
}
