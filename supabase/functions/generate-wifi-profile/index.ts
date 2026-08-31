// Edge Function: Generate Wi-Fi Profile
// Description: Generates dynamic Apple .mobileconfig EAP-TLS WPA2-Enterprise Wi-Fi profiles with mock certificates for multi-campus roaming.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { targetCampus, userId, format } = await req.json();

    if (!targetCampus || !userId) {
      throw new Error("targetCampus and userId are required.");
    }

    const certSerial = "CC-CERT-" + Math.floor(10000000 + Math.random() * 90000000);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days time-bound validity

    // Store in DB
    await supabase.from("wifi_certificates").insert({
      user_id: userId,
      target_campus: targetCampus,
      cert_serial: certSerial,
      expires_at: expiresAt.toISOString(),
    });

    const mockCertPem = `-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAJ57+8W\n...MOCK CLIENT CERTIFICATE FOR ${targetCampus}...\n-----END CERTIFICATE-----`;

    // XML Apple mobileconfig definition
    const mobileconfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadDisplayName</key>
    <string>${targetCampus} Secure Wi-Fi (EAP-TLS)</string>
    <key>PayloadIdentifier</key>
    <string>com.campusconnect.wifi.${targetCampus.toLowerCase()}</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>${crypto.randomUUID()}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadDisplayName</key>
            <string>Wi-Fi Network Configuration</string>
            <key>PayloadEnabled</key>
            <true/>
            <key>PayloadIdentifier</key>
            <string>com.campusconnect.wifi.${targetCampus.toLowerCase()}.wificonfig</string>
            <key>PayloadType</key>
            <string>com.apple.wifi.managed</string>
            <key>PayloadUUID</key>
            <string>${crypto.randomUUID()}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>SSID_STR</key>
            <string>eduroam</string>
            <key>HIDDEN_NETWORK</key>
            <false/>
            <key>EncryptionType</key>
            <string>WPA2</string>
            <key>AutoJoin</key>
            <true/>
            <key>EAPClientConfiguration</key>
            <dict>
                <key>AcceptEAPTypes</key>
                <array>
                    <integer>13</integer> <!-- TLS -->
                </array>
                <key>UserName</key>
                <string>${userId}@${targetCampus.toLowerCase()}.edu</string>
            </dict>
        </dict>
    </array>
</dict>
</plist>`;

    if (format === "apple") {
      return new Response(mobileconfig, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/x-apple-aspen-config",
          "Content-Disposition": `attachment; filename="${targetCampus}_WiFi_Profile.mobileconfig"`,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        certSerial,
        expiresAt: expiresAt.toISOString(),
        mobileconfig,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
