import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.2";
import { Redis } from "https://esm.sh/@upstash/redis@1.30.0";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { rsvpIpLimiter, rsvpUserLimiter } from "../_shared/rateLimiter.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import { verifyCsrf } from "../_shared/csrf.ts";
import { signTicket } from "../_shared/ticket-crypto.ts";

const toggleRsvpSchema = z
  .object({
    eventId: z.string().uuid("eventId must be a valid UUID"),
    hasRsvpd: z.boolean().optional(),
    captchaToken: z.string().optional(),
    accommodationsRequested: z.string().max(1000).optional().nullable(),
    noMediaConsent: z.boolean().optional().nullable(),
    referredBy: z.string().uuid().optional().nullable(),
  })
  .strict();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key, x-device-fingerprint",
};

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  delayMs = 1000,
): Promise<Response> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
    }
    attempt++;
    const backoff = delayMs * Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, backoff));
  }
  throw new Error("Failed after maximum retries");
}

const IDEMPOTENCY_TTL_SECONDS = 86400;

const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

function getCanonicalClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const candidate = forwarded || req.headers.get("x-real-ip")?.trim() || "";
  return candidate && candidate.length <= 64 && /^[0-9a-f:.]+$/i.test(candidate) ? candidate : null;
}

function normalizeDeviceFingerprint(value: string | null): string | null {
  const normalized = value?.trim() ?? "";
  if (
    !normalized ||
    normalized === "fallback-anonymous-id" ||
    normalized.length > 128 ||
    !/^[A-Za-z0-9._:-]{8,128}$/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

/**
 * Handles RSVP toggling with rate limiting and idempotent duplicate prevention.
 * When the client sends an `Idempotency-Key` header, a Redis SETNX lock
 * guarantees rapid duplicate clicks/retries never touch Postgres twice (#2323).
 * @param {Request} req - The incoming HTTP request.
 * @returns {Promise<Response>} The HTTP response.
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (
    req.method === "POST" ||
    req.method === "PUT" ||
    req.method === "PATCH" ||
    req.method === "DELETE"
  ) {
    if (!verifyCsrf(req)) {
      return new Response(
        JSON.stringify({
          error: "Invalid CSRF token",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
  }

  let idempotencyRedisKey: string | null = null;

  try {
    // 1. Pre-auth IP Limiter
    const ip = getCanonicalClientIp(req) ?? "unknown";

    let ipLimitRes;
    try {
      ipLimitRes = await rsvpIpLimiter.limit(ip);
    } catch (err) {
      console.error("[RateLimiter] IP limit check failed:", err);
      ipLimitRes = { success: true, reset: 0 }; // fail open
    }

    if (!ipLimitRes.success) {
      const retryAfter = Math.max(1, Math.ceil(((ipLimitRes as any).reset - Date.now()) / 1000));
      return new Response(
        JSON.stringify({
          error: "Too many requests. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": retryAfter.toString(),
          },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let user;
    try {
      user = await verifyAuth(req, supabase);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Post-auth User Limiter
    let userLimitRes;
    try {
      userLimitRes = await rsvpUserLimiter.limit(user.id);
    } catch (err) {
      console.error("[RateLimiter] User limit check failed:", err);
      userLimitRes = { success: true, reset: 0 }; // fail open
    }

    if (!userLimitRes.success) {
      const retryAfter = Math.max(1, Math.ceil(((userLimitRes as any).reset - Date.now()) / 1000));
      return new Response(
        JSON.stringify({
          error: "Too many requests. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": retryAfter.toString(),
          },
        },
      );
    }

    const parsed = await parseJsonBody(toggleRsvpSchema, req);
    if (!parsed.ok) return parsed.response;
    const { eventId, hasRsvpd, captchaToken, accommodationsRequested, noMediaConsent, referredBy } =
      parsed.data;

    const idempotencyKey = req.headers.get("Idempotency-Key");
    idempotencyRedisKey = idempotencyKey ? `rsvp_idempotency_${idempotencyKey}` : null;

    // Serialize a response and, when an idempotency key is present, cache the
    // final payload so retries replay the exact same result.
    const respond = async (
      body: unknown,
      status: number,
      extraHeaders: Record<string, string> = {},
    ): Promise<Response> => {
      if (idempotencyRedisKey && redis) {
        try {
          await redis.set(idempotencyRedisKey, JSON.stringify({ status, body }), {
            ex: IDEMPOTENCY_TTL_SECONDS,
          });
        } catch (cacheError) {
          console.error("Failed to cache idempotency response:", cacheError);
        }
      }
      return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
      });
    };

    // Acquire a Redis lock (SETNX semantics). If the key already exists this
    // request is a duplicate/retry: replay the cached response if one exists,
    // otherwise short-circuit with a safe 202 while the original runs.
    if (idempotencyRedisKey && redis) {
      const acquired = await redis.set(idempotencyRedisKey, "processing", {
        nx: true,
        ex: IDEMPOTENCY_TTL_SECONDS,
      });

      if (acquired === null) {
        const cached = await redis.get<string>(idempotencyRedisKey);
        if (cached && cached !== "processing") {
          try {
            const envelope = JSON.parse(cached) as { status: number; body: unknown };
            return new Response(JSON.stringify(envelope.body), {
              status: envelope.status,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } catch {
            return new Response(cached, {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        return new Response(JSON.stringify({ success: true, status: "processing" }), {
          status: 202,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (hasRsvpd) {
      // 1. Cancel RSVP: delete from RSVPs and waitlist
      const { error: rsvpErr } = await supabase
        .from("event_rsvps")
        .delete()
        .match({ event_id: eventId, user_id: user.id });

      if (rsvpErr) {
        throw rsvpErr;
      }

      const { error: waitlistErr } = await supabase
        .from("event_waitlist")
        .delete()
        .match({ event_id: eventId, user_id: user.id });

      if (waitlistErr) {
        throw waitlistErr;
      }

      return respond({ success: true, status: "cancelled" }, 200);
    } else {
      // 1.5 Pre-flight Prerequisite Verification
      const { data: eventData, error: eventErr } = await supabase
        .from("events")
 feature/design-marketplace-4049
 /design-marketplace-4049

 feature/membership-trial-period-4406
 main


 feature/rsvp-prereq-blocker-3946
 feature/rsvp-prereq-blocker-3946
 feature/rsvp-prereq-blocker-3946

 feature/geofenced-checkin-4035
 feature/geofenced-checkin-4035
 main

 feature/assistant-persistence-2044
 main


        .select("prerequisite_event_id, title, has_photography, is_high_demand")
        .eq("id", eventId)
        .single();

      if (eventErr) throw eventErr;

      const isHighDemand = eventData?.is_high_demand === true;
      const deviceFingerprint = normalizeDeviceFingerprint(req.headers.get("x-device-fingerprint"));
      const clientIp = getCanonicalClientIp(req);

      if (isHighDemand) {
        const claimHashSecret = Deno.env.get("TICKET_CLAIM_HASH_SECRET");
        const captchaSecret =
          Deno.env.get("TURNSTILE_SECRET_KEY") || Deno.env.get("HCAPTCHA_SECRET_KEY");
        const captchaProvider = Deno.env.get("TURNSTILE_SECRET_KEY") ? "turnstile" : "hcaptcha";

        if (!clientIp || !claimHashSecret || claimHashSecret.length < 16 || !captchaSecret) {
          return respond(
            { error: "High-demand ticket protection is temporarily unavailable." },
            503,
            { "Retry-After": "60" },
          );
        }

        if (!captchaToken?.trim()) {
          return respond({ error: "CAPTCHA verification is required for this event." }, 400);
        }

        const verificationUrl =
          captchaProvider === "turnstile"
            ? "https://challenges.cloudflare.com/turnstile/v0/siteverify"
            : "https://hcaptcha.com/siteverify";
        const verificationResponse = await fetch(verificationUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            secret: captchaSecret,
            response: captchaToken,
            remoteip: clientIp,
          }).toString(),
        });
        const verificationResult = await verificationResponse.json();
        if (!verificationResult?.success) {
          return respond({ error: "CAPTCHA verification failed." }, 400);
        }

        const { data: claimResult, error: claimError } = await supabase.rpc(
          "enforce_ticket_claim_rate_limit",
          {
            p_event_id: eventId,
            p_user_id: user.id,
            p_ip_address: clientIp,
            p_device_fingerprint: deviceFingerprint,
            p_idempotency_key: idempotencyKey,
            p_hash_secret: claimHashSecret,
            p_window_seconds: 60,
            p_max_claims: 2,
          },
        );

        if (claimError) {
          console.error("High-demand claim guard failed:", claimError.message);
          return respond(
            { error: "High-demand ticket protection is temporarily unavailable." },
            503,
            { "Retry-After": "60" },
          );
        }

        if (!claimResult?.allowed) {
          const retryAfter = Math.max(1, Number(claimResult?.retry_after_seconds || 60));
          return respond(
            { error: claimResult?.message || "Too many ticket claims. Please try again shortly." },
            429,
            { "Retry-After": String(retryAfter) },
          );
        }
      }

 main
 main
      if (eventData?.has_photography && noMediaConsent == null) {
        return respond(
          { error: "Media consent choice is required for this photography event." },
          400,
        );
      }
      if (eventData?.prerequisite_event_id) {
        const { data: prereqRsvp } = await supabase
          .from("event_rsvps")
          .select("checked_in")
          .match({ event_id: eventData.prerequisite_event_id, user_id: user.id })
          .maybeSingle();

        if (!prereqRsvp || !prereqRsvp.checked_in) {
          return respond(
            {
              error: `You must attend the prerequisite event before registering for this event.`,
            },
 feature/design-marketplace-4049
 feature/design-marketplace-4049

 feature/membership-trial-period-4406
 main
 HEAD


 feature/rsvp-prereq-blocker-3946
 feature/rsvp-prereq-blocker-3946
 feature/rsvp-prereq-blocker-3946

 feature/geofenced-checkin-4035
 feature/geofenced-checkin-4035
 main

 feature/assistant-persistence-2044
 main
 HEAD

 main
 feature/waitlist-churn-predictor
 feature/waitlist-churn-predictor

 feature/club-lifecycle-monitor-3610
 feature/club-lifecycle-monitor-3610
 feature/club-lifecycle-monitor-3610

 main
 feature/vendor-contract-nudges
 main
            403


 main
 feature/design-marketplace-4049
 feature/design-marketplace-4049

 feature/membership-trial-period-4406
 main
 upstream/main

 upstream/main

 main
 main
            403,
          );
        }
      }

      // 2. highly concurrent checkout flow utilizing PG advisory locks and backoff retry mechanism
      let attempts = 0;
      const maxAttempts = 5;
      let delay = 50; // initial wait time in milliseconds

      while (attempts < maxAttempts) {
        const { data, error } = await supabase.rpc("join_event_or_waitlist", {
          p_event_id: eventId,
          p_user_id: user.id,
          p_is_anonymous: false,
          p_resume_path: null,
          p_referred_by: referredBy || null,
        });

        if (error) {
          throw error;
        }

        if (data && data.success && (data.status === "attending" || data.status === "waitlisted")) {
          const { error: mediaConsentError } = await supabase
            .from("event_rsvps")
            .update({ no_media_consent: noMediaConsent === true })
            .match({ event_id: eventId, user_id: user.id });

          if (mediaConsentError) {
            await supabase
              .from("event_rsvps")
              .delete()
              .match({ event_id: eventId, user_id: user.id });
            return respond(
              { error: "Failed to securely save media consent. Please try again." },
              500,
            );
          }

          if (accommodationsRequested) {
            const { error: updateErr } = await supabase
              .from("event_rsvps")
              .update({ accommodations_requested: accommodationsRequested })
              .match({ event_id: eventId, user_id: user.id });

            if (updateErr) {
              console.error("Failed to save accommodations:", updateErr.message);
              // Clean up RSVP to prevent orphan RSVPs on partial failure
              await supabase
                .from("event_rsvps")
                .delete()
                .match({ event_id: eventId, user_id: user.id });

              return respond(
                {
                  error:
                    "Failed to securely save accessibility accommodation request. Please try again.",
                },
                500,
              );
            }

            try {
              const { data: eventDetails } = await supabase
                .from("events")
                .select(
                  `
                  title,
                  clubs (
                    name,
                    created_by
                  )
                `,
                )
                .eq("id", eventId)
                .single();

              let hostEmail: string | null = null;
              let clubName = "your club";
              let eventTitle = "the event";

              if (eventDetails) {
                eventTitle = eventDetails.title || "the event";
                const typedClubs = eventDetails.clubs as unknown as {
                  name: string;
                  created_by: string;
                } | null;
                if (typedClubs) {
                  clubName = typedClubs.name || "your club";
                  const createdBy = typedClubs.created_by;
                  if (createdBy) {
                    const { data: presidentProfile } = await supabase
                      .from("profiles")
                      .select("email")
                      .eq("id", createdBy)
                      .single();
                    if (presidentProfile) {
                      hostEmail = presidentProfile.email;
                    }
                  }
                }
              }

              const accessibilityOfficeEmail =
                Deno.env.get("ACCESSIBILITY_OFFICE_EMAIL") ||
                "accessibility-office@campusconnect.edu";
              const emailList: string[] = [];
              if (hostEmail) {
                emailList.push(hostEmail);
              }
              if (accessibilityOfficeEmail) {
                emailList.push(accessibilityOfficeEmail);
              }

              if (emailList.length > 0) {
                const resendApiKey = Deno.env.get("RESEND_API_KEY");
                const emailBody = {
                  from: "CampusConnect <notifications@campusconnect.app>",
                  to: emailList,
                  subject: `Accommodation Requested for ${eventTitle}. Please review.`,
                  html: `
                    <h2>Accessibility Accommodation Request Submitted</h2>
                    <p>An attendee has requested accessibility accommodations for the upcoming event <strong>${eventTitle}</strong> hosted by <strong>${clubName}</strong>.</p>
                    <p>Please log into the CampusConnect Organizer Dashboard to review this request securely.</p>
                    <p><em>Security Notice: To protect attendee privacy, no medical or sensitive details are included in this email.</em></p>
                  `,
                };

                if (!resendApiKey || Deno.env.get("MOCK_EMAIL") === "true") {
                  console.log(
                    "Mocking notification email dispatch. Would have sent to:",
                    emailList,
                    emailBody,
                  );
                } else {
                  const res = await fetchWithRetry("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${resendApiKey}`,
                    },
                    body: JSON.stringify(emailBody),
                  });
                  if (!res.ok) {
                    const errBody = await res.text();
                    console.error("Resend notification email delivery failed:", errBody);
                  }
                }
              }
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Unknown error";
              console.error("Accommodations email notification processing failure:", msg);
            }
          }

          // Decentralized Ticketing: Sign the ticket
          try {
            // 1. Get user's public key from profile
            const { data: profile } = await supabase
              .from("profiles")
              .select("public_key")
              .eq("id", user.id)
              .single();

            // 2. Get the new ticket (event_rsvps) to get the ticket_id
            const { data: rsvpData } = await supabase
              .from("event_rsvps")
              .select("id, ticket_id, version")
              .match({ event_id: eventId, user_id: user.id })
              .single();

            if (profile?.public_key && rsvpData?.ticket_id) {
              // 3. Sign the ticket
              const signature = await signTicket(
                rsvpData.ticket_id,
                eventId,
                profile.public_key,
                rsvpData.version || 1,
              );

              // 4. Update the ticket with public key and signature
              await supabase
                .from("event_rsvps")
                .update({
                  owner_public_key: profile.public_key,
                  signature: signature,
                })
                .eq("id", rsvpData.id);
            }
          } catch (cryptoErr) {
            console.error("Failed to cryptographically sign ticket:", cryptoErr);
            // Non-fatal, ticket is still issued but may not work offline yet
          }

          return respond({ success: true, status: data.status, position: data.position }, 200);
        }

        if (data?.error === "ALREADY_RSVPED" || data === "ALREADY_RSVPED") {
          return respond({ error: "You have already RSVPed to this event." }, 400);
        }

        if (data?.error === "FULL" || data === "FULL") {
          return respond({ error: "Event capacity has been reached." }, 409);
        }

        if (data?.error === "BUSY" || data === "BUSY") {
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2; // exponential backoff multiplier
            continue;
          }
        }
      }

      // Lock acquisition failed after max retries
      return respond({ error: "Server is busy processing checkouts. Please try again." }, 429);
    }
  } catch (error) {
    console.error("Internal RSVP Error:", error);
    // Release the lock so a client retry can re-execute instead of hitting a stale lock
    if (idempotencyRedisKey && redis) {
      try {
        await redis.del(idempotencyRedisKey);
      } catch (cleanupError) {
        console.error("Failed to clean up idempotency lock:", cleanupError);
      }
    }
    const errorMsg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: `An unexpected error occurred processing your RSVP: ${errorMsg}` }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
