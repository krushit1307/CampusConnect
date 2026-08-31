// supabase/functions/_shared/tarpit-middleware.ts
// Issue: #4995 - Dynamic "Early Bird" Rate-Limiting Tarpit
// Description: Middleware for integrating tarpit with bot detection

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface TarpitMiddlewareConfig {
  enabled: boolean;
  tarpitFunctionUrl: string;
  checkBeforeTarpit: boolean;
  severity?: "low" | "medium" | "high";
}

const DEFAULT_CONFIG: TarpitMiddlewareConfig = {
  enabled: true,
  tarpitFunctionUrl: "/functions/v1/tarpit",
  checkBeforeTarpit: true,
  severity: "medium",
};

/**
 * Tarpit middleware for Deno Edge Functions
 * This middleware can be used to integrate tarpit with existing bot detection
 */
export function withTarpit(
  handler: (req: Request) => Promise<Response>,
  config: Partial<TarpitMiddlewareConfig> = {},
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return async (req: Request): Promise<Response> => {
    // If tarpit is disabled, just call the handler
    if (!finalConfig.enabled) {
      return handler(req);
    }

    // Extract client information
    const clientIp =
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const fingerprint = req.headers.get("x-device-fingerprint") || undefined;

    // Check if already in tarpit
    if (finalConfig.checkBeforeTarpit) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      );

      try {
        const { data } = await supabase.rpc("is_in_tarpit", {
          p_ip_address: clientIp,
          p_fingerprint: fingerprint,
        });

        if (data && data.length > 0 && data[0].in_tarpit) {
          // Already in tarpit, redirect to tarpit function
          return redirectToTarpit(req, finalConfig);
        }
      } catch (error) {
        console.error("Error checking tarpit status:", error);
        // Continue on error to avoid blocking legitimate traffic
      }
    }

    // Call the original handler
    return handler(req);
  };
}

/**
 * Redirect request to tarpit function
 */
function redirectToTarpit(req: Request, config: TarpitMiddlewareConfig): Response {
  const url = new URL(req.url);
  const tarpitUrl = new URL(config.tarpitFunctionUrl, url.origin);

  // Forward relevant headers
  const headers = new Headers();
  headers.set("x-forwarded-for", req.headers.get("x-forwarded-for") || "");
  headers.set("x-real-ip", req.headers.get("x-real-ip") || "");
  headers.set("user-agent", req.headers.get("user-agent") || "");
  headers.set("x-device-fingerprint", req.headers.get("x-device-fingerprint") || "");

  // Return redirect to tarpit
  return Response.redirect(tarpitUrl.toString(), 302);
}

/**
 * Helper to trigger tarpit from within an Edge Function
 * Use this when you detect a bot and want to tarpit them
 */
export async function triggerTarpit(
  clientIp: string,
  userAgent?: string,
  fingerprint?: string,
  configName: string = "default",
  triggerReason: string = "bot_detected",
): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );

  try {
    await supabase.rpc("start_tarpit_session", {
      p_ip_address: clientIp,
      p_user_agent: userAgent,
      p_fingerprint: fingerprint,
      p_config_name: configName,
      p_trigger_reason: triggerReason,
    });
  } catch (error) {
    console.error("Error triggering tarpit:", error);
  }
}

/**
 * Example usage in an Edge Function:
 *
 * import { withTarpit, triggerTarpit } from "./_shared/tarpit-middleware.ts";
 *
 * async function handler(req: Request) {
 *   // Your existing logic
 *   const isBot = detectBot(req);
 *
 *   if (isBot) {
 *     const clientIp = req.headers.get("x-forwarded-for") || "unknown";
 *     await triggerTarpit(clientIp, req.headers.get("user-agent") || undefined);
 *     return new Response("Bot detected", { status: 403 });
 *   }
 *
 *   return new Response("Success");
 * }
 *
 * serve(withTarpit(handler));
 */
