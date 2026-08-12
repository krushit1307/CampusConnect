import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response("Missing database configuration", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("Missing token parameter", { status: 400 });
  }

  // Fetch the signature record
  const { data: signature, error: sigError } = await supabase
    .from("event_signatures")
    .select("*, events(*)")
    .eq("signature_token", token)
    .maybeSingle();

  if (sigError || !signature) {
    return new Response("Invalid or expired signature token", { status: 404 });
  }

  const event = signature.events;
  const clientIp =
    req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "127.0.0.1";

  if (req.method === "POST") {
    // Perform signing
    if (signature.signed_at) {
      return new Response(JSON.stringify({ success: true, message: "Already signed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabase
      .from("event_signatures")
      .update({
        signed_at: new Date().toISOString(),
        ip_address: clientIp,
      })
      .eq("id", signature.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if all signatures for this event are completed
    const { data: allSigs, error: sigsError } = await supabase
      .from("event_signatures")
      .select("signed_at")
      .eq("event_id", event.id);

    if (!sigsError && allSigs) {
      const allDone = allSigs.every((s) => s.signed_at !== null);
      if (allDone) {
        // Publish the event!
        await supabase.from("events").update({ status: "published" }).eq("id", event.id);
      }
    }

    // Attempt to notify stakeholders or creator via email if Resend is configured
    if (resendApiKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "CampusConnect <approvals@campusconnect.test>",
            to: [signature.signer_email],
            subject: `Signature Recorded - ${event.title}`,
            html: `<p>Dear ${signature.signer_name},</p><p>Your signature for <strong>${event.title}</strong> has been successfully recorded from IP ${clientIp}.</p>`,
          }),
        });
      } catch (err) {
        console.error("Failed to dispatch Resend sign email confirmation:", err);
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Event successfully signed!" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Handle GET request - render signing UI
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Co-Signer Event Review</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        .neu-shadow {
          box-shadow: 8px 8px 0px 0px #000;
        }
        .neu-border {
          border: 3px solid #000;
        }
      </style>
    </head>
    <body class="bg-[#fcf8f2] min-h-screen flex flex-col items-center justify-center p-4">
      <div class="max-w-xl w-full bg-white neu-border neu-shadow p-6 md:p-8 space-y-6">
        <div class="border-b-4 border-black pb-4 text-center">
          <span class="inline-block bg-[#ffde00] neu-border px-3 py-1 font-mono text-xs font-bold uppercase mb-2">High Risk Event Review</span>
          <h1 class="text-3xl font-black uppercase text-black tracking-tight">${event.title}</h1>
        </div>

        <div class="space-y-4 font-mono text-sm">
          <div class="bg-red-50 p-4 border-2 border-black">
            <p class="font-bold text-red-600">⚠️ HIGH RISK WARNING</p>
            <p class="text-xs text-gray-700 mt-1">This event is marked high-risk. All designated co-signers must approve before publication.</p>
          </div>
          <div>
            <span class="font-bold text-gray-600 block text-xs">DESCRIPTION</span>
            <p class="text-black font-semibold mt-1">${event.description || "No description provided."}</p>
          </div>
          <div>
            <span class="font-bold text-gray-600 block text-xs">VENUE / LOCATION</span>
            <p class="text-black font-semibold mt-1">${event.location || "TBA"}</p>
          </div>
          <div>
            <span class="font-bold text-gray-600 block text-xs">EVENT DATE & TIME</span>
            <p class="text-black font-semibold mt-1">${new Date(event.event_date).toLocaleString()}</p>
          </div>
        </div>

        <div class="border-t-4 border-black pt-6 space-y-4">
          <div class="flex items-center justify-between font-mono text-sm bg-yellow-50 p-3 border-2 border-black">
            <div>
              <span class="font-bold text-xs text-gray-600">YOUR SIGNER ROLE</span>
              <p class="font-bold text-black text-base">${signature.signer_role}</p>
            </div>
            <div>
              <span class="font-bold text-xs text-gray-600">RECIPIENT</span>
              <p class="font-bold text-black">${signature.signer_name}</p>
            </div>
          </div>

          <div id="action-section" class="text-center">
            ${
              signature.signed_at
                ? `
              <div class="bg-green-100 text-green-800 border-2 border-green-800 p-4 font-mono text-sm font-bold uppercase">
                Already Approved & Signed ✓
                <div class="text-xs font-normal lowercase mt-1 text-green-700">Signed at ${new Date(signature.signed_at).toLocaleString()} from IP ${signature.ip_address}</div>
              </div>
            `
                : `
              <button id="approve-btn" class="w-full bg-[#a3e635] hover:bg-[#8fd321] text-black font-black uppercase text-lg py-4 px-6 neu-border neu-shadow transition-transform hover:-translate-x-1 hover:-translate-y-1 active:translate-x-0 active:translate-y-0">
                Approve & Co-Sign Event
              </button>
            `
            }
          </div>
        </div>
      </div>

      <script>
        const btn = document.getElementById('approve-btn');
        if (btn) {
          btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.innerText = 'RECORDING SIGNATURE...';
            try {
              const res = await fetch('', { method: 'POST' });
              if (res.ok) {
                document.getElementById('action-section').innerHTML = \`
                  <div class="bg-green-100 text-green-800 border-2 border-green-800 p-4 font-mono text-sm font-bold uppercase">
                    Signature Successfully Recorded ✓
                    <div class="text-xs font-normal lowercase mt-1 text-green-700">Refreshed automatically.</div>
                  </div>
                \`;
                setTimeout(() => window.location.reload(), 1500);
              } else {
                alert('Failed to sign. Please try again.');
                btn.disabled = false;
                btn.innerText = 'Approve & Co-Sign Event';
              }
            } catch (err) {
              alert('Connection error occurred.');
              btn.disabled = false;
              btn.innerText = 'Approve & Co-Sign Event';
            }
          });
        }
      </script>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: { ...corsHeaders, "Content-Type": "text/html" },
  });
});
