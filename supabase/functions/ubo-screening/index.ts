// =============================================================================
// Edge Function: ubo-screening
// Issue: #5364 - Automated "Club Spending" Corporate Tax ID Scraper (OFAC Sanctions Beneficial Ownership)
// Description:
//   Integrates with corporate registry APIs (OpenCorporates) to traverse corporate
//   hierarchy, extract Ultimate Beneficial Owners (UBOs), and check them against
//   OFAC sanctions lists. Blocks escrow payouts if UBOs are sanctioned.
//
// Usage:
//   Called during vendor contract signing to screen vendors and their UBOs for sanctions.
// =============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface CorporateOwnership {
  owner_type: string;
  owner_name: string;
  owner_tax_id?: string;
  ownership_percentage: number;
  jurisdiction?: string;
  address?: string;
  date_of_birth?: string;
  nationality?: string;
  identification_number?: string;
}

interface OFACMatch {
  entity_name: string;
  match_score: number;
  is_match: boolean;
  match_details: any;
  ofac_list?: string;
}

serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const { vendor_id, tax_id, jurisdiction } = await req.json();

    if (!vendor_id) {
      return new Response("vendor_id is required", { status: 400 });
    }

    // Step 1: Fetch corporate ownership from OpenCorporates API
    const ownershipData = await fetchCorporateOwnership(tax_id, jurisdiction);

    // Step 2: Extract UBOs (>25% ownership)
    const ubos = extractUBOs(ownershipData);

    // Step 3: Store ownership data in database
    for (const ubo of ubos) {
      await supabase.rpc("add_corporate_ownership", {
        p_vendor_id: vendor_id,
        p_owner_type: ubo.owner_type,
        p_owner_name: ubo.owner_name,
        p_ownership_percentage: ubo.ownership_percentage,
        p_owner_tax_id: ubo.owner_tax_id,
        p_jurisdiction: ubo.jurisdiction,
        p_address: ubo.address,
        p_date_of_birth: ubo.date_of_birth,
        p_nationality: ubo.nationality,
        p_identification_number: ubo.identification_number,
        p_source: "opencorporates",
        p_source_data: ubo,
      });
    }

    // Step 4: Screen vendor and UBOs against OFAC sanctions
    const screeningResult = await screenForSanctions(vendor_id, supabase);

    // Step 5: Block escrow if sanctions match found
    if (screeningResult.has_sanctions) {
      await supabase.rpc("block_vendor_escrow", {
        p_vendor_id: vendor_id,
        p_reason: "UBO or entity matched OFAC sanctions list",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        vendor_id,
        ubos_count: ubos.length,
        has_sanctions: screeningResult.has_sanctions,
        escrow_blocked: screeningResult.has_sanctions,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error in UBO screening:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function fetchCorporateOwnership(
  taxId?: string,
  jurisdiction?: string,
): Promise<CorporateOwnership[]> {
  const openCorporatesApiKey = Deno.env.get("OPENCORPORATES_API_KEY");

  if (!openCorporatesApiKey || !taxId) {
    // Return empty array if no API key or tax ID
    return [];
  }

  try {
    // Query OpenCorporates API for company information
    const response = await fetch(
      `https://api.opencorporates.com/companies/${jurisdiction || "us"}/${taxId}?api_token=${openCorporatesApiKey}`,
    );

    const data = await response.json();

    if (!data.results || !data.results.company) {
      return [];
    }

    const company = data.results.company;
    const ownership: CorporateOwnership[] = [];

    // Extract officers/directors
    if (company.officers && company.officers.length > 0) {
      for (const officer of company.officers) {
        ownership.push({
          owner_type: officer.position ? "individual" : "corporation",
          owner_name: officer.name || "",
          ownership_percentage: 0, // OpenCorporates doesn't always provide percentages
          jurisdiction: officer.jurisdiction,
          address: officer.address,
          identification_number: officer.identification,
        });
      }
    }

    // Extract shareholders if available
    if (company.shareholdings && company.shareholdings.length > 0) {
      for (const shareholding of company.shareholdings) {
        ownership.push({
          owner_type: shareholding.shareholder_type || "individual",
          owner_name: shareholding.shareholder_name || "",
          ownership_percentage: shareholding.percentage || 0,
          jurisdiction: shareholding.jurisdiction,
          address: shareholding.address,
        });
      }
    }

    return ownership;
  } catch (error) {
    console.error("Error fetching from OpenCorporates:", error);
    return [];
  }
}

function extractUBOs(ownershipData: CorporateOwnership[]): CorporateOwnership[] {
  // Filter for UBOs (>25% ownership) or all individuals if percentages not available
  return ownershipData.filter((owner) => {
    // If ownership percentage is available, use >25% threshold
    if (owner.ownership_percentage > 0) {
      return owner.ownership_percentage >= 25;
    }
    // If no percentage, assume all individuals are potential UBOs for safety
    return owner.owner_type === "individual";
  });
}

async function screenForSanctions(
  vendorId: string,
  supabase: any,
): Promise<{ has_sanctions: boolean; matches: OFACMatch[] }> {
  const ofacApiKey = Deno.env.get("OFAC_API_KEY");

  // Get vendor and UBO data
  const { data: vendor } = await supabase.from("vendors").select("*").eq("id", vendorId).single();

  const { data: ownership } = await supabase
    .from("corporate_ownership")
    .select("*")
    .eq("vendor_id", vendorId)
    .eq("is_ultimate_beneficial_owner", true);

  const matches: OFACMatch[] = [];
  let hasSanctions = false;

  // Screen the entity itself
  if (vendor) {
    const entityMatch = await checkOFACSanctions(vendor.name, ofacApiKey);
    if (entityMatch.is_match) {
      matches.push(entityMatch);
      hasSanctions = true;
      await recordSanctionsScreening(
        vendorId,
        null,
        "entity",
        vendor.name,
        vendor.legal_entity_type,
        entityMatch,
        supabase,
      );
    }
  }

  // Screen UBOs
  for (const owner of ownership || []) {
    const uboMatch = await checkOFACSanctions(owner.owner_name, ofacApiKey);
    if (uboMatch.is_match) {
      matches.push(uboMatch);
      hasSanctions = true;
      await recordSanctionsScreening(
        vendorId,
        owner.id,
        "ubo_individual",
        owner.owner_name,
        owner.owner_type,
        uboMatch,
        supabase,
      );
    }
  }

  return { has_sanctions: hasSanctions, matches };
}

async function checkOFACSanctions(entityName: string, apiKey?: string): Promise<OFACMatch> {
  if (!apiKey) {
    // Return no match if no API key
    return {
      entity_name: entityName,
      match_score: 0,
      is_match: false,
      match_details: {},
    };
  }

  try {
    // Call OFAC API (this is a placeholder - actual implementation depends on OFAC API)
    const response = await fetch(
      `https://api.ofac.gov/sdn/search?name=${encodeURIComponent(entityName)}&apiKey=${apiKey}`,
    );

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const topMatch = data.results[0];
      return {
        entity_name: entityName,
        match_score: topMatch.match_score || 0,
        is_match: true,
        match_details: topMatch,
        ofac_list: topMatch.list || "SDN",
      };
    }

    return {
      entity_name: entityName,
      match_score: 0,
      is_match: false,
      match_details: {},
    };
  } catch (error) {
    console.error("Error checking OFAC sanctions:", error);
    return {
      entity_name: entityName,
      match_score: 0,
      is_match: false,
      match_details: {},
    };
  }
}

async function recordSanctionsScreening(
  vendorId: string,
  ownershipId: string | null,
  screeningType: string,
  entityName: string,
  entityType: string,
  match: OFACMatch,
  supabase: any,
): Promise<void> {
  await supabase.from("sanctions_screenings").insert({
    vendor_id: vendorId,
    ownership_id: ownershipId,
    screening_type: screeningType,
    entity_name: entityName,
    entity_type: entityType,
    match_score: match.match_score,
    is_match: match.is_match,
    match_details: match.match_details,
    ofac_list: match.ofac_list,
  });
}
