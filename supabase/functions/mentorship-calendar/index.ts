// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

declare const Deno: any;

async function refreshGoogleToken(integration: any, supabase: any) {
  if (new Date(integration.expires_at) > new Date()) {
    return integration.access_token;
  }
  if (!integration.refresh_token) {
    throw new Error("No refresh token available");
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";

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
    throw new Error("Failed to refresh Google token");
  }

  const { access_token, expires_in } = await tokenRes.json();
  const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

  await supabase
    .from("user_calendar_integrations")
    .update({ access_token, expires_at })
    .eq("user_id", integration.user_id);

  return access_token;
}

async function getGoogleEvents(accessToken: string, timeMin: string, timeMax: string) {
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.append("timeMin", timeMin);
  url.searchParams.append("timeMax", timeMax);
  url.searchParams.append("singleEvents", "true");
  url.searchParams.append("orderBy", "startTime");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return []; // Return empty if failed (maybe calendar not available)
  }

  const data = await res.json();
  return (data.items || [])
    .map((item: any) => ({
      start: item.start.dateTime || item.start.date,
      end: item.end.dateTime || item.end.date,
    }))
    .filter((evt: any) => evt.start && evt.end);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    const { action, mentor_id, mentee_id, start_time, end_time } = payload;

    if (!mentor_id || !mentee_id) {
      throw new Error("Missing mentor_id or mentee_id");
    }

    const { data: mentorInteg } = await supabase
      .from("user_calendar_integrations")
      .select("*")
      .eq("user_id", mentor_id)
      .single();

    if (!mentorInteg) {
      throw new Error("Mentor has no calendar integration");
    }

    const { data: menteeInteg } = await supabase
      .from("user_calendar_integrations")
      .select("*")
      .eq("user_id", mentee_id)
      .single();

    if (action === "availability") {
      // Find mutual availability for next 7 days
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const timeMin = now.toISOString();
      const timeMax = nextWeek.toISOString();

      const mentorToken = await refreshGoogleToken(mentorInteg, supabase);
      const mentorEvents = await getGoogleEvents(mentorToken, timeMin, timeMax);

      let menteeEvents: any[] = [];
      if (menteeInteg) {
        const menteeToken = await refreshGoogleToken(menteeInteg, supabase);
        menteeEvents = await getGoogleEvents(menteeToken, timeMin, timeMax);
      }

      // Simplified availability algorithm here, because we can't easily import date-fns in Deno without URL import
      // and we want it fast. Wait, I can use Deno's esm.sh date-fns.
      // But let's write a simple manual one or import it.

      const {
        addMinutes,
        isBefore,
        isAfter,
        parseISO,
        isSameDay,
        setHours,
        setMinutes,
        setSeconds,
        setMilliseconds,
        areIntervalsOverlapping,
      } = await import("https://esm.sh/date-fns@2.30.0");

      const config = {
        startDate: timeMin,
        endDate: timeMax,
        slotDurationMinutes: 30,
        workingHoursStart: 9,
        workingHoursEnd: 17,
      };

      const start = parseISO(config.startDate);
      const end = parseISO(config.endDate);
      const allEvents = [...mentorEvents, ...menteeEvents].map((evt) => ({
        start: parseISO(evt.start),
        end: parseISO(evt.end),
      }));

      const availableSlots = [];
      let currentSlotStart = new Date(start);

      while (isBefore(currentSlotStart, end)) {
        const currentSlotEnd = addMinutes(currentSlotStart, config.slotDurationMinutes);

        if (isAfter(currentSlotEnd, end)) break;

        const dayStart = setMilliseconds(
          setSeconds(setMinutes(setHours(currentSlotStart, config.workingHoursStart), 0), 0),
          0,
        );
        const dayEnd = setMilliseconds(
          setSeconds(setMinutes(setHours(currentSlotStart, config.workingHoursEnd), 0), 0),
          0,
        );

        const isWithinWorkingHours =
          (isAfter(currentSlotStart, dayStart) ||
            currentSlotStart.getTime() === dayStart.getTime()) &&
          (isBefore(currentSlotEnd, dayEnd) || currentSlotEnd.getTime() === dayEnd.getTime()) &&
          isSameDay(currentSlotStart, currentSlotEnd);

        if (!isWithinWorkingHours) {
          if (
            isAfter(currentSlotStart, dayEnd) ||
            currentSlotStart.getTime() === dayEnd.getTime()
          ) {
            const nextDay = addMinutes(currentSlotStart, 24 * 60);
            currentSlotStart = setMilliseconds(
              setSeconds(setMinutes(setHours(nextDay, config.workingHoursStart), 0), 0),
              0,
            );
          } else {
            if (isBefore(currentSlotStart, dayStart)) {
              currentSlotStart = new Date(dayStart);
            } else {
              currentSlotStart = addMinutes(currentSlotStart, config.slotDurationMinutes);
            }
          }
          continue;
        }

        const hasOverlap = allEvents.some((evt: any) =>
          areIntervalsOverlapping(
            { start: currentSlotStart, end: currentSlotEnd },
            { start: evt.start, end: evt.end },
          ),
        );

        if (!hasOverlap) {
          availableSlots.push({
            start: currentSlotStart.toISOString(),
            end: currentSlotEnd.toISOString(),
          });
        }

        currentSlotStart = currentSlotEnd;
      }

      return new Response(JSON.stringify({ availableSlots }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "schedule") {
      if (!start_time || !end_time) {
        throw new Error("Missing start_time or end_time");
      }

      const mentorToken = await refreshGoogleToken(mentorInteg, supabase);

      // Create event in Mentor's calendar and invite mentee if they have an email
      const menteeEmail = menteeInteg?.email || null;
      const attendees = menteeEmail ? [{ email: menteeEmail }] : [];

      const eventData = {
        summary: "Mentorship Session",
        description: "Scheduled via CampusConnect",
        start: { dateTime: start_time },
        end: { dateTime: end_time },
        attendees,
        conferenceData: {
          createRequest: { requestId: Math.random().toString(36).substring(7) },
        },
      };

      const res = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mentorToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventData),
        },
      );

      if (!res.ok) {
        throw new Error("Failed to create Google Calendar event");
      }

      const createdEvent = await res.json();
      const meetLink = createdEvent.hangoutLink || null;

      // Need a valid pair_id if table mandates it. For now let's bypass or find pair_id
      const { data: pairData } = await supabase
        .from("mentorship_pairs")
        .select("id")
        .or(
          `and(mentor_id.eq.${mentor_id},mentee_id.eq.${mentee_id}),and(mentor_id.eq.${mentee_id},mentee_id.eq.${mentor_id})`,
        )
        .single();

      if (!pairData) {
        throw new Error("Mentorship pair not found");
      }

      const { data: session, error: insertError } = await supabase
        .from("mentorship_sessions")
        .insert({
          pair_id: pairData.id,
          mentor_id,
          mentee_id,
          start_time,
          end_time,
          meeting_url: meetLink,
          google_event_id: createdEvent.id,
          status: "scheduled",
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to insert session: ${insertError.message}`);
      }

      return new Response(JSON.stringify({ session }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Calendar function error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
