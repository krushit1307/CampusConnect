import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

// 1x1 Transparent GIF Base64
const TRANSPARENT_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

serve(async (req: Request) => {
  const url = new URL(req.url);
  const newsletterId = url.searchParams.get("n");
  const userId = url.searchParams.get("u");
  const type = url.searchParams.get("type") || "open";
  const targetUrl = url.searchParams.get("url");

  if (newsletterId) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase.from("newsletter_analytics").insert({
        newsletter_id: newsletterId,
        user_id: userId || null,
        event_type: type === "click" ? "click" : "open",
        target_url: targetUrl || null,
      });
    } catch (err) {
      console.warn("Failed to record newsletter analytics event:", err);
    }
  }

  // Click tracking redirect
  if (type === "click" && targetUrl) {
    return Response.redirect(targetUrl, 302);
  }

  // Open tracking pixel
  return new Response(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    },
  });
});
