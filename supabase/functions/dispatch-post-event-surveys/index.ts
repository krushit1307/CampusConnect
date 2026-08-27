// @ts-ignore: Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// @ts-ignore: Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    const now = new Date();

    /*
     * The project stores the event ending timestamp in
     * events.end_date.
     *
     * Because this function runs hourly, process events whose
     * end time falls between 2 and 3 hours ago.
     *
     * This guarantees that every event is picked up once by
     * the hourly worker instead of requiring an exact
     * second-by-second match.
     */
    const windowEnd = new Date(
      now.getTime() - 2 * 60 * 60 * 1000,
    );

    const windowStart = new Date(
      now.getTime() - 3 * 60 * 60 * 1000,
    );

    const { data: events, error: eventsError } =
      await supabase
        .from("events")
        .select("id, title, end_date")
        .gte("end_date", windowStart.toISOString())
        .lte("end_date", windowEnd.toISOString())
        .neq("status", "cancelled");

    if (eventsError) {
      throw eventsError;
    }

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          events_processed: 0,
          surveys_sent: 0,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    let surveysSent = 0;

    for (const event of events) {
      /*
       * Only checked-in attendees are eligible.
       */
      const { data: attendees, error: attendeesError } =
        await supabase
          .from("event_rsvps")
          .select("user_id")
          .eq("event_id", event.id)
          .eq("checked_in", true);

      if (attendeesError) {
        console.error(
          "Failed to fetch attendees:",
          attendeesError,
        );
        continue;
      }

      for (const attendee of attendees || []) {
        const userId = attendee.user_id;

        /*
         * Survey fatigue protection:
         * never send more than one survey notification
         * to the same user within 24 hours.
         */
        const { data: recentSurvey } = await supabase
          .from("event_feedback")
          .select("id")
          .eq("user_id", userId)
          .gte(
            "created_at",
            new Date(
              now.getTime() - 24 * 60 * 60 * 1000,
            ).toISOString(),
          )
          .limit(1)
          .maybeSingle();

        if (recentSurvey) {
          continue;
        }

        /*
         * Avoid sending the same event survey twice.
         */
        const { data: existingSurvey } = await supabase
          .from("event_feedback")
          .select("id")
          .eq("event_id", event.id)
          .eq("user_id", userId)
          .maybeSingle();

        if (existingSurvey) {
          continue;
        }

        /*
         * Only verified email accounts receive the survey.
         */
        const { data: authUser, error: authError } =
          await supabase.auth.admin.getUserById(userId);

        if (authError || !authUser?.user) {
          continue;
        }

        if (!authUser.user.email_confirmed_at) {
          continue;
        }

        /*
         * Create the feedback row before sending.
         *
         * rating remains NULL until the attendee chooses
         * a rating.
         */
        const { error: feedbackError } = await supabase
          .from("event_feedback")
          .insert({
            event_id: event.id,
            user_id: userId,
          });

        if (feedbackError) {
          /*
           * UNIQUE(event_id, user_id) protects against
           * duplicate notifications if two cron runs overlap.
           */
          if (feedbackError.code === "23505") {
            continue;
          }

          console.error(
            "Failed to create feedback record:",
            feedbackError,
          );
          continue;
        }

        const surveyUrl =
          `${supabaseUrl.replace(/\/$/, "")}` +
          `/events/${event.id}?feedback=1`;

        const safeTitle = escapeHtml(event.title);

        /*
         * Push notification.
         *
         * The project already uses Web Push through
         * send-push-notification, so reuse it instead of
         * introducing another notification system.
         */
        try {
          await fetch(
            `${supabaseUrl}/functions/v1/send-push-notification`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                user_id: userId,
                title: "How was the event?",
                message: `How was ${event.title}? Tap to rate it!`,
                url: surveyUrl,
              }),
            },
          );
        } catch (pushError) {
          console.error(
            "Survey push notification failed:",
            pushError,
          );
        }

        /*
         * Email notification.
         *
         * Reuse the existing send-welcome-email Edge Function,
         * which already supports custom subject/body HTML.
         */
        try {
          await fetch(
            `${supabaseUrl}/functions/v1/send-welcome-email`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                user_id: userId,
                subject: `How was ${event.title}?`,
                html: `
                  <!DOCTYPE html>
                  <html>
                    <body style="font-family:Arial,sans-serif;line-height:1.6;">
                      <div style="max-width:600px;margin:auto;padding:24px;">
                        <h2>How was your event?</h2>

                        <p>
                          Thanks for attending
                          <strong>${safeTitle}</strong>.
                        </p>

                        <p>
                          Take a few seconds to rate your experience.
                        </p>

                        <p style="text-align:center;margin:32px 0;">
                          <a
                            href="${surveyUrl}"
                            style="
                              background:#000;
                              color:#fff;
                              padding:14px 24px;
                              text-decoration:none;
                              font-weight:bold;
                            "
                          >
                            Rate the Event
                          </a>
                        </p>

                        <p>
                          Your feedback helps organizers improve
                          future events.
                        </p>
                      </div>
                    </body>
                  </html>
                `,
              }),
            },
          );
        } catch (emailError) {
          console.error(
            "Survey email failed:",
            emailError,
          );
        }

        surveysSent++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        events_processed: events.length,
        surveys_sent: surveysSent,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error: any) {
    console.error(
      "dispatch-post-event-surveys error:",
      error,
    );

    return new Response(
      JSON.stringify({
        error: error?.message || "Internal server error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});