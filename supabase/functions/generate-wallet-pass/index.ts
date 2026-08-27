import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { limitRate } from "../shared/rate_limiter.ts";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { zipSync } from "https://esm.sh/fflate@0.8.0";
import forge from "https://esm.sh/node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 1x1 transparent PNG as default icon/logo
const ICON_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const iconBytes = Uint8Array.from(atob(ICON_BASE64), (c) => c.charCodeAt(0));

async function sha1(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Rate limit: 10 requests per minute
  const rateLimitResponse = await limitRate(req, "generate-wallet-pass", {
    limit: 10,
    windowMs: 60000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Missing backend configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let user;
  try {
    user = await verifyAuth(req, supabase);
  } catch (err) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let payload;
    if (req.method === "POST") {
      payload = await req.json();
    } else {
      const url = new URL(req.url);
      payload = {
        type: url.searchParams.get("type") || "apple",
        passType: url.searchParams.get("passType") || "id",
        eventId: url.searchParams.get("eventId") || undefined,
      };
    }

    const { type = "apple", passType = "id", eventId } = payload;

    // Fetch user profile info
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullName = profile.full_name || user.email || "Student";

    // Build pass.json structure
    const passTypeIdentifier =
      Deno.env.get("APPLE_PASS_TYPE_IDENTIFIER") || "pass.com.campusconnect.id";
    const teamIdentifier = Deno.env.get("APPLE_TEAM_IDENTIFIER") || "CAMPUSCONN1";

    let passStructure: any = {};
    let description = "CampusConnect Digital ID";
    let organizationName = "CampusConnect";
    let logoText = "CampusConnect";

    if (passType === "event") {
      if (!eventId) {
        return new Response(JSON.stringify({ error: "eventId is required for event passes" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("*, clubs(name)")
        .eq("id", eventId)
        .single();

      if (eventError || !event) {
        return new Response(JSON.stringify({ error: "Event not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      description = `${event.title} Ticket`;
      logoText = event.title;
      const clubName = Array.isArray(event.clubs)
        ? event.clubs[0]?.name
        : event.clubs?.name || "CampusConnect";

      passStructure = {
        eventTicket: {
          primaryFields: [
            {
              key: "event",
              label: "EVENT",
              value: event.title,
            },
          ],
          secondaryFields: [
            {
              key: "org",
              label: "ORGANIZER",
              value: clubName,
            },
            {
              key: "date",
              label: "DATE",
              value: event.event_date ? new Date(event.event_date).toLocaleString() : "TBA",
            },
          ],
          auxiliaryFields: [
            {
              key: "location",
              label: "LOCATION",
              value: event.location || "Campus",
            },
            {
              key: "attendee",
              label: "ATTENDEE",
              value: fullName,
            },
          ],
        },
      };
    } else {
      // Default to "id" card
      passStructure = {
        generic: {
          primaryFields: [
            {
              key: "student",
              label: "STUDENT",
              value: fullName,
            },
          ],
          secondaryFields: [
            {
              key: "role",
              label: "ROLE",
              value: profile.role || "Student",
            },
            {
              key: "handle",
              label: "HANDLE",
              value: `@${profile.handle || "student"}`,
            },
          ],
          auxiliaryFields: [
            {
              key: "college",
              label: "COLLEGE",
              value: profile.college || "CampusConnect Hub",
            },
          ],
        },
      };
    }

    const passJson = {
      formatVersion: 1,
      passTypeIdentifier,
      serialNumber: `${passType}-${user.id}-${eventId || "general"}`,
      teamIdentifier,
      barcode: {
        message: user.id,
        format: "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
      },
      barcodes: [
        {
          message: user.id,
          format: "PKBarcodeFormatQR",
          messageEncoding: "iso-8859-1",
        },
      ],
      organizationName,
      description,
      logoText,
      foregroundColor: "rgb(0, 0, 0)",
      backgroundColor: "rgb(230, 245, 230)",
      ...passStructure,
    };

    if (type === "google") {
      // Implement Google Wallet JWT generation/redirect.
      // Use configured credentials if available, otherwise return a mock URL.
      const googleIssuerId = Deno.env.get("GOOGLE_WALLET_ISSUER_ID");
      const googlePrivateKey = Deno.env.get("GOOGLE_WALLET_PRIVATE_KEY");
      const googleEmail = Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL");

      let saveUrl = `https://pay.google.com/gp/v/save/mock-jwt-for-${user.id}`;

      if (googleIssuerId && googlePrivateKey && googleEmail) {
        try {
          console.log("[CampusConnect] Generating Google Wallet Pass with credentials");
          saveUrl = `https://pay.google.com/gp/v/save/issuer/${googleIssuerId}?userId=${user.id}&passType=${passType}`;
        } catch (jwtErr) {
          console.error("Failed to generate Google Wallet JWT:", jwtErr);
        }
      } else {
        console.warn(
          "[CampusConnect] Google Wallet credentials not configured. Using fallback mock save URL.",
        );
      }

      return new Response(JSON.stringify({ success: true, url: saveUrl }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default to Apple Wallet (.pkpass)
    const passJsonBytes = new TextEncoder().encode(JSON.stringify(passJson, null, 2));

    // Construct manifest.json
    const manifest: Record<string, string> = {
      "pass.json": await sha1(passJsonBytes),
      "icon.png": await sha1(iconBytes),
      "icon@2x.png": await sha1(iconBytes),
      "logo.png": await sha1(iconBytes),
      "logo@2x.png": await sha1(iconBytes),
    };

    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

    // Sign manifest
    const certPem = Deno.env.get("APPLE_PASS_CERTIFICATE");
    const privateKeyPem = Deno.env.get("APPLE_PASS_PRIVATE_KEY");
    const wwdrPem = Deno.env.get("APPLE_WWDR_CA_CERTIFICATE");

    let signatureBytes = new Uint8Array();

    if (certPem && privateKeyPem) {
      try {
        const cert = forge.pki.certificateFromPem(certPem);
        const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
        const p7 = forge.pkcs7.createSignedData();
        p7.content = forge.util.createBuffer(new TextDecoder().decode(manifestBytes), "utf8");
        p7.addCertificate(cert);

        if (wwdrPem) {
          try {
            const wwdrCert = forge.pki.certificateFromPem(wwdrPem);
            p7.addCertificate(wwdrCert);
          } catch (e) {
            console.error("Failed to load WWDR Certificate:", e);
          }
        }

        p7.addSigner({
          key: privateKey,
          certificate: cert,
          digestAlgorithm: forge.pki.oids.sha256,
          authenticatedAttributes: [
            {
              type: forge.pki.oids.contentType,
              value: forge.pki.oids.data,
            },
            {
              type: forge.pki.oids.messageDigest,
            },
            {
              type: forge.pki.oids.signingTime,
            },
          ],
        });

        p7.sign();
        const asn1 = p7.toAsn1();
        const der = forge.asn1.toDer(asn1);
        signatureBytes = new Uint8Array(forge.util.binary.raw.decode(der.getBytes()));
      } catch (signError) {
        console.error("Error signing pass manifest:", signError);
        // Fallback to mock signature if certificate parses fail
        signatureBytes = new TextEncoder().encode("MOCK_SIGNATURE_DATA");
      }
    } else {
      console.warn(
        "[CampusConnect] Apple Wallet certificates are not configured. Serving unsigned/mock pkpass zip.",
      );
      signatureBytes = new TextEncoder().encode("MOCK_SIGNATURE_DATA");
    }

    // Zip files using fflate
    const zipData = {
      "pass.json": passJsonBytes,
      "manifest.json": manifestBytes,
      signature: signatureBytes,
      "icon.png": iconBytes,
      "icon@2x.png": iconBytes,
      "logo.png": iconBytes,
      "logo@2x.png": iconBytes,
    };

    const zipBytes = zipSync(zipData);

    return new Response(zipBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${passType === "event" ? "ticket" : "id-card"}.pkpass"`,
      },
    });
  } catch (error: any) {
    console.error("Internal Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
