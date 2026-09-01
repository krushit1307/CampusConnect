import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * ============================================================================
 * MWBE CERTIFICATION LOOKUP (#5291)
 * ============================================================================
 *
 * Called during vendor onboarding. Queries the state's official MWBE directory
 * by EIN, falling back to legal name, and records the outcome against the
 * vendor's profile so the badge, the search boost and the compliance report all
 * read the same verified row.
 *
 * The vendor never supplies its own certification status. A self-declared badge
 * would be the platform asserting federal grant compliance on the word of the
 * party being paid, which is the exact exposure #5291 describes.
 *
 * A miss is recorded as NOT_FOUND rather than left blank: "we checked and the
 * state has no record" and "we never checked" look identical in a report unless
 * the negative result is stored.
 * ============================================================================
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type MwbeCategory = "MINORITY_OWNED" | "WOMEN_OWNED" | "MINORITY_WOMEN_OWNED" | "DISADVANTAGED";

interface DirectoryEntry {
  certificateNumber: string;
  legalName: string;
  ein: string;
  category: MwbeCategory;
  issuingRegistry: string;
  expiresOn: string;
}

/** Mirrors src/lib/supplierDiversity.ts so UI and stored badge cannot disagree. */
function normalizeEin(ein: string): string {
  const digits = (ein || "").replace(/\D/g, "");
  return digits.length === 9 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : "";
}

function normalizeBusinessName(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(llc|l l c|inc|incorporated|corp|corporation|co|company|ltd|limited|lp|llp)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

const REGISTRY_NAME = Deno.env.get("MWBE_REGISTRY_NAME") ?? "State MWBE Directory";
const REGISTRY_URL = Deno.env.get("MWBE_DIRECTORY_API_URL") ?? "";
const REGISTRY_KEY = Deno.env.get("MWBE_DIRECTORY_API_KEY") ?? "";

/**
 * Fetches candidate directory rows for an EIN and legal name.
 *
 * Both identifiers are sent so the state can answer on either; the caller decides
 * which match to trust.
 */
async function queryStateDirectory(ein: string, legalName: string): Promise<DirectoryEntry[]> {
  if (!REGISTRY_URL) {
    console.warn("[MWBE] MWBE_DIRECTORY_API_URL is unset; treating the lookup as no-record.");
    return [];
  }

  const url = new URL(REGISTRY_URL);
  url.searchParams.set("ein", ein);
  url.searchParams.set("legal_name", legalName);

  const response = await fetch(url.toString(), {
    headers: REGISTRY_KEY ? { Authorization: `Bearer ${REGISTRY_KEY}` } : undefined,
  });

  if (!response.ok) {
    throw new Error(`State MWBE directory returned ${response.status}.`);
  }

  const payload = await response.json();
  const rows = Array.isArray(payload?.results) ? payload.results : [];

  return rows.map((row: Record<string, unknown>) => ({
    certificateNumber: String(row.certificate_number ?? row.certificateNumber ?? ""),
    legalName: String(row.legal_name ?? row.legalName ?? ""),
    ein: String(row.ein ?? ""),
    category: String(row.category ?? "MINORITY_OWNED").toUpperCase() as MwbeCategory,
    issuingRegistry: String(row.issuing_registry ?? REGISTRY_NAME),
    expiresOn: String(row.expires_on ?? row.expiresOn ?? ""),
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { ein, legalName } = await req.json();
    const normalizedEin = normalizeEin(ein);

    if (!legalName) throw new Error("legalName is required.");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // An unusable EIN is not a directory miss; it is a data-entry problem the
    // organizer has to fix, and it is reported as such rather than as "not certified".
    if (!normalizedEin) {
      return new Response(
        JSON.stringify({
          status: "INVALID_EIN",
          certified: false,
          evidence: `EIN "${ein}" is not a valid federal EIN (XX-XXXXXXX), so the directory could not be queried.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const directory = await queryStateDirectory(normalizedEin, legalName);

    let entry = directory.find((row) => normalizeEin(row.ein) === normalizedEin) ?? null;
    let matchMethod: "EIN" | "LEGAL_NAME" | "NONE" = entry ? "EIN" : "NONE";

    if (!entry) {
      const byName = directory.filter(
        (row) => normalizeBusinessName(row.legalName) === normalizeBusinessName(legalName),
      );
      // One name match is an identification; two is a coin toss, and a badge on
      // the wrong taxpayer is a false compliance claim.
      if (byName.length === 1) {
        entry = byName[0];
        matchMethod = "LEGAL_NAME";
      }
    }

    const now = new Date();
    const active = entry ? Date.parse(entry.expiresOn) >= now.getTime() : false;
    const status = !entry ? "NOT_FOUND" : active ? "VERIFIED" : "EXPIRED";

    const evidence = !entry
      ? `No ${REGISTRY_NAME} record matched EIN ${normalizedEin} or legal name "${legalName}".`
      : active
        ? `Matched by ${matchMethod === "EIN" ? "EIN" : "legal name"} to ${entry.issuingRegistry} certificate ${entry.certificateNumber}, valid to ${entry.expiresOn}.`
        : `${entry.issuingRegistry} certificate ${entry.certificateNumber} expired on ${entry.expiresOn}; the vendor must recertify before the badge is restored.`;

    const record = {
      vendor_ein: normalizedEin,
      vendor_legal_name: legalName,
      status,
      category: entry?.category ?? null,
      certificate_number: entry?.certificateNumber ?? null,
      issuing_registry: entry?.issuingRegistry ?? REGISTRY_NAME,
      expires_on: entry?.expiresOn ?? null,
      match_method: matchMethod,
      evidence,
      verified_at: now.toISOString(),
    };

    // Re-onboarding the same taxpayer refreshes the badge rather than stacking rows.
    const { error } = await supabase
      .from("mwbe_vendor_certifications")
      .upsert(record, { onConflict: "vendor_ein" });

    if (error) throw new Error(`Directory checked but not recorded: ${error.message}`);

    return new Response(
      JSON.stringify({
        status,
        certified: status === "VERIFIED",
        category: record.category,
        certificateNumber: record.certificate_number,
        issuingRegistry: record.issuing_registry,
        expiresOn: record.expires_on,
        matchMethod,
        evidence,
        verifiedAt: record.verified_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[MWBE] Lookup failed:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
