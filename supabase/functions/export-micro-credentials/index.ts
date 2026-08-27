import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export async function handler(req: Request): Promise<Response> {
  // CORS check
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch completed credit-eligible event series certificates that are not yet exported
    const { data: certs, error: certsError } = await supabase
      .from("issued_certificates")
      .select(`
        id,
        certificate_number,
        issued_at,
        user_id,
        series_id,
        event_series!inner (
          id,
          title,
          is_credit_eligible
        )
      `)
      .eq("event_series.is_credit_eligible", true)
      .is("registrar_exported_at", null);

    if (certsError) throw certsError;

    if (!certs || certs.length === 0) {
      return new Response(JSON.stringify({ message: "No new micro-credentials to export", count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch profiles to retrieve student IDs and emails
    const userIds = certs.map((c: any) => c.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email, student_id")
      .in("id", userIds);

    if (profilesError) throw profilesError;

    const profileMap = new Map(profiles?.map((p: any) => [p.id, p]));

    // 3. Format the data for Workday Student (JSON) and Ellucian Banner (XML)
    const completionsJson = certs.map((cert: any) => {
      const profile = profileMap.get(cert.user_id);
      const studentId = profile?.student_id || `STD-${cert.user_id.substring(0, 6)}`;
      const email = profile?.email || "unknown@university.edu";

      return {
        studentReference: {
          id: studentId,
          email: email,
        },
        credentialCode: `CRED-${cert.series_id.substring(0, 8).toUpperCase()}`,
        courseTitle: cert.event_series.title,
        creditValue: 0.5,
        status: "Completed",
        completionDate: cert.issued_at,
      };
    });

    const workdayPayload = {
      source: "CampusConnect",
      exportTimestamp: new Date().toISOString(),
      completions: completionsJson,
    };

    // Construct Ellucian Banner XML Payload
    let bannerXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sisEnrollmentExport>\n  <sourceSystem>CampusConnect</sourceSystem>\n  <exportDate>${new Date().toISOString()}</exportDate>\n  <records>\n`;
    certs.forEach((cert: any) => {
      const profile = profileMap.get(cert.user_id);
      const studentId = profile?.student_id || `STD-${cert.user_id.substring(0, 6)}`;
      const email = profile?.email || "unknown@university.edu";
      bannerXml += `    <record>\n`;
      bannerXml += `      <studentId>${studentId}</studentId>\n`;
      bannerXml += `      <email>${email}</email>\n`;
      bannerXml += `      <courseReferenceNumber>CRED-${cert.series_id.substring(0, 8).toUpperCase()}</courseReferenceNumber>\n`;
      bannerXml += `      <title>${cert.event_series.title}</title>\n`;
      bannerXml += `      <creditUnits>0.5</creditUnits>\n`;
      bannerXml += `      <grade>P</grade>\n`;
      bannerXml += `      <completionDate>${cert.issued_at}</completionDate>\n`;
      bannerXml += `    </record>\n`;
    });
    bannerXml += `  </records>\n</sisEnrollmentExport>`;

    // 4. Securely transmit payload using mTLS if certificates are configured
    const clientCert = Deno.env.get("REGISTRAR_SIS_CLIENT_CERT");
    const clientKey = Deno.env.get("REGISTRAR_SIS_CLIENT_KEY");
    const sisApiUrl = Deno.env.get("REGISTRAR_SIS_API_URL") || "https://sis-api.university.edu/sis/credentials";
    const sisFormat = Deno.env.get("REGISTRAR_SIS_FORMAT") || "json";

    let httpClient: any;
    if (clientCert && clientKey && typeof Deno.createHttpClient === "function") {
      try {
        httpClient = Deno.createHttpClient({
          cert: clientCert,
          key: clientKey,
        });
        console.log("[export-micro-credentials] Configured mTLS client HTTP client.");
      } catch (err: any) {
        console.error("[export-micro-credentials] mTLS configuration failed:", err.message);
      }
    }

    const requestBody = sisFormat === "xml" ? bannerXml : JSON.stringify(workdayPayload);
    const contentType = sisFormat === "xml" ? "application/xml" : "application/json";

    const fetchOptions: any = {
      method: "POST",
      headers: {
        "Content-Type": contentType,
      },
      body: requestBody,
    };

    if (httpClient) {
      fetchOptions.client = httpClient;
    }

    console.log(`[export-micro-credentials] Transmitting payload to Registrar SIS API: ${sisApiUrl}`);
    const response = await fetch(sisApiUrl, fetchOptions);

    if (!response.ok) {
      throw new Error(`Registrar API responded with status ${response.status}: ${await response.text()}`);
    }

    // 5. Update exported timestamp to prevent duplicate processing
    const exportedIds = certs.map((c: any) => c.id);
    const { error: updateError } = await supabase
      .from("issued_certificates")
      .update({ registrar_exported_at: new Date().toISOString() })
      .in("id", exportedIds);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        exported_count: certs.length,
        format: sisFormat,
        payload_transmitted: sisFormat === "xml" ? "xml" : workdayPayload,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[export-micro-credentials] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

if (import.meta.main) {
  serve(handler);
}
